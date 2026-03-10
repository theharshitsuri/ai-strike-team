"""
Action layer for Production Report — generate and save reports.
"""

import json
from pathlib import Path
from datetime import datetime

from core.logger import get_logger
from shubh.production_report.validator import ProductionReportResult

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"


def save_report(result: ProductionReportResult) -> dict:
    """Save production report as JSON."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"production_report_{result.metrics.report_date}.json"
    out_path = OUTPUT_DIR / filename
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)

    log.info("production_report_saved", path=str(out_path))
    return {"path": str(out_path)}


def generate_markdown_report(result: ProductionReportResult) -> str:
    """Generate a markdown-formatted report for email/Slack."""
    grade_emoji = {
        "excellent": "🟢", "good": "🟡", "satisfactory": "🟠",
        "below_target": "🔴", "critical": "🚨",
    }

    m = result.metrics
    md = f"""# 📊 Daily Production Report — {m.report_date}

**Overall Grade: {grade_emoji.get(result.overall_grade, '⚪')} {result.overall_grade.upper()}**

## Key Metrics
| Metric | Actual | Target | Variance |
|--------|--------|--------|----------|
| Output (units) | {m.total_output_units} | {m.target_output_units} | {m.output_variance_pct:+.1f}% |
| Downtime | {m.total_downtime_minutes:.0f} min | <{m.target_output_units * 0.05:.0f} min | {m.downtime_pct:.1f}% |
| Quality Pass Rate | {m.quality_pass_rate_pct:.1f}% | ≥98.0% | — |
| Scrap Rate | {m.scrap_rate_pct:.1f}% | <2.0% | — |

## Executive Summary
{result.executive_summary}

## Highlights
{chr(10).join(f'- ✅ {h}' for h in result.highlights)}

## Concerns
{chr(10).join(f'- ⚠️ {c}' for c in result.concerns)}

## Recommendations
{chr(10).join(f'- 💡 {r}' for r in result.recommendations)}

---
*Generated at {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")} by AI Strike Team*
"""
    # Save markdown report
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUTPUT_DIR / f"production_report_{m.report_date}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)

    return md
