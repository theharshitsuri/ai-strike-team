"""
Maintenance Ticket Triage — Classify + Route

Classifies maintenance tickets by category and priority using LLM,
then routes to the correct team with Slack notifications.

Usage:
    python -m shubh.maintenance_triage.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.maintenance_triage.extractor import classify_ticket
from shubh.maintenance_triage.validator import MaintenanceTicketResult
from shubh.maintenance_triage.action import save_routed_ticket, build_slack_notification

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_ticket.txt"


class MaintenanceTriageWorkflow(BaseWorkflow):
    name = "maintenance_triage"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> MaintenanceTicketResult:
        return await classify_ticket(raw_text)

    async def act(self, result: MaintenanceTicketResult) -> dict:
        ticket_info = save_routed_ticket(result)
        slack_msg = build_slack_notification(result)
        return {"ticket": ticket_info, "slack": slack_msg}


async def _main():
    wf = MaintenanceTriageWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
