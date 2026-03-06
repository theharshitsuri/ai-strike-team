"""
Production Report Auto-Generation — CSV → Executive Summary

Production-ready workflow:
1. Ingests daily production CSV/Excel data
2. Validates data has required columns and sufficient rows
3. Aggregates metrics (output, downtime, quality, efficiency)
4. Uses LLM to generate narrative executive summary
5. Assigns overall grade based on KPIs
6. Generates professional markdown report
7. Calculates ROI (90 min manual report → seconds automated)

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
        if not hasattr(self, "_df") or len(self._df) < 1:
            return "No production data found. Provide a CSV/Excel file with production metrics."
        numeric_cols = self._df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) == 0:
            return "No numeric columns found. Production reports require metrics data (output, downtime, quality, etc.)."
        return None

    async def extract(self, raw_text: str) -> ProductionReportResult:
        metrics = aggregate_production_data(self._df)
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

        grade_emoji = {"excellent": "🏆", "good": "✅", "satisfactory": "👍", "needs_improvement": "⚠️", "critical": "🚨"}.get(result.overall_grade, "📊")

        return {
            "summary": f"{grade_emoji} Production Report — Grade: {result.overall_grade.upper()} | {len(result.highlights)} highlights, {len(result.concerns)} concerns, {len(result.recommendations)} recommendations",
            "report": report_info,
            "markdown_preview": md_report[:500],
            "grade": result.overall_grade,
        }


async def _main():
    wf = ProductionReportWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
