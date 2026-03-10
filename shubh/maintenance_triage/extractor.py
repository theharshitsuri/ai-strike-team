"""
LLM classification for Maintenance Ticket Triage.
Production-ready: uses model/temperature from config, confidence threshold, auto-escalation.
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
    extraction = config.get("extraction", {})
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("classifying_ticket", input_length=len(raw_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, MaintenanceTicketResult)

    # Confidence threshold check
    threshold = extraction.get("confidence_threshold", 0.70)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_triage", confidence=result.confidence, threshold=threshold)

    # Auto-escalate safety risks
    if result.safety_risk and config.get("thresholds", {}).get("auto_escalate_safety", True):
        result.priority = "critical"
        result.assigned_team = "safety"
        log.warning("safety_risk_escalated", ticket_id=result.ticket_id)

    log.info("ticket_classified", ticket_id=result.ticket_id,
             category=result.category, priority=result.priority,
             team=result.assigned_team)
    return result
