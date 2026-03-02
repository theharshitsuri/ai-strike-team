# 📦 Shipment Status Follow-Up Agent

**Overdue Alert → Auto Email → Slack Escalation**

## What It Does
Monitors shipments past expected delivery, auto-generates professional follow-up emails to carriers, and escalates to Slack after multiple unanswered attempts.

## ROI
- **Manual time**: 10–15 min per follow-up (compose, track, escalate)
- **Volume**: 10–30 overdue shipments/day for mid-size broker
- **Savings**: 3–8 hours/day of dispatcher time
- **Impact**: Faster resolution, zero missed follow-ups

## Stack
- LLM: Draft professional follow-up emails with escalating tone
- Rules: Overdue threshold, follow-up intervals, escalation triggers
- Output: Email draft + Slack escalation message

## Run Demo
```bash
python -m shubh.shipment_followup.main
```
