"""
Maintenance Ticket Triage — Classify + Route + Report

Production-ready workflow:
1. Ingests maintenance tickets (text, email, form submissions)
2. Validates input contains equipment/maintenance content
3. Classifies by category, priority, and team via LLM
4. Routes to the correct maintenance team
5. Generates work order with estimated time and parts
6. Sends priority-colored Slack notifications
7. Generates professional triage report
8. Calculates ROI (8 min manual triage → seconds automated)

Usage:
    python -m shubh.maintenance_triage.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from core.plugins.slack import post_message as slack_post
from shubh.maintenance_triage.extractor import classify_ticket
from shubh.maintenance_triage.validator import MaintenanceTicketResult
from shubh.maintenance_triage.action import save_routed_ticket, build_slack_notification, generate_triage_report

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

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["maintenance", "repair", "broken", "fault", "malfunction", "equipment",
                     "machine", "line", "down", "leak", "noise", "vibrat", "error", "alarm",
                     "pressure", "temperature", "motor", "pump", "conveyor", "belt", "issue"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be a maintenance ticket. Expected equipment/repair related content."
        return None

    async def extract(self, raw_text: str) -> MaintenanceTicketResult:
        return await classify_ticket(raw_text)

    async def act(self, result: MaintenanceTicketResult) -> dict:
        ticket_info = save_routed_ticket(result)
        slack_msg = build_slack_notification(result)
        report = generate_triage_report(result)

        priority_emoji = {"critical": "🚨", "high": "🔴", "medium": "🟡", "low": "🟢"}.get(result.priority, "⚪")

        return {
            "summary": f"{priority_emoji} [{result.priority.upper()}] {result.category} — Routed to {result.assigned_team}. Est. {result.estimated_repair_hours}h repair.",
            "ticket": ticket_info,
            "slack": slack_msg,
            "report_preview": report[:500],
            "priority": result.priority,
            "assigned_team": result.assigned_team,
        }


async def _main():
    wf = MaintenanceTriageWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
