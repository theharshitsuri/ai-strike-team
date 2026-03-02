"""
Pydantic schemas for Warranty Claims Processing workflow.
"""

from typing import Literal
from pydantic import Field
from core.validator import WorkflowResult


class WarrantyClaimData(WorkflowResult):
    """Extracted warranty claim data."""
    claim_id: str = Field(default="N/A")
    customer_name: str = Field(...)
    customer_email: str = Field(default="N/A")
    product_id: str = Field(...)
    serial_number: str = Field(default="N/A")
    purchase_date: str = Field(..., description="YYYY-MM-DD")
    claim_date: str = Field(..., description="YYYY-MM-DD")
    issue_type: Literal["defect", "malfunction", "damage", "missing_parts", "performance", "other"] = Field(...)
    issue_description: str = Field(...)
    requested_resolution: Literal["replacement", "repair", "refund", "credit"] = Field(...)
    attachments_mentioned: bool = Field(default=False)


class WarrantyDecision(WorkflowResult):
    """Warranty claim decision result."""
    claim_id: str
    customer_name: str
    product_id: str
    decision: Literal["approved", "rejected", "review"] = Field(...)
    reason: str = Field(..., description="Explanation for the decision")
    days_since_purchase: int
    within_warranty: bool
    within_extended_warranty: bool
    valid_product: bool
    auto_approved: bool = Field(default=False)
