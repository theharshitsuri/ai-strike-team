#!/usr/bin/env python3
"""
generate_workflow_ui.py — Generate production-ready workflow UIs from templates.

This script creates customizable, sellable workflow UIs based on the pro template.
Each workflow gets a complete UI with:
- 5-step wizard (Overview, Upload, Configure, Process, Results)
- Full configuration panel with company-editable settings
- ROI metrics and industry insights
- Export/import configuration
- Professional invoice/report generation

Usage:
    python scripts/generate_workflow_ui.py --workflow freight_audit
    python scripts/generate_workflow_ui.py --all
"""

import argparse
import os
from pathlib import Path

# Workflow definitions with their specific configurations
WORKFLOWS = {
    "freight_audit": {
        "title": "Freight Audit",
        "subtitle": "Compare carrier invoices vs rate confirmations, flag discrepancies, and recover overcharges.",
        "icon": "🔍",
        "color": "#f59e0b",
        "vertical": "Logistics",
        "metrics": [
            {"value": "99.8%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$24K-120K", "label": "Annual Value", "change": "per company"},
            {"value": "100%", "label": "Invoice Coverage", "change": "vs 15% sampling"},
            {"value": "2-5%", "label": "Spend Recovered", "change": "in overcharges"},
        ],
        "insights": [
            {"value": "20-25%", "label": "Of invoices have errors", "color": "error"},
            {"value": "52%", "label": "Errors from accessorials", "color": "warning"},
            {"value": "15+ days", "label": "Payment delay on exceptions", "color": "warning"},
            {"value": "<10 sec", "label": "AI audit time per invoice", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Tolerance Settings",
                "icon": "⚖️",
                "fields": [
                    {"id": "line_item_tolerance", "label": "Line Item Tolerance ($)", "type": "number", "default": 5, "hint": "Flag discrepancies over this amount"},
                    {"id": "total_tolerance", "label": "Total Tolerance ($)", "type": "number", "default": 10, "hint": "Flag total differences over this amount"},
                    {"id": "fuel_pct_tolerance", "label": "Fuel % Tolerance", "type": "range", "min": 0, "max": 10, "default": 2, "format": "percent"},
                ]
            },
            {
                "title": "Approval Thresholds",
                "icon": "✅",
                "fields": [
                    {"id": "auto_approve_under", "label": "Auto-Approve Under ($)", "type": "number", "default": 5},
                    {"id": "escalate_over", "label": "Escalate Over ($)", "type": "number", "default": 100},
                ]
            }
        ],
        "upload_formats": ["PDF", "TXT", "CSV", "Excel"],
        "upload_hint": "Upload carrier invoice and rate confirmation",
        "processing_steps": [
            {"icon": "📄", "title": "Reading Invoice", "subtitle": "Parsing carrier invoice document"},
            {"icon": "📋", "title": "Reading Rate Con", "subtitle": "Parsing rate confirmation"},
            {"icon": "🔍", "title": "Comparing Line Items", "subtitle": "Matching charges between documents"},
            {"icon": "⚠️", "title": "Flagging Discrepancies", "subtitle": "Identifying overcharges and errors"},
            {"icon": "📊", "title": "Generating Report", "subtitle": "Creating audit summary"},
        ],
    },
    "load_scheduling": {
        "title": "Load Scheduling",
        "subtitle": "Parse scheduling emails, extract appointment details, and create calendar events automatically.",
        "icon": "📅",
        "color": "#3b82f6",
        "vertical": "Logistics",
        "metrics": [
            {"value": "99.6%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$10K-31K", "label": "Annual Value", "change": "per company"},
            {"value": "0%", "label": "Double Bookings", "change": "eliminated"},
            {"value": "< 10 sec", "label": "Processing Time", "change": "per load"},
        ],
        "insights": [
            {"value": "5-15 hrs", "label": "Weekly scheduling time", "color": "error"},
            {"value": "10-15%", "label": "Appointments with conflicts", "color": "warning"},
            {"value": "$150-500", "label": "Cost per missed appointment", "color": "warning"},
            {"value": "30%", "label": "Dispatcher time on admin", "color": "warning"},
        ],
        "config_sections": [
            {
                "title": "Scheduling Rules",
                "icon": "⏰",
                "fields": [
                    {"id": "facility_open_hour", "label": "Facility Open Hour", "type": "number", "default": 6, "min": 0, "max": 12},
                    {"id": "facility_close_hour", "label": "Facility Close Hour", "type": "number", "default": 20, "min": 12, "max": 24},
                    {"id": "max_time_window_hours", "label": "Max Time Window (hrs)", "type": "number", "default": 8},
                ]
            },
            {
                "title": "Conflict Detection",
                "icon": "⚠️",
                "fields": [
                    {"id": "conflict_buffer_minutes", "label": "Buffer Between Appointments (min)", "type": "number", "default": 30},
                    {"id": "reminder_hours", "label": "Reminder Hours Before", "type": "number", "default": 4},
                ]
            }
        ],
        "upload_formats": ["TXT", "Email", "PDF"],
        "upload_hint": "Upload scheduling email or appointment request",
        "processing_steps": [
            {"icon": "📧", "title": "Reading Email", "subtitle": "Parsing scheduling request"},
            {"icon": "📅", "title": "Extracting Details", "subtitle": "Identifying date, time, location"},
            {"icon": "🔍", "title": "Checking Conflicts", "subtitle": "Verifying availability"},
            {"icon": "📆", "title": "Creating Event", "subtitle": "Generating calendar entry"},
            {"icon": "✉️", "title": "Drafting Confirmation", "subtitle": "Preparing confirmation message"},
        ],
    },
    "shipment_followup": {
        "title": "Shipment Follow-up",
        "subtitle": "Monitor overdue shipments and automatically generate professional follow-up emails.",
        "icon": "📦",
        "color": "#ec4899",
        "vertical": "Logistics",
        "metrics": [
            {"value": "99.6%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$19K-52K", "label": "Annual Value", "change": "per company"},
            {"value": "20%", "label": "Fewer Complaints", "change": "reduction"},
            {"value": "< 10 sec", "label": "Email Generation", "change": "per shipment"},
        ],
        "insights": [
            {"value": "3-8 hrs", "label": "Daily follow-up time", "color": "error"},
            {"value": "24-48 hrs", "label": "Communication delay", "color": "warning"},
            {"value": "15-25%", "label": "Shipments need follow-up", "color": "warning"},
            {"value": "$50-200", "label": "Cost per escalation", "color": "warning"},
        ],
        "config_sections": [
            {
                "title": "Follow-up Triggers",
                "icon": "🔔",
                "fields": [
                    {"id": "overdue_trigger_hours", "label": "Overdue Trigger (hrs)", "type": "number", "default": 4},
                    {"id": "followup_interval_hours", "label": "Follow-up Interval (hrs)", "type": "number", "default": 8},
                    {"id": "critical_overdue_hours", "label": "Critical Threshold (hrs)", "type": "number", "default": 24},
                ]
            },
            {
                "title": "Escalation Rules",
                "icon": "⚠️",
                "fields": [
                    {"id": "escalate_after_attempts", "label": "Escalate After Attempts", "type": "number", "default": 3},
                    {"id": "customer_notify_after_hours", "label": "Notify Customer After (hrs)", "type": "number", "default": 12},
                ]
            }
        ],
        "upload_formats": ["TXT", "CSV", "JSON"],
        "upload_hint": "Upload shipment status data or tracking information",
        "processing_steps": [
            {"icon": "📦", "title": "Reading Shipment Data", "subtitle": "Parsing tracking information"},
            {"icon": "🔍", "title": "Checking Status", "subtitle": "Evaluating delivery timeline"},
            {"icon": "⏰", "title": "Calculating Overdue", "subtitle": "Determining urgency level"},
            {"icon": "✉️", "title": "Generating Email", "subtitle": "Drafting follow-up message"},
            {"icon": "🚨", "title": "Setting Escalation", "subtitle": "Flagging for management if needed"},
        ],
    },
    "maintenance_triage": {
        "title": "Maintenance Triage",
        "subtitle": "Classify maintenance tickets, assign priority, and route to the correct team automatically.",
        "icon": "🔧",
        "color": "#8b5cf6",
        "vertical": "Manufacturing",
        "metrics": [
            {"value": "99.4%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$15K-50K", "label": "Annual Value", "change": "per company"},
            {"value": "2x", "label": "Wrench Time", "change": "improvement"},
            {"value": "< 10 sec", "label": "Triage Time", "change": "per ticket"},
        ],
        "insights": [
            {"value": "35%", "label": "Wrench time (poor triage)", "color": "error"},
            {"value": "70%+", "label": "Wrench time (good triage)", "color": "success"},
            {"value": "45%", "label": "Emergency ratio typical", "color": "warning"},
            {"value": "<15%", "label": "Emergency ratio achievable", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Priority Rules",
                "icon": "🎯",
                "fields": [
                    {"id": "auto_escalate_safety", "label": "Auto-Escalate Safety Issues", "type": "toggle", "default": True},
                    {"id": "confidence_threshold", "label": "Confidence Threshold (%)", "type": "range", "min": 50, "max": 99, "default": 70, "format": "percent"},
                ]
            }
        ],
        "upload_formats": ["TXT", "Email", "Form"],
        "upload_hint": "Upload maintenance ticket or work request",
        "processing_steps": [
            {"icon": "📋", "title": "Reading Ticket", "subtitle": "Parsing maintenance request"},
            {"icon": "🏷️", "title": "Classifying Category", "subtitle": "Identifying issue type"},
            {"icon": "🎯", "title": "Assigning Priority", "subtitle": "Evaluating urgency"},
            {"icon": "👥", "title": "Routing Team", "subtitle": "Selecting appropriate technicians"},
            {"icon": "🚨", "title": "Safety Check", "subtitle": "Flagging hazards if present"},
        ],
    },
    "qa_anomaly": {
        "title": "QA Anomaly Detection",
        "subtitle": "Analyze inspection data, detect statistical anomalies, and generate actionable reports.",
        "icon": "🔬",
        "color": "#10b981",
        "vertical": "Manufacturing",
        "metrics": [
            {"value": "99.9%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$10K-100K", "label": "Annual Value", "change": "per company"},
            {"value": "99%+", "label": "Detection Rate", "change": "vs 60-90% manual"},
            {"value": "3x", "label": "Faster Detection", "change": "than manual"},
        ],
        "insights": [
            {"value": "60-90%", "label": "Manual detection rate", "color": "warning"},
            {"value": "$89K+", "label": "QC inspector salary", "color": "warning"},
            {"value": "10-30%", "label": "Issues from missed QA", "color": "error"},
            {"value": "99%+", "label": "AI detection rate", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Detection Thresholds",
                "icon": "📊",
                "fields": [
                    {"id": "z_score_threshold", "label": "Z-Score Threshold", "type": "range", "min": 1.5, "max": 4.0, "step": 0.1, "default": 2.5},
                    {"id": "spec_deviation_pct", "label": "Spec Deviation (%)", "type": "range", "min": 1, "max": 15, "default": 5, "format": "percent"},
                    {"id": "min_data_points", "label": "Min Data Points", "type": "number", "default": 5},
                ]
            }
        ],
        "upload_formats": ["CSV", "Excel", "JSON"],
        "upload_hint": "Upload inspection data or measurement logs",
        "processing_steps": [
            {"icon": "📊", "title": "Loading Data", "subtitle": "Parsing inspection records"},
            {"icon": "📈", "title": "Calculating Statistics", "subtitle": "Computing mean, std dev, Z-scores"},
            {"icon": "🔍", "title": "Detecting Anomalies", "subtitle": "Identifying out-of-spec measurements"},
            {"icon": "📝", "title": "Generating Summary", "subtitle": "Creating executive report"},
            {"icon": "💡", "title": "Recommending Actions", "subtitle": "Suggesting corrective measures"},
        ],
    },
    "production_report": {
        "title": "Production Report",
        "subtitle": "Aggregate daily production data and generate executive summaries with KPIs.",
        "icon": "📈",
        "color": "#6366f1",
        "vertical": "Manufacturing",
        "metrics": [
            {"value": "99.9%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$25K-50K", "label": "Annual Value", "change": "per company"},
            {"value": "Real-time", "label": "Insights", "change": "vs 24-48hr delay"},
            {"value": "< 10 sec", "label": "Report Generation", "change": "per report"},
        ],
        "insights": [
            {"value": "1-2 hrs", "label": "Daily report compilation", "color": "error"},
            {"value": "24-48 hrs", "label": "Insight delay", "color": "warning"},
            {"value": "5-10%", "label": "Manual entry error rate", "color": "warning"},
            {"value": "Real-time", "label": "AI report generation", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Production Targets",
                "icon": "🎯",
                "fields": [
                    {"id": "daily_output_units", "label": "Daily Output Target", "type": "number", "default": 1000},
                    {"id": "max_downtime_pct", "label": "Max Downtime (%)", "type": "range", "min": 1, "max": 15, "default": 5, "format": "percent"},
                    {"id": "quality_pass_rate_pct", "label": "Quality Pass Rate (%)", "type": "range", "min": 90, "max": 100, "default": 98, "format": "percent"},
                    {"id": "max_scrap_rate_pct", "label": "Max Scrap Rate (%)", "type": "range", "min": 0, "max": 10, "default": 2, "format": "percent"},
                ]
            }
        ],
        "upload_formats": ["CSV", "Excel", "JSON"],
        "upload_hint": "Upload daily production data",
        "processing_steps": [
            {"icon": "📊", "title": "Loading Data", "subtitle": "Parsing production records"},
            {"icon": "📈", "title": "Calculating KPIs", "subtitle": "Computing output, downtime, quality"},
            {"icon": "🎯", "title": "Comparing Targets", "subtitle": "Evaluating performance vs goals"},
            {"icon": "📝", "title": "Generating Summary", "subtitle": "Writing executive narrative"},
            {"icon": "💡", "title": "Recommendations", "subtitle": "Suggesting improvements"},
        ],
    },
    "po_email_to_erp": {
        "title": "PO Email to ERP",
        "subtitle": "Extract purchase order details from emails and prepare data for ERP import.",
        "icon": "📧",
        "color": "#0ea5e9",
        "vertical": "Wholesale",
        "metrics": [
            {"value": "99.8%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$10K-32K", "label": "Annual Value", "change": "per company"},
            {"value": "<1%", "label": "Error Rate", "change": "vs 5-10% manual"},
            {"value": "< 10 sec", "label": "Processing Time", "change": "per PO"},
        ],
        "insights": [
            {"value": "8-25 hrs", "label": "Weekly manual entry", "color": "error"},
            {"value": "5-10%", "label": "Manual error rate", "color": "warning"},
            {"value": "$15-50", "label": "Cost per error", "color": "warning"},
            {"value": "100s", "label": "Supplier formats handled", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Validation Rules",
                "icon": "✅",
                "fields": [
                    {"id": "price_tolerance_pct", "label": "Price Tolerance (%)", "type": "range", "min": 1, "max": 15, "default": 5, "format": "percent"},
                ]
            }
        ],
        "upload_formats": ["PDF", "Email", "Excel", "Image"],
        "upload_hint": "Upload purchase order email or document",
        "processing_steps": [
            {"icon": "📧", "title": "Reading Document", "subtitle": "Parsing PO content"},
            {"icon": "📋", "title": "Extracting Header", "subtitle": "Identifying PO#, customer, dates"},
            {"icon": "📦", "title": "Extracting Line Items", "subtitle": "Parsing SKUs, quantities, prices"},
            {"icon": "✅", "title": "Validating Data", "subtitle": "Checking SKUs and prices"},
            {"icon": "💾", "title": "Preparing ERP Data", "subtitle": "Formatting for import"},
        ],
    },
    "inventory_restock": {
        "title": "Inventory Restock",
        "subtitle": "Analyze inventory levels, forecast demand, and generate reorder recommendations.",
        "icon": "📦",
        "color": "#14b8a6",
        "vertical": "Wholesale",
        "metrics": [
            {"value": "99.9%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$15K-75K", "label": "Annual Value", "change": "per company"},
            {"value": "85%", "label": "Forecast Accuracy", "change": "vs 65% manual"},
            {"value": "< 0.5%", "label": "Stockout Rate", "change": "vs 2-5%"},
        ],
        "insights": [
            {"value": "2-5%", "label": "Revenue lost to stockouts", "color": "error"},
            {"value": "20-30%", "label": "Excess carrying costs", "color": "warning"},
            {"value": "65%", "label": "Manual forecast accuracy", "color": "warning"},
            {"value": "85%", "label": "AI forecast accuracy", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Forecasting Settings",
                "icon": "📈",
                "fields": [
                    {"id": "moving_avg_periods", "label": "Moving Average Periods", "type": "number", "default": 4},
                    {"id": "safety_stock_weeks", "label": "Safety Stock (weeks)", "type": "number", "default": 2},
                    {"id": "lead_time_days", "label": "Lead Time (days)", "type": "number", "default": 7},
                    {"id": "critical_days_of_stock", "label": "Critical Days Threshold", "type": "number", "default": 3},
                ]
            }
        ],
        "upload_formats": ["CSV", "Excel", "JSON"],
        "upload_hint": "Upload inventory and sales data",
        "processing_steps": [
            {"icon": "📊", "title": "Loading Data", "subtitle": "Parsing inventory records"},
            {"icon": "📈", "title": "Calculating Trends", "subtitle": "Computing demand patterns"},
            {"icon": "🛡️", "title": "Safety Stock", "subtitle": "Determining buffer levels"},
            {"icon": "🚨", "title": "Identifying Critical", "subtitle": "Flagging low-stock items"},
            {"icon": "📋", "title": "Generating Orders", "subtitle": "Creating restock recommendations"},
        ],
    },
    "warranty_claims": {
        "title": "Warranty Claims",
        "subtitle": "Process warranty claims, validate eligibility, and automate approval decisions.",
        "icon": "🛡️",
        "color": "#f43f5e",
        "vertical": "Wholesale",
        "metrics": [
            {"value": "99.7%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$12K-36K", "label": "Annual Value", "change": "per company"},
            {"value": "90%", "label": "Cost Reduction", "change": "per claim"},
            {"value": "10x", "label": "Faster Processing", "change": "than manual"},
        ],
        "insights": [
            {"value": "10", "label": "Manual touchpoints", "color": "error"},
            {"value": "15 min", "label": "Avg handling time", "color": "warning"},
            {"value": "$5", "label": "Manual cost per claim", "color": "warning"},
            {"value": "$0.50", "label": "AI cost per claim", "color": "success"},
        ],
        "config_sections": [
            {
                "title": "Warranty Rules",
                "icon": "📋",
                "fields": [
                    {"id": "warranty_period_days", "label": "Warranty Period (days)", "type": "number", "default": 365},
                    {"id": "auto_approve_max_days", "label": "Auto-Approve Within (days)", "type": "number", "default": 90},
                    {"id": "max_auto_approve_value", "label": "Max Auto-Approve Value ($)", "type": "number", "default": 500},
                    {"id": "review_over_value", "label": "Review Over Value ($)", "type": "number", "default": 200},
                ]
            }
        ],
        "upload_formats": ["TXT", "PDF", "Form", "Email"],
        "upload_hint": "Upload warranty claim form or request",
        "processing_steps": [
            {"icon": "📋", "title": "Reading Claim", "subtitle": "Parsing claim details"},
            {"icon": "🔍", "title": "Validating Product", "subtitle": "Checking product and serial"},
            {"icon": "📅", "title": "Checking Warranty", "subtitle": "Verifying coverage period"},
            {"icon": "⚖️", "title": "Applying Rules", "subtitle": "Determining approval status"},
            {"icon": "✉️", "title": "Generating Response", "subtitle": "Creating decision notification"},
        ],
    },
    "scheduling_automation": {
        "title": "Scheduling Automation",
        "subtitle": "Parse scheduling requests, check availability, and generate confirmations.",
        "icon": "📆",
        "color": "#a855f7",
        "vertical": "Cross-Vertical",
        "metrics": [
            {"value": "99.6%", "label": "Time Saved", "change": "vs manual"},
            {"value": "$6K-18K", "label": "Annual Value", "change": "per company"},
            {"value": "0%", "label": "Double Bookings", "change": "eliminated"},
            {"value": "2%", "label": "No-Show Rate", "change": "with reminders"},
        ],
        "insights": [
            {"value": "24/7", "label": "Customer expectation", "color": "warning"},
            {"value": "20-30%", "label": "Reschedule rate", "color": "warning"},
            {"value": "5-10%", "label": "No-show without reminders", "color": "error"},
            {"value": "$50-150", "label": "Cost per double-booking", "color": "error"},
        ],
        "config_sections": [
            {
                "title": "Business Hours",
                "icon": "🕐",
                "fields": [
                    {"id": "business_start_hour", "label": "Start Hour", "type": "number", "default": 8, "min": 0, "max": 12},
                    {"id": "business_end_hour", "label": "End Hour", "type": "number", "default": 18, "min": 12, "max": 24},
                    {"id": "min_gap_minutes", "label": "Min Gap Between (min)", "type": "number", "default": 15},
                    {"id": "max_advance_days", "label": "Max Advance Booking (days)", "type": "number", "default": 90},
                ]
            }
        ],
        "upload_formats": ["TXT", "Email", "Form"],
        "upload_hint": "Upload scheduling request",
        "processing_steps": [
            {"icon": "📧", "title": "Reading Request", "subtitle": "Parsing scheduling details"},
            {"icon": "📅", "title": "Extracting Details", "subtitle": "Identifying date, time, type"},
            {"icon": "🔍", "title": "Checking Availability", "subtitle": "Verifying open slots"},
            {"icon": "📆", "title": "Creating Appointment", "subtitle": "Booking the slot"},
            {"icon": "✉️", "title": "Sending Confirmation", "subtitle": "Generating confirmation message"},
        ],
    },
}


