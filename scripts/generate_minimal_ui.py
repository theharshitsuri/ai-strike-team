#!/usr/bin/env python3
"""
Generate minimalist black & white workflow UIs for all workflows.
"""

from pathlib import Path

WORKFLOWS = {
    "detention_tracking": {
        "title": "Detention Tracking",
        "subtitle": "Extract timestamps, calculate fees, generate invoices",
        "metrics": [
            ("99.7%", "Time Saved"),
            ("$26K+", "Annual Value"),
            ("98%", "Accuracy"),
            ("10 sec", "Per Document"),
        ],
        "description": "Upload check-call logs, driver messages, or facility records. AI extracts arrival/departure timestamps, calculates detention fees based on your rate structure, and generates ready-to-send invoices.",
        "config": [
            {"id": "rate_per_hour", "label": "Hourly Rate", "type": "range", "min": 25, "max": 200, "default": 75, "format": "currency"},
            {"id": "free_time_minutes", "label": "Free Time (minutes)", "type": "range", "min": 30, "max": 240, "step": 15, "default": 120, "format": "minutes"},
        ],
        "toggles": [
            {"id": "auto_invoice", "label": "Auto-generate invoice", "default": True},
            {"id": "slack_alert", "label": "Send Slack alert", "default": True},
        ],
        "upload_hint": "Check-call logs, driver messages, or facility records",
        "text_placeholder": "Paste detention log, check-call data, or facility timestamps...",
        "steps": [
            ("📄", "Reading document", "Parsing uploaded content"),
            ("🔍", "Extracting timestamps", "Finding arrival and departure times"),
            ("⏱️", "Calculating duration", "Computing wait and billable time"),
            ("💰", "Generating invoice", "Creating detention fee invoice"),
        ],
    },
    "freight_audit": {
        "title": "Freight Audit",
        "subtitle": "Compare invoices, flag discrepancies, recover overcharges",
        "metrics": [
            ("99.8%", "Time Saved"),
            ("$24K+", "Annual Value"),
            ("100%", "Coverage"),
            ("2-5%", "Recovered"),
        ],
        "description": "Upload carrier invoices and rate confirmations. AI compares line items, flags discrepancies, and identifies overcharges for recovery.",
        "config": [
            {"id": "tolerance", "label": "Tolerance ($)", "type": "range", "min": 1, "max": 50, "default": 5, "format": "currency"},
            {"id": "fuel_tolerance", "label": "Fuel % Tolerance", "type": "range", "min": 0, "max": 10, "default": 2, "format": "percent"},
        ],
        "toggles": [
            {"id": "auto_flag", "label": "Auto-flag discrepancies", "default": True},
            {"id": "email_report", "label": "Email audit report", "default": False},
        ],
        "upload_hint": "Carrier invoice or rate confirmation",
        "text_placeholder": "Paste invoice data...",
        "steps": [
            ("📄", "Reading invoice", "Parsing carrier invoice"),
            ("📋", "Extracting charges", "Identifying line items"),
            ("🔍", "Comparing rates", "Checking against rate con"),
            ("⚠️", "Flagging issues", "Identifying discrepancies"),
        ],
    },
    "load_scheduling": {
        "title": "Load Scheduling",
        "subtitle": "Parse emails, create calendar events, confirm appointments",
        "metrics": [
            ("99.6%", "Time Saved"),
            ("$10K+", "Annual Value"),
            ("0%", "Double Bookings"),
            ("10 sec", "Per Load"),
        ],
        "description": "Upload scheduling emails or requests. AI extracts appointment details, checks for conflicts, and creates calendar events.",
        "config": [
            {"id": "buffer_minutes", "label": "Buffer (minutes)", "type": "range", "min": 0, "max": 60, "default": 15, "format": "minutes"},
        ],
        "toggles": [
            {"id": "auto_confirm", "label": "Auto-send confirmation", "default": False},
            {"id": "check_conflicts", "label": "Check for conflicts", "default": True},
        ],
        "upload_hint": "Scheduling email or appointment request",
        "text_placeholder": "Paste scheduling email...",
        "steps": [
            ("📧", "Reading email", "Parsing scheduling request"),
            ("📅", "Extracting details", "Finding date, time, location"),
            ("🔍", "Checking conflicts", "Verifying availability"),
            ("✅", "Creating event", "Generating calendar entry"),
        ],
    },
    "shipment_followup": {
        "title": "Shipment Follow-up",
        "subtitle": "Monitor overdue shipments, generate follow-up emails",
        "metrics": [
            ("99.6%", "Time Saved"),
            ("$19K+", "Annual Value"),
            ("20%", "Fewer Complaints"),
            ("10 sec", "Per Email"),
        ],
        "description": "Upload shipment status data. AI identifies overdue shipments and generates professional follow-up emails.",
        "config": [
            {"id": "overdue_hours", "label": "Overdue Threshold (hrs)", "type": "range", "min": 1, "max": 24, "default": 4, "format": ""},
        ],
        "toggles": [
            {"id": "auto_send", "label": "Auto-send follow-ups", "default": False},
            {"id": "escalate", "label": "Escalate critical", "default": True},
        ],
        "upload_hint": "Shipment status or tracking data",
        "text_placeholder": "Paste shipment data...",
        "steps": [
            ("📦", "Reading shipment", "Parsing tracking data"),
            ("🔍", "Checking status", "Evaluating delivery timeline"),
            ("⏰", "Calculating overdue", "Determining urgency"),
            ("✉️", "Generating email", "Drafting follow-up message"),
        ],
    },
    "maintenance_triage": {
        "title": "Maintenance Triage",
        "subtitle": "Classify tickets, assign priority, route to teams",
        "metrics": [
            ("99.4%", "Time Saved"),
            ("$15K+", "Annual Value"),
            ("2x", "Wrench Time"),
            ("10 sec", "Per Ticket"),
        ],
        "description": "Upload maintenance tickets. AI classifies the issue, assigns priority, and routes to the appropriate team.",
        "config": [
            {"id": "confidence", "label": "Confidence Threshold (%)", "type": "range", "min": 50, "max": 99, "default": 70, "format": "percent"},
        ],
        "toggles": [
            {"id": "auto_escalate", "label": "Auto-escalate safety issues", "default": True},
            {"id": "notify_team", "label": "Notify assigned team", "default": True},
        ],
        "upload_hint": "Maintenance ticket or work request",
        "text_placeholder": "Paste maintenance ticket...",
        "steps": [
            ("📋", "Reading ticket", "Parsing maintenance request"),
            ("🏷️", "Classifying", "Identifying issue type"),
            ("🎯", "Assigning priority", "Evaluating urgency"),
            ("👥", "Routing team", "Selecting technicians"),
        ],
    },
    "qa_anomaly": {
        "title": "QA Anomaly Detection",
        "subtitle": "Analyze inspection data, detect statistical anomalies",
        "metrics": [
            ("99.9%", "Time Saved"),
            ("$10K+", "Annual Value"),
            ("99%", "Detection Rate"),
            ("3x", "Faster"),
        ],
        "description": "Upload inspection data. AI performs statistical analysis to detect anomalies and out-of-spec measurements.",
        "config": [
            {"id": "z_score", "label": "Z-Score Threshold", "type": "range", "min": 1.5, "max": 4, "step": 0.1, "default": 2.5, "format": ""},
        ],
        "toggles": [
            {"id": "auto_alert", "label": "Auto-alert on anomaly", "default": True},
            {"id": "include_stats", "label": "Include statistics", "default": True},
        ],
        "upload_hint": "Inspection data (CSV)",
        "text_placeholder": "Paste CSV data...",
        "steps": [
            ("📊", "Loading data", "Parsing inspection records"),
            ("📈", "Calculating stats", "Computing mean, std dev"),
            ("🔍", "Detecting anomalies", "Finding outliers"),
            ("📝", "Generating report", "Creating summary"),
        ],
    },
    "production_report": {
        "title": "Production Report",
        "subtitle": "Aggregate data, generate executive summaries",
        "metrics": [
            ("99.9%", "Time Saved"),
            ("$25K+", "Annual Value"),
            ("Real-time", "Insights"),
            ("10 sec", "Per Report"),
        ],
        "description": "Upload production data. AI aggregates metrics and generates executive summaries with KPIs.",
        "config": [
            {"id": "target_output", "label": "Daily Target", "type": "range", "min": 100, "max": 5000, "step": 100, "default": 1000, "format": ""},
        ],
        "toggles": [
            {"id": "include_trends", "label": "Include trends", "default": True},
            {"id": "email_report", "label": "Email report", "default": False},
        ],
        "upload_hint": "Production data (CSV)",
        "text_placeholder": "Paste CSV data...",
        "steps": [
            ("📊", "Loading data", "Parsing production records"),
            ("📈", "Calculating KPIs", "Computing metrics"),
            ("🎯", "Comparing targets", "Evaluating performance"),
            ("📝", "Generating summary", "Writing narrative"),
        ],
    },
    "po_email_to_erp": {
        "title": "PO Email to ERP",
        "subtitle": "Extract PO details, validate SKUs, prepare ERP data",
        "metrics": [
            ("99.8%", "Time Saved"),
            ("$10K+", "Annual Value"),
            ("<1%", "Error Rate"),
            ("10 sec", "Per PO"),
        ],
        "description": "Upload PO emails. AI extracts order details, validates SKUs, and prepares data for ERP import.",
        "config": [
            {"id": "price_tolerance", "label": "Price Tolerance (%)", "type": "range", "min": 1, "max": 15, "default": 5, "format": "percent"},
        ],
        "toggles": [
            {"id": "validate_skus", "label": "Validate SKUs", "default": True},
            {"id": "auto_import", "label": "Auto-import to ERP", "default": False},
        ],
        "upload_hint": "PO email or document",
        "text_placeholder": "Paste PO email...",
        "steps": [
            ("📧", "Reading document", "Parsing PO content"),
            ("📋", "Extracting header", "Finding PO#, customer"),
            ("📦", "Extracting items", "Parsing line items"),
            ("✅", "Validating", "Checking SKUs and prices"),
        ],
    },
    "inventory_restock": {
        "title": "Inventory Restock",
        "subtitle": "Forecast demand, generate reorder recommendations",
        "metrics": [
            ("99.9%", "Time Saved"),
            ("$15K+", "Annual Value"),
            ("85%", "Forecast Accuracy"),
            ("<0.5%", "Stockout Rate"),
        ],
        "description": "Upload inventory and sales data. AI forecasts demand and generates reorder recommendations.",
        "config": [
            {"id": "safety_weeks", "label": "Safety Stock (weeks)", "type": "range", "min": 1, "max": 8, "default": 2, "format": ""},
            {"id": "lead_days", "label": "Lead Time (days)", "type": "range", "min": 1, "max": 30, "default": 7, "format": ""},
        ],
        "toggles": [
            {"id": "auto_order", "label": "Auto-generate orders", "default": False},
            {"id": "alert_critical", "label": "Alert on critical", "default": True},
        ],
        "upload_hint": "Inventory data (CSV)",
        "text_placeholder": "Paste CSV data...",
        "steps": [
            ("📊", "Loading data", "Parsing inventory records"),
            ("📈", "Calculating trends", "Computing demand patterns"),
            ("🛡️", "Safety stock", "Determining buffer levels"),
            ("📋", "Generating orders", "Creating recommendations"),
        ],
    },
    "warranty_claims": {
        "title": "Warranty Claims",
        "subtitle": "Process claims, validate eligibility, automate decisions",
        "metrics": [
            ("99.7%", "Time Saved"),
            ("$12K+", "Annual Value"),
            ("90%", "Cost Reduction"),
            ("10x", "Faster"),
        ],
        "description": "Upload warranty claims. AI validates eligibility and automates approval decisions.",
        "config": [
            {"id": "warranty_days", "label": "Warranty Period (days)", "type": "range", "min": 30, "max": 730, "step": 30, "default": 365, "format": ""},
        ],
        "toggles": [
            {"id": "auto_approve", "label": "Auto-approve eligible", "default": False},
            {"id": "notify_customer", "label": "Notify customer", "default": True},
        ],
        "upload_hint": "Warranty claim form",
        "text_placeholder": "Paste claim details...",
        "steps": [
            ("📋", "Reading claim", "Parsing claim details"),
            ("🔍", "Validating product", "Checking serial number"),
            ("📅", "Checking warranty", "Verifying coverage"),
            ("⚖️", "Making decision", "Determining approval"),
        ],
    },
    "scheduling_automation": {
        "title": "Scheduling Automation",
        "subtitle": "Parse requests, check availability, confirm appointments",
        "metrics": [
            ("99.6%", "Time Saved"),
            ("$6K+", "Annual Value"),
            ("0%", "Double Bookings"),
            ("2%", "No-Show Rate"),
        ],
        "description": "Upload scheduling requests. AI extracts details, checks availability, and generates confirmations.",
        "config": [
            {"id": "min_gap", "label": "Min Gap (minutes)", "type": "range", "min": 0, "max": 60, "default": 15, "format": "minutes"},
        ],
        "toggles": [
            {"id": "auto_confirm", "label": "Auto-send confirmation", "default": False},
            {"id": "send_reminder", "label": "Send reminders", "default": True},
        ],
        "upload_hint": "Scheduling request",
        "text_placeholder": "Paste scheduling request...",
        "steps": [
            ("📧", "Reading request", "Parsing scheduling details"),
            ("📅", "Extracting details", "Finding date, time, type"),
            ("🔍", "Checking availability", "Verifying open slots"),
            ("✅", "Creating appointment", "Booking the slot"),
        ],
    },
}


