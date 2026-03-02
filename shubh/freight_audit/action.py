"""
Action layer for Freight Audit — compare line items and generate audit report.
"""

import json
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
    No LLM here — pure business logic.
    """
    config = _load_config()["thresholds"]
    line_tol = config["line_item_tolerance"]
    total_tol = config["total_tolerance"]

    # Index line items by normalized description
    inv_items = {item.description.lower().strip(): item.amount for item in invoice.line_items}
    rc_items = {item.description.lower().strip(): item.amount for item in rate_con.line_items}

    all_charges = set(inv_items.keys()) | set(rc_items.keys())
    mismatches: list[LineItemMismatch] = []
    overcharge_total = 0.0

    for charge in sorted(all_charges):
        inv_amt = inv_items.get(charge, 0.0)
        rc_amt = rc_items.get(charge, 0.0)
        diff = round(inv_amt - rc_amt, 2)

        if charge not in inv_items:
            status = "missing_from_invoice"
        elif charge not in rc_items:
            status = "missing_from_ratecon"
        elif abs(diff) <= line_tol:
            status = "match"
        elif diff > 0:
            status = "over"
            overcharge_total += diff
        else:
            status = "under"

        mismatches.append(LineItemMismatch(
            charge_type=charge,
            invoice_amount=inv_amt,
            rate_con_amount=rc_amt,
            difference=diff,
            status=status,
        ))

    total_diff = round(invoice.total_amount - rate_con.total_amount, 2)

    # Determine verdict
    has_fails = any(m.status in ("over", "under", "missing_from_invoice", "missing_from_ratecon") for m in mismatches)
    if not has_fails and abs(total_diff) <= total_tol:
        verdict = "pass"
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
        mismatches=mismatches,
        verdict=verdict,
        overcharge_amount=round(overcharge_total, 2),
        confidence=min(invoice.confidence, rate_con.confidence),
    )

    # Save audit report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"audit_{invoice.load_id}.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    log.info("audit_complete", load_id=invoice.load_id, verdict=verdict, overcharge=overcharge_total)

    return result
