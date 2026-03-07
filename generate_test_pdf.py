from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def create_rfp_pdf(output_path):
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=12,
        textColor=colors.HexColor("#1e3a8a")
    )
    
    content = []
    
    # Title
    content.append(Paragraph("REQUEST FOR PROPOSAL: CONSTRUCTION OF WEST SIDE HEALTH CLINIC", title_style))
    content.append(Spacer(1, 12))
    
    # Basic Info
    content.append(Paragraph("<b>RFP Number:</b> RFP-2025-MED-09", styles['Normal']))
    content.append(Paragraph("<b>Issue Date:</b> March 1, 2025", styles['Normal']))
    content.append(Paragraph("<b>Submission Deadline:</b> June 15, 2025 at 2:00 PM PST", styles['Normal']))
    content.append(Spacer(1, 12))
    
    # Project Overview
    content.append(Paragraph("<b>1. Project Overview</b>", styles['Heading2']))
    content.append(Paragraph(
        "The City of Seaside is requesting proposals for the complete design and construction of a new "
        "15,000 square foot community health clinic on the West Side. The project aims to provide "
        "accessible primary care and dental services to the local population.",
        styles['Normal']
    ))
    content.append(Spacer(1, 12))
    
    # Scope of Work
    content.append(Paragraph("<b>2. Scope of Work</b>", styles['Heading2']))
    scope_points = [
        "● Architectural design and structural engineering.",
        "● Site preparation and grading.",
        "● Construction of a single-story LEED-certified building.",
        "● Installation of HVAC, plumbing, and medical gas systems.",
        "● Interior finishing including exam rooms and laboratory spaces.",
        "● Landscaping and 50-space parking lot."
    ]
    for point in scope_points:
        content.append(Paragraph(point, styles['Normal']))
    content.append(Spacer(1, 12))
    
    # Budget and Duration
    content.append(Paragraph("<b>3. Budget and Timeline</b>", styles['Heading2']))
    content.append(Paragraph("<b>Estimated Budget:</b> $8,500,000.00 (Total Project Cost)", styles['Normal']))
    content.append(Paragraph("<b>Project Duration:</b> 18 months from Notice to Proceed.", styles['Normal']))
    content.append(Spacer(1, 12))
    
    # Requirements
    content.append(Paragraph("<b>4. Mandatory Requirements</b>", styles['Heading2']))
    requirements = [
        ["Requirement", "Value/Type"],
        ["General Liability Insurance", "$2,000,000 per occurrence"],
        ["Professional Liability", "$1,000,000"],
        ["Bid Bond", "10% of total bid amount"],
        ["Performance Bond", "100% of contract value"],
        ["Experience", "Minimum 10 years in healthcare construction"]
    ]
    t = Table(requirements, colWidths=[200, 250])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0,0), (-1,-1), 1, colors.black)
    ]))
    content.append(t)
    content.append(Spacer(1, 12))
    
    # Contact
    content.append(Paragraph("<b>5. Contact Information</b>", styles['Heading2']))
    content.append(Paragraph("<b>Procurement Officer:</b> Marcus Aurelius", styles['Normal']))
    content.append(Paragraph("<b>Email:</b> procurement@cityofseaside.gov", styles['Normal']))
    content.append(Paragraph("<b>Phone:</b> (555) 987-6543", styles['Normal']))
    
    # Build
    doc.build(content)
    print(f"Created RFP PDF at: {output_path}")

if __name__ == "__main__":
    import os
    target = os.path.join(os.getcwd(), "test_rfp_seaside_clinic.pdf")
    create_rfp_pdf(target)
