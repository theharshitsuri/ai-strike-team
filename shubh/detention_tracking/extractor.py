"""
LLM extraction logic for Detention Tracking workflow.
Production-ready: uses model/temperature from config, confidence threshold checking.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.detention_tracking.validator import DetentionResult

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_detention(raw_text: str) -> DetentionResult:
    """Call LLM to extract detention timestamps from unstructured text."""
    config = _load_config()
    prompts = config["prompts"]
    extraction = config.get("extraction", {})

    prompt = prompts["extraction"].replace("{input_text}", raw_text)
    system = prompts["system"]

    log.info("extracting_detention", input_length=len(raw_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, DetentionResult)

    # Confidence threshold check
    threshold = extraction.get("confidence_threshold", 0.80)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_detention", confidence=result.confidence, threshold=threshold)

    log.info("detention_extraction_complete", load_id=result.load_id, confidence=result.confidence)
    return result
