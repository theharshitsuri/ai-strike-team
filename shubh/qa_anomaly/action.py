"""
Action layer for QA Anomaly Detection — save reports and trigger alerts.
"""

import json
from pathlib import Path

from core.logger import get_logger
from shubh.qa_anomaly.validator import QAAnomalyResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_anomaly_report(result: QAAnomalyResult) -> dict:
    """Save anomaly report to JSON file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "anomaly_report.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    log.info("anomaly_report_saved", path=str(out_path))
    return {"report_path": str(out_path)}


def build_alert_slack_message(result: QAAnomalyResult) -> dict:
    """Build Slack alert for anomalies."""
    emoji = {"low": "ℹ️", "medium": "⚠️", "high": "🔶", "critical": "🚨"}
    return {
        "channel": "manufacturing-qa",
        "text": (
            f"{emoji.get(result.severity, '⚠️')} *QA Anomaly Report — {result.severity.upper()}*\n"
            f"• Rows inspected: {result.total_rows}\n"
            f"• Anomalies found: {result.total_anomalies}\n"
            f"• Columns checked: {', '.join(result.columns_checked)}\n"
            f"• Summary: {result.summary[:300]}..."
        ),
    }
