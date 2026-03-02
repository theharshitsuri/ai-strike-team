# ⏱ Detention Tracking Automation

**Timestamps → Detention Invoice**

## What It Does
Tracks driver arrival/departure at facilities, calculates detention fees when free time is exceeded, and generates invoice drafts automatically.

## ROI
- **Manual time**: 20–45 min per detention event to verify and invoice
- **Missed revenue**: Carriers lose $500–$2,000/week in unbilled detention
- **Savings**: Captures 100% of billable detention automatically

## Stack
- LLM: Extract timestamps from messy emails/logs (optional — works with structured input too)
- Rules: Fee calculation, free time thresholds, max cap
- Output: Detention invoice JSON

## Run Demo
```bash
python -m shubh.detention_tracking.main
```
