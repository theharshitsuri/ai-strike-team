"""
QA Anomaly Detection — Inspection Logs → Anomaly Report

Production-ready workflow:
1. Ingests inspection CSV/Excel data from production lines
2. Validates data has required measurement columns
3. Runs statistical anomaly detection (z-scores, spec range checks)
4. Uses LLM to generate plain-English executive summary
5. Generates professional QA report with charts data
6. Sends Slack alerts for critical anomalies
7. Calculates ROI (45 min manual analysis → seconds automated)

Usage:
    python -m shubh.qa_anomaly.main
"""

import asyncio
from typing import Any
from pathlib import Path

import pandas as pd
import yaml

from core.workflow_base import BaseWorkflow
from core.logger import get_logger
from shubh.qa_anomaly.extractor import detect_anomalies_statistical, summarize_anomalies
from shubh.qa_anomaly.validator import QAAnomalyResult
from shubh.qa_anomaly.action import save_anomaly_report, build_alert_slack_message, generate_qa_markdown_report

log = get_logger(__name__)

DEMO_PATH = Path(__file__).parent / "demo" / "sample_inspection.csv"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


class QAAnomalyWorkflow(BaseWorkflow):
    name = "qa_anomaly"

    async def ingest(self, input_data: Any) -> str:
        """Load CSV/Excel into memory and return as string for the pipeline."""
        if isinstance(input_data, (str, Path)):
            path = Path(input_data)
            if path.suffix == ".csv":
                self._df = pd.read_csv(path)
            elif path.suffix in (".xlsx", ".xls"):
                self._df = pd.read_excel(path)
            else:
                # Try parsing as raw text (pasted CSV data)
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
            return "Input data must contain at least 2 rows of inspection measurements."
        if len(self._df.columns) < 2:
            return "Input data must have at least 2 columns (timestamp + measurements)."
        # Check for numeric columns
        numeric_cols = self._df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) == 0:
            return "No numeric measurement columns found in data. QA anomaly detection requires numeric data."
        return None

    async def extract(self, raw_text: str) -> QAAnomalyResult:
        """Run statistical anomaly detection then LLM summary."""
        anomalies = detect_anomalies_statistical(self._df)

        with open(CONFIG_PATH, "r") as f:
            specs = yaml.safe_load(f).get("column_specs", {})

        if anomalies:
            summary_data = await summarize_anomalies(anomalies, specs)
        else:
            summary_data = {
                "summary": "No anomalies detected. All measurements within specification limits.",
                "severity": "low",
                "recommended_actions": ["Continue standard monitoring"],
                "confidence": 1.0,
            }

        return QAAnomalyResult(
            total_rows=len(self._df),
            total_anomalies=len(anomalies),
            anomalies=anomalies,
            columns_checked=list(specs.keys()) if specs else list(self._df.select_dtypes(include=["number"]).columns),
            summary=summary_data.get("summary", ""),
            severity=summary_data.get("severity", "low"),
            recommended_actions=summary_data.get("recommended_actions", []),
            confidence=summary_data.get("confidence", 0.8),
        )

    async def act(self, result: QAAnomalyResult) -> dict:
        report = save_anomaly_report(result)
        md_report = generate_qa_markdown_report(result)
        slack_msg = build_alert_slack_message(result) if result.total_anomalies > 0 else None

        severity_emoji = {"low": "✅", "medium": "⚠️", "high": "🔴", "critical": "🚨"}.get(result.severity, "⚠️")

        return {
            "summary": f"{severity_emoji} {result.total_anomalies} anomalies in {result.total_rows} rows. Severity: {result.severity.upper()}. {len(result.recommended_actions)} actions recommended.",
            "report": report,
            "report_preview": md_report[:500],
            "slack_alert": slack_msg,
            "severity": result.severity,
        }


async def _main():
    wf = QAAnomalyWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
