"""
LLM extraction logic for Load Scheduling workflow.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.load_scheduling.validator import LoadScheduleResult

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_schedule(raw_text: str) -> LoadScheduleResult:
    """Call LLM to extract structured scheduling data from email text."""
    config = _load_config()
    prompts = config["prompts"]

    prompt = prompts["extraction"].replace("{input_text}", raw_text)
    system = prompts["system"]

    log.info("extracting_schedule", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, LoadScheduleResult)
    log.info("extraction_complete", load_id=result.load_id, confidence=result.confidence)
    return result
