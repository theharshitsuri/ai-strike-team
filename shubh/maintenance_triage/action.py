"""
Action layer for Maintenance Triage — ticket routing, notifications, and reports.
"""

import json
from datetime import datetime
from pathlib import Path

from core.logger import get_logger
from shubh.maintenance_triage.validator import MaintenanceTicketResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_routed_ticket(result: MaintenanceTicketResult) -> dict:
    """Save the classified and routed ticket."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ticket_data = {
        "ticket_id": result.ticket_id,
        "equipment_id": result.equipment_id,
        "category": result.category,
        "priority": result.priority,
        "assigned_team": result.assigned_team,
        "description": result.description,
        "root_cause_guess": result.root_cause_guess,
        "estimated_repair_hours": result.estimated_repair_hours,
        "parts_needed": result.parts_needed,
        "safety_risk": result.safety_risk,
        "production_impact": result.production_impact,
        "routed_at": datetime.utcnow().isoformat(),
    }
    out_path = OUTPUT_DIR / f"ticket_{result.ticket_id}.json"
    with open(out_path, "w") as f:
        json.dump(ticket_data, f, indent=2)
    log.info("ticket_routed", ticket_id=result.ticket_id, team=result.assigned_team, priority=result.priority)
    return ticket_data


def build_slack_notification(result: MaintenanceTicketResult) -> dict:
    """Build priority-colored Slack notification."""
    emoji = {"critical": "🚨", "high": "🔴", "medium": "🟡", "low": "🟢"}.get(result.priority, "⚪")

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Maintenance Ticket — {result.priority.upper()}"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Ticket:*\n`{result.ticket_id}`"},
            {"type": "mrkdwn", "text": f"*Equipment:*\n{result.equipment_id}"},
            {"type": "mrkdwn", "text": f"*Category:*\n{result.category}"},
            {"type": "mrkdwn", "text": f"*Assigned to:*\n{result.assigned_team}"},
            {"type": "mrkdwn", "text": f"*Est. Repair:*\n{result.estimated_repair_hours}h"},
            {"type": "mrkdwn", "text": f"*Safety Risk:*\n{'⚠️ YES' if result.safety_risk else '✅ No'}"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Description:*\n{result.description[:200]}"}},
    ]
    if result.root_cause_guess:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*Likely Cause:*\n{result.root_cause_guess}"}})

    return {
        "channel": f"maintenance-{result.assigned_team.lower().replace(' ', '-')}",
        "text": f"{emoji} [{result.priority.upper()}] {result.category} — Equipment {result.equipment_id}",
        "blocks": blocks,
    }


def generate_triage_report(result: MaintenanceTicketResult) -> str:
    """Generate a professional maintenance triage report."""
    priority_emoji = {"critical": "🚨", "high": "🔴", "medium": "🟡", "low": "🟢"}.get(result.priority, "⚪")

    report = f"""# {priority_emoji} Maintenance Triage Report

## Ticket Summary
| Field | Value |
|-------|-------|
| Ticket ID | `{result.ticket_id}` |
| Equipment | {result.equipment_id} |
| Category | {result.category} |
| Priority | **{result.priority.upper()}** |
| Assigned Team | {result.assigned_team} |
| Safety Risk | {'⚠️ YES' if result.safety_risk else '✅ No'} |
| Production Impact | {result.production_impact} |
| Est. Repair Time | {result.estimated_repair_hours} hours |

## Description
{result.description}

## Root Cause Analysis
{result.root_cause_guess or "Requires on-site inspection"}

"""
    if result.parts_needed:
        report += "## Parts Needed\n" + "\n".join(f"- {p}" for p in result.parts_needed) + "\n\n"

    if result.recommended_actions:
        report += "## Recommended Actions\n"
        for i, action in enumerate(result.recommended_actions, 1):
            report += f"{i}. {action}\n"
        report += "\n"

    report += f"---\n*Confidence: {result.confidence:.0%} | Triaged: {datetime.utcnow().isoformat()}*\n"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"triage_report_{result.ticket_id}.md"
    with open(report_path, "w") as f:
        f.write(report)

    return report
