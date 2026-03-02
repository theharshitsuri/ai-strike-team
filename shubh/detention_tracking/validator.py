"""
Pydantic schemas for Detention Tracking workflow.
"""

from typing import Optional, Literal
from pydantic import Field
from core.validator import WorkflowResult


class DetentionResult(WorkflowResult):
    """Extracted detention event data."""
    load_id: str = Field(..., description="Load or shipment number")
    facility_name: str = Field(..., description="Facility name")
    carrier_name: str = Field(default="N/A")
    driver_name: str = Field(default="N/A")
    arrival_time: str = Field(..., description="ISO 8601 arrival datetime")
    departure_time: str = Field(..., description="ISO 8601 departure datetime")
    free_time_minutes: int = Field(default=120, description="Free time before detention")
    detention_reason: Literal["loading", "unloading", "paperwork", "other"] = Field(default="other")


class DetentionInvoice(WorkflowResult):
    """Calculated detention invoice."""
    load_id: str
    facility_name: str
    carrier_name: str
    total_time_minutes: float = Field(description="Total time at facility in minutes")
    free_time_minutes: int
    billable_minutes: float = Field(description="Minutes beyond free time")
    billable_hours: float
    rate_per_hour: float
    total_charge: float
    detention_reason: str
    status: Literal["billable", "within_free_time", "capped"] = Field(default="billable")
