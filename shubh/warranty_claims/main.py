"""
Warranty Claim Processing — Claim Form → Approve/Reject/Review

Production-ready workflow:
1. Ingests warranty claims (emails, form submissions, PDFs)
2. Validates input contains warranty/claim content
3. Extracts claim data via LLM (product, dates, defect, customer)
4. Validates against warranty rules (period, product validity)
5. Makes automated decision (approve/reject/review)
6. Generates professional claim report with decision rationale
7. Sends Slack notification for high-value claims
8. Drafts response letter to customer
9. Calculates ROI (20 min manual review → seconds automated)

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
from shubh.warranty_claims.action import evaluate_claim, generate_claim_report, build_claim_slack_alert, draft_customer_response

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

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["warranty", "claim", "defect", "product", "purchase", "return",
                     "replacement", "repair", "damaged", "broken", "malfunction", "serial"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be a warranty claim. Expected keywords like 'warranty', 'claim', 'defect', 'product', etc."
        return None

    async def extract(self, raw_text: str) -> WarrantyClaimData:
        return await extract_claim(raw_text)

    async def act(self, result: WarrantyClaimData) -> dict:
        # Evaluate claim against warranty rules
        decision = evaluate_claim(result)

        # Generate report
        report = generate_claim_report(result, decision)

        # Build Slack alert for high-value or escalated claims
        slack = build_claim_slack_alert(result, decision)

        # Draft customer response letter
        response_letter = draft_customer_response(result, decision)

        decision_emoji = {"approved": "✅", "rejected": "❌", "review": "⚠️"}.get(decision.decision, "⚠️")

        return {
            "summary": f"{decision_emoji} Claim {decision.claim_id}: {decision.decision.upper()} — {decision.reason} (Product: {result.product_name}, {decision.days_since_purchase} days old)",
            "decision": decision.model_dump(),
            "report_preview": report[:500],
            "slack_alert": slack,
            "customer_response": response_letter,
        }


async def _main():
    wf = WarrantyClaimsWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
