"""
LLM extraction and confirmation for Scheduling Automation.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.scheduling_automation.validator import ScheduleRequest, ScheduleConfirmation

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_schedule_request(raw_text: str) -> ScheduleRequest:
    """Parse free-text scheduling request."""
    config = _load_config()
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_schedule_request", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, ScheduleRequest)
    log.info("schedule_request_extracted", request_id=result.request_id, type=result.request_type)
    return result


async def generate_confirmation(request: ScheduleRequest) -> dict:
    """Generate confirmation message using LLM."""
    config = _load_config()
    prompt = config["prompts"]["confirmation_message"].format(
        request_type=request.request_type,
        date=request.preferred_date,
        time=request.preferred_time,
        duration=request.duration_minutes,
        location=request.location,
        participants=", ".join(request.participants) if request.participants else "N/A",
    )
    system = config["prompts"]["system"]

    response = await llm_call(prompt=prompt, system=system)
    import json, re
    cleaned = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("```").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"subject": "Appointment Confirmed", "body": response, "confidence": 0.7}
