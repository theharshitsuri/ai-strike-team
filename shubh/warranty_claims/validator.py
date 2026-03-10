"""
Pydantic schemas for Warranty Claims Processing workflow.
Production-ready with full claim + decision data.
"""

from typing import Literal, Optional
from pydantic import Field, field_validator
from core.validator import WorkflowResult


class WarrantyClaimData(WorkflowResult):
    """Extracted warranty claim data from forms/emails."""
    claim_id: str = Field(default="N/A")
    customer_name: str = Field(default="Unknown")
    customer_email: str = Field(default="N/A")
    product_name: str = Field(default="", description="Product name/model")
    product_id: str = Field(default="N/A", description="Product SKU/model number")
    serial_number: str = Field(default="N/A")
    purchase_date: str = Field(default="", description="YYYY-MM-DD")
    claim_date: str = Field(default="", description="YYYY-MM-DD")
    defect_type: str = Field(default="other", description="Type of defect: manufacturing, material, wear, misuse, other")
    defect_description: str = Field(default="", description="Detailed defect description")
    issue_type: str = Field(default="other", description="Issue category")
    issue_description: str = Field(default="", description="Brief description of the problem")
    requested_resolution: str = Field(default="replacement")
    claim_value: Optional[float] = Field(default=None, description="Estimated claim value in USD")
    attachments_mentioned: bool = Field(default=False)
    is_duplicate: bool = Field(default=False)

    @field_validator("defect_type", mode="before")
    @classmethod
    def normalize_defect(cls, v):
        if isinstance(v, str):
            v = v.lower().strip()
            mapping = {
                "defect": "manufacturing", "mfg": "manufacturing",
                "material": "material", "materials": "material",
                "damage": "misuse", "user_error": "misuse",
                "malfunction": "manufacturing", "broken": "manufacturing",
                "wear": "wear", "wear_and_tear": "wear",
            }
            return mapping.get(v, v)
        return v


class WarrantyDecision(WorkflowResult):
    """Warranty claim decision result."""
    claim_id: str
    product_name: str = Field(default="")
    customer_name: str = Field(default="")
    product_id: str = Field(default="")
    decision: Literal["approved", "rejected", "review"] = Field(default="review")
    reason: str = Field(default="", description="Explanation for the decision")
    days_since_purchase: int = Field(default=0)
    warranty_period_days: int = Field(default=365)
    claim_value: float = Field(default=0.0)
    within_warranty: bool = Field(default=False)
    within_extended_warranty: bool = Field(default=False)
    valid_product: bool = Field(default=True)
    replacement_eligible: bool = Field(default=False)
    auto_approved: bool = Field(default=False)
