"""
QA Anomaly Detection — Inspection Logs → Anomaly Report

Analyzes inspection log data using statistical methods (z-score, range checks),
then uses LLM to generate a plain-English executive summary.

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
from shubh.qa_anomaly.action import save_anomaly_report, build_alert_slack_message

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
                raise ValueError(f"QA anomaly expects CSV or Excel, got: {path.suffix}")
            return self._df.to_string()
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def extract(self, raw_text: str) -> QAAnomalyResult:
        """Run statistical anomaly detection (no LLM)."""
        anomalies = detect_anomalies_statistical(self._df)

        with open(CONFIG_PATH, "r") as f:
            specs = yaml.safe_load(f).get("column_specs", {})

        # Use LLM to summarize if anomalies found
        if anomalies:
            summary_data = await summarize_anomalies(anomalies, specs)
        else:
            summary_data = {
                "summary": "No anomalies detected. All measurements within specification.",
                "severity": "low",
                "recommended_actions": [],
                "confidence": 1.0,
            }

        return QAAnomalyResult(
            total_rows=len(self._df),
            total_anomalies=len(anomalies),
            anomalies=anomalies,
            columns_checked=list(specs.keys()),
            summary=summary_data.get("summary", ""),
            severity=summary_data.get("severity", "low"),
            recommended_actions=summary_data.get("recommended_actions", []),
            confidence=summary_data.get("confidence", 0.8),
        )

    async def act(self, result: QAAnomalyResult) -> dict:
        report = save_anomaly_report(result)
        slack_msg = build_alert_slack_message(result) if result.total_anomalies > 0 else None

        return {
            "report": report,
            "slack_alert": slack_msg,
            "summary": f"{result.total_anomalies} anomalies in {result.total_rows} rows. Severity: {result.severity}",
        }


async def _main():
    wf = QAAnomalyWorkflow()
    result = await wf.run(str(DEMO_PATH))
    import json
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main())
