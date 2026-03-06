"""
core/roi.py — ROI Calculator for workflow automation.

Every workflow declares how long the task takes manually.
This module auto-calculates time saved, cost saved, and cumulative ROI per client.

Usage:
    from core.roi import ROIMetrics, calculate_roi

    roi = calculate_roi(
        workflow_name="freight_audit",
        elapsed_seconds=3.2,
    )
    # roi.time_saved_minutes = 26.8 (30 min manual - 3.2s actual)
    # roi.cost_saved_usd = 13.40
"""

from pydantic import BaseModel, Field
from datetime import datetime


# Manual time per task (in minutes) — based on industry benchmarks
MANUAL_TIME_BENCHMARKS: dict[str, dict] = {
    "load_scheduling": {
        "manual_minutes": 12,
        "description": "Manually reading email, checking calendar, creating event, sending confirmation",
        "hourly_rate": 25.0,  # typical coordinator rate
    },
    "detention_tracking": {
        "manual_minutes": 20,
        "description": "Calculating detention from timestamps, verifying free time, creating invoice",
        "hourly_rate": 30.0,
    },
    "shipment_followup": {
        "manual_minutes": 15,
        "description": "Checking shipment status, drafting follow-up email, sending, logging",
        "hourly_rate": 25.0,
    },
    "freight_audit": {
        "manual_minutes": 30,
        "description": "Comparing invoice line items vs rate con, flagging discrepancies, creating report",
        "hourly_rate": 35.0,
    },
    "qa_anomaly": {
        "manual_minutes": 45,
        "description": "Reviewing inspection logs, calculating deviations, writing summary report",
        "hourly_rate": 40.0,
    },
    "maintenance_triage": {
        "manual_minutes": 8,
        "description": "Reading ticket, classifying priority/category, assigning to team",
        "hourly_rate": 30.0,
    },
    "production_report": {
        "manual_minutes": 90,
        "description": "Compiling data from multiple lines, calculating metrics, writing executive summary",
        "hourly_rate": 50.0,
    },
    "warranty_claims": {
        "manual_minutes": 20,
        "description": "Reading claim, checking warranty status, validating product, making decision",
        "hourly_rate": 28.0,
    },
    "po_email_to_erp": {
        "manual_minutes": 25,
        "description": "Reading PO email, keying line items into ERP, verifying SKUs and prices",
        "hourly_rate": 22.0,
    },
    "inventory_restock": {
        "manual_minutes": 60,
        "description": "Analyzing sales data, calculating reorder points, determining order quantities",
        "hourly_rate": 35.0,
    },
    "scheduling_automation": {
        "manual_minutes": 10,
        "description": "Reading request, checking calendar, finding slot, sending confirmation",
        "hourly_rate": 25.0,
    },
}


class ROIMetrics(BaseModel):
    """ROI metrics for a single workflow run."""
    workflow_name: str
    manual_minutes: float = Field(description="How long this task takes manually")
    automation_seconds: float = Field(description="How long the automation took")
    time_saved_minutes: float = Field(description="Net time saved")
    cost_saved_usd: float = Field(description="Cost saved at hourly rate")
    efficiency_multiplier: float = Field(description="How many X faster than manual")
    hourly_rate_used: float = Field(default=25.0)
    calculated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    # Projection fields
    daily_volume_estimate: int = Field(default=20, description="Estimated daily task volume")
    daily_hours_saved: float = Field(default=0.0)
    monthly_cost_saved: float = Field(default=0.0)
    annual_cost_saved: float = Field(default=0.0)


def calculate_roi(
    workflow_name: str,
    elapsed_seconds: float,
    daily_volume: int = 20,
) -> ROIMetrics:
    """
    Calculate ROI for a single workflow run.

    Args:
        workflow_name: Name of the workflow
        elapsed_seconds: How long the automation took
        daily_volume: Estimated daily task volume for projections
    """
    benchmark = MANUAL_TIME_BENCHMARKS.get(workflow_name, {
        "manual_minutes": 15,
        "description": "Generic task",
        "hourly_rate": 25.0,
    })

    manual_min = benchmark["manual_minutes"]
    hourly_rate = benchmark["hourly_rate"]
    auto_min = elapsed_seconds / 60

    time_saved = max(manual_min - auto_min, 0)
    cost_saved = (time_saved / 60) * hourly_rate
    multiplier = manual_min / auto_min if auto_min > 0 else 999

    daily_hours = (time_saved * daily_volume) / 60
    monthly_cost = cost_saved * daily_volume * 22  # 22 working days
    annual_cost = monthly_cost * 12

    return ROIMetrics(
        workflow_name=workflow_name,
        manual_minutes=manual_min,
        automation_seconds=round(elapsed_seconds, 2),
        time_saved_minutes=round(time_saved, 1),
        cost_saved_usd=round(cost_saved, 2),
        efficiency_multiplier=round(multiplier, 0),
        hourly_rate_used=hourly_rate,
        daily_volume_estimate=daily_volume,
        daily_hours_saved=round(daily_hours, 1),
        monthly_cost_saved=round(monthly_cost, 0),
        annual_cost_saved=round(annual_cost, 0),
    )


def format_roi_summary(roi: ROIMetrics) -> str:
    """Format ROI as a human-readable summary for clients."""
    return (
        f"⏱️  This task takes {roi.manual_minutes:.0f} min manually → done in {roi.automation_seconds:.1f}s ({roi.efficiency_multiplier:.0f}x faster)\n"
        f"💰 Saved ${roi.cost_saved_usd:.2f} per task (at ${roi.hourly_rate_used:.0f}/hr)\n"
        f"📈 At {roi.daily_volume_estimate} tasks/day → {roi.daily_hours_saved:.1f} hrs/day saved\n"
        f"💵 Projected savings: ${roi.monthly_cost_saved:,.0f}/month · ${roi.annual_cost_saved:,.0f}/year"
    )
