"""
Action layer for Detention Tracking — calculate fees and generate invoice drafts.
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
    This is NOT an LLM task — pure math + business rules.
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

    if billable_minutes == 0:
        status = "within_free_time"
    elif capped:
        status = "capped"
    else:
        status = "billable"

    invoice = DetentionInvoice(
        load_id=result.load_id,
        facility_name=result.facility_name,
        carrier_name=result.carrier_name,
        total_time_minutes=round(total_minutes, 2),
        free_time_minutes=free_time,
        billable_minutes=round(billable_minutes, 2),
        billable_hours=billable_hours,
        rate_per_hour=rate,
        total_charge=total_charge,
        detention_reason=result.detention_reason,
        status=status,
        confidence=result.confidence,
    )

    # Save to file
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"detention_invoice_{result.load_id}.json"
    with open(out_path, "w") as f:
        json.dump(invoice.model_dump(), f, indent=2, default=str)
    log.info("detention_invoice_created", load_id=result.load_id, total_charge=total_charge, status=status)

    return invoice
