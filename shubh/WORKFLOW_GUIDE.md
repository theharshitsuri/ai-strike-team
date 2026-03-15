# AI Strike Team — Shubh Workflows Guide

This guide covers **how to test each workflow** and **how companies will use them in production**.

---

## 🚀 Quick Start: Running the Server

```bash
# 1. Navigate to the project directory
cd c:\Users\paras\Downloads\ai-strike-team

# 2. Activate virtual environment
.venv\Scripts\activate

# 3. Start the server
uvicorn server:app --reload --port 8000

# 4. Open browser to dashboard
http://localhost:8000/dashboard
```

---

## 📋 Workflow Overview

| # | Workflow | Vertical | UI URL |
|---|----------|----------|--------|
| 1 | Detention Tracking | Logistics | `/shubh/detention_tracking/index-pro.html` |
| 2 | Freight Audit | Logistics | `/shubh/freight_audit/index-pro.html` |
| 3 | Load Scheduling | Logistics | `/shubh/load_scheduling/index-pro.html` |
| 4 | Shipment Follow-up | Logistics | `/shubh/shipment_followup/index-pro.html` |
| 5 | Maintenance Triage | Manufacturing | `/shubh/maintenance_triage/index-pro.html` |
| 6 | QA Anomaly Detection | Manufacturing | `/shubh/qa_anomaly/index-pro.html` |
| 7 | Production Report | Manufacturing | `/shubh/production_report/index-pro.html` |
| 8 | PO Email to ERP | Wholesale | `/shubh/po_email_to_erp/index-pro.html` |
| 9 | Inventory Restock | Wholesale | `/shubh/inventory_restock/index-pro.html` |
| 10 | Warranty Claims | Wholesale | `/shubh/warranty_claims/index-pro.html` |
| 11 | Scheduling Automation | Cross-Vertical | `/shubh/scheduling_automation/index-pro.html` |

---

# 🧪 TESTING EACH WORKFLOW

## 1. Detention Tracking ⏱️

### Test Steps
1. Open: `http://localhost:8000/shubh/detention_tracking/index-pro.html`
2. Click **"Try Demo"** or paste this sample data:
```
Load: TRK-90221
Carrier: FastHaul Logistics
Driver: James Walker

Check-in at facility: ABC Manufacturing, Dock 4
Arrived: March 12, 2025 at 7:45 AM
Departed: March 12, 2025 at 1:30 PM

Reason for extended stay: Loading delays — product not staged, waited for forklift crew.
Free time per contract: 2 hours
```
3. Configure settings (hourly rate, free time, thresholds)
4. Click **"Process"**
5. Verify output shows:
   - Extracted timestamps (arrival/departure)
   - Calculated detention hours
   - Generated invoice with fee

### API Test
```bash
curl -X POST http://localhost:8000/run/detention_tracking \
  -F "file=@shubh/detention_tracking/demo/sample_detention.txt"
```

---

## 2. Freight Audit 🔍

### Test Steps
1. Open: `http://localhost:8000/shubh/freight_audit/index-pro.html`
2. Click **"Try Demo"** or paste:
```
CARRIER INVOICE
Invoice #: INV-2025-8834
Date: 2025-03-15
Carrier: Heartland Transport LLC
Load: FRT-44500

Charges:
  Linehaul                 $2,850.00
  Fuel Surcharge (28%)       $798.00
  Detention (3 hrs)          $225.00
  Lumper Fee                 $150.00
  TOTAL                    $4,023.00
```
3. Configure tolerance settings
4. Click **"Process"**
5. Verify output shows:
   - Extracted line items
   - Flagged discrepancies (fuel % too high, etc.)
   - Audit summary

### API Test
```bash
curl -X POST http://localhost:8000/run/freight_audit \
  -F "file=@shubh/freight_audit/demo/sample_invoice.txt"
```

---

## 3. Load Scheduling 📅

### Test Steps
1. Open: `http://localhost:8000/shubh/load_scheduling/index-pro.html`
2. Click **"Try Demo"** or paste:
```
Subject: Scheduling Request — Load #TRK-88412

Please schedule the following pickup:

Load Number: TRK-88412
Facility: Johnson Distribution Center
Address: 1450 Industrial Blvd, Memphis, TN 38118
Date: March 14, 2025
Time: 08:00 AM - 10:00 AM (2-hour window)
Type: Pickup

Contact at facility: Mike Thompson, (901) 555-0142
```
3. Configure scheduling rules
4. Click **"Process"**
5. Verify output shows:
   - Extracted appointment details
   - Calendar event data
   - Confirmation draft

