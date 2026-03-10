"""
Action layer for Inventory Restock — save recommendations and alerts.
"""

import json
from pathlib import Path

from core.logger import get_logger
from shubh.inventory_restock.validator import RestockResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_restock_report(result: RestockResult) -> dict:
    """Save restock recommendations."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "restock_recommendations.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    log.info("restock_report_saved", path=str(out_path))
    return {"path": str(out_path)}


def build_restock_slack_alert(result: RestockResult) -> dict:
    """Build Slack alert for urgent restocks."""
    urgent_items = [f for f in result.forecasts if f.urgency in ("immediate", "soon")]
    if not urgent_items:
        return {}

    lines = [f"• `{f.sku}` — {f.weeks_of_stock:.1f} weeks left, order {f.recommended_order_qty} units" for f in urgent_items]
    return {
        "channel": "inventory-alerts",
        "text": (
            f"📦 *Restock Alert — {len(urgent_items)} SKUs need attention*\n"
            + "\n".join(lines)
        ),
    }


def generate_restock_markdown_report(result: RestockResult) -> str:
    """Generate professional inventory restock report."""
    from datetime import datetime
    urgency_emoji = {"immediate": "🚨", "soon": "⚠️", "planned": "📋", "no_action": "✅"}.get(result.urgency_level, "📊")

    forecast_rows = ""
    for f in result.forecasts:
        u_icon = {"immediate": "🚨", "soon": "⚠️", "planned": "📋", "no_action": "✅"}.get(f.urgency, "")
        forecast_rows += f"| {u_icon} `{f.sku}` | {f.current_stock} | {f.avg_daily_demand:.1f} | {f.weeks_of_stock:.1f} | {f.reorder_point} | {f.recommended_order_qty} | {f.urgency} |\n"

    report = f"""# {urgency_emoji} Inventory Restock Report

## Overview
| Metric | Value |
|--------|-------|
| SKUs Analyzed | {result.total_skus_analyzed} |
| Immediate Reorders | {result.immediate_reorders} |
| Reorder Soon | {result.soon_reorders} |
| Planned | {result.planned_reorders} |
| No Action | {result.no_action} |
| Overall Urgency | **{result.urgency_level.upper()}** |

## SKU Forecast
| SKU | Stock | Avg Daily | Weeks Left | Reorder Pt | Order Qty | Urgency |
|-----|-------|-----------|------------|------------|-----------|---------|
{forecast_rows}
## Analysis
{result.explanation}

---
*Confidence: {result.confidence:.0%} | Generated: {datetime.utcnow().isoformat()}*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"restock_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    return report
