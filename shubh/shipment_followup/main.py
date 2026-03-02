"""
Shipment Status Follow-Up Agent — Overdue Alert → Auto Email/Slack

Monitors shipment statuses, generates professional follow-up emails
to carriers, and escalates to Slack when thresholds are exceeded.

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
from shubh.shipment_followup.action import save_followup_email, build_escalation_slack_message

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

    async def extract(self, raw_text: str) -> ShipmentStatus:
        return await extract_shipment_status(raw_text)

    async def act(self, result: ShipmentStatus) -> dict:
        # Determine attempt number from context (default 1 for demo)
        attempt = 2  # demo: simulate 2nd attempt

        # Generate follow-up email
        email = await generate_followup_email(result, attempt_number=attempt)

        # Save email
        email_payload = save_followup_email(email, result)

        # Check escalation
        output = {"email": email_payload, "escalation": None}
        if email.should_escalate:
            slack_msg = build_escalation_slack_message(result, email)
            output["escalation"] = slack_msg
            log.warning("shipment_escalated", load_id=result.load_id, attempt=attempt)

        return output


async def _main():
    wf = ShipmentFollowUpWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
