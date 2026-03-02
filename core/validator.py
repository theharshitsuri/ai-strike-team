"""
core/validator.py — Base Pydantic schemas and extraction helper.
Every workflow defines its own schema by extending WorkflowResult.

Usage:
    from core.validator import WorkflowResult, parse_llm_json
    
    class InvoiceResult(WorkflowResult):
        vendor: str
        amount: float
        po_number: str
"""

import json
import re
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

from core.logger import get_logger

log = get_logger(__name__)


class WorkflowResult(BaseModel):
    """Base schema for all workflow extraction results."""
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="LLM confidence score 0-1")
    needs_human_review: bool = Field(default=False, description="Flag for manual review queue")
    raw_input_snippet: Optional[str] = Field(default=None, description="First 200 chars of input for audit")
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(default=None, description="LLM reasoning or edge case notes")


class HumanReviewItem(BaseModel):
    """Queued item flagged for human review."""
    workflow_name: str
    reason: str
    payload: dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)


def parse_llm_json(raw_response: str, schema: type[WorkflowResult]) -> WorkflowResult:
    """
    Parse a JSON object from an LLM response string and validate against schema.
    Handles cases where LLM wraps JSON in markdown code fences.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw_response).strip().rstrip("```").strip()

    # Find first JSON object in response
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        log.warning("no_json_found_in_llm_response", snippet=raw_response[:200])
        raise ValueError("No JSON object found in LLM response")

    data = json.loads(match.group())
    result = schema(**data)

    if result.confidence < 0.75:
        result.needs_human_review = True
        log.warning("low_confidence_flagged", confidence=result.confidence)

    return result
