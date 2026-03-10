"""
Freight Audit Automation — Invoice vs Rate Confirmation

Production-ready workflow:
1. Ingests both invoice and rate confirmation documents
2. Validates inputs contain financial/freight content
3. Extracts line items from both documents via LLM
4. Normalizes charge types (linehaul, fuel_surcharge, detention, etc.)
5. Compares every line item with configurable tolerance
6. Detects overcharges, undercharges, and phantom charges
7. Auto-approves or escalates based on thresholds
8. Generates professional markdown audit report
9. Sends Slack alerts for overcharges
10. Calculates ROI (30 min manual audit → seconds automated)

Usage:
    python -m shubh.freight_audit.main
"""

import asyncio
from typing import Any
from pathlib import Path

from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from core.plugins.slack import post_message as slack_post
from shubh.freight_audit.extractor import extract_invoice, extract_rate_confirmation
from shubh.freight_audit.validator import InvoiceData, FreightAuditResult
from shubh.freight_audit.action import compare_charges, build_audit_slack_alert, generate_audit_report

log = get_logger(__name__)

DEMO_DIR = Path(__file__).parent / "demo"


class FreightAuditWorkflow(BaseWorkflow):
    name = "freight_audit"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, dict) and "invoice_path" in input_data:
            invoice_text = ingest_file(input_data["invoice_path"])
            rate_con_text = ingest_file(input_data["rate_con_path"])
            return f"===INVOICE===\n{invoice_text}\n===RATE_CON===\n{rate_con_text}"
        elif isinstance(input_data, dict) and "body" in input_data:
            return input_data["body"]
        elif isinstance(input_data, (str, Path)):
            return ingest_file(input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        lower = raw_text.lower()
        keywords = ["invoice", "rate", "charge", "total", "amount", "linehaul",
                     "fuel", "freight", "carrier", "load", "shipment", "bill"]
        if not any(kw in lower for kw in keywords):
            return "This doesn't appear to be a freight invoice or rate confirmation. Expected keywords like 'invoice', 'rate', 'charge', 'total', etc."
        return None

    async def extract(self, raw_text: str) -> InvoiceData:
        if "===RATE_CON===" in raw_text:
            parts = raw_text.split("===RATE_CON===")
            invoice_text = parts[0].replace("===INVOICE===", "").strip()
            rate_con_text = parts[1].strip()
            self._invoice_text = invoice_text
            self._rate_con_text = rate_con_text
            return await extract_invoice(invoice_text)
        else:
            return await extract_invoice(raw_text)

    async def act(self, result: InvoiceData) -> dict:
        if hasattr(self, "_rate_con_text"):
            rate_con = await extract_rate_confirmation(self._rate_con_text)
        else:
            return {"error": "No rate confirmation provided. Submit both invoice and rate con for comparison."}

        # Compare charges
        audit = compare_charges(result, rate_con)

        # Build Slack alert
        slack = build_audit_slack_alert(audit)

        # Generate professional report
        report = generate_audit_report(audit)

        # Build actionable summary
        if audit.verdict in ("pass", "auto_approved"):
            action = "✅ Approve for payment"
        elif audit.verdict == "escalated":
            action = f"🚨 Escalate — ${audit.overcharge_amount:.2f} overcharge needs manager approval"
        elif audit.verdict == "fail":
            action = f"❌ Dispute — ${audit.overcharge_amount:.2f} overcharge detected"
        else:
            action = "⚠️ Manual review needed"

        return {
            "summary": f"Load {audit.load_id}: Invoice ${audit.invoice_total:.2f} vs Rate Con ${audit.rate_con_total:.2f} = ${audit.total_difference:+.2f}. {action}",
            "audit": audit.model_dump(),
            "slack_alert": slack,
            "report_preview": report[:500],
            "recommended_action": action,
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