def generate_html(wf_id: str, wf: dict) -> str:
    # Config inputs
    config_html = ""
    for cfg in wf.get("config", []):
        step = cfg.get("step", 1)
        fmt = cfg.get("format", "")
        default_display = f"${cfg['default']}" if fmt == "currency" else f"{cfg['default']}%" if fmt == "percent" else f"{cfg['default']} min" if fmt == "minutes" else str(cfg['default'])
        config_html += f'''
          <div class="form-group">
            <label class="form-label">{cfg['label']}</label>
            <div class="range-group">
              <input type="range" class="range-input" id="{cfg['id']}" data-config="{cfg['id']}" data-format="{fmt}" min="{cfg.get('min', 0)}" max="{cfg.get('max', 100)}" step="{cfg.get('step', 1)}" value="{cfg['default']}">
              <span class="range-value" id="{cfg['id']}-value">{default_display}</span>
            </div>
          </div>'''
    
    # Toggles
    toggles_html = ""
    for tog in wf.get("toggles", []):
        checked = "checked" if tog.get("default") else ""
        toggles_html += f'''
          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" data-config="{tog['id']}" {checked}>
              <span class="toggle-switch"></span>
              <span class="toggle-label">{tog['label']}</span>
            </label>
          </div>'''
    
    # Metrics
    metrics_html = "\n".join([
        f'''<div class="metric"><div class="metric-value">{m[0]}</div><div class="metric-label">{m[1]}</div></div>'''
        for m in wf.get("metrics", [])
    ])
    
    # Processing steps
    steps_html = "\n".join([
        f'''<div class="processing-step">
          <span class="processing-step-icon">{s[0]}</span>
          <div><div class="processing-step-title">{s[1]}</div><div class="processing-step-subtitle">{s[2]}</div></div>
        </div>'''
        for s in wf.get("steps", [])
    ])
    
    # Default config JS
    default_config = {}
    for cfg in wf.get("config", []):
        default_config[cfg["id"]] = cfg["default"]
    for tog in wf.get("toggles", []):
        default_config[tog["id"]] = tog.get("default", False)
    
    config_js = str(default_config).replace("'", '"').replace("True", "true").replace("False", "false")
    
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{wf['title']}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/dashboard/workflows/shared-minimal.css">
</head>
<body data-theme="light">
  <div class="container">
    <header class="header">
      <a href="/" class="logo">AI Strike Team</a>
      <nav class="nav">
        <a href="#" onclick="Workflow.loadDemo()">Demo</a>
        <a href="/">Dashboard</a>
      </nav>
    </header>

    <div class="steps">
      <div class="step active" onclick="Workflow.goTo(1)"><span class="step-number">1</span><span>Overview</span></div>
      <div class="step-connector"></div>
      <div class="step" onclick="Workflow.goTo(2)"><span class="step-number">2</span><span>Upload</span></div>
      <div class="step-connector"></div>
      <div class="step" onclick="Workflow.goTo(3)"><span class="step-number">3</span><span>Process</span></div>
      <div class="step-connector"></div>
      <div class="step" onclick="Workflow.goTo(4)"><span class="step-number">4</span><span>Results</span></div>
    </div>

    <!-- Step 1: Overview -->
    <div id="step-1" class="step-content active">
      <div class="step-header">
        <h1>{wf['title']}</h1>
        <p class="subtitle">{wf['subtitle']}</p>
      </div>
      <div class="metrics">{metrics_html}</div>
      <div class="card">
        <h3>How it works</h3>
        <p>{wf['description']}</p>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Configuration</h3>
          <button class="btn btn-ghost btn-sm" onclick="Workflow.resetConfig()">Reset</button>
        </div>
        <div class="form-row">{config_html}</div>
        <div class="form-row">{toggles_html}</div>
      </div>
      <div class="footer-actions">
        <div></div>
        <button class="btn btn-primary" onclick="Workflow.next()">Get Started →</button>
      </div>
    </div>

    <!-- Step 2: Upload -->
    <div id="step-2" class="step-content">
      <div class="step-header">
        <h1>Upload Data</h1>
        <p class="subtitle">{wf['upload_hint']}</p>
      </div>
      <div class="upload-zone">
        <input type="file" accept=".pdf,.txt,.csv,.doc,.docx,.xlsx">
        <div class="upload-icon">📄</div>
        <div class="upload-title">Drop file here</div>
        <div class="upload-subtitle">or click to browse</div>
      </div>
      <div class="divider">or paste text</div>
      <div class="form-group">
        <textarea class="form-textarea" id="text-input" rows="8" placeholder="{wf['text_placeholder']}"></textarea>
      </div>
      <div class="footer-actions">
        <button class="btn btn-secondary" onclick="Workflow.prev()">← Back</button>
        <div>
          <button class="btn btn-ghost" onclick="Workflow.loadDemo()">Load Demo</button>
          <button class="btn btn-primary" onclick="Workflow.run()">Process →</button>
        </div>
      </div>
    </div>

    <!-- Step 3: Processing -->
    <div id="step-3" class="step-content">
      <div class="step-header">
        <h1>Processing</h1>
        <p class="subtitle">Analyzing your data</p>
      </div>
      <div class="progress-container">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-info"><span id="progress-status">Starting...</span><span id="progress-pct">0%</span></div>
      </div>
      <div class="processing-steps">{steps_html}</div>
    </div>

    <!-- Step 4: Results -->
    <div id="step-4" class="step-content">
      <div class="results-header">
        <div><h1>Results</h1><p class="text-muted">Extracted data</p></div>
        <div class="results-actions">
          <button class="btn btn-secondary btn-sm" onclick="Workflow.goTo(2)">New</button>
          <button class="btn btn-primary btn-sm" onclick="Workflow.download('json')">Download</button>
        </div>
      </div>
      <div class="results-grid" id="results-grid"></div>
      <div class="card">
        <div class="card-header"><h3>Raw Output</h3></div>
        <pre class="json-display" id="json-output"></pre>
      </div>
    </div>
  </div>

  <button class="theme-toggle" onclick="Workflow.toggleTheme()">◐</button>
  <div id="toast-container" class="toast-container"></div>

  <script src="/dashboard/workflows/shared-minimal.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {{
      Workflow.init('{wf_id}', {config_js});
    }});
  </script>
</body>
</html>'''


def main():
    base = Path(__file__).parent.parent / "shubh"
    
    for wf_id, wf in WORKFLOWS.items():
        output = base / wf_id / "index-minimal.html"
        output.parent.mkdir(parents=True, exist_ok=True)
        
        html = generate_html(wf_id, wf)
        output.write_text(html, encoding="utf-8")
        print(f"Generated: {output}")


if __name__ == "__main__":
    main()
