"""
core/workflow_base.py — Production-ready abstract base class for every workflow.
Enforces the 4-layer architecture: Ingest → Extract → Act → Log.

Features:
- Pre-flight API key validation (fail fast)
- Input validation hook (reject bad data before LLM call)
- Automatic ROI metrics on every run
- Structured run metadata for auditing
- Human review queue with confidence gating

Usage:
    from core.workflow_base import BaseWorkflow

    class InvoiceAPWorkflow(BaseWorkflow):
        name = "invoice_ap"

        async def ingest(self, input_data: dict) -> str: ...
        async def extract(self, raw_text: str) -> WorkflowResult: ...
        async def act(self, result: WorkflowResult) -> dict: ...
"""

import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from core.logger import get_logger
from core.validator import WorkflowResult, HumanReviewItem
from core.config import settings
from core.roi import calculate_roi, format_roi_summary

log = get_logger(__name__)

# In-memory human review queue (swap for DB in production)
HUMAN_REVIEW_QUEUE: list[HumanReviewItem] = []


class BaseWorkflow(ABC):
    """
    Every workflow extends this class and implements:
      - ingest:   raw input → text
      - extract:  text → WorkflowResult (via LLM)
      - act:      WorkflowResult → output action (write DB, Slack, etc.)

    Optional overrides:
      - validate_input: pre-LLM input sanity check
    """

    name: str = "unnamed_workflow"

    async def run(self, input_data: Any) -> dict:
        """
        Orchestrate the full pipeline with pre-flight checks, ROI tracking,
        and structured error handling.
        """
        start = time.perf_counter()
        run_timestamp = datetime.utcnow().isoformat()
        log.info("workflow_run_start", workflow=self.name, timestamp=run_timestamp)

        try:
            # ── Pre-flight: verify LLM is configured ──
            from core.llm import preflight_check
            try:
                preflight_check()
            except Exception as e:
                return {
                    "status": "config_error",
                    "workflow": self.name,
                    "error": str(e),
                    "fix": "Add your API key to the .env file and restart.",
                    "elapsed_s": 0,
                }

            # ── Layer 1: Ingest ──
            raw_text = await self.ingest(input_data)

            if not raw_text or len(raw_text.strip()) < 10:
                return {
                    "status": "error",
                    "workflow": self.name,
                    "error": f"Input too short ({len(raw_text.strip())} chars). Provide a valid document or text.",
                    "elapsed_s": round(time.perf_counter() - start, 3),
                }

            # ── Layer 1.5: Validate Input ──
            validation_error = await self.validate_input(raw_text)
            if validation_error:
                return {
                    "status": "validation_error",
                    "workflow": self.name,
                    "error": validation_error,
                    "elapsed_s": round(time.perf_counter() - start, 3),
                }

            # ── Layer 2: Extract via LLM ──
            result = await self.extract(raw_text)
            result.raw_input_snippet = raw_text[:200]

            # ── Layer 3: Human review check ──
            if result.needs_human_review:
                self._queue_for_review(
                    reason=f"Low confidence: {result.confidence:.2f}",
                    payload=result.model_dump(),
                )

            # ── Layer 4: Act ──
            output = await self.act(result)

            elapsed = time.perf_counter() - start

            # ── ROI Calculation ──
            roi = calculate_roi(
                workflow_name=self.name,
                elapsed_seconds=elapsed,
            )
            roi_summary = format_roi_summary(roi)

            log.info("workflow_run_complete", workflow=self.name,
                     elapsed_s=round(elapsed, 3),
                     time_saved_min=roi.time_saved_minutes,
                     cost_saved=roi.cost_saved_usd)

            return {
                "status": "success",
                "workflow": self.name,
                "needs_human_review": result.needs_human_review,
                "confidence": result.confidence,
                "result": result.model_dump(),
                "output": output,
                "elapsed_s": round(elapsed, 3),
                "roi": roi.model_dump(),
                "roi_summary": roi_summary,
                "run_metadata": {
                    "timestamp": run_timestamp,
                    "input_chars": len(raw_text),
                    "workflow_version": "2.0.0",
                },
            }

        except Exception as exc:
            elapsed = time.perf_counter() - start
            log.error("workflow_run_failed", workflow=self.name, error=str(exc), elapsed_s=round(elapsed, 3))
            return {
                "status": "error",
                "workflow": self.name,
                "error": str(exc),
                "error_type": type(exc).__name__,
                "elapsed_s": round(elapsed, 3),
            }

    # ── Abstract methods ──────────────────────────────────────────────────────

    @abstractmethod
    async def ingest(self, input_data: Any) -> str:
        """Convert raw input (file path, email dict, webhook payload) to plain text."""
        ...

    @abstractmethod
    async def extract(self, raw_text: str) -> WorkflowResult:
        """Call LLM, parse response, return a validated WorkflowResult subclass."""
        ...

    @abstractmethod
    async def act(self, result: WorkflowResult) -> dict:
        """Execute the output action and return a summary dict."""
        ...

    # ── Optional overrides ────────────────────────────────────────────────────

    async def validate_input(self, raw_text: str) -> str | None:
        """
        Override this to add workflow-specific input validation.
        Return None if valid, or an error message string if invalid.
        Called BEFORE the LLM call to reject bad data early.
        """
        return None

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _queue_for_review(self, reason: str, payload: dict) -> None:
        item = HumanReviewItem(workflow_name=self.name, reason=reason, payload=payload)
        HUMAN_REVIEW_QUEUE.append(item)
        log.warning("queued_for_human_review", workflow=self.name, reason=reason)
