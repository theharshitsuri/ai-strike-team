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
    with open(out_path, "w") as f:
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
