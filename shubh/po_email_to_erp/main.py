"""
PO Email → ERP Entry — Purchase Order Email Processing

Production-ready workflow:
1. Ingests PO emails or PDF attachments
2. Validates input contains purchase order content
3. Extracts PO header + line items via LLM
4. Validates SKUs and prices against product catalog
5. Generates ERP-ready JSON payload
6. Flags issues (unknown SKUs, price mismatches, missing fields)
7. Generates professional PO processing report
8. Sends Slack alert for high-value orders
9. Calculates ROI (25 min manual data entry → seconds automated)

Usage:
    python -m shubh.po_email_to_erp.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.po_email_to_erp.extractor import extract_purchase_order
from shubh.po_email_to_erp.validator import PurchaseOrderResult
from shubh.po_email_to_erp.action import validate_and_prepare_erp, generate_po_report, build_po_slack_alert

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_po_email.txt"


class POEmailToERPWorkflow(BaseWorkflow):
    name = "po_email_to_erp"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["purchase order", "po", "order", "qty", "quantity", "sku",
                     "item", "unit price", "total", "ship to", "bill to",
                     "vendor", "supplier", "buyer"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be a purchase order. Expected keywords like 'purchase order', 'PO', 'qty', 'SKU', etc."
        return None

    async def extract(self, raw_text: str) -> PurchaseOrderResult:
        return await extract_purchase_order(raw_text)

    async def act(self, result: PurchaseOrderResult) -> dict:
        erp = validate_and_prepare_erp(result)
        report = generate_po_report(result, erp)
        slack = build_po_slack_alert(result, erp)

        status_emoji = "✅" if erp.all_valid else "⚠️"
        issues_text = f" — {len(erp.issues)} issues found" if erp.issues else ""

        return {
            "summary": f"{status_emoji} PO {erp.po_number}: {len(erp.line_items)} items, ${erp.total:.2f}. {'Ready for ERP' if erp.all_valid else 'Needs review'}{issues_text}",
            "erp_entry": erp.model_dump(),
            "report_preview": report[:500],
            "slack_alert": slack,
            "ready_for_erp": erp.all_valid,
        }


async def _main():
    wf = POEmailToERPWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
