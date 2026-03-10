"""
Action layer for Warranty Claims — evaluation, reports, customer responses.
"""

import json
from datetime import datetime, timedelta
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
    Rule-based warranty claim evaluation.
    Pure business logic — no LLM needed.
    """
    config = _load_config()["thresholds"]

    # Calculate days since purchase
    try:
        purchase_date = datetime.strptime(claim.purchase_date, "%Y-%m-%d")
        days = (datetime.utcnow() - purchase_date).days
    except (ValueError, TypeError):
        days = -1

    warranty_period = config.get("warranty_period_days", 365)
    max_claim_value = config.get("max_auto_approve_value", 500)
    review_threshold = config.get("review_over_value", 200)

    # Decision logic
    reasons = []

    if days < 0:
        decision = "review"
        reasons.append("Could not determine purchase date")
    elif days > warranty_period:
        decision = "rejected"
        reasons.append(f"Warranty expired ({days} days since purchase, warranty is {warranty_period} days)")
    elif claim.claim_value and claim.claim_value > max_claim_value:
        decision = "review"
        reasons.append(f"Claim value ${claim.claim_value:.2f} exceeds auto-approve limit ${max_claim_value}")
    elif hasattr(claim, "is_duplicate") and claim.is_duplicate:
        decision = "rejected"
        reasons.append("Duplicate claim detected")
    else:
        decision = "approved"
        reasons.append(f"Within warranty ({days}/{warranty_period} days), valid product")

    reason_text = "; ".join(reasons)

    warranty_decision = WarrantyDecision(
        claim_id=claim.claim_id,
        product_name=claim.product_name,
        decision=decision,
        reason=reason_text,
        days_since_purchase=max(days, 0),
        warranty_period_days=warranty_period,
        claim_value=claim.claim_value or 0.0,
        replacement_eligible=decision == "approved" and claim.defect_type in ("manufacturing", "material"),
        confidence=claim.confidence,
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"claim_decision_{claim.claim_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(warranty_decision.model_dump(), f, indent=2, default=str)
    log.info("claim_evaluated", claim_id=claim.claim_id, decision=decision, days=days)

    return warranty_decision


def generate_claim_report(claim: WarrantyClaimData, decision: WarrantyDecision) -> str:
    """Generate professional claim processing report."""
    decision_emoji = {"approved": "✅", "rejected": "❌", "review": "⚠️"}.get(decision.decision, "⚠️")

    report = f"""# {decision_emoji} Warranty Claim Report — {decision.claim_id}

## Decision: {decision.decision.upper()}
**Reason:** {decision.reason}

## Claim Details
| Field | Value |
|-------|-------|
| Claim ID | `{claim.claim_id}` |
| Product | {claim.product_name} |
| Serial # | {claim.serial_number} |
| Purchase Date | {claim.purchase_date} |
| Days Since Purchase | {decision.days_since_purchase} |
| Warranty Period | {decision.warranty_period_days} days |
| Defect Type | {claim.defect_type} |
| Claim Value | ${decision.claim_value:.2f} |
| Replacement Eligible | {'✅ Yes' if decision.replacement_eligible else '❌ No'} |

## Customer Information
| Field | Value |
|-------|-------|
| Name | {claim.customer_name} |
| Email | {claim.customer_email} |

## Defect Description
{claim.defect_description}

---
*Confidence: {decision.confidence:.0%} | Processed: {datetime.utcnow().isoformat()}*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"claim_report_{claim.claim_id}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    return report


def build_claim_slack_alert(claim: WarrantyClaimData, decision: WarrantyDecision) -> dict:
    """Slack alert for claim decisions."""
    emoji = {"approved": "✅", "rejected": "❌", "review": "⚠️"}.get(decision.decision, "📋")

    return {
        "channel": "warranty-claims",
        "text": f"{emoji} Claim {claim.claim_id} — {decision.decision.upper()} ({claim.product_name})",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Warranty Claim — {decision.decision.upper()}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Claim ID:*\n`{claim.claim_id}`"},
                {"type": "mrkdwn", "text": f"*Product:*\n{claim.product_name}"},
                {"type": "mrkdwn", "text": f"*Customer:*\n{claim.customer_name}"},
                {"type": "mrkdwn", "text": f"*Value:*\n${decision.claim_value:.2f}"},
                {"type": "mrkdwn", "text": f"*Days Old:*\n{decision.days_since_purchase}"},
                {"type": "mrkdwn", "text": f"*Decision:*\n{decision.decision.upper()}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Reason:* {decision.reason}"}},
        ],
    }


def draft_customer_response(claim: WarrantyClaimData, decision: WarrantyDecision) -> dict:
    """Draft a professional response to the customer."""
    if decision.decision == "approved":
        body = (
            f"Dear {claim.customer_name},\n\n"
            f"Thank you for submitting your warranty claim (#{claim.claim_id}) for the {claim.product_name}.\n\n"
            f"We have reviewed your claim and are pleased to inform you that it has been APPROVED.\n\n"
            f"{'We will ship a replacement unit to you within 5-7 business days.' if decision.replacement_eligible else 'We will process a refund of $' + f'{decision.claim_value:.2f} within 10 business days.'}\n\n"
            f"If you have any questions, please don't hesitate to reach out.\n\n"
            f"Best regards,\nWarranty Department"
        )
    elif decision.decision == "rejected":
        body = (
            f"Dear {claim.customer_name},\n\n"
            f"Thank you for submitting your warranty claim (#{claim.claim_id}) for the {claim.product_name}.\n\n"
            f"After careful review, we regret to inform you that your claim has been DECLINED.\n\n"
            f"Reason: {decision.reason}\n\n"
            f"If you believe this decision was made in error, you may appeal by contacting our support team.\n\n"
            f"Best regards,\nWarranty Department"
        )
    else:
        body = (
            f"Dear {claim.customer_name},\n\n"
            f"Thank you for submitting your warranty claim (#{claim.claim_id}) for the {claim.product_name}.\n\n"
            f"Your claim is currently under review. A specialist will reach out within 2 business days.\n\n"
            f"Best regards,\nWarranty Department"
        )

    return {
        "to": claim.customer_email,
        "subject": f"Warranty Claim #{claim.claim_id} — {decision.decision.upper()}",
        "body": body,
    }
