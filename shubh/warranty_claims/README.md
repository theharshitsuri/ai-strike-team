# 🛡 Warranty Claim Processing

**Claim Form → Approve / Reject / Review**

## What It Does
Extracts claim data from forms/docs, validates against warranty rules (period, product validity, duplication), and makes automated decisions. Within 90 days = auto-approve. Expired = auto-reject. Edge cases → manual review queue.

## ROI
- **Manual time**: 15–30 min per claim to verify and decide
- **Volume**: 20–100 claims/week for mid-size manufacturer
- **Savings**: 5–15 hours/week, faster customer resolution

## Run Demo
```bash
python -m shubh.warranty_claims.main
```
