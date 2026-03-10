"""
Action layer for Shipment Follow-Up — save emails, escalation alerts, and reports.
"""

import json
from datetime import datetime
from pathlib import Path

from core.logger import get_logger
from shubh.shipment_followup.validator import ShipmentStatus, FollowUpEmail

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_followup_email(email: FollowUpEmail, status: ShipmentStatus) -> dict:
    """Save the follow-up email draft to file and return the payload."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "to": status.carrier_contact_email,
        "subject": email.subject,
        "body": email.body,
        "urgency": email.urgency,
        "load_id": status.load_id,
        "carrier": status.carrier,
        "generated_at": datetime.utcnow().isoformat(),
    }

    out_path = OUTPUT_DIR / f"followup_{status.load_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    log.info("followup_email_saved", load_id=status.load_id, path=str(out_path))

    return payload


def build_escalation_slack_message(status: ShipmentStatus, email: FollowUpEmail) -> dict:
    """Build urgent Slack escalation for unresolved shipments."""
    return {
        "channel": "logistics-escalations",
        "text": f"🚨 ESCALATION — Load {status.load_id} ({status.carrier}) overdue by {status.hours_overdue} hrs",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"🚨 Shipment Escalation — Load {status.load_id}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Carrier:*\n{status.carrier}"},
                {"type": "mrkdwn", "text": f"*Status:*\n{status.current_status}"},
                {"type": "mrkdwn", "text": f"*Route:*\n{status.origin} → {status.destination}"},
                {"type": "mrkdwn", "text": f"*Hours Overdue:*\n{status.hours_overdue}"},
                {"type": "mrkdwn", "text": f"*Last Location:*\n{status.last_known_location}"},
                {"type": "mrkdwn", "text": f"*Customer:*\n{status.customer_name}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Recommended:* {email.recommended_action}"}},
        ],
    }


def generate_followup_report(status: ShipmentStatus, email: FollowUpEmail, attempt: int) -> str:
    """Generate markdown report for the follow-up action."""
    urgency_emoji = {"routine": "📧", "urgent": "⚠️", "critical": "🚨"}.get(email.urgency, "📧")

    report = f"""# {urgency_emoji} Shipment Follow-Up Report

## Shipment Details
| Field | Value |
|-------|-------|
| Load # | `{status.load_id}` |
| Carrier | {status.carrier} |
| Route | {status.origin} → {status.destination} |
| Expected Delivery | {status.expected_delivery} |
| Current Status | {status.current_status} |
| Last Location | {status.last_known_location} |
| Hours Overdue | {status.hours_overdue} |
| Customer | {status.customer_name} |

## Follow-Up Email (Attempt #{attempt})
**Subject:** {email.subject}

**Urgency:** {email.urgency.upper()}

**Body:**
> {email.body.replace(chr(10), chr(10) + '> ')}

## Next Steps
{email.recommended_action}

{"## 🚨 ESCALATED TO MANAGEMENT" if email.should_escalate else ""}

---
*Confidence: {status.confidence:.0%} | Generated: {datetime.utcnow().isoformat()}*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"followup_report_{status.load_id}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    return report
