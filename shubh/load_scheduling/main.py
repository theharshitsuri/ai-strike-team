"""
Load Scheduling Automation — Email → Calendar Event

Parses scheduling emails from shippers/brokers, extracts load details,
checks for conflicts, and creates calendar events + Slack notifications.

Usage:
    python -m shubh.load_scheduling.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.load_scheduling.extractor import extract_schedule
from shubh.load_scheduling.validator import LoadScheduleResult
from shubh.load_scheduling.action import create_calendar_event, build_slack_message, check_time_conflicts

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_email.txt"


class LoadSchedulingWorkflow(BaseWorkflow):
    name = "load_scheduling"

    async def ingest(self, input_data: Any) -> str:
        """Accept file path or raw email text."""
        if isinstance(input_data, dict) and "body" in input_data:
            # Direct email dict from email ingestion
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> LoadScheduleResult:
        return await extract_schedule(raw_text)

    async def act(self, result: LoadScheduleResult) -> dict:
        # Check conflicts (empty list in demo mode)
        conflicts = check_time_conflicts(result, existing_events=[])
        if conflicts:
            log.warning("scheduling_conflict", load_id=result.load_id, count=len(conflicts))

        # Create calendar event
        event = create_calendar_event(result)

        # Build Slack notification
        slack_msg = build_slack_message(result)

        return {
            "calendar_event": event,
            "slack_message": slack_msg,
            "conflicts": conflicts,
        }


# ── CLI Entry Point ──────────────────────────────────────────────────────────

async def _main():
    wf = LoadSchedulingWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
