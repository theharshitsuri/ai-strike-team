"""
Inventory Restock Forecasting Agent — Demand Forecast + Reorder Alerts

Production-ready workflow:
1. Ingests sales/inventory CSV or Excel data
2. Validates data has required columns and sufficient history
3. Runs moving average demand forecasting (rule-based)
4. Calculates reorder points and safety stock per SKU
5. Classifies urgency (immediate, soon, planned, no_action)
6. Uses LLM for plain-English explanation of recommendations
7. Generates professional restock report with order table
8. Sends Slack alerts for urgent reorders
9. Calculates ROI (60 min manual analysis → seconds automated)

Usage:
    python -m shubh.inventory_restock.main
"""

import asyncio
from typing import Any
from pathlib import Path

import pandas as pd

from core.workflow_base import BaseWorkflow
from core.logger import get_logger
from shubh.inventory_restock.extractor import forecast_demand, generate_explanation
from shubh.inventory_restock.validator import RestockResult
from shubh.inventory_restock.action import save_restock_report, build_restock_slack_alert, generate_restock_markdown_report

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_inventory.csv"


class InventoryRestockWorkflow(BaseWorkflow):
    name = "inventory_restock"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, (str, Path)):
            path = Path(input_data)
            if path.suffix == ".csv":
                self._df = pd.read_csv(path)
            elif path.suffix in (".xlsx", ".xls"):
                self._df = pd.read_excel(path)
            else:
                import io
                self._df = pd.read_csv(io.StringIO(str(input_data)))
            return self._df.to_string()
        elif isinstance(input_data, dict) and "body" in input_data:
            import io
            self._df = pd.read_csv(io.StringIO(input_data["body"]))
            return self._df.to_string()
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def validate_input(self, raw_text: str) -> str | None:
        if not hasattr(self, "_df") or len(self._df) < 2:
            return "Inventory data must contain at least 2 rows."
        numeric_cols = self._df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) == 0:
            return "No numeric columns found. Need inventory quantities, sales data, or stock levels."
        return None

    async def extract(self, raw_text: str) -> RestockResult:
        forecasts = forecast_demand(self._df)

        immediate = sum(1 for f in forecasts if f.urgency == "immediate")
        soon = sum(1 for f in forecasts if f.urgency == "soon")
        planned = sum(1 for f in forecasts if f.urgency == "planned")
        no_act = sum(1 for f in forecasts if f.urgency == "no_action")

        explain_data = await generate_explanation(forecasts)

        if immediate > 0:
            overall = "immediate"
        elif soon > 0:
            overall = "soon"
        elif planned > 0:
            overall = "planned"
        else:
            overall = "no_action"

        total_order_value = sum(f.recommended_order_qty * getattr(f, "unit_cost", 0) for f in forecasts if f.urgency != "no_action")

        return RestockResult(
            total_skus_analyzed=len(forecasts),
            immediate_reorders=immediate,
            soon_reorders=soon,
            planned_reorders=planned,
            no_action=no_act,
            forecasts=forecasts,
            explanation=explain_data.get("explanation", ""),
            urgency_level=overall,
            total_order_value=round(total_order_value, 2),
            confidence=explain_data.get("confidence", 0.8),
        )

    async def act(self, result: RestockResult) -> dict:
        report = save_restock_report(result)
        md_report = generate_restock_markdown_report(result)
        slack = build_restock_slack_alert(result)

        urgency_emoji = {"immediate": "🚨", "soon": "⚠️", "planned": "📋", "no_action": "✅"}.get(result.urgency_level, "📊")

        return {
            "summary": f"{urgency_emoji} {result.total_skus_analyzed} SKUs: {result.immediate_reorders} immediate, {result.soon_reorders} soon, {result.planned_reorders} planned. Urgency: {result.urgency_level.upper()}",
            "report": report,
            "report_preview": md_report[:500],
            "slack_alert": slack if slack else None,
            "urgency": result.urgency_level,
        }


async def _main():
    wf = InventoryRestockWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
