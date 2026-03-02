"""
Action layer for Load Scheduling — create calendar events and send notifications.
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
    Build a calendar event from extracted schedule data.
    Returns a Google Calendar-compatible event dict.
    In production, push to Google Calendar API.
    """
    start_dt = datetime.strptime(
        f"{result.appointment_date} {result.appointment_time}", "%Y-%m-%d %H:%M"
    )
    end_dt = start_dt + timedelta(minutes=result.time_window_minutes)

    event = {
        "summary": f"[{result.load_type.upper()}] Load {result.load_id} — {result.facility_name}",
        "location": result.facility_address,
        "description": (
            f"Load ID: {result.load_id}\n"
            f"Type: {result.load_type}\n"
            f"Contact: {result.contact_name} ({result.contact_phone})\n"
            f"Instructions: {result.special_instructions}"
        ),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/New_York"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/New_York"},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 60}]},
    }

    # Save to file for demo / audit
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"event_{result.load_id}.json"
    with open(out_path, "w") as f:
        json.dump(event, f, indent=2)
    log.info("calendar_event_created", load_id=result.load_id, path=str(out_path))

    return event


def build_slack_message(result: LoadScheduleResult) -> dict:
    """Build a Slack notification payload."""
    return {
        "channel": "logistics-scheduling",
        "text": (
            f"📅 *New {result.load_type.upper()} Scheduled*\n"
            f"• Load: `{result.load_id}`\n"
            f"• Facility: {result.facility_name}\n"
            f"• Date/Time: {result.appointment_date} @ {result.appointment_time}\n"
            f"• Window: {result.time_window_minutes} min\n"
            f"• Contact: {result.contact_name}"
        ),
    }


def check_time_conflicts(result: LoadScheduleResult, existing_events: list[dict]) -> list[dict]:
    """
    Check if the proposed appointment conflicts with existing events.
    Returns list of conflicting events.
    """
    start_dt = datetime.strptime(
        f"{result.appointment_date} {result.appointment_time}", "%Y-%m-%d %H:%M"
    )
    end_dt = start_dt + timedelta(minutes=result.time_window_minutes)
    conflicts = []

    for ev in existing_events:
        ev_start = datetime.fromisoformat(ev["start"]["dateTime"])
        ev_end = datetime.fromisoformat(ev["end"]["dateTime"])
        if start_dt < ev_end and end_dt > ev_start:
            conflicts.append(ev)

    return conflicts
