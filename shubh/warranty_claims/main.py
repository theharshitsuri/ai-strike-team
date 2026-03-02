"""
Warranty Claim Processing — Claim Form → Approve/Reject/Review

Extracts claim data, validates against warranty rules (period, product validity,
duplicate checks), and makes automated decisions.

Usage:
    python -m shubh.warranty_claims.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.warranty_claims.extractor import extract_claim
from shubh.warranty_claims.validator import WarrantyClaimData, WarrantyDecision
from shubh.warranty_claims.action import evaluate_claim

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_claim.txt"


class WarrantyClaimsWorkflow(BaseWorkflow):
    name = "warranty_claims"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> WarrantyClaimData:
        return await extract_claim(raw_text)

    async def act(self, result: WarrantyClaimData) -> dict:
        decision = evaluate_claim(result)
        return {
            "decision": decision.model_dump(),
            "summary": (
                f"Claim {decision.claim_id}: {decision.decision.upper()} — "
                f"{decision.reason} ({decision.days_since_purchase} days since purchase)"
            ),
        }


async def _main():
    wf = WarrantyClaimsWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
