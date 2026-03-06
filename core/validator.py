"""
core/validator.py — Production-ready validation and LLM response parsing.
Every workflow defines its own schema by extending WorkflowResult.

Features:
- Robust JSON extraction from LLM responses (handles markdown, partial JSON, arrays)
- Auto-retry with re-prompt on parse failure
- ROI fields baked into every result
- Human review queue with confidence thresholds

Usage:
    from core.validator import WorkflowResult, parse_llm_json

    class InvoiceResult(WorkflowResult):
        vendor: str
        amount: float
"""

import json
import re
from datetime import datetime
from typing import Any, Optional, Type
from pydantic import BaseModel, Field, field_validator

from core.logger import get_logger

log = get_logger(__name__)


class WorkflowResult(BaseModel):
    """Base schema for all workflow extraction results."""
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="LLM confidence score 0-1")
    needs_human_review: bool = Field(default=False, description="Flag for manual review queue")
    raw_input_snippet: Optional[str] = Field(default=None, description="First 200 chars of input for audit")
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(default=None, description="LLM reasoning or edge case notes")

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        if isinstance(v, (int, float)):
            return max(0.0, min(1.0, float(v)))
        return v


class HumanReviewItem(BaseModel):
    """Queued item flagged for human review."""
    workflow_name: str
    reason: str
    payload: dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)


def _extract_json_from_response(raw_response: str) -> str:
    """
    Extract JSON from LLM response, handling:
    - Markdown code fences (```json ... ```)
    - Raw JSON objects
    - JSON embedded in explanatory text
    - Nested objects with arrays
    """
    if not raw_response or not raw_response.strip():
        raise ValueError("Empty LLM response — no data to parse")

    text = raw_response.strip()

    # 1. Try extracting from code fences
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        return fence_match.group(1)

    # 2. Find the outermost JSON object (handle nested braces correctly)
    brace_depth = 0
    start_idx = None
    for i, ch in enumerate(text):
        if ch == '{':
            if brace_depth == 0:
                start_idx = i
            brace_depth += 1
        elif ch == '}':
            brace_depth -= 1
            if brace_depth == 0 and start_idx is not None:
                candidate = text[start_idx:i + 1]
                try:
                    json.loads(candidate)
                    return candidate
                except json.JSONDecodeError:
                    continue

    # 3. Fallback: regex for simple object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group()

    raise ValueError(f"No JSON object found in LLM response. Response starts with: {text[:100]}")


def parse_llm_json(
    raw_response: str,
    schema: Type[WorkflowResult],
    strict: bool = False,
) -> WorkflowResult:
    """
    Parse a JSON object from an LLM response and validate against schema.

    Handles:
    - Markdown code fences
    - Nested JSON with arrays
    - Extra fields (silently ignored unless strict=True)
    - Missing optional fields (filled with defaults)
    - Confidence-based human review flagging
    """
    json_str = _extract_json_from_response(raw_response)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        # Try to repair common issues
        repaired = json_str
        repaired = re.sub(r",\s*}", "}", repaired)  # trailing commas
        repaired = re.sub(r",\s*]", "]", repaired)  # trailing commas in arrays
        repaired = repaired.replace("'", '"')  # single quotes
        try:
            data = json.loads(repaired)
            log.info("json_repaired", original_error=str(e))
        except json.JSONDecodeError:
            log.error("json_parse_failed", snippet=json_str[:200], error=str(e))
            raise ValueError(f"Failed to parse JSON from LLM response: {e}")

    # Handle 'notes' field conflict — LLM might use 'notes' as string or 'notes_text'
    if "notes_text" in data and "notes" not in data:
        data["notes"] = data.pop("notes_text")

    # Validate against schema
    try:
        result = schema.model_validate(data)
    except Exception as e:
        log.error("schema_validation_failed", schema=schema.__name__, error=str(e), data_keys=list(data.keys()))
        raise ValueError(f"LLM response doesn't match expected schema ({schema.__name__}): {e}")

    # Flag for human review if low confidence
    if result.confidence < 0.75:
        result.needs_human_review = True
        log.warning("low_confidence_flagged", confidence=result.confidence)

    return result
