"""
Pydantic schemas for Production Report workflow.
"""

from typing import Literal
from pydantic import Field
from core.validator import WorkflowResult


class ProductionMetrics(WorkflowResult):
    """Aggregated production metrics from CSV data."""
    report_date: str = Field(..., description="Date of production data YYYY-MM-DD")
    total_output_units: int = Field(default=0)
    target_output_units: int = Field(default=1000)
    output_variance_pct: float = Field(default=0.0)
    total_downtime_minutes: float = Field(default=0)
    downtime_pct: float = Field(default=0.0)
    quality_pass_count: int = Field(default=0)
    quality_fail_count: int = Field(default=0)
    quality_pass_rate_pct: float = Field(default=0.0)
    scrap_units: int = Field(default=0)
    scrap_rate_pct: float = Field(default=0.0)
    lines_active: int = Field(default=0)
    shifts_reported: int = Field(default=0)


class ProductionReportResult(WorkflowResult):
    """Complete production report with LLM-generated narrative."""
    metrics: ProductionMetrics
    executive_summary: str = Field(default="")
    highlights: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    overall_grade: Literal["excellent", "good", "satisfactory", "below_target", "critical"] = Field(default="satisfactory")
