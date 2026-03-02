"""
LLM extraction for PO Email → ERP Entry.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.po_email_to_erp.validator import PurchaseOrderResult

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_purchase_order(raw_text: str) -> PurchaseOrderResult:
    """Extract structured PO data from email/doc text."""
    config = _load_config()
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_po", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, PurchaseOrderResult)
    log.info("po_extracted", po_number=result.po_number, items=len(result.line_items))
    return result
