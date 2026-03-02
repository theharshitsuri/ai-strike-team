"""
LLM extraction for Warranty Claims Processing.
"""

from pathlib import Path
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.warranty_claims.validator import WarrantyClaimData

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


async def extract_claim(raw_text: str) -> WarrantyClaimData:
    """Extract warranty claim data from form/document text."""
    config = _load_config()
    prompt = config["prompts"]["extraction"].replace("{input_text}", raw_text)
    system = config["prompts"]["system"]

    log.info("extracting_claim", input_length=len(raw_text))
    response = await llm_call(prompt=prompt, system=system)
    result = parse_llm_json(response, WarrantyClaimData)
    log.info("claim_extracted", product_id=result.product_id, issue_type=result.issue_type)
    return result
