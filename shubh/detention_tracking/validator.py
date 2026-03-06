"""
Pydantic schemas for Detention Tracking workflow.
Production-ready with comprehensive validation.
"""

from typing import Optional, Literal
from pydantic import Field, field_validator
from core.validator import WorkflowResult


class DetentionResult(WorkflowResult):
    """Extracted detention event data from documents/emails."""
    load_id: str = Field(..., description="Load or shipment number")
    facility_name: str = Field(..., description="Facility name")
    facility_type: Literal["shipper", "consignee", "warehouse", "other"] = Field(default="other")
    carrier_name: str = Field(default="N/A")
    driver_name: str = Field(default="N/A")
    arrival_time: str = Field(..., description="ISO 8601 arrival datetime")
    departure_time: str = Field(..., description="ISO 8601 departure datetime")
    check_in_time: str = Field(default="", description="Guard shack check-in time")
    loading_start_time: str = Field(default="N/A", description="When actual loading started")
    free_time_minutes: int = Field(default=120, ge=0, description="Free time before detention")
    detention_reason: str = Field(default="other")
    detention_reason_detail: str = Field(default="", description="Specific delay explanation")
    po_numbers: list[str] = Field(default_factory=list)

    @field_validator("arrival_time", "departure_time", mode="before")
    @classmethod
    def validate_datetime(cls, v):
        if not v or v == "N/A":
            raise ValueError("Arrival and departure times are required")
        return v

    @field_validator("detention_reason", mode="before")
    @classmethod
    def normalize_reason(cls, v):
        if isinstance(v, str):
            v = v.lower().strip().replace(" ", "_")
            valid = {"loading", "unloading", "paperwork", "waiting_for_dock", "product_not_ready", "other"}
            return v if v in valid else "other"
        return v


class DetentionInvoice(WorkflowResult):
    """Calculated detention invoice with full breakdown."""
    load_id: str
    facility_name: str
    facility_type: str = "other"
    carrier_name: str
    driver_name: str = "N/A"
    arrival_time: str = ""
    departure_time: str = ""
    total_time_minutes: float = Field(description="Total time at facility")
    free_time_minutes: int
    billable_minutes: float = Field(description="Minutes beyond free time")
    billable_hours: float
    rate_per_hour: float
    total_charge: float
    detention_reason: str
    detention_reason_detail: str = ""
    status: Literal["billable", "within_free_time", "capped", "escalated"] = Field(default="billable")
    requires_escalation: bool = Field(default=False)
    po_numbers: list[str] = Field(default_factory=list)
