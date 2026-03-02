"""
Production Report Auto-Generation — CSV → Executive Summary

Reads daily production CSV, aggregates metrics (output, downtime, quality),
then uses LLM to generate a narrative executive summary.

Usage:
    python -m shubh.production_report.main
"""

import asyncio
from typing import Any
from pathlib import Path

import pandas as pd

from core.workflow_base import BaseWorkflow
from core.logger import get_logger
from shubh.production_report.extractor import aggregate_production_data, generate_summary
from shubh.production_report.validator import ProductionMetrics, ProductionReportResult
from shubh.production_report.action import save_report, generate_markdown_report

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_production.csv"


class ProductionReportWorkflow(BaseWorkflow):
    name = "production_report"

    async def ingest(self, input_data: Any) -> str:
        if isinstance(input_data, (str, Path)):
            path = Path(input_data)
            self._df = pd.read_csv(path) if path.suffix == ".csv" else pd.read_excel(path)
            return self._df.to_string()
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> ProductionReportResult:
        # Aggregate metrics (rule-based)
        metrics = aggregate_production_data(self._df)

        # Generate LLM summary
        summary_data = await generate_summary(metrics)

        return ProductionReportResult(
            metrics=metrics,
            executive_summary=summary_data.get("executive_summary", ""),
            highlights=summary_data.get("highlights", []),
            concerns=summary_data.get("concerns", []),
            recommendations=summary_data.get("recommendations", []),
            overall_grade=summary_data.get("overall_grade", "satisfactory"),
            confidence=summary_data.get("confidence", 0.8),
        )

    async def act(self, result: ProductionReportResult) -> dict:
        report_info = save_report(result)
        md_report = generate_markdown_report(result)
        return {
            "report": report_info,
            "markdown_preview": md_report[:500] + "...",
            "grade": result.overall_grade,
        }


async def _main():
    wf = ProductionReportWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
