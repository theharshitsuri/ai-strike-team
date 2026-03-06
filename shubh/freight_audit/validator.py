"""
Pydantic schemas for Freight Audit workflow.
Production-ready with comprehensive charge tracking.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from core.validator import WorkflowResult


class ChargeLineItem(BaseModel):
    """Single charge line item from an invoice or rate confirmation."""
    description: str = Field(..., description="Normalized charge type")
    amount: float = Field(..., description="Dollar amount")
    detail: str = Field(default="", description="Additional detail")

    @field_validator("description", mode="before")
    @classmethod
    def normalize_charge_type(cls, v):
        if isinstance(v, str):
            v = v.lower().strip().replace(" ", "_").replace("-", "_")
            mapping = {
                "line_haul": "linehaul", "line haul": "linehaul", "base_rate": "linehaul",
                "fuel": "fuel_surcharge", "fsc": "fuel_surcharge", "fuel_sc": "fuel_surcharge",
                "det": "detention", "wait_time": "detention",
                "stop": "stop_off", "stop_charge": "stop_off",
                "accessorial_charge": "accessorial", "extra": "accessorial",
            }
            return mapping.get(v, v)
        return v


class InvoiceData(WorkflowResult):
    """Extracted carrier invoice data."""
    load_id: str
    carrier_name: str
    invoice_number: str
    invoice_date: str = ""
    payment_terms: str = Field(default="N/A")
    line_items: list[ChargeLineItem]
    total_amount: float
    currency: str = Field(default="USD")


class RateConData(WorkflowResult):
    """Extracted rate confirmation data."""
    load_id: str
    carrier_name: str
    rate_con_number: str = ""
    line_items: list[ChargeLineItem]
    total_amount: float


class LineItemMismatch(BaseModel):
    """A mismatch between invoice and rate confirmation."""
    charge_type: str
    invoice_amount: float
    rate_con_amount: float
    difference: float
    pct_difference: float = Field(default=0.0, description="Percentage difference")
    status: Literal["over", "under", "missing_from_invoice", "missing_from_ratecon", "match"]


class FreightAuditResult(WorkflowResult):
    """Complete audit comparison result."""
    load_id: str
    carrier_name: str
    invoice_number: str
    invoice_total: float
    rate_con_total: float
    total_difference: float
    pct_difference: float = Field(default=0.0)
    mismatches: list[LineItemMismatch]
    verdict: Literal["pass", "fail", "review", "auto_approved", "escalated"] = Field(default="review")
    overcharge_amount: float = Field(default=0.0)
    undercharge_amount: float = Field(default=0.0)
    requires_escalation: bool = Field(default=False)
