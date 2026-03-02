"""
Freight Audit Automation — Invoice vs Rate Confirmation Comparison

Extracts line items from both documents, compares them rule-by-rule,
and generates an audit report flagging mismatches and overcharges.

Usage:
    python -m shubh.freight_audit.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from shubh.freight_audit.extractor import extract_invoice, extract_rate_confirmation
from shubh.freight_audit.validator import InvoiceData, FreightAuditResult
from shubh.freight_audit.action import compare_charges

log = get_logger(__name__)

DEMO_DIR = Path(__file__).parent / "demo"


class FreightAuditWorkflow(BaseWorkflow):
    name = "freight_audit"

    async def ingest(self, input_data: Any) -> str:
        """
        Expects input_data as dict with 'invoice_path' and 'rate_con_path',
        or a single file path for invoice-only mode.
        """
        if isinstance(input_data, dict):
            invoice_text = ingest_file(input_data["invoice_path"])
            rate_con_text = ingest_file(input_data["rate_con_path"])
            return f"===INVOICE===\n{invoice_text}\n===RATE_CON===\n{rate_con_text}"
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> InvoiceData:
        """Extract from both documents in the combined text."""
        if "===RATE_CON===" in raw_text:
            parts = raw_text.split("===RATE_CON===")
            invoice_text = parts[0].replace("===INVOICE===", "").strip()
            rate_con_text = parts[1].strip()

            # Store rate_con for use in act()
            self._invoice_text = invoice_text
            self._rate_con_text = rate_con_text

            return await extract_invoice(invoice_text)
        else:
            return await extract_invoice(raw_text)

    async def act(self, result: InvoiceData) -> dict:
        # Extract rate confirmation
        if hasattr(self, "_rate_con_text"):
            rate_con = await extract_rate_confirmation(self._rate_con_text)
        else:
            return {"error": "No rate confirmation provided for comparison"}

        # Compare
        audit = compare_charges(result, rate_con)

        return {
            "audit": audit.model_dump(),
            "summary": (
                f"Load {audit.load_id}: Invoice ${audit.invoice_total} vs "
                f"Rate Con ${audit.rate_con_total} = ${audit.total_difference} difference. "
                f"Verdict: {audit.verdict}. Overcharge: ${audit.overcharge_amount}"
            ),
        }


async def _main():
    wf = FreightAuditWorkflow()
    result = await wf.run({
        "invoice_path": str(DEMO_DIR / "sample_invoice.txt"),
        "rate_con_path": str(DEMO_DIR / "sample_rate_con.txt"),
    })
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
