"""
Data aggregation + LLM summarization for Production Report.
"""

import json
from pathlib import Path
import re

import pandas as pd
import yaml

from core.llm import llm_call
from core.logger import get_logger
from shubh.production_report.validator import ProductionMetrics

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def aggregate_production_data(df: pd.DataFrame) -> ProductionMetrics:
    """
    Rule-based aggregation from daily production CSV. No LLM needed.
    Expected columns: shift, line, output_units, downtime_minutes, pass_count, fail_count, scrap_units
    """
    config = _load_config()
    targets = config["targets"]

    total_output = int(df["output_units"].sum())
    total_downtime = float(df["downtime_minutes"].sum())
    total_pass = int(df["pass_count"].sum())
    total_fail = int(df["fail_count"].sum())
    total_scrap = int(df["scrap_units"].sum())

    # Calculate total production minutes (8hr shift = 480 min per shift per line)
    lines = df["line"].nunique()
    shifts = df["shift"].nunique()
    total_prod_minutes = lines * shifts * 480

    metrics = ProductionMetrics(
        report_date=str(df["date"].iloc[0]) if "date" in df.columns else "unknown",
        total_output_units=total_output,
        target_output_units=targets["daily_output_units"],
        output_variance_pct=round((total_output - targets["daily_output_units"]) / targets["daily_output_units"] * 100, 2),
        total_downtime_minutes=total_downtime,
        downtime_pct=round(total_downtime / total_prod_minutes * 100, 2) if total_prod_minutes > 0 else 0,
        quality_pass_count=total_pass,
        quality_fail_count=total_fail,
        quality_pass_rate_pct=round(total_pass / (total_pass + total_fail) * 100, 2) if (total_pass + total_fail) > 0 else 0,
        scrap_units=total_scrap,
        scrap_rate_pct=round(total_scrap / total_output * 100, 2) if total_output > 0 else 0,
        lines_active=lines,
        shifts_reported=shifts,
    )

    log.info("production_aggregated", output=total_output, downtime_pct=metrics.downtime_pct)
    return metrics


async def generate_summary(metrics: ProductionMetrics) -> dict:
    """Use LLM to generate executive narrative from aggregated metrics."""
    config = _load_config()
    extraction = config.get("extraction", {})
    prompt = config["prompts"]["summarize"].replace("{metrics_json}", json.dumps(metrics.model_dump(), default=str))
    system = config["prompts"]["system"]

    response = await llm_call(
        prompt=prompt,
        system=system,
        model=extraction.get("model", "gpt-4o"),
        temperature=extraction.get("temperature", 0.3),
    )

    # Parse response
    cleaned = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("```").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {
        "executive_summary": response,
        "highlights": [],
        "concerns": [],
        "recommendations": [],
        "overall_grade": "satisfactory",
        "confidence": 0.7,
    }
