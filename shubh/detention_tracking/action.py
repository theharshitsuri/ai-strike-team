"""
Action layer for Detention Tracking — calculate fees, generate professional invoices,
Slack alerts for long detentions, and markdown reports.
"""

import json
from datetime import datetime
from pathlib import Path

import yaml

from core.logger import get_logger
from shubh.detention_tracking.validator import DetentionResult, DetentionInvoice

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def calculate_detention(result: DetentionResult) -> DetentionInvoice:
    """
    Rule-based detention fee calculation.
    Pure math + business rules — NOT an LLM task.
    """
    config = _load_config()["thresholds"]

    arrival = datetime.fromisoformat(result.arrival_time)
    departure = datetime.fromisoformat(result.departure_time)
    total_minutes = (departure - arrival).total_seconds() / 60

    free_time = result.free_time_minutes or config["default_free_time_minutes"]
    billable_minutes = max(0, total_minutes - free_time)

    # Cap at max detention hours
    max_minutes = config["max_detention_hours"] * 60
    capped = billable_minutes > max_minutes
    billable_minutes = min(billable_minutes, max_minutes)

    billable_hours = round(billable_minutes / 60, 2)
    rate = config["rate_per_hour"]
    total_charge = round(billable_hours * rate, 2)

    # Determine status
    escalation_threshold = config.get("escalation_over_hours", 8) * 60
    requires_escalation = billable_minutes > escalation_threshold

    if billable_minutes == 0:
        status = "within_free_time"
    elif capped:
        status = "capped"
    elif requires_escalation:
        status = "escalated"
    else:
        status = "billable"

    invoice = DetentionInvoice(
        load_id=result.load_id,
        facility_name=result.facility_name,
        facility_type=result.facility_type,
        carrier_name=result.carrier_name,
        driver_name=result.driver_name,
        arrival_time=result.arrival_time,
        departure_time=result.departure_time,
        total_time_minutes=round(total_minutes, 2),
        free_time_minutes=free_time,
        billable_minutes=round(billable_minutes, 2),
        billable_hours=billable_hours,
        rate_per_hour=rate,
        total_charge=total_charge,
        detention_reason=result.detention_reason,
        detention_reason_detail=result.detention_reason_detail,
        status=status,
        requires_escalation=requires_escalation,
        po_numbers=result.po_numbers,
        confidence=result.confidence,
    )

    # Save to file
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"detention_invoice_{result.load_id}.json"
    with open(out_path, "w") as f:
        json.dump(invoice.model_dump(), f, indent=2, default=str)
    log.info("detention_invoice_created", load_id=result.load_id,
             total_charge=total_charge, status=status,
             escalation=requires_escalation)

    return invoice


def build_slack_alert(invoice: DetentionInvoice) -> dict:
    """Build Slack notification — urgent for escalated detentions."""
    if invoice.status == "within_free_time":
        emoji = "✅"
        urgency = "No detention charge"
    elif invoice.requires_escalation:
        emoji = "🚨"
        urgency = f"ESCALATION: {invoice.billable_hours} hrs detention — ${invoice.total_charge}"
    else:
        emoji = "⏱️"
        urgency = f"Detention: {invoice.billable_hours} hrs — ${invoice.total_charge}"

    return {
        "channel": "logistics-detention",
        "text": f"{emoji} Load {invoice.load_id} — {urgency}",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Detention Alert — Load {invoice.load_id}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Facility:*\n{invoice.facility_name}"},
                {"type": "mrkdwn", "text": f"*Carrier:*\n{invoice.carrier_name}"},
                {"type": "mrkdwn", "text": f"*Total Time:*\n{invoice.total_time_minutes:.0f} min"},
                {"type": "mrkdwn", "text": f"*Free Time:*\n{invoice.free_time_minutes} min"},
                {"type": "mrkdwn", "text": f"*Billable:*\n{invoice.billable_hours} hrs"},
                {"type": "mrkdwn", "text": f"*Charge:*\n${invoice.total_charge:.2f}"},
            ]},
        ],
    }


def generate_invoice_report(invoice: DetentionInvoice) -> str:
    """Generate a professional detention invoice in markdown."""
    escalation_notice = ""
    if invoice.requires_escalation:
        escalation_notice = "\n> ⚠️ **ESCALATION REQUIRED** — Detention exceeds 8 hours. Manager review needed.\n"

    report = f"""# 🧾 Detention Invoice — Load {invoice.load_id}

{escalation_notice}
## Event Details
| Field | Value |
|-------|-------|
| Load # | `{invoice.load_id}` |
| Facility | {invoice.facility_name} ({invoice.facility_type}) |
| Carrier | {invoice.carrier_name} |
| Driver | {invoice.driver_name} |
| Arrival | {invoice.arrival_time} |
| Departure | {invoice.departure_time} |
| Reason | {invoice.detention_reason} |

## Fee Calculation
| Item | Value |
|------|-------|
| Total Time at Facility | {invoice.total_time_minutes:.0f} minutes |
| Free Time Allowed | {invoice.free_time_minutes} minutes |
| **Billable Time** | **{invoice.billable_hours} hours** |
| Rate per Hour | ${invoice.rate_per_hour:.2f} |
| **Total Charge** | **${invoice.total_charge:.2f}** |
| Status | {invoice.status.upper()} |

"""
    if invoice.detention_reason_detail:
        report += f"## Delay Details\n{invoice.detention_reason_detail}\n\n"

    if invoice.po_numbers:
        report += "## Reference Numbers\n" + "\n".join(f"- `{po}`" for po in invoice.po_numbers) + "\n\n"

    report += f"---\n*Confidence: {invoice.confidence:.0%} | Generated: {datetime.utcnow().isoformat()}*\n"

    # Save report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"detention_report_{invoice.load_id}.md"
    with open(report_path, "w") as f:
        f.write(report)

    return report
