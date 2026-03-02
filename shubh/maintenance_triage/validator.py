"""
Pydantic schemas for Maintenance Ticket Triage workflow.
"""

from typing import Literal
from pydantic import Field
from core.validator import WorkflowResult


class MaintenanceTicketResult(WorkflowResult):
    """Classified maintenance ticket."""
    ticket_id: str = Field(..., description="Ticket ID")
    title: str = Field(..., description="Brief summary")
    category: Literal["electrical", "mechanical", "software", "plumbing", "hvac", "safety", "other"] = Field(...)
    priority: Literal["critical", "high", "medium", "low"] = Field(...)
    equipment_id: str = Field(default="N/A")
    location: str = Field(default="N/A")
    estimated_downtime_hours: float = Field(default=0.0)
    safety_risk: bool = Field(default=False)
    recommended_team: str = Field(...)
