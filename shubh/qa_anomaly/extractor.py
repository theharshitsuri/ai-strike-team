"""
Statistical anomaly detection + LLM summarization for QA logs.
No ML training — just statistics and specs.
"""

import json
from pathlib import Path

import pandas as pd
import yaml

from core.llm import llm_call
from core.validator import parse_llm_json
from core.logger import get_logger
from shubh.qa_anomaly.validator import AnomalyFlag, QAAnomalyResult

log = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def detect_anomalies_statistical(df: pd.DataFrame) -> list[AnomalyFlag]:
    """
    Rule-based anomaly detection. No LLM needed.
    Checks: out-of-range, z-score spikes, spec deviation.
    """
    config = _load_config()
    specs = config.get("column_specs", {})
    z_threshold = config["thresholds"]["z_score_threshold"]
    anomalies: list[AnomalyFlag] = []

    for col in df.select_dtypes(include="number").columns:
        col_lower = col.lower().strip()
        spec = specs.get(col_lower)
        if not spec:
            continue

        mean = df[col].mean()
        std = df[col].std()

        for idx, val in df[col].items():
            if pd.isna(val):
                continue

            # Z-score check
            z = abs((val - mean) / std) if std > 0 else 0

            # Range check
            out_of_range = val < spec["min"] or val > spec["max"]

            # Deviation from nearest spec limit
            if val < spec["min"]:
                dev_pct = abs(val - spec["min"]) / spec["min"]
            elif val > spec["max"]:
                dev_pct = abs(val - spec["max"]) / spec["max"]
            else:
                dev_pct = 0

            if out_of_range or z > z_threshold:
                # Determine severity
                if z > z_threshold * 2 or dev_pct > 0.15:
                    severity = "critical"
                elif z > z_threshold * 1.5 or dev_pct > 0.10:
                    severity = "high"
                elif z > z_threshold or dev_pct > 0.05:
                    severity = "medium"
                else:
                    severity = "low"

                anomalies.append(AnomalyFlag(
                    row_index=int(idx),
                    column=col_lower,
                    value=round(val, 4),
                    expected_min=spec["min"],
                    expected_max=spec["max"],
                    z_score=round(z, 2),
                    deviation_pct=round(dev_pct, 4),
                    severity=severity,
                ))

    log.info("anomaly_detection_complete", total_anomalies=len(anomalies))
    return anomalies


async def summarize_anomalies(anomalies: list[AnomalyFlag], specs: dict) -> dict:
    """Use LLM to generate a plain-English summary of detected anomalies."""
    config = _load_config()
    prompt = config["prompts"]["summarize_anomalies"].format(
        anomalies_json=json.dumps([a.model_dump() for a in anomalies[:20]], default=str),
        specs_json=json.dumps(specs),
    )
    system = config["prompts"]["system"]

    response = await llm_call(prompt=prompt, system=system)
    # Parse the response — expected fields: summary, severity, recommended_actions, confidence
    import re
    cleaned = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("```").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        data = json.loads(match.group())
        return data
    return {"summary": response, "severity": "medium", "recommended_actions": [], "confidence": 0.7}
