"""
core/workflow_base.py — Abstract base class for every workflow.
Enforces the standard 4-layer architecture: Trigger → Extract → Validate → Act.

Usage:
    from core.workflow_base import BaseWorkflow

    class InvoiceAPWorkflow(BaseWorkflow):
        name = "invoice_ap"

        async def ingest(self, input_data: dict) -> str:
            ...

        async def extract(self, raw_text: str) -> WorkflowResult:
            ...

        async def act(self, result: WorkflowResult) -> dict:
            ...
"""

import time
from abc import ABC, abstractmethod
from typing import Any

from core.logger import get_logger
from core.validator import WorkflowResult, HumanReviewItem
from core.config import settings

log = get_logger(__name__)

# In-memory human review queue (swap for DB in production)
HUMAN_REVIEW_QUEUE: list[HumanReviewItem] = []


class BaseWorkflow(ABC):
    """
    Every workflow extends this class and implements:
      - ingest:   raw input → text
      - extract:  text → WorkflowResult (via LLM)
      - act:      WorkflowResult → output action (write DB, Slack, etc.)
    """

    name: str = "unnamed_workflow"

    async def run(self, input_data: Any) -> dict:
        """
        Orchestrate the full 4-layer pipeline with logging and error handling.
        Returns a dict with status, result, and any review flags.
        """
        start = time.perf_counter()
        log.info("workflow_run_start", workflow=self.name)

        try:
            # Layer 1: Ingest
            raw_text = await self.ingest(input_data)

            # Layer 2: Extract via LLM
            result = await self.extract(raw_text)
            result.raw_input_snippet = raw_text[:200]

            # Layer 3: Human review check
            if result.needs_human_review:
                self._queue_for_review(
                    reason=f"Low confidence: {result.confidence:.2f}",
                    payload=result.model_dump(),
                )

            # Layer 4: Act
            output = await self.act(result)

            elapsed = time.perf_counter() - start
            log.info("workflow_run_complete", workflow=self.name, elapsed_s=round(elapsed, 3))

            return {
                "status": "success",
                "workflow": self.name,
                "needs_human_review": result.needs_human_review,
                "result": result.model_dump(),
                "output": output,
                "elapsed_s": round(elapsed, 3),
            }

        except Exception as exc:
            elapsed = time.perf_counter() - start
            log.error("workflow_run_failed", workflow=self.name, error=str(exc), elapsed_s=round(elapsed, 3))
            return {
                "status": "error",
                "workflow": self.name,
                "error": str(exc),
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

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _queue_for_review(self, reason: str, payload: dict) -> None:
        item = HumanReviewItem(workflow_name=self.name, reason=reason, payload=payload)
        HUMAN_REVIEW_QUEUE.append(item)
        log.warning("queued_for_human_review", workflow=self.name, reason=reason)
