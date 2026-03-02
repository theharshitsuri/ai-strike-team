"""
Pydantic schemas for Load Scheduling workflow.
"""

from typing import Optional, Literal
from pydantic import Field
from core.validator import WorkflowResult


class LoadScheduleResult(WorkflowResult):
    """Structured extraction from a scheduling email."""
    load_id: str = Field(..., description="Load or shipment number")
    facility_name: str = Field(..., description="Pickup/delivery facility name")
    facility_address: str = Field(default="N/A", description="Facility address")
    appointment_date: str = Field(..., description="Date in YYYY-MM-DD format")
    appointment_time: str = Field(..., description="Time in HH:MM 24h format")
    time_window_minutes: int = Field(default=120, description="Appointment window in minutes")
    load_type: Literal["pickup", "delivery"] = Field(..., description="Pickup or delivery")
    contact_name: str = Field(default="N/A")
    contact_phone: str = Field(default="N/A")
    special_instructions: str = Field(default="N/A")
