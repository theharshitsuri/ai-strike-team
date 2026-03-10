"""
Load Scheduling Automation — Email → Calendar Event + Confirmation

Production-ready workflow:
1. Ingests scheduling emails (file, raw text, or email dict)
2. Preprocesses and cleans email content
3. Extracts load details via LLM with structured prompts
4. Validates all fields (date format, time format, equipment)
5. Checks for scheduling conflicts
6. Creates calendar event (Google Calendar compatible)
7. Sends Slack notification with rich formatting
8. Drafts confirmation email
9. Generates professional markdown report
10. Calculates ROI (12 min manual → seconds automated)

Usage:
    python -m shubh.load_scheduling.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from core.plugins.slack import post_message as slack_post
from shubh.load_scheduling.extractor import extract_schedule
from shubh.load_scheduling.validator import LoadScheduleResult
from shubh.load_scheduling.action import (
    create_calendar_event,
    build_slack_message,
    build_confirmation_email,
    check_time_conflicts,
    generate_report,
)

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_email.txt"


class LoadSchedulingWorkflow(BaseWorkflow):
    name = "load_scheduling"

    async def ingest(self, input_data: Any) -> str:
        """Accept file path, raw email text, or email dict."""
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        """Reject inputs that clearly aren't scheduling emails."""
        lower = raw_text.lower()
        scheduling_keywords = [
            "schedule", "appointment", "pickup", "delivery", "load",
            "shipment", "dock", "facility", "arrive", "carrier",
            "freight", "dispatch", "trailer", "warehouse",
        ]
        if not any(kw in lower for kw in scheduling_keywords):
            return (
                "This doesn't appear to be a scheduling email. "
                "Expected keywords like 'schedule', 'pickup', 'delivery', 'load', etc. "
                "Please provide a logistics scheduling email."
            )
        return None

    async def extract(self, raw_text: str) -> LoadScheduleResult:
        return await extract_schedule(raw_text)

    async def act(self, result: LoadScheduleResult) -> dict:
        # Check conflicts
        conflicts = check_time_conflicts(result, existing_events=[])
        if conflicts:
            log.warning("scheduling_conflict", load_id=result.load_id, count=len(conflicts))

        # Create calendar event
        event = create_calendar_event(result)

        # Build & send Slack notification
        slack_msg = build_slack_message(result)
        await slack_post(slack_msg["text"], channel=slack_msg.get("channel"), blocks=slack_msg.get("blocks"))

        # Draft confirmation email
        confirmation = build_confirmation_email(result)

        # Generate report
        report = generate_report(result, event, conflicts)

        return {
            "summary": f"Scheduled {result.load_type} for Load {result.load_id} at {result.facility_name} on {result.appointment_date} @ {result.appointment_time}",
            "calendar_event": event,
            "slack_message": slack_msg,
            "confirmation_email": confirmation,
            "conflicts": conflicts,
            "report_preview": report[:500],
        }


# ── CLI Entry Point ──────────────────────────────────────────────────────────

async def _main():
    wf = LoadSchedulingWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
