"""
Pydantic schemas for Shipment Follow-Up workflow.
"""

from typing import Optional, Literal
from pydantic import Field
from core.validator import WorkflowResult


class ShipmentStatus(WorkflowResult):
    """Extracted shipment status data."""
    load_id: str = Field(..., description="Load or shipment number")
    carrier: str = Field(..., description="Carrier name")
    origin: str = Field(..., description="Origin city/location")
    destination: str = Field(..., description="Destination city/location")
    expected_delivery: str = Field(..., description="Expected delivery date YYYY-MM-DD")
    current_status: str = Field(default="unknown", description="Last known status")
    last_update: str = Field(default="", description="ISO 8601 datetime of last update")
    hours_overdue: float = Field(default=0, description="Hours past expected delivery")


class FollowUpEmail(WorkflowResult):
    """Generated follow-up email."""
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Email body text")
    urgency: Literal["routine", "urgent", "critical"] = Field(default="routine")
    attempt_number: int = Field(default=1)
    should_escalate: bool = Field(default=False, description="Whether to escalate to Slack")