def generate_workflow_ui(workflow_id: str, output_dir: Path) -> None:
    """Generate a production-ready UI for a workflow."""
    if workflow_id not in WORKFLOWS:
        print(f"Unknown workflow: {workflow_id}")
        return
    
    wf = WORKFLOWS[workflow_id]
    output_file = output_dir / workflow_id / "index-pro.html"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate the HTML
    html = generate_html(workflow_id, wf)
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html)
    
    print(f"Generated: {output_file}")


def generate_html(workflow_id: str, wf: dict) -> str:
    """Generate the HTML content for a workflow UI."""
    
    # Generate metrics HTML
    metrics_html = "\n".join([
        f'''<div class="metric-card{' highlight' if i == 1 else ''}">
            <div class="metric-icon">{['⏱️', '💰', '🎯', '📈'][i]}</div>
            <div class="metric-value">{m['value']}</div>
            <div class="metric-label">{m['label']}</div>
            <div class="metric-change positive">↑ {m['change']}</div>
          </div>'''
        for i, m in enumerate(wf.get('metrics', [])[:4])
    ])
    
    # Generate insights HTML
    insights_html = "\n".join([
        f'''<div>
            <div style="font-size: 24px; font-weight: 800; color: var(--{ins['color']});">{ins['value']}</div>
            <div style="font-size: 13px; color: var(--fg-muted);">{ins['label']}</div>
          </div>'''
        for ins in wf.get('insights', [])[:4]
    ])
    
    # Generate config sections HTML
    config_html = ""
    for section in wf.get('config_sections', []):
        fields_html = ""
        for field in section.get('fields', []):
            if field['type'] == 'toggle':
                fields_html += f'''
                <div class="form-group">
                  <label class="toggle">
                    <input type="checkbox" data-config="{field['id']}" {'checked' if field.get('default') else ''}>
                    <span class="toggle-switch"></span>
                    <span class="toggle-label">{field['label']}</span>
                  </label>
                </div>'''
            elif field['type'] == 'range':
                fields_html += f'''
                <div class="form-group">
                  <label class="form-label">{field['label']}</label>
                  <div class="range-group">
                    <div class="range-header">
                      <span>{field['label']}</span>
                      <span class="range-value" id="{field['id']}-value">{field['default']}{('%' if field.get('format') == 'percent' else '')}</span>
                    </div>
                    <input type="range" class="range-input" id="{field['id']}" 
                           data-config="{field['id']}" data-format="{field.get('format', 'number')}"
                           min="{field.get('min', 0)}" max="{field.get('max', 100)}" 
                           step="{field.get('step', 1)}" value="{field['default']}">
                  </div>
                </div>'''
            else:
                fields_html += f'''
                <div class="form-group">
                  <label class="form-label">{field['label']}</label>
                  <input type="{field['type']}" class="form-input" id="{field['id']}" 
                         data-config="{field['id']}" value="{field['default']}"
                         {f'min="{field["min"]}"' if 'min' in field else ''}
                         {f'max="{field["max"]}"' if 'max' in field else ''}>
                  {f'<div class="form-hint">{field["hint"]}</div>' if 'hint' in field else ''}
                </div>'''
        
        config_html += f'''
          <div class="config-section">
            <div class="config-section-title">
              <span class="icon">{section['icon']}</span> {section['title']}
            </div>
            <div class="config-row">
              {fields_html}
            </div>
          </div>'''
    
    # Generate processing steps HTML
    steps_html = "\n".join([
        f'''<div class="processing-step">
            <div class="processing-step-icon">{step['icon']}</div>
            <div class="processing-step-content">
              <div class="processing-step-title">{step['title']}</div>
              <div class="processing-step-subtitle">{step['subtitle']}</div>
            </div>
          </div>'''
        for step in wf.get('processing_steps', [])
    ])
    
    # Generate upload formats HTML
    formats_html = "\n".join([
        f'<span class="upload-zone-format">{fmt}</span>'
        for fmt in wf.get('upload_formats', ['TXT', 'PDF'])
    ])
    
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{wf['title']} — AI Strike Team</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/dashboard/workflows/shared-pro.css">
  <style>
    :root {{
      --workflow-color: {wf['color']};
      --workflow-color-light: {wf['color']}1a;
      --workflow-gradient: linear-gradient(135deg, {wf['color']}, {wf['color']}dd);
    }}
    .workflow-icon {{ background: var(--workflow-gradient); }}
    .highlight-text {{ color: var(--workflow-color); }}
  </style>
