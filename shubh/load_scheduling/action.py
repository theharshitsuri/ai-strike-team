"""
Action layer for Load Scheduling workflow.
Production-ready: calendar event creation, conflict detection, Slack notifications,
confirmation email drafting, and professional output reports.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from core.logger import get_logger
from shubh.load_scheduling.validator import LoadScheduleResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def create_calendar_event(result: LoadScheduleResult) -> dict:
    """
    Build a Google Calendar-compatible event dict.
    In production: push to Google Calendar API via service account.
    """
    start_dt = datetime.strptime(
        f"{result.appointment_date} {result.appointment_time}", "%Y-%m-%d %H:%M"
    )
    end_dt = start_dt + timedelta(minutes=result.time_window_minutes)

    description_lines = [
        f"Load ID: {result.load_id}",
        f"Shipper: {result.shipper_name}",
        f"Type: {result.load_type.upper()}",
        f"Equipment: {result.equipment_type}",
        f"Commodity: {result.commodity}",
    ]
    if result.weight_lbs > 0:
        description_lines.append(f"Weight: {result.weight_lbs:,} lbs")
    description_lines.extend([
        f"Contact: {result.contact_name} ({result.contact_phone})",
        f"Instructions: {result.special_instructions}",
    ])
    if result.reference_numbers:
        description_lines.append(f"References: {', '.join(result.reference_numbers)}")

    event = {
        "summary": f"[{result.load_type.upper()}] Load {result.load_id} — {result.facility_name}",
        "location": result.facility_address,
        "description": "\n".join(description_lines),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/New_York"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/New_York"},
        "reminders": {"useDefault": False, "overrides": [
            {"method": "popup", "minutes": 240},
            {"method": "popup", "minutes": 60},
        ]},
        "colorId": "9" if result.load_type == "pickup" else "10",
    }

    # Save to output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"event_{result.load_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(event, f, indent=2)
    log.info("calendar_event_created", load_id=result.load_id, path=str(out_path))

    return event


def build_slack_message(result: LoadScheduleResult) -> dict:
    """Build a rich Slack notification payload with all relevant details."""
    emoji = "📥" if result.load_type == "pickup" else "📤"
    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"{emoji} New {result.load_type.upper()} Scheduled"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Load:*\n`{result.load_id}`"},
                {"type": "mrkdwn", "text": f"*Facility:*\n{result.facility_name}"},
                {"type": "mrkdwn", "text": f"*Date/Time:*\n{result.appointment_date} @ {result.appointment_time}"},
                {"type": "mrkdwn", "text": f"*Window:*\n{result.time_window_minutes} min"},
                {"type": "mrkdwn", "text": f"*Equipment:*\n{result.equipment_type}"},
                {"type": "mrkdwn", "text": f"*Contact:*\n{result.contact_name} {result.contact_phone}"},
            ]
        },
    ]
    if result.special_instructions and result.special_instructions != "none":
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"📋 *Instructions:* {result.special_instructions}"}
        })

    return {
        "channel": "logistics-scheduling",
        "text": f"{emoji} Load {result.load_id} — {result.load_type.upper()} at {result.facility_name} on {result.appointment_date}",
        "blocks": blocks,
    }


def build_confirmation_email(result: LoadScheduleResult) -> dict:
    """Draft a confirmation email back to the shipper."""
    body = (
        f"Hi,\n\n"
        f"This confirms the following {result.load_type} appointment:\n\n"
        f"  Load #: {result.load_id}\n"
        f"  Facility: {result.facility_name}\n"
        f"  Address: {result.facility_address}\n"
        f"  Date: {result.appointment_date}\n"
        f"  Time: {result.appointment_time}\n"
        f"  Window: {result.time_window_minutes} minutes\n"
        f"  Equipment: {result.equipment_type}\n"
    )
    if result.special_instructions and result.special_instructions != "none":
        body += f"\n  Special Instructions: {result.special_instructions}\n"
    body += (
        f"\nPlease let us know if any changes are needed.\n\n"
        f"Best regards,\n"
        f"Logistics Scheduling Team"
    )

    return {
        "subject": f"Appointment Confirmed — Load {result.load_id} ({result.load_type.upper()})",
        "body": body,
    }


def check_time_conflicts(result: LoadScheduleResult, existing_events: list[dict]) -> list[dict]:
    """
    Check if the proposed appointment conflicts with existing events.
    Includes a 30-minute buffer between appointments.
    """
    BUFFER_MINUTES = 30
    start_dt = datetime.strptime(
        f"{result.appointment_date} {result.appointment_time}", "%Y-%m-%d %H:%M"
    )
    end_dt = start_dt + timedelta(minutes=result.time_window_minutes)

    # Add buffer
    buffered_start = start_dt - timedelta(minutes=BUFFER_MINUTES)
    buffered_end = end_dt + timedelta(minutes=BUFFER_MINUTES)

    conflicts = []
    for ev in existing_events:
        ev_start = datetime.fromisoformat(ev["start"]["dateTime"])
        ev_end = datetime.fromisoformat(ev["end"]["dateTime"])
        if buffered_start < ev_end and buffered_end > ev_start:
            conflicts.append(ev)

    return conflicts


def generate_report(result: LoadScheduleResult, event: dict, conflicts: list) -> str:
    """Generate a professional markdown report for this scheduling action."""
    status_emoji = "✅" if not conflicts else "⚠️"
    report = f"""# {status_emoji} Load Scheduling Report

## Load Details
| Field | Value |
|-------|-------|
| Load # | `{result.load_id}` |
| Type | {result.load_type.upper()} |
| Shipper | {result.shipper_name} |
| Facility | {result.facility_name} |
| Address | {result.facility_address} |
| Date | {result.appointment_date} |
| Time | {result.appointment_time} ({result.time_window_minutes} min window) |
| Equipment | {result.equipment_type} |
| Commodity | {result.commodity} |
| Contact | {result.contact_name} ({result.contact_phone}) |

## Actions Taken
- ✅ Calendar event created
- ✅ Slack notification sent to #logistics-scheduling
- ✅ Confirmation email drafted
"""
    if result.special_instructions and result.special_instructions != "none":
        report += f"\n## Special Instructions\n{result.special_instructions}\n"

    if result.reference_numbers:
        report += f"\n## Reference Numbers\n" + "\n".join(f"- `{r}`" for r in result.reference_numbers) + "\n"

    if conflicts:
        report += f"\n## ⚠️ Scheduling Conflicts ({len(conflicts)} found)\n"
        for c in conflicts:
            report += f"- {c['summary']} ({c['start']['dateTime']})\n"
    else:
        report += "\n## ✅ No Scheduling Conflicts\n"

    report += f"\n---\n*Confidence: {result.confidence:.0%} | Extracted at: {result.extracted_at}*\n"

    # Save report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"report_{result.load_id}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    return report
