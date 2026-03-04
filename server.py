"""
server.py — FastAPI backend for AI Strike Team Management Dashboard.

Endpoints:
    GET  /health                          — Health check
    GET  /workflows                       — List all available workflows
    GET  /workflows/{name}/config         — Get workflow default config
    POST /run/{workflow_name}             — Run a workflow (file upload or text)

    GET  /clients                         — List all clients
    POST /clients                         — Create a new client
    GET  /clients/{slug}                  — Get client details
    PUT  /clients/{slug}                  — Update client config
    DELETE /clients/{slug}                — Delete a client

    GET  /clients/{slug}/workflows        — List workflows assigned to client
    POST /clients/{slug}/workflows        — Assign workflow to client
    DELETE /clients/{slug}/workflows/{wf} — Unassign workflow

    GET  /clients/{slug}/overrides/{wf}   — Get client overrides for a workflow
    PUT  /clients/{slug}/overrides/{wf}   — Save client overrides for a workflow

    GET  /runs                            — List recent run history
    POST /run/{workflow_name}             — Run workflow (with optional client context)

Usage:
    .venv\\Scripts\\uvicorn.exe server:app --reload --port 8000
"""

import json
import time
import tempfile
import importlib
from pathlib import Path
from datetime import datetime
from typing import Optional

import yaml
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="AI Strike Team",
    description="Forward-Deployed AI Workflow Automation Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve dashboard static files
DASHBOARD_DIR = Path(__file__).parent / "dashboard"
if DASHBOARD_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(DASHBOARD_DIR)), name="static")

# ── In-memory run history (swap for DB in production) ────────────────────────
RUN_HISTORY: list[dict] = []
MAX_HISTORY = 100

# ── Workflow Registry ────────────────────────────────────────────────────────

