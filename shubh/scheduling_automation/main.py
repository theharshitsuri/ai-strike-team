"""
Generic Scheduling Automation — Request → Availability → Confirm

Cross-vertical reusable scheduling workflow. Parses free-text scheduling
requests, checks availability, optimizes time slots, and generates confirmations.

Usage:
    python -m shubh.scheduling_automation.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.scheduling_automation.extractor import extract_schedule_request, generate_confirmation
from shubh.scheduling_automation.validator import ScheduleRequest, ScheduleConfirmation
from shubh.scheduling_automation.action import check_availability, save_confirmation

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

    async def extract(self, raw_text: str) -> ScheduleRequest:
        return await extract_schedule_request(raw_text)

    async def act(self, result: ScheduleRequest) -> dict:
        # Check availability (empty calendar in demo)
        available, conflicts, slot = check_availability(result, existing_events=[])

        if not available:
            return {
                "status": "no_slot_available",
                "conflicts": conflicts,
                "message": "Could not find an available slot. Manual intervention needed.",
            }

        # Generate confirmation message
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

        return {
            "confirmation": confirmation.model_dump(),
            "summary": (
                f"Scheduled: {confirmation.confirmed_date} @ {confirmation.confirmed_time} "
                f"({result.duration_minutes} min) at {result.location}"
            ),
        }


async def _main():
    wf = SchedulingAutomationWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
