"""
Detention Tracking Automation — Timestamps → Detention Invoice

Parses arrival/departure data, calculates detention fees based on
contract terms, and generates invoice drafts.

Usage:
    python -m shubh.detention_tracking.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.detention_tracking.extractor import extract_detention
from shubh.detention_tracking.validator import DetentionResult, DetentionInvoice
from shubh.detention_tracking.action import calculate_detention

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_detention.txt"


class DetentionTrackingWorkflow(BaseWorkflow):
    name = "detention_tracking"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> DetentionResult:
        return await extract_detention(raw_text)

    async def act(self, result: DetentionResult) -> dict:
        invoice = calculate_detention(result)
        return {
            "invoice": invoice.model_dump(),
            "summary": (
                f"Load {invoice.load_id}: {invoice.total_time_minutes} min total, "
                f"{invoice.billable_hours} hrs billable @ ${invoice.rate_per_hour}/hr = "
                f"${invoice.total_charge} ({invoice.status})"
            ),
        }


async def _main():
    wf = DetentionTrackingWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