WORKFLOW_REGISTRY = {
    "load_scheduling": {
        "module": "shubh.load_scheduling.main",
        "class": "LoadSchedulingWorkflow",
        "description": "Parse scheduling emails → create calendar events",
        "vertical": "logistics",
        "icon": "📅",
        "color": "#3B82F6",
        "accepts": ["text", "file"],
        "roi": "Save 5-15 hrs/week in scheduling coordination",
        "demo_file": "shubh/load_scheduling/demo/sample_email.txt",
    },
    "detention_tracking": {
        "module": "shubh.detention_tracking.main",
        "class": "DetentionTrackingWorkflow",
        "description": "Track timestamps → calculate detention fees → invoice",
        "vertical": "logistics",
        "icon": "⏱",
        "color": "#8B5CF6",
        "accepts": ["text", "file"],
        "roi": "Capture $500-2000/week in missed detention fees",
        "demo_file": "shubh/detention_tracking/demo/sample_detention.txt",
    },
    "shipment_followup": {
        "module": "shubh.shipment_followup.main",
        "class": "ShipmentFollowUpWorkflow",
        "description": "Monitor overdue shipments → auto follow-up emails",
        "vertical": "logistics",
        "icon": "📦",
        "color": "#EC4899",
        "accepts": ["text", "file"],
        "roi": "Eliminate 3-8 hrs/day of dispatcher follow-up work",
        "demo_file": "shubh/shipment_followup/demo/sample_shipment.txt",
    },
    "freight_audit": {
        "module": "shubh.freight_audit.main",
        "class": "FreightAuditWorkflow",
        "description": "Compare invoice vs rate confirmation → flag overcharges",
        "vertical": "logistics",
        "icon": "🔍",
        "color": "#F59E0B",
        "accepts": ["text", "file"],
        "roi": "Recover 2-5% of freight spend in overcharges",
        "demo_file": "shubh/freight_audit/demo/sample_invoice.txt",
    },
    "qa_anomaly": {
        "module": "shubh.qa_anomaly.main",
        "class": "QAAnomalyWorkflow",
        "description": "Analyze inspection logs → detect anomalies",
        "vertical": "manufacturing",
        "icon": "🔬",
        "color": "#10B981",
        "accepts": ["csv", "excel"],
        "roi": "Catch defects 3x faster than manual review",
        "demo_file": "shubh/qa_anomaly/demo/sample_inspection.csv",
    },
    "maintenance_triage": {
        "module": "shubh.maintenance_triage.main",
        "class": "MaintenanceTriageWorkflow",
        "description": "Classify maintenance tickets → auto-route to team",
        "vertical": "manufacturing",
        "icon": "🔧",
        "color": "#F97316",
        "accepts": ["text", "file"],
        "roi": "Cut ticket routing time from 10 min to 10 seconds",
        "demo_file": "shubh/maintenance_triage/demo/sample_ticket.txt",
    },
    "production_report": {
        "module": "shubh.production_report.main",
        "class": "ProductionReportWorkflow",
        "description": "Daily production CSV → executive summary report",
        "vertical": "manufacturing",
        "icon": "📊",
        "color": "#6366F1",
        "accepts": ["csv", "excel"],
        "roi": "Save 1-2 hours/day of report compilation",
        "demo_file": "shubh/production_report/demo/sample_production.csv",
    },
    "warranty_claims": {
        "module": "shubh.warranty_claims.main",
        "class": "WarrantyClaimsWorkflow",
        "description": "Process warranty claims → auto approve/reject/review",
        "vertical": "manufacturing",
        "icon": "🛡",
        "color": "#14B8A6",
        "accepts": ["text", "file"],
        "roi": "Process claims 10x faster, reduce backlog by 80%",
        "demo_file": "shubh/warranty_claims/demo/sample_claim.txt",
    },
    "po_email_to_erp": {
        "module": "shubh.po_email_to_erp.main",
        "class": "POEmailToERPWorkflow",
        "description": "Parse PO emails → validate SKUs → ERP payload",
        "vertical": "wholesale",
        "icon": "📧",
        "color": "#EF4444",
        "accepts": ["text", "file"],
        "roi": "Eliminate 8-25 hrs/week of manual PO data entry",
        "demo_file": "shubh/po_email_to_erp/demo/sample_po_email.txt",
    },
    "inventory_restock": {
        "module": "shubh.inventory_restock.main",
        "class": "InventoryRestockWorkflow",
        "description": "Forecast demand → reorder alerts with safety stock",
        "vertical": "wholesale",
        "icon": "📦",
        "color": "#A855F7",
        "accepts": ["csv", "excel"],
        "roi": "Prevent stockouts, reduce carrying costs 5-10%",
        "demo_file": "shubh/inventory_restock/demo/sample_inventory.csv",
    },
    "scheduling_automation": {
        "module": "shubh.scheduling_automation.main",
        "class": "SchedulingAutomationWorkflow",
        "description": "Parse scheduling requests → check availability → confirm",
        "vertical": "cross_vertical",
        "icon": "🗓",
        "color": "#06B6D4",
        "accepts": ["text", "file"],
        "roi": "Zero double-bookings, instant confirmations",
        "demo_file": "shubh/scheduling_automation/demo/sample_request.txt",
    },
}

CLIENTS_DIR = Path(__file__).parent / "clients"


def _load_workflow(name: str):
    info = WORKFLOW_REGISTRY.get(name)
    if not info:
        raise HTTPException(404, f"Workflow '{name}' not found")
    mod = importlib.import_module(info["module"])
    cls = getattr(mod, info["class"])
    return cls()


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return FileResponse(str(DASHBOARD_DIR / "index.html")) if DASHBOARD_DIR.exists() else {"message": "AI Strike Team API"}


@app.get("/health")
async def health():
    return {"status": "ok", "workflows": len(WORKFLOW_REGISTRY), "version": "2.0.0"}


# ── Workflows ────────────────────────────────────────────────────────────────

@app.get("/workflows")
async def list_workflows():
    return {
        name: {k: v for k, v in info.items() if k not in ("module", "class")}
        for name, info in WORKFLOW_REGISTRY.items()
    }


