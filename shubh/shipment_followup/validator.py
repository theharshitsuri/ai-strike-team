"""
Pydantic schemas for Shipment Follow-Up workflow.
Production-ready with comprehensive tracking fields.
"""

from typing import Optional, Literal
from pydantic import Field, field_validator
from core.validator import WorkflowResult


class ShipmentStatus(WorkflowResult):
    """Extracted shipment status from tracking data or emails."""
    load_id: str = Field(..., description="Load/shipment number")
    carrier: str = Field(..., description="Carrier name")
    carrier_contact_email: str = Field(default="N/A")
    origin: str = Field(..., description="Origin location")
    destination: str = Field(..., description="Destination location")
    expected_delivery: str = Field(..., description="YYYY-MM-DD expected delivery date")
    actual_pickup_date: str = Field(default="N/A")
    current_status: str = Field(default="unknown")
    last_update: str = Field(default="N/A")
    last_known_location: str = Field(default="N/A")
    customer_name: str = Field(default="N/A")
    commodity: str = Field(default="general freight")
    is_overdue: bool = Field(default=False)
    hours_overdue: int = Field(default=0, ge=0)

    @field_validator("current_status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v = v.lower().strip().replace(" ", "_")
            mapping = {
                "in transit": "in_transit", "intransit": "in_transit",
                "picked up": "in_transit", "picked_up": "in_transit",
                "at origin": "at_origin", "at_origin": "at_origin",
                "delay": "delayed", "delayed": "delayed",
                "delivered": "delivered", "complete": "delivered",
            }
            return mapping.get(v, v)
        return v


class FollowUpEmail(WorkflowResult):
    """LLM-generated follow-up email."""
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Email body text")
    urgency: Literal["routine", "urgent", "critical"] = Field(default="routine")
    should_escalate: bool = Field(default=False)
    recommended_action: str = Field(default="Monitor and await response")
