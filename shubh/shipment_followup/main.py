"""
Shipment Status Follow-Up Agent — Overdue Alert → Auto Email → Escalation

Production-ready workflow:
1. Ingests shipment tracking data (emails, CSVs, API responses)
2. Validates input contains shipment-related content
3. Extracts shipment status, location, and overdue status via LLM
4. Generates tone-appropriate follow-up email (polite → firm → escalation)
5. Saves email draft and builds Slack escalation if needed
6. Generates professional follow-up report
7. Calculates ROI (15 min manual follow-up → seconds automated)

Usage:
    python -m shubh.shipment_followup.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.shipment_followup.extractor import extract_shipment_status, generate_followup_email
from shubh.shipment_followup.validator import ShipmentStatus, FollowUpEmail
from shubh.shipment_followup.action import save_followup_email, build_escalation_slack_message, generate_followup_report

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_shipment.txt"


class ShipmentFollowUpWorkflow(BaseWorkflow):
    name = "shipment_followup"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["shipment", "load", "carrier", "delivery", "transit", "tracking",
                     "overdue", "delayed", "shipped", "freight", "eta", "pickup"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be shipment/tracking data. Expected keywords like 'shipment', 'carrier', 'delivery', etc."
        return None

    async def extract(self, raw_text: str) -> ShipmentStatus:
        return await extract_shipment_status(raw_text)

    async def act(self, result: ShipmentStatus) -> dict:
        # Determine attempt (default 1 for new, escalate at 3+)
        attempt = 2 if result.hours_overdue > 12 else 1
        if result.hours_overdue > 24:
            attempt = 3

        # Generate follow-up email with appropriate tone
        email = await generate_followup_email(result, attempt_number=attempt)

        # Save email draft
        email_payload = save_followup_email(email, result)

        # Generate report
        report = generate_followup_report(result, email, attempt)

        output = {
            "summary": f"Follow-up #{attempt} for Load {result.load_id} ({result.carrier}) — {email.urgency} — {result.hours_overdue}h overdue",
            "email": email_payload,
            "escalation": None,
            "report_preview": report[:500],
        }

        # Escalate if needed
        if email.should_escalate:
            slack_msg = build_escalation_slack_message(result, email)
            output["escalation"] = slack_msg
            log.warning("shipment_escalated", load_id=result.load_id, attempt=attempt, hours_overdue=result.hours_overdue)

        return output


async def _main():
    wf = ShipmentFollowUpWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
