"""
Demand forecasting engine + LLM explanation for Inventory Restock.
No ML — moving average + safety stock + reorder point logic.
"""

import json
import re
from pathlib import Path

import pandas as pd
import yaml

from core.llm import llm_call
from core.logger import get_logger
from shubh.inventory_restock.validator import SKUForecast

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def forecast_demand(df: pd.DataFrame) -> list[SKUForecast]:
    """
    Rule-based demand forecasting. No LLM, no ML.
    Expects columns: sku, description, current_stock, week_1, week_2, week_3, week_4 (sales)
    """
    config = _load_config()["thresholds"]
    ma_periods = config["moving_avg_periods"]
    safety_weeks = config["safety_stock_weeks"]
    lead_days = config["lead_time_days"]
    critical_days = config["critical_days_of_stock"]

    # Identify weekly sales columns
    week_cols = [c for c in df.columns if c.startswith("week_")]
    forecasts = []

    for _, row in df.iterrows():
        sku = str(row["sku"])
        desc = str(row.get("description", ""))
        current_stock = int(row["current_stock"])

        # Calculate moving average weekly demand
        weekly_sales = [float(row[c]) for c in week_cols[-ma_periods:] if pd.notna(row[c])]
        avg_weekly = sum(weekly_sales) / len(weekly_sales) if weekly_sales else 0

        # Weeks of stock remaining
        weeks_remaining = current_stock / avg_weekly if avg_weekly > 0 else float("inf")
        days_until_stockout = weeks_remaining * 7

        # Safety stock
        safety_stock = int(avg_weekly * safety_weeks)

        # Reorder point = (lead time demand) + safety stock
        lead_time_weeks = lead_days / 7
        reorder_point = int(avg_weekly * lead_time_weeks + safety_stock)

        # Recommended order = enough for lead_time + safety_weeks + buffer
        if current_stock <= reorder_point:
            order_qty = int(avg_weekly * (lead_time_weeks + safety_weeks + 2))
        else:
            order_qty = 0

        # Urgency
        if days_until_stockout <= critical_days:
            urgency = "immediate"
        elif current_stock <= reorder_point:
            urgency = "soon"
        elif current_stock <= reorder_point * 1.5:
            urgency = "planned"
        else:
            urgency = "no_action"

        forecasts.append(SKUForecast(
            sku=sku,
            description=desc,
            current_stock=current_stock,
            avg_weekly_demand=round(avg_weekly, 1),
            weeks_of_stock=round(weeks_remaining, 1),
            reorder_point=reorder_point,
            recommended_order_qty=order_qty,
            urgency=urgency,
            days_until_stockout=round(days_until_stockout, 1),
        ))

    log.info("demand_forecast_complete", total_skus=len(forecasts))
    return forecasts


async def generate_explanation(forecasts: list[SKUForecast]) -> dict:
    """Use LLM to generate a readable explanation of the forecast."""
    config = _load_config()
    prompt = config["prompts"]["explain_forecast"].replace(
        "{forecast_json}",
        json.dumps([f.model_dump() for f in forecasts], default=str),
    )
    system = config["prompts"]["system"]

    response = await llm_call(prompt=prompt, system=system)

    cleaned = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("```").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"explanation": response, "urgency_level": "planned", "confidence": 0.7}
