# 🔍 Freight Audit Automation

**Invoice vs Rate Confirmation → Audit Report**

## What It Does
Extracts charge line items from carrier invoices and rate confirmations (PDFs/text), compares them rule-by-rule, and flags overcharges, missing items, and discrepancies.

## ROI
- **Manual time**: 30–60 min per invoice audit
- **Overcharges caught**: Industry average 2–5% of freight spend is overbilled
- **For $5M freight spend**: $100k–$250k/year in recovered overcharges
- **Savings**: 10–20 hours/week for AP team

## Stack
- LLM: Extract structured line items from unstructured invoices and rate confirmations
- Rules: Line-by-line comparison with dollar tolerances, fuel % check
- Output: Audit report JSON with verdict (pass/fail/review)

## Run Demo
```bash
python -m shubh.freight_audit.main
```
