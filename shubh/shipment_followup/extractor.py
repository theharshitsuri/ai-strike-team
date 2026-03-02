"""
LLM extraction and email generation for Shipment Follow-Up workflow.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.shipment_followup.validator import ShipmentStatus, FollowUpEmail

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_shipment_status(raw_text: str) -> ShipmentStatus:
    """Extract shipment status data from text."""
    config = _load_config()
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    response = await llm_call(prompt=prompt, system=system)
    return parse_llm_json(response, ShipmentStatus)


async def generate_followup_email(status: ShipmentStatus, attempt_number: int = 1) -> FollowUpEmail:
    """Generate a follow-up email using LLM."""
    config = _load_config()
    thresholds = config["thresholds"]

    prompt = config["prompts"]["followup_email"].format(
        load_id=status.load_id,
        carrier=status.carrier,
        origin=status.origin,
        destination=status.destination,
        expected_delivery=status.expected_delivery,
        hours_overdue=status.hours_overdue,
        last_status=status.current_status,
        attempt_number=attempt_number,
    )
    system = config["prompts"]["system"]

    response = await llm_call(prompt=prompt, system=system)
    email_result = parse_llm_json(response, FollowUpEmail)
    email_result.attempt_number = attempt_number
    email_result.should_escalate = attempt_number >= thresholds["escalate_after_attempts"]

    return email_result