@app.get("/workflows/{name}/config")
async def get_workflow_config(name: str):
    if name not in WORKFLOW_REGISTRY:
        raise HTTPException(404, "Workflow not found")
    for owner in ["shubh", "suri"]:
        cfg_path = Path(__file__).parent / owner / name / "config.yaml"
        if cfg_path.exists():
            with open(cfg_path, "r") as f:
                return yaml.safe_load(f)
    raise HTTPException(404, "Config not found")


@app.get("/workflows/{name}/demo")
async def get_demo_data(name: str):
    info = WORKFLOW_REGISTRY.get(name)
    if not info:
        raise HTTPException(404, "Workflow not found")
    demo_path = Path(__file__).parent / info["demo_file"]
    if demo_path.exists():
        return {"filename": demo_path.name, "content": demo_path.read_text(encoding="utf-8")}
    raise HTTPException(404, "Demo file not found")


# ── Run Workflow ─────────────────────────────────────────────────────────────

@app.post("/run/{workflow_name}")
async def run_workflow(
    workflow_name: str,
    file: UploadFile | None = File(None),
    text_input: str | None = Form(None),
    client: str | None = Form(None),
):
    if workflow_name not in WORKFLOW_REGISTRY:
        raise HTTPException(404, f"Workflow '{workflow_name}' not found")

    wf = _load_workflow(workflow_name)
    start_time = time.perf_counter()

    if file:
        suffix = Path(file.filename).suffix if file.filename else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = await wf.run(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    elif text_input:
        result = await wf.run({"body": text_input})
    else:
        raise HTTPException(400, "Provide either 'file' or 'text_input'")

    elapsed = round(time.perf_counter() - start_time, 2)

    # Record in history
    run_record = {
        "id": len(RUN_HISTORY) + 1,
        "workflow": workflow_name,
        "client": client,
        "status": result.get("status", "unknown"),
        "elapsed_s": elapsed,
        "timestamp": datetime.utcnow().isoformat(),
        "result_summary": str(result.get("output", {}).get("summary", ""))[:200] if isinstance(result.get("output"), dict) else "",
    }
    RUN_HISTORY.insert(0, run_record)
    if len(RUN_HISTORY) > MAX_HISTORY:
        RUN_HISTORY.pop()

    return JSONResponse(content=json.loads(json.dumps(result, default=str)))


@app.get("/runs")
async def get_run_history(limit: int = Query(20, le=MAX_HISTORY)):
    return RUN_HISTORY[:limit]


# ── Clients ──────────────────────────────────────────────────────────────────

@app.get("/clients")
async def list_clients():
    if not CLIENTS_DIR.exists():
        return []
    clients = []
    for d in sorted(CLIENTS_DIR.iterdir()):
        if d.is_dir() and (d / "client.yaml").exists():
            with open(d / "client.yaml", "r") as f:
                cfg = yaml.safe_load(f) or {}
            clients.append({
                "slug": d.name,
                "company_name": cfg.get("company_name", d.name),
                "vertical": cfg.get("vertical", "unknown"),
                "deployment_status": cfg.get("deployment_status", "setup"),
                "enabled_workflows": cfg.get("enabled_workflows", []),
                "contract_value": cfg.get("contract_value", 0),
                "monthly_retainer": cfg.get("monthly_retainer", 0),
            })
    return clients


@app.post("/clients")
async def create_client(
    company_name: str = Form(...),
    vertical: str = Form("logistics"),
    contact_name: str = Form(""),
    contact_email: str = Form(""),
):
    slug = company_name.lower().replace(" ", "_").replace("-", "_")
    client_dir = CLIENTS_DIR / slug
    if client_dir.exists():
        raise HTTPException(409, f"Client '{slug}' already exists")

    client_dir.mkdir(parents=True, exist_ok=True)
    (client_dir / "overrides").mkdir()
    (client_dir / "data").mkdir()

    config = {
        "company_name": company_name,
        "vertical": vertical,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "deployment_start": datetime.utcnow().strftime("%Y-%m-%d"),
        "deployment_status": "setup",
        "enabled_workflows": [],
        "integrations": {},
        "contract_type": "deployment",
        "contract_value": 0,
        "monthly_retainer": 0,
    }
    with open(client_dir / "client.yaml", "w") as f:
        yaml.dump(config, f, default_flow_style=False)

    return {"status": "created", "slug": slug}


@app.get("/clients/{slug}")
async def get_client(slug: str):
    client_dir = CLIENTS_DIR / slug
    if not (client_dir / "client.yaml").exists():
        raise HTTPException(404, f"Client '{slug}' not found")
    with open(client_dir / "client.yaml", "r") as f:
        return yaml.safe_load(f)


@app.put("/clients/{slug}")
async def update_client(slug: str, config: dict):
    client_dir = CLIENTS_DIR / slug
    if not client_dir.exists():
        raise HTTPException(404, f"Client '{slug}' not found")
    with open(client_dir / "client.yaml", "w") as f:
        yaml.dump(config, f, default_flow_style=False)
    return {"status": "updated"}


@app.delete("/clients/{slug}")
async def delete_client(slug: str):
    import shutil
    client_dir = CLIENTS_DIR / slug
    if not client_dir.exists():
        raise HTTPException(404, f"Client '{slug}' not found")
    shutil.rmtree(client_dir)
    return {"status": "deleted"}


# ── Client Workflow Assignments ──────────────────────────────────────────────

@app.get("/clients/{slug}/workflows")
async def get_client_workflows(slug: str):
    client_dir = CLIENTS_DIR / slug
    if not (client_dir / "client.yaml").exists():
        raise HTTPException(404, f"Client '{slug}' not found")
    with open(client_dir / "client.yaml", "r") as f:
        cfg = yaml.safe_load(f) or {}
    return cfg.get("enabled_workflows", [])


@app.post("/clients/{slug}/workflows")
async def assign_workflow(slug: str, workflow_name: str = Form(...)):
    client_dir = CLIENTS_DIR / slug
    cfg_path = client_dir / "client.yaml"
    if not cfg_path.exists():
        raise HTTPException(404, f"Client '{slug}' not found")
    if workflow_name not in WORKFLOW_REGISTRY:
        raise HTTPException(404, f"Workflow '{workflow_name}' not found")

    with open(cfg_path, "r") as f:
        cfg = yaml.safe_load(f) or {}
    wfs = cfg.get("enabled_workflows", [])
    if workflow_name not in wfs:
        wfs.append(workflow_name)
        cfg["enabled_workflows"] = wfs
        with open(cfg_path, "w") as f:
            yaml.dump(cfg, f, default_flow_style=False)
    return {"status": "assigned", "workflows": wfs}


@app.delete("/clients/{slug}/workflows/{wf}")
async def unassign_workflow(slug: str, wf: str):
    client_dir = CLIENTS_DIR / slug
    cfg_path = client_dir / "client.yaml"
    if not cfg_path.exists():
        raise HTTPException(404, f"Client '{slug}' not found")

    with open(cfg_path, "r") as f:
        cfg = yaml.safe_load(f) or {}
    wfs = cfg.get("enabled_workflows", [])
    if wf in wfs:
        wfs.remove(wf)
        cfg["enabled_workflows"] = wfs
        with open(cfg_path, "w") as f:
            yaml.dump(cfg, f, default_flow_style=False)
    return {"status": "removed", "workflows": wfs}


# ── Client Config Overrides ─────────────────────────────────────────────────

@app.get("/clients/{slug}/overrides/{wf}")
async def get_overrides(slug: str, wf: str):
    override_path = CLIENTS_DIR / slug / "overrides" / f"{wf}.yaml"
    if not override_path.exists():
        return {}
    with open(override_path, "r") as f:
        return yaml.safe_load(f) or {}


@app.put("/clients/{slug}/overrides/{wf}")
async def save_overrides(slug: str, wf: str, overrides: dict):
    override_dir = CLIENTS_DIR / slug / "overrides"
    override_dir.mkdir(parents=True, exist_ok=True)
    with open(override_dir / f"{wf}.yaml", "w") as f:
        yaml.dump(overrides, f, default_flow_style=False)
    return {"status": "saved"}


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
