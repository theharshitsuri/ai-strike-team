"""
Action layer for Maintenance Triage — route tickets and send notifications.
"""

import json
from pathlib import Path

from core.logger import get_logger
from shubh.maintenance_triage.validator import MaintenanceTicketResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_routed_ticket(result: MaintenanceTicketResult) -> dict:
    """Save classified + routed ticket."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"ticket_{result.ticket_id}.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    log.info("ticket_routed", ticket_id=result.ticket_id, team=result.recommended_team)
    return {"path": str(out_path), "routed_to": result.recommended_team}


def build_slack_notification(result: MaintenanceTicketResult) -> dict:
    """Build Slack notification for the assigned team."""
    priority_emoji = {"critical": "🚨", "high": "🔶", "medium": "⚠️", "low": "ℹ️"}
    return {
        "channel": f"maint-{result.recommended_team.replace('_', '-')}",
        "text": (
            f"{priority_emoji.get(result.priority, '⚠️')} *New Ticket: {result.ticket_id}*\n"
            f"• {result.title}\n"
            f"• Category: {result.category} | Priority: {result.priority}\n"
            f"• Equipment: {result.equipment_id} | Location: {result.location}\n"
            f"• Est. downtime: {result.estimated_downtime_hours}h\n"
            f"{'• ⚠️ SAFETY RISK — immediate attention required' if result.safety_risk else ''}"
        ),
    }
