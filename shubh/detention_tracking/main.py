"""
Detention Tracking Automation — Timestamps → Detention Invoice

Production-ready workflow:
1. Ingests detention records (emails, check-call logs, facility reports)
2. Validates input contains timestamp data
3. Extracts arrival/departure timestamps via LLM
4. Calculates detention fees using rule-based engine (pure math)
5. Detects escalation-worthy detentions (>8 hours)
6. Generates professional invoice with full breakdown
7. Sends Slack alerts (🚨 urgent for escalations)
8. Calculates ROI (20 min manual → seconds automated)

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
from shubh.detention_tracking.action import calculate_detention, build_slack_alert, generate_invoice_report

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

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        time_keywords = ["arrival", "depart", "check", "arrived", "left", "am", "pm", "time",
                         "dock", "detention", "waiting", "loaded", "unloaded", "gate"]
        if not any(kw in lower for kw in time_keywords):
            return (
                "This doesn't appear to contain detention/timestamp data. "
                "Expected keywords like 'arrival', 'departure', 'detention', 'dock', 'waiting', etc."
            )
        return None

    async def extract(self, raw_text: str) -> DetentionResult:
        return await extract_detention(raw_text)

    async def act(self, result: DetentionResult) -> dict:
        # Calculate detention fees
        invoice = calculate_detention(result)

        # Build Slack alert
        slack = build_slack_alert(invoice)

        # Generate professional invoice report
        report = generate_invoice_report(invoice)

        return {
            "summary": (
                f"Load {invoice.load_id}: {invoice.total_time_minutes:.0f} min at facility, "
                f"{invoice.billable_hours} hrs billable @ ${invoice.rate_per_hour}/hr = "
                f"${invoice.total_charge:.2f} ({invoice.status})"
            ),
            "invoice": invoice.model_dump(),
            "slack_alert": slack,
            "report_preview": report[:500],
            "requires_escalation": invoice.requires_escalation,
        }


async def _main():
    wf = DetentionTrackingWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
