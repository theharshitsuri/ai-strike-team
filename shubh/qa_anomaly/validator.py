"""
Pydantic schemas for QA Anomaly Detection workflow.
"""

from typing import Literal
from pydantic import BaseModel, Field
from core.validator import WorkflowResult


class AnomalyFlag(BaseModel):
    """A single anomaly detected in inspection data."""
    row_index: int = Field(..., description="Row number in the log")
    column: str = Field(..., description="Column/measurement name")
    value: float = Field(..., description="Observed value")
    expected_min: float
    expected_max: float
    z_score: float = Field(default=0.0, description="Standard deviations from mean")
    deviation_pct: float = Field(default=0.0, description="% deviation from nearest spec limit")
    severity: Literal["low", "medium", "high", "critical"] = Field(default="medium")


class QAAnomalyResult(WorkflowResult):
    """Complete anomaly detection result."""
    total_rows: int
    total_anomalies: int
    anomalies: list[AnomalyFlag]
    columns_checked: list[str]
    summary: str = Field(default="", description="LLM-generated executive summary")
    severity: Literal["low", "medium", "high", "critical"] = Field(default="low")
    recommended_actions: list[str] = Field(default_factory=list)