### API Test
```bash
curl -X POST http://localhost:8000/run/load_scheduling \
  -F "file=@shubh/load_scheduling/demo/sample_email.txt"
```

---

## 4. Shipment Follow-up 📦

### Test Steps
1. Open: `http://localhost:8000/shubh/shipment_followup/index-pro.html`
2. Click **"Try Demo"** or paste:
```
Load ID: FRT-44102
Carrier: MidWest Express Trucking
Route: Chicago, IL → Nashville, TN
Expected Delivery: 2025-03-12
Last Status Update: In transit — departed Chicago terminal at 6:00 AM on March 11, 2025
Current Date/Time: 2025-03-13 14:00

Notes: No driver check-in since departure. GPS signal lost near Indianapolis.
This is the 2nd follow-up attempt.
```
3. Configure follow-up triggers and escalation rules
4. Click **"Process"**
5. Verify output shows:
   - Overdue status detected
   - Urgency level assigned
   - Follow-up email draft generated

### API Test
```bash
curl -X POST http://localhost:8000/run/shipment_followup \
  -F "file=@shubh/shipment_followup/demo/sample_shipment.txt"
```

---

## 5. Maintenance Triage 🔧

### Test Steps
1. Open: `http://localhost:8000/shubh/maintenance_triage/index-pro.html`
2. Click **"Try Demo"** or paste:
```
Ticket submitted by: Floor Supervisor, Line 3
Date: 2025-03-14 14:22

Subject: Hydraulic press making grinding noise — possible seal failure

The hydraulic press on Assembly Line 3 (Equipment ID: HP-042) has been making 
a loud grinding noise since this morning. Operators noticed hydraulic fluid leaking 
around the main cylinder seal. Production has been slowed — we're running at 60% 
capacity on this line.

Possible safety concern: if the seal fully fails, there is risk of high-pressure 
fluid spray.

Location: Building A, Assembly Line 3, Station 7
```
3. Configure priority rules
4. Click **"Process"**
5. Verify output shows:
   - Category: Hydraulic/Mechanical
   - Priority: Critical (safety concern detected)
   - Assigned team: Hydraulics specialists
   - Safety flag: Yes

### API Test
```bash
curl -X POST http://localhost:8000/run/maintenance_triage \
  -F "file=@shubh/maintenance_triage/demo/sample_ticket.txt"
```

---

## 6. QA Anomaly Detection 🔬

### Test Steps
1. Open: `http://localhost:8000/shubh/qa_anomaly/index-pro.html`
2. Click **"Try Demo"** or upload CSV:
```csv
batch_id,timestamp,temperature,pressure,thickness,weight
B001,2025-03-14 08:00,372,31.2,2.24,499
B002,2025-03-14 08:15,375,30.8,2.22,501
B006,2025-03-14 09:15,415,31.0,2.21,501
B007,2025-03-14 09:30,376,38.5,2.24,499
B008,2025-03-14 09:45,373,31.3,1.85,500
B009,2025-03-14 10:00,371,30.7,2.26,520
```
3. Configure detection thresholds (Z-score, spec deviation)
4. Click **"Process"**
5. Verify output shows:
   - Anomalies detected: B006 (temp spike), B007 (pressure), B008 (thickness), B009 (weight)
   - Statistical analysis
   - Recommended actions

### API Test
```bash
curl -X POST http://localhost:8000/run/qa_anomaly \
  -F "file=@shubh/qa_anomaly/demo/sample_inspection.csv"
```

---

## 7. Production Report 📈

### Test Steps
1. Open: `http://localhost:8000/shubh/production_report/index-pro.html`
2. Click **"Try Demo"** or upload CSV:
```csv
date,shift,line,output_units,downtime_minutes,pass_count,fail_count,scrap_units
2025-03-14,1,A,180,15,175,5,3
2025-03-14,1,B,195,8,192,3,2
2025-03-14,1,C,160,45,152,8,6
2025-03-14,2,A,190,10,187,3,2
2025-03-14,2,B,170,30,164,6,4
2025-03-14,2,C,185,12,182,3,2
```
3. Configure production targets
4. Click **"Process"**
5. Verify output shows:
   - Total output: 1,080 units
   - Downtime analysis (Line C had issues)
   - Quality pass rate
   - Executive summary narrative

### API Test
```bash
curl -X POST http://localhost:8000/run/production_report \
  -F "file=@shubh/production_report/demo/sample_production.csv"
```

---

## 8. PO Email to ERP 📧

