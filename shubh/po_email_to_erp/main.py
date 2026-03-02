"""
PO Email → ERP Entry — Purchase Order Email Processing

Parses PO emails/attachments, extracts line items, validates SKUs and prices
against catalog, and generates ERP-ready payloads.

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
from shubh.po_email_to_erp.action import validate_and_prepare_erp

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

    async def extract(self, raw_text: str) -> PurchaseOrderResult:
        return await extract_purchase_order(raw_text)

    async def act(self, result: PurchaseOrderResult) -> dict:
        erp = validate_and_prepare_erp(result)
        return {
            "erp_entry": erp.model_dump(),
            "summary": (
                f"PO {erp.po_number}: {len(erp.line_items)} items, ${erp.total:.2f}. "
                f"Validation: {'✅ All valid' if erp.all_valid else f'⚠️ {len(erp.issues)} issues found'}"
            ),
        }


async def _main():
    wf = POEmailToERPWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
