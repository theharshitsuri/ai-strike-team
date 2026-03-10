"""
Action layer for Scheduling Automation — availability check, optimization, confirmation.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

import yaml

from core.logger import get_logger
from shubh.scheduling_automation.validator import ScheduleRequest, ScheduleSlot, ScheduleConfirmation

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def check_availability(
    request: ScheduleRequest,
    existing_events: list[dict] | None = None,
) -> tuple[bool, list[dict], ScheduleSlot | None]:
    """
    Rule-based availability check.
    Returns: (is_available, conflicts, suggested_slot)
    """
    config = _load_config()["thresholds"]
    existing = existing_events or []

    req_start = datetime.strptime(f"{request.preferred_date} {request.preferred_time}", "%Y-%m-%d %H:%M")
    req_end = req_start + timedelta(minutes=request.duration_minutes)

    # Business hours check
    if req_start.hour < config["business_start_hour"] or req_end.hour >= config["business_end_hour"]:
        log.warning("outside_business_hours", time=request.preferred_time)

    # Conflict check
    conflicts = []
    for ev in existing:
        ev_start = datetime.fromisoformat(ev["start"])
        ev_end = datetime.fromisoformat(ev["end"])
        gap = timedelta(minutes=config["min_gap_minutes"])

        if (req_start - gap) < ev_end and (req_end + gap) > ev_start:
            conflicts.append(ev)

    if not conflicts:
        slot = ScheduleSlot(
            date=request.preferred_date,
            start_time=request.preferred_time,
            end_time=req_end.strftime("%H:%M"),
        )
        return True, [], slot

    # Try to find next available slot (simple: push forward in 30-min increments)
    if request.flexibility != "exact":
        candidate = req_start
        for _ in range(16):  # Try up to 8 hours forward
            candidate += timedelta(minutes=30)
            cand_end = candidate + timedelta(minutes=request.duration_minutes)

            if candidate.hour >= config["business_end_hour"]:
                break

            no_conflict = True
            for ev in existing:
                ev_start = datetime.fromisoformat(ev["start"])
                ev_end = datetime.fromisoformat(ev["end"])
                gap = timedelta(minutes=config["min_gap_minutes"])
                if (candidate - gap) < ev_end and (cand_end + gap) > ev_start:
                    no_conflict = False
                    break

            if no_conflict:
                slot = ScheduleSlot(
                    date=candidate.strftime("%Y-%m-%d"),
                    start_time=candidate.strftime("%H:%M"),
                    end_time=cand_end.strftime("%H:%M"),
                )
                return True, conflicts, slot

    return False, conflicts, None


def save_confirmation(confirmation: ScheduleConfirmation) -> dict:
    """Save scheduling confirmation."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"confirmation_{confirmation.request_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(confirmation.model_dump(), f, indent=2, default=str)
    log.info("confirmation_saved", request_id=confirmation.request_id, path=str(out_path))
    return {"path": str(out_path)}


def generate_scheduling_report(request: ScheduleRequest, confirmation: ScheduleConfirmation) -> str:
    """Generate professional scheduling confirmation report."""
    from datetime import datetime

    report = f"""# ✅ Scheduling Confirmation Report

## Appointment Details
| Field | Value |
|-------|-------|
| Request ID | `{confirmation.request_id}` |
| Date | {confirmation.confirmed_date} |
| Time | {confirmation.confirmed_time} |
| Duration | {confirmation.duration_minutes} minutes |
| Location | {confirmation.location} |
| Participants | {', '.join(confirmation.participants)} |
| Slot Optimized | {'Yes — moved from preferred time' if confirmation.slot_optimized else 'No — preferred slot available'} |

## Confirmation Email
**Subject:** {confirmation.confirmation_subject}

{confirmation.confirmation_body}

---
*Confidence: {confirmation.confidence:.0%} | Confirmed: {datetime.utcnow().isoformat()}*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / f"scheduling_report_{confirmation.request_id}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    return report
