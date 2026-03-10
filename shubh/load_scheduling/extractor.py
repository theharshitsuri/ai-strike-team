"""
LLM extraction logic for Load Scheduling workflow.
Production-ready: uses model/temperature from config, confidence threshold checking.
"""

import re
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


def _preprocess_email(text: str) -> str:
    """Strip email signatures, collapse whitespace, truncate long emails."""
    # Remove common signature patterns
    sig_patterns = [r'\n--\s*\n.*', r'\nSent from my.*', r'\nBest regards,.*',
                    r'\nThanks,.*', r'\nRegards,.*']
    for pattern in sig_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)
    # Collapse whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    # Truncate to prevent token overflow
    return text[:6000] if len(text) > 6000 else text


async def extract_schedule(raw_text: str) -> LoadScheduleResult:
    """Call LLM to extract scheduling data from email text."""
    config = _load_config()
    prompts = config["prompts"]
    extraction = config.get("extraction", {})

    # Preprocess email
    clean_text = _preprocess_email(raw_text)

    prompt = prompts["extraction"].replace("{input_text}", clean_text)
    system = prompts["system"]

    log.info("extracting_schedule", input_length=len(clean_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, LoadScheduleResult)

    # Confidence threshold check (suri pattern)
    threshold = extraction.get("confidence_threshold", 0.80)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_extraction", confidence=result.confidence, threshold=threshold)

    log.info("schedule_extraction_complete",
             load_id=result.load_id, confidence=result.confidence,
             facility=result.facility_name, date=result.date)
    return result