### Test Steps
1. Open: `http://localhost:8000/shubh/po_email_to_erp/index-pro.html`
2. Click **"Try Demo"** or paste:
```
Subject: PO #WD-2025-1140 — Monthly Restock Order
From: purchasing@midwestsupply.com

PO Number: WD-2025-1140
Company: MidWest Supply Co.

Items:
1. SKU-1001 — Industrial Bolt Pack (100ct)    Qty: 200    @ $24.99 ea = $4,998.00
2. SKU-1002 — Heavy Duty Bracket Set          Qty: 50     @ $49.99 ea = $2,499.50
3. WHL-2001 — Hydraulic Hose Assembly         Qty: 30     @ $89.99 ea = $2,699.70

Total: $16,447.20
Payment Terms: Net 30
Requested Ship Date: March 20, 2025
```
3. Configure validation rules
4. Click **"Process"**
5. Verify output shows:
   - Extracted PO header
   - Parsed line items with SKUs
   - ERP-ready JSON payload
   - Validation status

### API Test
```bash
curl -X POST http://localhost:8000/run/po_email_to_erp \
  -F "file=@shubh/po_email_to_erp/demo/sample_po_email.txt"
```

---

## 9. Inventory Restock 📦

### Test Steps
1. Open: `http://localhost:8000/shubh/inventory_restock/index-pro.html`
2. Click **"Try Demo"** or upload CSV:
```csv
sku,description,current_stock,week_1,week_2,week_3,week_4
SKU-1001,Industrial Bolt Pack,1200,280,310,295,320
SKU-1002,Heavy Duty Bracket Set,85,40,45,38,42
WHL-2001,Hydraulic Hose Assembly,12,8,10,7,9
DST-3001,Control Valve Assembly,25,5,7,6,4
```
3. Configure forecasting settings (safety stock, lead time)
4. Click **"Process"**
5. Verify output shows:
   - Demand forecast per SKU
   - Days of stock remaining
   - Critical items flagged (WHL-2001 is low!)
   - Reorder recommendations

### API Test
```bash
curl -X POST http://localhost:8000/run/inventory_restock \
  -F "file=@shubh/inventory_restock/demo/sample_inventory.csv"
```

---

## 10. Warranty Claims 🛡️

### Test Steps
1. Open: `http://localhost:8000/shubh/warranty_claims/index-pro.html`
2. Click **"Try Demo"** or paste:
```
WARRANTY CLAIM FORM
Claim #: WC-2025-0891

Customer: David Martinez
Product: PRD-X450 Heavy Duty Drill
Serial Number: SN-HDD-2024-07821
Purchase Date: 2025-01-10
Date of Claim: 2025-03-14

Issue Type: Malfunction
Description: The drill motor stopped working after approximately 2 months of regular use.

Requested Resolution: Replacement
```
3. Configure warranty rules (period, auto-approve thresholds)
4. Click **"Process"**
5. Verify output shows:
   - Claim validated (within warranty period)
   - Decision: Approved/Review/Rejected
   - Response draft generated

### API Test
```bash
curl -X POST http://localhost:8000/run/warranty_claims \
  -F "file=@shubh/warranty_claims/demo/sample_claim.txt"
```

---

## 11. Scheduling Automation 📆

### Test Steps
1. Open: `http://localhost:8000/shubh/scheduling_automation/index-pro.html`
2. Click **"Try Demo"** or paste:
```
Hi,

I need to schedule a service call for our HVAC system at the downtown office.

Preferably next Tuesday (March 18, 2025) around 10 AM. The visit usually takes about 
2 hours. The technician will need access to the rooftop unit.

Location: 200 Main Street, Suite 400, Denver, CO 80202
Contact: Rachel Kim, Facilities Manager
Priority: High
```
3. Configure business hours and booking rules
4. Click **"Process"**
5. Verify output shows:
   - Extracted date/time/location
   - Availability check
   - Calendar event created
   - Confirmation message draft

### API Test
```bash
curl -X POST http://localhost:8000/run/scheduling_automation \
  -F "file=@shubh/scheduling_automation/demo/sample_request.txt"
```

---

# 🏢 COMPANY USAGE GUIDE

## How Companies Will Use These Workflows in Production

### Step 1: Onboarding & Configuration

1. **Access the Dashboard**
   - Company admin logs into `https://your-domain.com/dashboard`
   - Selects their assigned workflows

