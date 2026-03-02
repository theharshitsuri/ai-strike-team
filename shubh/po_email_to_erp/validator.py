"""
Pydantic schemas for PO Email → ERP Entry workflow.
"""

from typing import Literal
from pydantic import BaseModel, Field
from core.validator import WorkflowResult


class POLineItem(BaseModel):
    """Single line item from a purchase order."""
    sku: str
    description: str
    quantity: int
    unit_price: float
    total: float


class POLineItemValidation(BaseModel):
    """Validation result for a single line item."""
    sku: str
    sku_valid: bool
    price_valid: bool
    catalog_price: float = Field(default=0.0)
    price_difference_pct: float = Field(default=0.0)
    status: Literal["ok", "sku_unknown", "price_mismatch", "both_issues"] = Field(default="ok")


class PurchaseOrderResult(WorkflowResult):
    """Extracted purchase order data."""
    po_number: str
    customer_name: str
    customer_email: str = Field(default="N/A")
    order_date: str
    requested_ship_date: str = Field(default="ASAP")
    shipping_address: str = Field(default="N/A")
    line_items: list[POLineItem]
    subtotal: float
    tax: float = Field(default=0.0)
    total: float
    payment_terms: str = Field(default="N/A")
    special_instructions: str = Field(default="N/A")


class ERPEntryResult(WorkflowResult):
    """Result after validation, ready for ERP push."""
    po_number: str
    customer_name: str
    line_items: list[POLineItem]
    validations: list[POLineItemValidation]
    total: float
    all_valid: bool = Field(default=False)
    erp_payload_saved: bool = Field(default=False)
    issues: list[str] = Field(default_factory=list)
