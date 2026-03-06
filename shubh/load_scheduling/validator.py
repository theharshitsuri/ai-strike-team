"""
Pydantic schemas for Load Scheduling workflow.
Production-ready with comprehensive field validation.
"""

from typing import Optional, Literal
from pydantic import Field, field_validator
from core.validator import WorkflowResult


class LoadScheduleResult(WorkflowResult):
    """Structured extraction from a scheduling email."""
    load_id: str = Field(..., description="Load or shipment number")
    shipper_name: str = Field(default="N/A", description="Company name of the shipper")
    facility_name: str = Field(..., description="Pickup/delivery facility name")
    facility_address: str = Field(default="N/A", description="Facility street address")
    appointment_date: str = Field(..., description="Date in YYYY-MM-DD format")
    appointment_time: str = Field(..., description="Time in HH:MM 24h format")
    time_window_minutes: int = Field(default=120, ge=15, le=480, description="Appointment window in minutes")
    load_type: Literal["pickup", "delivery"] = Field(..., description="Pickup or delivery")
    contact_name: str = Field(default="N/A")
    contact_phone: str = Field(default="N/A")
    equipment_type: str = Field(default="standard", description="Trailer type required")
    commodity: str = Field(default="general freight", description="Cargo description")
    weight_lbs: int = Field(default=0, ge=0, description="Weight in pounds")
    special_instructions: str = Field(default="none")
    reference_numbers: list[str] = Field(default_factory=list, description="PO, BOL, or other reference numbers")

    @field_validator("appointment_date")
    @classmethod
    def validate_date_format(cls, v):
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError(f"Date must be YYYY-MM-DD format, got: {v}")
        return v

    @field_validator("appointment_time")
    @classmethod
    def validate_time_format(cls, v):
        import re
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError(f"Time must be HH:MM format, got: {v}")
        return v

    @field_validator("load_type", mode="before")
    @classmethod
    def normalize_load_type(cls, v):
        if isinstance(v, str):
            v = v.lower().strip()
            if v in ("pick up", "pick-up", "pu", "p/u"):
                return "pickup"
            if v in ("deliver", "del", "drop", "drop-off", "dropoff"):
                return "delivery"
        return v
