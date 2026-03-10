"""
LLM extraction and email generation for Shipment Follow-Up workflow.
Production-ready: uses model/temperature from config, confidence threshold checking.
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
    """Extract shipment status from tracking data, emails, or check-call logs."""
    config = _load_config()
    prompts = config["prompts"]
    extraction = config.get("extraction", {})

    prompt = prompts["extraction"].replace("{input_text}", raw_text)
    system = prompts["system"]

    log.info("extracting_shipment_status", input_length=len(raw_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, ShipmentStatus)

    # Confidence threshold check
    threshold = extraction.get("confidence_threshold", 0.80)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_shipment", confidence=result.confidence, threshold=threshold)

    log.info("shipment_extraction_complete",
             load_id=result.load_id, carrier=result.carrier,
             status=result.current_status, overdue=result.is_overdue)
    return result


async def generate_followup_email(
    status: ShipmentStatus,
    attempt_number: int = 1,
) -> FollowUpEmail:
    """Generate a tone-appropriate follow-up email based on attempt number."""
    config = _load_config()
    prompts = config["prompts"]
    extraction = config.get("extraction", {})

    prompt = prompts["followup_email"]
    prompt = prompt.replace("{load_id}", status.load_id)
    prompt = prompt.replace("{carrier}", status.carrier)
    prompt = prompt.replace("{origin}", status.origin)
    prompt = prompt.replace("{destination}", status.destination)
    prompt = prompt.replace("{expected_delivery}", status.expected_delivery)
    prompt = prompt.replace("{hours_overdue}", str(status.hours_overdue))
    prompt = prompt.replace("{last_status}", status.current_status)
    prompt = prompt.replace("{last_location}", status.last_known_location)
    prompt = prompt.replace("{customer}", status.customer_name)
    prompt = prompt.replace("{attempt_number}", str(attempt_number))

    system = prompts["system"]

    log.info("generating_followup_email", load_id=status.load_id, attempt=attempt_number)
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1) + 0.2,  # Slightly higher for creative writing
    )
    email = parse_llm_json(response, FollowUpEmail)
    log.info("followup_email_generated", urgency=email.urgency, escalate=email.should_escalate)
    return email
