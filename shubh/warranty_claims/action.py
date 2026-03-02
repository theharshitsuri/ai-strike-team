"""
Action layer for Warranty Claims — validate rules and make decision.
"""

import json
from datetime import datetime
from pathlib import Path

import yaml

from core.logger import get_logger
from shubh.warranty_claims.validator import WarrantyClaimData, WarrantyDecision

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def evaluate_claim(claim: WarrantyClaimData) -> WarrantyDecision:
    """
    Rule-based warranty evaluation. No LLM — pure business logic.
    """
    config = _load_config()["rules"]

    # Calculate days since purchase
    purchase_dt = datetime.strptime(claim.purchase_date, "%Y-%m-%d")
    claim_dt = datetime.strptime(claim.claim_date, "%Y-%m-%d")
    days_since = (claim_dt - purchase_dt).days

    # Check warranty periods
    within_warranty = days_since <= config["warranty_period_days"]
    within_extended = days_since <= config["extended_warranty_days"]

    # Validate product ID
    valid_prefixes = config["valid_product_prefixes"]
    valid_product = any(claim.product_id.upper().startswith(p) for p in valid_prefixes)

    # Decision logic
    reasons = []

    if days_since < 0:
        decision = "rejected"
        reasons.append("Claim date is before purchase date — invalid")
    elif not valid_product:
        decision = "review"
        reasons.append(f"Product ID '{claim.product_id}' does not match known prefixes")
    elif not within_warranty and not within_extended:
        decision = "rejected"
        reasons.append(f"Warranty expired: {days_since} days since purchase (max {config['extended_warranty_days']})")
    elif within_warranty and days_since <= config["auto_approve_max_days"]:
        decision = "approved"
        reasons.append(f"Within auto-approval window ({days_since} days, max {config['auto_approve_max_days']})")
        auto_approved = True
    elif within_warranty:
        decision = "approved"
        reasons.append(f"Within standard warranty ({days_since} days)")
    elif within_extended:
        decision = "review"
        reasons.append(f"In extended warranty period ({days_since} days) — requires manager approval")
    else:
        decision = "review"
        reasons.append("Edge case — manual review required")

    result = WarrantyDecision(
        claim_id=claim.claim_id,
        customer_name=claim.customer_name,
        product_id=claim.product_id,
        decision=decision,
        reason="; ".join(reasons),
        days_since_purchase=days_since,
        within_warranty=within_warranty,
        within_extended_warranty=within_extended,
        valid_product=valid_product,
        auto_approved=decision == "approved" and days_since <= config["auto_approve_max_days"],
        confidence=claim.confidence,
    )

    # Save decision
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"decision_{claim.claim_id}.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)

    log.info("warranty_decision", claim_id=claim.claim_id, decision=decision, days=days_since)
    return result
