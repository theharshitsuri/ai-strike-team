"""
Generic Scheduling Automation — Request → Availability → Confirm

Production-ready workflow:
1. Ingests free-text scheduling requests (emails, forms, messages)
2. Validates input contains scheduling-related content
3. Extracts date, time, duration, participants, location via LLM
4. Checks availability against existing calendar
5. Optimizes time slot if preferred is unavailable
6. Generates professional confirmation message
7. Saves confirmation to output
8. Calculates ROI (10 min manual scheduling → seconds automated)

Usage:
    python -m shubh.scheduling_automation.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from core.plugins.slack import post_message as slack_post
from shubh.scheduling_automation.extractor import extract_schedule_request, generate_confirmation
from shubh.scheduling_automation.validator import ScheduleRequest, ScheduleConfirmation
from shubh.scheduling_automation.action import check_availability, save_confirmation, generate_scheduling_report

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_request.txt"


class SchedulingAutomationWorkflow(BaseWorkflow):
    name = "scheduling_automation"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["schedule", "meeting", "appointment", "available", "book", "calendar",
                     "time", "date", "slot", "call", "visit", "demo", "interview"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be a scheduling request. Expected keywords like 'schedule', 'meeting', 'appointment', 'available', etc."
        return None

    async def extract(self, raw_text: str) -> ScheduleRequest:
        return await extract_schedule_request(raw_text)

    async def act(self, result: ScheduleRequest) -> dict:
        available, conflicts, slot = check_availability(result, existing_events=[])

        if not available:
            return {
                "status": "no_slot_available",
                "conflicts": conflicts,
                "summary": "❌ No available slot found. Manual intervention needed.",
            }

        conf_data = await generate_confirmation(result)

        confirmation = ScheduleConfirmation(
            request_id=result.request_id,
            confirmed_date=slot.date,
            confirmed_time=slot.start_time,
            duration_minutes=result.duration_minutes,
            location=result.location,
            participants=result.participants,
            confirmation_subject=conf_data.get("subject", ""),
            confirmation_body=conf_data.get("body", ""),
            conflicts_found=len(conflicts),
            slot_optimized=slot.start_time != result.preferred_time,
            confidence=result.confidence,
        )

        save_confirmation(confirmation)
        report = generate_scheduling_report(result, confirmation)

        return {
            "summary": f"✅ Scheduled: {confirmation.confirmed_date} @ {confirmation.confirmed_time} ({result.duration_minutes} min) at {result.location}",
            "confirmation": confirmation.model_dump(),
            "report_preview": report[:500],
            "slot_optimized": confirmation.slot_optimized,
        }


async def _main():
    wf = SchedulingAutomationWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