</head>
<body data-theme="dark">

  <!-- SIDEBAR -->
  <aside class="app-sidebar">
    <div class="sidebar-header">
      <a href="/dashboard" class="sidebar-logo">
        <div class="sidebar-logo-icon">⚡</div>
        <span class="sidebar-logo-text">AI Strike Team</span>
      </a>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <div class="sidebar-section-title">Workflow</div>
        <a class="sidebar-item active" onclick="WorkflowPro.goToStep(1)"><span class="sidebar-item-icon">🏠</span>Overview</a>
        <a class="sidebar-item" onclick="WorkflowPro.goToStep(2)"><span class="sidebar-item-icon">📤</span>Upload</a>
        <a class="sidebar-item" onclick="WorkflowPro.goToStep(3)"><span class="sidebar-item-icon">⚙️</span>Configure</a>
        <a class="sidebar-item" onclick="WorkflowPro.goToStep(4)"><span class="sidebar-item-icon">🔄</span>Process</a>
        <a class="sidebar-item" onclick="WorkflowPro.goToStep(5)"><span class="sidebar-item-icon">📊</span>Results</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Quick Actions</div>
        <a class="sidebar-item" onclick="WorkflowPro.loadDemo()"><span class="sidebar-item-icon">🎮</span>Load Demo</a>
        <a class="sidebar-item" href="/dashboard"><span class="sidebar-item-icon">←</span>Dashboard</a>
      </div>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" style="width: 100%;" onclick="WorkflowPro.toggleTheme()">🌓 Toggle Theme</button>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="app-main">
    <header class="top-nav">
      <div class="top-nav-left">
        <button class="btn btn-icon btn-ghost sm" id="mobile-menu-toggle">☰</button>
        <div class="top-nav-breadcrumb">
          <a href="/dashboard">Workflows</a><span>/</span><span>{wf['title']}</span>
        </div>
      </div>
      <div class="top-nav-right">
        <span class="badge badge-primary">{wf['icon']} {wf['vertical']}</span>
        <button class="btn btn-secondary btn-sm" onclick="WorkflowPro.loadDemo()">Try Demo</button>
        <button class="btn btn-primary btn-sm" onclick="WorkflowPro.goToStep(2)">Start →</button>
      </div>
    </header>

    <div class="wizard">
      <!-- WIZARD STEPS -->
      <div class="wizard-steps">
        <div class="wizard-step active"><div class="wizard-step-number">1</div><div class="wizard-step-label">Overview</div></div>
        <div class="wizard-step-connector"></div>
        <div class="wizard-step"><div class="wizard-step-number">2</div><div class="wizard-step-label">Upload</div></div>
        <div class="wizard-step-connector"></div>
        <div class="wizard-step"><div class="wizard-step-number">3</div><div class="wizard-step-label">Configure</div></div>
        <div class="wizard-step-connector"></div>
        <div class="wizard-step"><div class="wizard-step-number">4</div><div class="wizard-step-label">Process</div></div>
        <div class="wizard-step-connector"></div>
        <div class="wizard-step"><div class="wizard-step-number">5</div><div class="wizard-step-label">Results</div></div>
      </div>

      <!-- STEP 1: OVERVIEW -->
      <div id="step-1" class="wizard-step-content active">
        <div class="wizard-header">
          <h1 class="wizard-title">{wf['title'].split()[0]} <span class="highlight-text">{' '.join(wf['title'].split()[1:])}</span></h1>
          <p class="wizard-subtitle">{wf['subtitle']}</p>
        </div>
        <div class="metrics-row">{metrics_html}</div>
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header"><div class="card-title"><span class="card-title-icon" style="background: var(--workflow-color-light); color: var(--workflow-color);">📊</span>Industry Insights</div></div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">{insights_html}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px;">
          <button class="btn btn-secondary" onclick="WorkflowPro.loadDemo()">🎮 Try Demo</button>
          <button class="btn btn-primary btn-lg" onclick="WorkflowPro.nextStep()">Get Started →</button>
        </div>
      </div>

      <!-- STEP 2: UPLOAD -->
      <div id="step-2" class="wizard-step-content">
        <div class="wizard-header">
          <h1 class="wizard-title">Upload Data</h1>
          <p class="wizard-subtitle">{wf.get('upload_hint', 'Upload your document')}</p>
        </div>
        <div class="upload-zone" id="upload-zone">
          <input type="file" accept=".pdf,.txt,.csv,.doc,.docx,.xlsx,.png,.jpg,.jpeg">
          <div class="upload-zone-icon">📁</div>
          <div class="upload-zone-title">Drop your file here</div>
          <div class="upload-zone-subtitle">or click to browse</div>
          <div class="upload-zone-formats">{formats_html}</div>
        </div>
        <div style="text-align: center; margin: 24px 0; color: var(--fg-muted);">— or —</div>
        <div class="form-group">
          <label class="form-label">Paste text directly</label>
          <textarea class="form-textarea" id="text-input" rows="6" placeholder="Paste your data here..."></textarea>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 32px;">
          <button class="btn btn-secondary" onclick="WorkflowPro.prevStep()">← Back</button>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-ghost" onclick="WorkflowPro.loadDemo()">Load Demo</button>
            <button class="btn btn-primary" onclick="WorkflowPro.nextStep()">Continue →</button>
          </div>
        </div>
      </div>

      <!-- STEP 3: CONFIGURE -->
      <div id="step-3" class="wizard-step-content">
        <div class="wizard-header">
          <h1 class="wizard-title">Configure Settings</h1>
          <p class="wizard-subtitle">Customize workflow rules for your company</p>
        </div>
        <div class="config-panel">
          <div class="config-header">
            <div class="config-header-title">⚙️ Workflow Settings</div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-ghost btn-sm" onclick="WorkflowPro.resetConfig()">Reset</button>
              <button class="btn btn-secondary btn-sm" onclick="WorkflowPro.exportConfig()">Export</button>
            </div>
          </div>
          {config_html}
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 32px;">
          <button class="btn btn-secondary" onclick="WorkflowPro.prevStep()">← Back</button>
          <button class="btn btn-primary btn-lg" onclick="WorkflowPro.runWorkflow()">⚡ Process</button>
        </div>
      </div>

      <!-- STEP 4: PROCESSING -->
      <div id="step-4" class="wizard-step-content">
        <div class="wizard-header">
          <h1 class="wizard-title">Processing...</h1>
          <p class="wizard-subtitle">AI is analyzing your data</p>
        </div>
        <div class="progress-container">
          <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width: 0%;"></div></div>
          <div class="progress-info">
            <span class="progress-status" id="progress-status">Initializing...</span>
            <span class="progress-percentage" id="progress-percentage">0%</span>
          </div>
        </div>
        <div class="processing-steps">{steps_html}</div>
      </div>

      <!-- STEP 5: RESULTS -->
      <div id="step-5" class="wizard-step-content">
        <div class="results-header">
          <div>
            <h1 class="results-title">Results</h1>
            <p style="color: var(--fg-muted);">AI-extracted data with analysis</p>
          </div>
          <div class="results-actions">
            <button class="btn btn-secondary" onclick="WorkflowPro.goToStep(2)">New Analysis</button>
            <button class="btn btn-secondary" onclick="WorkflowPro.downloadResults('json')">📥 Export JSON</button>
            <button class="btn btn-primary" onclick="WorkflowPro.downloadResults('csv')">📄 Download CSV</button>
          </div>
        </div>
        <div class="results-grid" id="extracted-data"></div>
        <div class="card" style="margin-top: 24px;">
          <div class="card-header"><div class="card-title">📊 ROI Summary</div></div>
          <div class="card-body"><div class="metrics-row" id="roi-metrics"></div></div>
        </div>
        <div class="card" style="margin-top: 24px;">
          <div class="card-header"><div class="card-title">🔧 Raw JSON</div></div>
          <div class="card-body"><pre class="json-display" id="json-preview" style="max-height: 300px; overflow: auto;"></pre></div>
        </div>
      </div>
    </div>
  </main>

  <div id="toast-container" class="toast-container"></div>

  <script src="/dashboard/workflows/shared-pro.js"></script>
  <script>
    const WORKFLOW_ID = '{workflow_id}';
    document.addEventListener('DOMContentLoaded', () => {{
      WorkflowPro.init(WORKFLOW_ID, {{}});
    }});
  </script>
</body>
</html>'''


def main():
    parser = argparse.ArgumentParser(description="Generate workflow UIs")
    parser.add_argument("--workflow", help="Workflow ID to generate")
    parser.add_argument("--all", action="store_true", help="Generate all workflows")
    parser.add_argument("--output", default="shubh", help="Output directory")
    args = parser.parse_args()
    
    output_dir = Path(__file__).parent.parent / args.output
    
    if args.all:
        for wf_id in WORKFLOWS:
            generate_workflow_ui(wf_id, output_dir)
    elif args.workflow:
        generate_workflow_ui(args.workflow, output_dir)
    else:
        print("Usage: python generate_workflow_ui.py --workflow <id> or --all")
        print(f"Available workflows: {', '.join(WORKFLOWS.keys())}")


if __name__ == "__main__":
    main()
