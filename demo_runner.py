"""
demo_runner.py — Run all workflows against demo data in one command.

Usage:
    python demo_runner.py                    # Run ALL workflows
    python demo_runner.py load_scheduling    # Run one specific workflow
    python demo_runner.py --list             # List available workflows
    python demo_runner.py --dry-run          # Test imports only (no LLM calls)

This is your SALES TOOL. Before any client call:
    1. Run this to verify everything works
    2. Screen-record the output
    3. Show the structured JSON results in the call
"""

import asyncio
import json
import sys
import time
import importlib
from pathlib import Path

WORKFLOWS = {
    # Logistics
    "load_scheduling": {
        "module": "shubh.load_scheduling.main",
        "class": "LoadSchedulingWorkflow",
        "demo": "shubh/load_scheduling/demo/sample_email.txt",
        "vertical": "Logistics",
    },
    "detention_tracking": {
        "module": "shubh.detention_tracking.main",
        "class": "DetentionTrackingWorkflow",
        "demo": "shubh/detention_tracking/demo/sample_detention.txt",
        "vertical": "Logistics",
    },
    "shipment_followup": {
        "module": "shubh.shipment_followup.main",
        "class": "ShipmentFollowUpWorkflow",
        "demo": "shubh/shipment_followup/demo/sample_shipment.txt",
        "vertical": "Logistics",
    },
    "freight_audit": {
        "module": "shubh.freight_audit.main",
        "class": "FreightAuditWorkflow",
        "demo": {
            "invoice_path": "shubh/freight_audit/demo/sample_invoice.txt",
            "rate_con_path": "shubh/freight_audit/demo/sample_rate_con.txt",
        },
        "vertical": "Logistics",
    },
    # Manufacturing
    "qa_anomaly": {
        "module": "shubh.qa_anomaly.main",
        "class": "QAAnomalyWorkflow",
        "demo": "shubh/qa_anomaly/demo/sample_inspection.csv",
        "vertical": "Manufacturing",
    },
    "maintenance_triage": {
        "module": "shubh.maintenance_triage.main",
        "class": "MaintenanceTriageWorkflow",
        "demo": "shubh/maintenance_triage/demo/sample_ticket.txt",
        "vertical": "Manufacturing",
    },
    "production_report": {
        "module": "shubh.production_report.main",
        "class": "ProductionReportWorkflow",
        "demo": "shubh/production_report/demo/sample_production.csv",
        "vertical": "Manufacturing",
    },
    "warranty_claims": {
        "module": "shubh.warranty_claims.main",
        "class": "WarrantyClaimsWorkflow",
        "demo": "shubh/warranty_claims/demo/sample_claim.txt",
        "vertical": "Manufacturing",
    },
    # Suri's Workflows
    "rfp_intelligence": {
        "module": "suri.rfp_intelligence.main",
        "class": "RFPWorkflow",
        "demo": "suri/rfp_intelligence/demo/sample_rfp.txt",
        "vertical": "Consulting",
    },
    # Wholesale
    "po_email_to_erp": {
        "module": "shubh.po_email_to_erp.main",
        "class": "POEmailToERPWorkflow",
        "demo": "shubh/po_email_to_erp/demo/sample_po_email.txt",
        "vertical": "Wholesale",
    },
    "inventory_restock": {
        "module": "shubh.inventory_restock.main",
        "class": "InventoryRestockWorkflow",
        "demo": "shubh/inventory_restock/demo/sample_inventory.csv",
        "vertical": "Wholesale",
    },
    "scheduling_automation": {
        "module": "shubh.scheduling_automation.main",
        "class": "SchedulingAutomationWorkflow",
        "demo": "shubh/scheduling_automation/demo/sample_request.txt",
        "vertical": "Wholesale",
    },
}


def list_workflows():
    """Print available workflows grouped by vertical."""
    by_vertical = {}
    for name, info in WORKFLOWS.items():
        v = info["vertical"]
        by_vertical.setdefault(v, []).append(name)

    print("\n🤖 AI Strike Team — Available Workflows\n")
    for vertical, names in by_vertical.items():
        print(f"  {vertical}:")
        for n in names:
            print(f"    • {n}")
    print()


async def run_workflow(name: str, dry_run: bool = False) -> dict:
    """Run a single workflow against its demo data."""
    info = WORKFLOWS[name]

    print(f"\n{'='*60}")
    print(f"▶ Running: {name} ({info['vertical']})")
    print(f"{'='*60}")

    if dry_run:
        # Just test imports
        try:
            mod = importlib.import_module(info["module"])
            cls = getattr(mod, info["class"])
            print(f"  ✅ Import OK: {info['class']}")
            return {"status": "import_ok", "workflow": name}
        except Exception as e:
            print(f"  ❌ Import FAILED: {e}")
            return {"status": "import_error", "workflow": name, "error": str(e)}

    # Full run
    try:
        mod = importlib.import_module(info["module"])
        cls = getattr(mod, info["class"])
        wf = cls()

        start = time.perf_counter()
        result = await wf.run(info["demo"])
        elapsed = time.perf_counter() - start

        status = result.get("status", "unknown")
        emoji = "✅" if status == "success" else "❌"
        print(f"  {emoji} Status: {status} ({elapsed:.2f}s)")

        if status == "success":
            # Show key output snippet
            output = result.get("output", {})
            if isinstance(output, dict):
                summary = output.get("summary", json.dumps(output, default=str)[:200])
                print(f"  📋 {summary}")

        return {**result, "elapsed_s": round(elapsed, 2)}

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return {"status": "error", "workflow": name, "error": str(e)}


async def run_all(dry_run: bool = False):
    """Run all workflows sequentially."""
    print("\n" + "🤖 AI STRIKE TEAM — DEMO RUNNER".center(60))
    print("=" * 60)

    results = {}
    passed = 0
    failed = 0

    for name in WORKFLOWS:
        result = await run_workflow(name, dry_run=dry_run)
        results[name] = result
        if result.get("status") in ("success", "import_ok"):
            passed += 1
        else:
            failed += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 RESULTS: {passed} passed, {failed} failed, {len(WORKFLOWS)} total")
    print(f"{'='*60}\n")

    return results


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--list" in args:
        list_workflows()
    elif "--dry-run" in args:
        # Filter to specific workflow if provided
        specific = [a for a in args if a != "--dry-run"]
        if specific:
            asyncio.run(run_workflow(specific[0], dry_run=True))
        else:
            asyncio.run(run_all(dry_run=True))
    elif args and args[0] in WORKFLOWS:
        asyncio.run(run_workflow(args[0]))
    elif args:
        print(f"Unknown workflow: {args[0]}")
        list_workflows()
    else:
        asyncio.run(run_all())