2. **Configure Each Workflow**
   - Open workflow → Go to **Configure** step
   - Adjust settings to match company policies:
     - **Detention Tracking**: Set hourly rate ($50-150), free time (1-3 hrs)
     - **Freight Audit**: Set tolerance thresholds ($5-20)
     - **Warranty Claims**: Set warranty period, auto-approve limits
   - Click **Export Config** to save settings
   - Settings persist in browser and can be shared with team

3. **Integration Setup** (Optional)
   - Configure Slack webhook for alerts
   - Set up email notifications
   - Connect to ERP/TMS via API

---

### Step 2: Daily Operations

#### Logistics Companies

| Time | Action | Workflow |
|------|--------|----------|
| 7:00 AM | Review overnight scheduling emails | Load Scheduling |
| 9:00 AM | Process detention claims from yesterday | Detention Tracking |
| 11:00 AM | Audit incoming carrier invoices | Freight Audit |
| 2:00 PM | Check overdue shipments, send follow-ups | Shipment Follow-up |
| 4:00 PM | Review and confirm tomorrow's appointments | Load Scheduling |

**Typical Flow:**
1. Dispatcher receives scheduling email
2. Copies email text → Pastes into Load Scheduling workflow
3. AI extracts: Load #, facility, date/time, contact
4. Dispatcher reviews → Clicks "Create Calendar Event"
5. Confirmation email auto-generated → Sent to carrier

#### Manufacturing Companies

| Time | Action | Workflow |
|------|--------|----------|
| 6:00 AM | Review overnight maintenance tickets | Maintenance Triage |
| 8:00 AM | Upload morning QA inspection data | QA Anomaly |
| 12:00 PM | Generate mid-day production report | Production Report |
| 3:00 PM | Process warranty claims from customers | Warranty Claims |
| 5:00 PM | Generate end-of-day production summary | Production Report |

**Typical Flow:**
1. QA inspector exports inspection CSV from equipment
2. Uploads to QA Anomaly workflow
3. AI detects: Batch B006 temperature spike (415°F vs 375°F avg)
4. Alert sent to production supervisor
5. Supervisor investigates, prevents defective batch

#### Wholesale/Distribution Companies

| Time | Action | Workflow |
|------|--------|----------|
| 8:00 AM | Process overnight PO emails | PO Email to ERP |
| 10:00 AM | Review inventory levels, generate reorders | Inventory Restock |
| 1:00 PM | Process customer warranty claims | Warranty Claims |
| 3:00 PM | Schedule delivery appointments | Scheduling Automation |

**Typical Flow:**
1. Customer sends PO via email
2. Sales rep forwards to PO Email workflow
3. AI extracts: PO#, customer, line items, quantities, prices
4. Validates SKUs against catalog
5. Generates ERP import payload → One-click import

---

### Step 3: Automation & Integration

#### API Integration
Companies can integrate workflows directly into their systems:

```javascript
// Example: Auto-process incoming emails
async function processIncomingPO(emailContent) {
  const response = await fetch('https://api.yourdomain.com/run/po_email_to_erp', {
    method: 'POST',
    body: JSON.stringify({ text: emailContent }),
    headers: { 'Content-Type': 'application/json' }
  });
  
  const result = await response.json();
  
  if (result.status === 'success') {
    // Auto-import to ERP
    await importToERP(result.erp_payload);
  }
}
```

#### Slack Integration
```
🚨 Detention Alert — Load TRK-90221
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Facility: ABC Manufacturing
Wait Time: 5.75 hours
Billable: 3.75 hours
Fee: $281.25

[View Invoice] [Approve] [Dispute]
```

#### Email Automation
- Auto-send follow-up emails for overdue shipments
- Auto-send warranty decision notifications
- Auto-send appointment confirmations

---

### Step 4: Reporting & Analytics

Each workflow tracks:
- **Time Saved**: Comparison vs manual processing
- **Cost Saved**: Labor cost reduction
- **Accuracy**: Error rate vs manual entry
- **Volume**: Documents processed per day/week/month

Dashboard shows:
- ROI metrics per workflow
- Processing trends
- Error rates
- User activity

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow not loading | Check server is running: `uvicorn server:app --reload` |
| File upload fails | Ensure file is supported format (PDF, TXT, CSV) |
| API returns 500 | Check server logs for Python errors |
| Config not saving | Clear browser cache, check localStorage |
| Demo not loading | Verify demo files exist in `/shubh/{workflow}/demo/` |

---

## 📞 Support

- **Documentation**: `/shubh/README.md`
- **Research**: `/shubh/WORKFLOW_RESEARCH.md`
- **API Docs**: `http://localhost:8000/docs`

---

*Last updated: March 2025*
