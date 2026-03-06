"""
LLM extraction logic for Load Scheduling workflow.
Production-ready with config loading, error handling, and input preprocessing.
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


def _preprocess_email(raw_text: str) -> str:
    """
    Clean email text before sending to LLM:
    - Strip email signature blocks
    - Remove excessive whitespace
    - Truncate very long emails (keep first 4000 chars)
    """
    import re

    # Remove common email signature delimiters and everything after
    sig_patterns = [
        r"\n--\s*\n.*",           # -- signature
        r"\nSent from my .*",     # Sent from my iPhone
        r"\n_{3,}.*",             # _____ horizontal rule
    ]
    text = raw_text
    for pat in sig_patterns:
        text = re.split(pat, text, maxsplit=1, flags=re.DOTALL)[0]

    # Collapse excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{3,}", "  ", text)

    # Truncate very long emails
    if len(text) > 4000:
        text = text[:4000] + "\n[... truncated ...]"
        log.info("email_truncated", original_length=len(raw_text), truncated_to=4000)

    return text.strip()


async def extract_schedule(raw_text: str) -> LoadScheduleResult:
    """
    Call LLM to extract structured scheduling data from email text.
    Handles preprocessing, prompt assembly, and response parsing.
    """
    config = _load_config()
    prompts = config["prompts"]

    # Preprocess input
    cleaned = _preprocess_email(raw_text)

    # Assemble prompt
    prompt = prompts["extraction"].replace("{input_text}", cleaned)
    system = prompts["system"]

    log.info("extracting_schedule", input_length=len(cleaned))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, LoadScheduleResult)
    log.info("extraction_complete",
             load_id=result.load_id,
             facility=result.facility_name,
             date=result.appointment_date,
             confidence=result.confidence)
    return result
