# 📅 Load Scheduling Automation

**Email → Calendar Event**

## What It Does
Parses scheduling emails from shippers/brokers → extracts load ID, facility, date/time → checks for conflicts → creates calendar event + Slack notification.

## ROI
- **Manual time**: 15–30 min per load scheduling email
- **Volume**: 20–50 emails/day for mid-size carrier
- **Savings**: 5–15 hours/week
- **Error reduction**: Eliminates missed appointments, double-bookings

## Stack
- LLM: Extract structured fields from unstructured email
- Rules: Conflict detection, time window validation, facility hours check
- Output: Google Calendar event JSON + Slack message

## Run Demo
```bash
python -m shubh.load_scheduling.main
```
