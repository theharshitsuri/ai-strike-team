"""
Inventory Restock Forecasting Agent — Demand Forecast + Reorder Alerts

Analyzes sales/inventory data using moving average forecasting,
calculates reorder points and safety stock, generates restock recommendations.

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
from shubh.inventory_restock.action import save_restock_report, build_restock_slack_alert

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_inventory.csv"


class InventoryRestockWorkflow(BaseWorkflow):
    name = "inventory_restock"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, (str, Path)):
            path = Path(input_data)
            self._df = pd.read_csv(path) if path.suffix == ".csv" else pd.read_excel(path)
            return self._df.to_string()
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> RestockResult:
        forecasts = forecast_demand(self._df)

        # Counts
        immediate = sum(1 for f in forecasts if f.urgency == "immediate")
        soon = sum(1 for f in forecasts if f.urgency == "soon")
        planned = sum(1 for f in forecasts if f.urgency == "planned")
        no_act = sum(1 for f in forecasts if f.urgency == "no_action")

        # LLM explanation
        explain_data = await generate_explanation(forecasts)

        # Overall urgency
        if immediate > 0:
            overall = "immediate"
        elif soon > 0:
            overall = "soon"
        elif planned > 0:
            overall = "planned"
        else:
            overall = "no_action"

        return RestockResult(
            total_skus_analyzed=len(forecasts),
            immediate_reorders=immediate,
            soon_reorders=soon,
            planned_reorders=planned,
            no_action=no_act,
            forecasts=forecasts,
            explanation=explain_data.get("explanation", ""),
            urgency_level=overall,
            confidence=explain_data.get("confidence", 0.8),
        )

    async def act(self, result: RestockResult) -> dict:
        report = save_restock_report(result)
        slack = build_restock_slack_alert(result)
        return {
            "report": report,
            "slack_alert": slack if slack else None,
            "summary": (
                f"{result.total_skus_analyzed} SKUs analyzed: "
                f"{result.immediate_reorders} immediate, {result.soon_reorders} soon, "
                f"{result.planned_reorders} planned. Overall: {result.urgency_level}"
            ),
        }


async def _main():
    wf = InventoryRestockWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
