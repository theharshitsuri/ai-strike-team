"""
Pydantic schemas for Freight Audit workflow.
"""

from typing import Literal
from pydantic import BaseModel, Field
from core.validator import WorkflowResult


class ChargeLineItem(BaseModel):
    """Single charge line item."""
    description: str = Field(..., description="Charge type: linehaul, fuel_surcharge, detention, etc.")
    amount: float = Field(..., description="Dollar amount")


class InvoiceData(WorkflowResult):
    """Extracted invoice data."""
    load_id: str
    carrier_name: str
    invoice_number: str
    invoice_date: str
    line_items: list[ChargeLineItem]
    total_amount: float


class RateConData(WorkflowResult):
    """Extracted rate confirmation data."""
    load_id: str
    carrier_name: str
    rate_con_number: str
    line_items: list[ChargeLineItem]
    total_amount: float


class LineItemMismatch(BaseModel):
    """A mismatch between invoice and rate confirmation."""
    charge_type: str
    invoice_amount: float
    rate_con_amount: float
    difference: float
    status: Literal["over", "under", "missing_from_invoice", "missing_from_ratecon", "match"]


class FreightAuditResult(WorkflowResult):
    """Complete audit comparison result."""
    load_id: str
    carrier_name: str
    invoice_number: str
    invoice_total: float
    rate_con_total: float
    total_difference: float
    mismatches: list[LineItemMismatch]
    verdict: Literal["pass", "fail", "review"] = Field(default="review")
    overcharge_amount: float = Field(default=0.0)
