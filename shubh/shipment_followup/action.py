"""
Action layer for Shipment Follow-Up — send emails and Slack escalations.
"""

import json
from pathlib import Path
from datetime import datetime

from core.logger import get_logger
from shubh.shipment_followup.validator import ShipmentStatus, FollowUpEmail

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_followup_email(email: FollowUpEmail, status: ShipmentStatus) -> dict:
    """Save the generated follow-up email to file (in production, send via SMTP/SendGrid)."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    email_payload = {
        "to": f"dispatch@{status.carrier.lower().replace(' ', '')}.com",
        "from": "operations@aistrikeTeam.com",
        "subject": email.subject,
        "body": email.body,
        "urgency": email.urgency,
        "attempt": email.attempt_number,
        "load_id": status.load_id,
        "generated_at": datetime.utcnow().isoformat(),
    }

    out_path = OUTPUT_DIR / f"followup_{status.load_id}_attempt{email.attempt_number}.json"
    with open(out_path, "w") as f:
        json.dump(email_payload, f, indent=2)

    log.info("followup_email_saved", load_id=status.load_id, attempt=email.attempt_number, path=str(out_path))
    return email_payload


def build_escalation_slack_message(status: ShipmentStatus, email: FollowUpEmail) -> dict:
    """Build Slack escalation message for overdue shipments with no response."""
    return {
        "channel": "logistics-escalations",
        "text": (
            f"🚨 *ESCALATION — Overdue Shipment*\n"
            f"• Load: `{status.load_id}`\n"
            f"• Carrier: {status.carrier}\n"
            f"• Route: {status.origin} → {status.destination}\n"
            f"• Expected: {status.expected_delivery}\n"
            f"• Overdue: {status.hours_overdue:.1f} hours\n"
            f"• Follow-up attempts: {email.attempt_number}\n"
            f"• Last status: {status.current_status}\n"
            f"*Action required: Manual intervention needed.*"
        ),
    }
