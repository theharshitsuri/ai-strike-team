"""
Pydantic schemas for Scheduling Automation workflow.
"""

from typing import Literal
from pydantic import BaseModel, Field
from core.validator import WorkflowResult


class ScheduleRequest(WorkflowResult):
    """Extracted scheduling request data."""
    request_id: str = Field(default="SCH-00000")
    requester_name: str = Field(...)
    requester_email: str = Field(default="N/A")
    request_type: Literal["meeting", "delivery", "service_call", "inspection", "pickup", "installation", "other"] = Field(...)
    preferred_date: str = Field(..., description="YYYY-MM-DD")
    preferred_time: str = Field(..., description="HH:MM 24h")
    duration_minutes: int = Field(default=60)
    location: str = Field(default="N/A")
    participants: list[str] = Field(default_factory=list)
    priority: Literal["high", "normal", "low"] = Field(default="normal")
    notes_text: str = Field(default="N/A")
    flexibility: Literal["exact", "flexible_time", "flexible_date", "fully_flexible"] = Field(default="flexible_time")


class ScheduleSlot(BaseModel):
    """An available time slot."""
    date: str
    start_time: str
    end_time: str
    available: bool = True


class ScheduleConfirmation(WorkflowResult):
    """Confirmed schedule with notification."""
    request_id: str
    confirmed_date: str
    confirmed_time: str
    duration_minutes: int
    location: str
    participants: list[str]
    confirmation_subject: str = Field(default="")
    confirmation_body: str = Field(default="")
    conflicts_found: int = Field(default=0)
    slot_optimized: bool = Field(default=False, description="Whether the slot was moved from requested time")
