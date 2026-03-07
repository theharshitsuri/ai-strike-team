"""
suri/rfp_intelligence/extractor.py — Extraction logic for RFPs.
"""

import yaml
from pathlib import Path
from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from suri.rfp_intelligence.validator import RFPResult

log = get_logger(__name__)

# Load local config
CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH, "r") as f:
    config = yaml.safe_load(f)

async def extract_rfp_data(text: str) -> RFPResult:
    """Uses LLM to extract structured data from RFP text."""
    
    log.info("extracting_rfp_data_via_llm", snippet=text[:100])
    
    system_prompt = config["prompts"]["system_message"]
    user_prompt = f"RFP Document Text:\n\n{text}"
    
    # Call core LLM wrapper
    response = await llm_call(
        system=system_prompt,
        prompt=user_prompt,
        model=config["extraction"]["model"],
        temperature=config["extraction"]["temperature"]
    )
    
    # Parse and validate against RFPResult schema
    result = parse_llm_json(response, RFPResult)
    
    # Custom business logic: override confidence thresholds if needed
    threshold = config["extraction"]["confidence_threshold"]
    if result.confidence < threshold:
        result.needs_human_review = True
        log.warning("low_confidence_rfp_extraction", confidence=result.confidence, threshold=threshold)
        
    return result
