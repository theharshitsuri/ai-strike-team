"""
LLM extraction logic for Freight Audit workflow.
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
    prompt = config["prompts"]["invoice_extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_invoice", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    return parse_llm_json(response, InvoiceData)


async def extract_rate_confirmation(raw_text: str) -> RateConData:
    """Extract structured line items from a rate confirmation."""
    config = _load_config()
    prompt = config["prompts"]["rate_extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_rate_confirmation", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    return parse_llm_json(response, RateConData)
