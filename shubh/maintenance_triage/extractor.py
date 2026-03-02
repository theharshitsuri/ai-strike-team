"""
LLM classification for Maintenance Ticket Triage.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.maintenance_triage.validator import MaintenanceTicketResult

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def classify_ticket(raw_text: str) -> MaintenanceTicketResult:
    """LLM classifies ticket by category, priority, and routes to correct team."""
    config = _load_config()
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("classifying_ticket", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, MaintenanceTicketResult)

    # Auto-escalate safety risks
    if result.safety_risk and config["thresholds"]["auto_escalate_safety"]:
        result.priority = "critical"
        result.recommended_team = "safety_officer"
        log.warning("safety_risk_escalated", ticket_id=result.ticket_id)

    log.info("ticket_classified", ticket_id=result.ticket_id, category=result.category, priority=result.priority)
    return result
