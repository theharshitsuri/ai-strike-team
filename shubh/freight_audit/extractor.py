"""
LLM extraction logic for Freight Audit workflow.
Production-ready: uses model/temperature from config, confidence threshold checking.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.freight_audit.validator import InvoiceData, RateConData

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_invoice(raw_text: str) -> InvoiceData:
    """Extract structured line items from a carrier invoice."""
    config = _load_config()
    extraction = config.get("extraction", {})
    prompt = config["prompts"]["invoice_extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_invoice", input_length=len(raw_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, InvoiceData)

    # Confidence threshold check
    threshold = extraction.get("confidence_threshold", 0.85)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_invoice", confidence=result.confidence, threshold=threshold)

    log.info("invoice_extracted", invoice_number=result.invoice_number, items=len(result.line_items))
    return result


async def extract_rate_confirmation(raw_text: str) -> RateConData:
    """Extract structured line items from a rate confirmation."""
    config = _load_config()
    extraction = config.get("extraction", {})
    prompt = config["prompts"]["rate_extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_rate_confirmation", input_length=len(raw_text))
    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.1),
    )
    result = parse_llm_json(response, RateConData)

    threshold = extraction.get("confidence_threshold", 0.85)
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_rate_con", confidence=result.confidence, threshold=threshold)

    log.info("rate_con_extracted", load_id=result.load_id, items=len(result.line_items))
    return result
