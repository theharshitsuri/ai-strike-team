# 📧 PO Email → ERP Entry

**Purchase Order Email → Validated ERP Payload**

## What It Does
Parses purchase order emails, extracts line items (SKU, qty, price), validates against product catalog, and generates ERP-ready payloads. Flags unknown SKUs and price mismatches.

## ROI
- **Manual time**: 15–30 min per PO to manually key into ERP
- **Volume**: 30–100 POs/day for mid-size distributor
- **Savings**: 8–25 hours/week of data entry
- **Error reduction**: Eliminates typos and missed line items

## Run Demo
```bash
python -m shubh.po_email_to_erp.main
```
