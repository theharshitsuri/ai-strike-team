"""
Pydantic schemas for Inventory Restock Forecasting workflow.
"""

from typing import Literal
from pydantic import BaseModel, Field
from core.validator import WorkflowResult


class SKUForecast(BaseModel):
    """Forecast for a single SKU."""
    sku: str
    description: str = Field(default="")
    current_stock: int
    avg_weekly_demand: float
    weeks_of_stock: float = Field(description="Current stock / weekly demand")
    reorder_point: int = Field(description="Stock level that triggers reorder")
    recommended_order_qty: int
    urgency: Literal["immediate", "soon", "planned", "no_action"] = Field(default="planned")
    days_until_stockout: float = Field(default=0)


class RestockResult(WorkflowResult):
    """Complete restock forecasting result."""
    total_skus_analyzed: int
    immediate_reorders: int
    soon_reorders: int
    planned_reorders: int
    no_action: int
    forecasts: list[SKUForecast]
    explanation: str = Field(default="")
    urgency_level: Literal["immediate", "soon", "planned", "no_action"] = Field(default="planned")
