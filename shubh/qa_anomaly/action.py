"""
Action layer for QA Anomaly Detection — reports, alerts, and markdown output.
"""

import json
from datetime import datetime
from pathlib import Path

from core.logger import get_logger
from shubh.qa_anomaly.validator import QAAnomalyResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_anomaly_report(result: QAAnomalyResult) -> dict:
    """Save the anomaly report as JSON."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"anomaly_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    data = result.model_dump()
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    log.info("anomaly_report_saved", path=str(out_path), anomalies=result.total_anomalies)
    return {"path": str(out_path), "anomalies": result.total_anomalies, "severity": result.severity}


def build_alert_slack_message(result: QAAnomalyResult) -> dict:
    """Build Slack alert for QA anomalies — urgent for high/critical severity."""
    severity_emoji = {"low": "📊", "medium": "⚠️", "high": "🔴", "critical": "🚨"}.get(result.severity, "⚠️")

    return {
        "channel": "quality-alerts",
        "text": f"{severity_emoji} QA Alert: {result.total_anomalies} anomalies detected — {result.severity.upper()} severity",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{severity_emoji} QA Anomaly Alert"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Rows Analyzed:*\n{result.total_rows}"},
                {"type": "mrkdwn", "text": f"*Anomalies Found:*\n{result.total_anomalies}"},
                {"type": "mrkdwn", "text": f"*Severity:*\n{result.severity.upper()}"},
                {"type": "mrkdwn", "text": f"*Columns Checked:*\n{', '.join(result.columns_checked)}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Summary:*\n{result.summary[:300]}"}},
        ] + ([{"type": "section", "text": {"type": "mrkdwn", "text": "*Actions:*\n" + "\n".join(f"• {a}" for a in result.recommended_actions[:5])}}] if result.recommended_actions else []),
    }


def generate_qa_markdown_report(result: QAAnomalyResult) -> str:
    """Generate a professional QA analysis markdown report."""
    severity_emoji = {"low": "✅", "medium": "⚠️", "high": "🔴", "critical": "🚨"}.get(result.severity, "⚠️")

    anomaly_rows = ""
    for i, a in enumerate(result.anomalies[:20], 1):
        col = a.get("column", "N/A")
        value = a.get("value", "N/A")
        z = a.get("z_score", 0)
        reason = a.get("reason", "Out of range")
        anomaly_rows += f"| {i} | {col} | {value} | {z:.1f} | {reason} |\n"

    report = f"""# {severity_emoji} QA Anomaly Detection Report

## Overview
| Metric | Value |
|--------|-------|
| Total Rows Analyzed | {result.total_rows} |
| Anomalies Found | {result.total_anomalies} |
| Anomaly Rate | {result.total_anomalies / max(result.total_rows, 1) * 100:.1f}% |
| Severity | **{result.severity.upper()}** |
| Columns Checked | {', '.join(result.columns_checked)} |

## Executive Summary
{result.summary}

"""
    if anomaly_rows:
        report += f"""## Anomalies Detected
| # | Column | Value | Z-Score | Reason |
|---|--------|-------|---------|--------|
{anomaly_rows}
"""

    if result.recommended_actions:
        report += "## Recommended Actions\n"
        for i, action in enumerate(result.recommended_actions, 1):
            report += f"{i}. {action}\n"
        report += "\n"

    report += f"\n---\n*Confidence: {result.confidence:.0%} | Generated: {datetime.utcnow().isoformat()}*\n"

    # Save report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"qa_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
    with open(report_path, "w") as f:
        f.write(report)

    return report
