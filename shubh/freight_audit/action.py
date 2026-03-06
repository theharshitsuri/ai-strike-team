"""
Action layer for Freight Audit — compare charges, generate audit report,
Slack alerts for overcharges, and professional markdown reports.
"""

import json
from datetime import datetime
from pathlib import Path

import yaml

from core.logger import get_logger
from shubh.freight_audit.validator import (
    InvoiceData, RateConData, FreightAuditResult, LineItemMismatch
)

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def compare_charges(invoice: InvoiceData, rate_con: RateConData) -> FreightAuditResult:
    """
    Rule-based comparison of invoice vs rate confirmation.
    Pure business logic — no LLM needed.
    """
    config = _load_config()["thresholds"]
    line_tol = config["line_item_tolerance"]
    total_tol = config["total_tolerance"]
    auto_approve = config.get("auto_approve_under", 5.00)
    escalate_over = config.get("escalate_over", 100.00)

    inv_items = {item.description.lower().strip(): item.amount for item in invoice.line_items}
    rc_items = {item.description.lower().strip(): item.amount for item in rate_con.line_items}

    all_charges = set(inv_items.keys()) | set(rc_items.keys())
    mismatches: list[LineItemMismatch] = []
    overcharge_total = 0.0
    undercharge_total = 0.0

    for charge in sorted(all_charges):
        inv_amt = inv_items.get(charge, 0.0)
        rc_amt = rc_items.get(charge, 0.0)
        diff = round(inv_amt - rc_amt, 2)
        pct = round(diff / rc_amt * 100, 1) if rc_amt != 0 else 0.0

        if charge not in inv_items:
            status = "missing_from_invoice"
        elif charge not in rc_items:
            status = "missing_from_ratecon"
            overcharge_total += inv_amt  # charge not in agreement
        elif abs(diff) <= line_tol:
            status = "match"
        elif diff > 0:
            status = "over"
            overcharge_total += diff
        else:
            status = "under"
            undercharge_total += abs(diff)

        mismatches.append(LineItemMismatch(
            charge_type=charge,
            invoice_amount=inv_amt,
            rate_con_amount=rc_amt,
            difference=diff,
            pct_difference=pct,
            status=status,
        ))

    total_diff = round(invoice.total_amount - rate_con.total_amount, 2)
    pct_total = round(total_diff / rate_con.total_amount * 100, 1) if rate_con.total_amount != 0 else 0.0

    # Determine verdict
    has_issues = any(m.status in ("over", "under", "missing_from_ratecon") for m in mismatches)
    requires_escalation = overcharge_total > escalate_over

    if not has_issues and abs(total_diff) <= total_tol:
        verdict = "pass"
    elif abs(total_diff) <= auto_approve:
        verdict = "auto_approved"
    elif requires_escalation:
        verdict = "escalated"
    elif overcharge_total > 0:
        verdict = "fail"
    else:
        verdict = "review"

    result = FreightAuditResult(
        load_id=invoice.load_id,
        carrier_name=invoice.carrier_name,
        invoice_number=invoice.invoice_number,
        invoice_total=invoice.total_amount,
        rate_con_total=rate_con.total_amount,
        total_difference=total_diff,
        pct_difference=pct_total,
        mismatches=mismatches,
        verdict=verdict,
        overcharge_amount=round(overcharge_total, 2),
        undercharge_amount=round(undercharge_total, 2),
        requires_escalation=requires_escalation,
        confidence=min(invoice.confidence, rate_con.confidence),
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"audit_{invoice.load_id}.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    log.info("audit_complete", load_id=invoice.load_id, verdict=verdict,
             overcharge=overcharge_total, total_diff=total_diff)

    return result


def build_audit_slack_alert(audit: FreightAuditResult) -> dict:
    """Slack alert for audit results — urgent for overcharges."""
    emoji = {"pass": "✅", "auto_approved": "✅", "fail": "❌", "escalated": "🚨", "review": "⚠️"}.get(audit.verdict, "⚠️")
    issues = [m for m in audit.mismatches if m.status != "match"]

    return {
        "channel": "freight-audit",
        "text": f"{emoji} Audit {audit.load_id} — {audit.verdict.upper()} — ${audit.overcharge_amount} overcharge",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Freight Audit — Load {audit.load_id}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Carrier:*\n{audit.carrier_name}"},
                {"type": "mrkdwn", "text": f"*Invoice #:*\n{audit.invoice_number}"},
                {"type": "mrkdwn", "text": f"*Invoice Total:*\n${audit.invoice_total:.2f}"},
                {"type": "mrkdwn", "text": f"*Rate Con Total:*\n${audit.rate_con_total:.2f}"},
                {"type": "mrkdwn", "text": f"*Difference:*\n${audit.total_difference:.2f} ({audit.pct_difference:.1f}%)"},
                {"type": "mrkdwn", "text": f"*Verdict:*\n{audit.verdict.upper()}"},
            ]},
        ] + ([{"type": "section", "text": {"type": "mrkdwn", "text": f"*Issues:*\n" + "\n".join(f"• {m.charge_type}: ${m.difference:+.2f}" for m in issues[:5])}}] if issues else []),
    }


def generate_audit_report(audit: FreightAuditResult) -> str:
    """Generate a professional markdown freight audit report."""
    verdict_emoji = {"pass": "✅", "auto_approved": "✅", "fail": "❌", "escalated": "🚨", "review": "⚠️"}.get(audit.verdict, "⚠️")

    rows = ""
    for m in audit.mismatches:
        status_icon = {"match": "✅", "over": "🔴", "under": "🔵", "missing_from_ratecon": "🟡", "missing_from_invoice": "🟡"}.get(m.status, "")
        rows += f"| {status_icon} {m.charge_type} | ${m.invoice_amount:.2f} | ${m.rate_con_amount:.2f} | ${m.difference:+.2f} | {m.status} |\n"

    escalation_notice = ""
    if audit.requires_escalation:
        escalation_notice = "\n> 🚨 **ESCALATION REQUIRED** — Overcharge exceeds $100. Manager approval needed.\n"

    report = f"""# {verdict_emoji} Freight Audit Report — Load {audit.load_id}

{escalation_notice}
## Summary
| Field | Value |
|-------|-------|
| Load # | `{audit.load_id}` |
| Carrier | {audit.carrier_name} |
| Invoice # | {audit.invoice_number} |
| Invoice Total | ${audit.invoice_total:.2f} |
| Rate Con Total | ${audit.rate_con_total:.2f} |
| **Difference** | **${audit.total_difference:+.2f}** ({audit.pct_difference:+.1f}%) |
| **Overcharge** | **${audit.overcharge_amount:.2f}** |
| Verdict | **{audit.verdict.upper()}** |

## Line Item Comparison
| Charge | Invoice | Rate Con | Difference | Status |
|--------|---------|----------|------------|--------|
{rows}
## Actions
{"- ✅ Invoice matches rate confirmation — approve for payment" if audit.verdict in ("pass", "auto_approved") else ""}
{"- ❌ Dispute required — overcharge of $" + f"{audit.overcharge_amount:.2f} detected" if audit.verdict == "fail" else ""}
{"- 🚨 Escalated to management — overcharge of $" + f"{audit.overcharge_amount:.2f}" if audit.verdict == "escalated" else ""}
{"- ⚠️ Manual review needed" if audit.verdict == "review" else ""}

---
*Confidence: {audit.confidence:.0%} | Generated: {datetime.utcnow().isoformat()}*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"audit_report_{audit.load_id}.md"
    with open(report_path, "w") as f:
        f.write(report)

    return report
