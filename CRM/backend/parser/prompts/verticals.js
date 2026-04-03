// Vertical-specific Claude prompt templates for the parser layer

export const PARSER_PROMPTS = {

  logistics: {
    email: (emailText) => `You are an expert freight CRM data extractor. Analyze the email and return ONLY valid JSON — no explanation, no markdown fences.

Required JSON schema:
{
  "contact_name": "string or null",
  "email": "string or null",
  "company": "string or null",
  "phone": "string or null",
  "intent": "quote_request | follow_up | complaint | general_inquiry | referral",
  "load_type": "LTL | FTL | Partial | Container | Flatbed | Reefer | Hazmat | null",
  "origin": "string or null",
  "destination": "string or null",
  "freight_weight_lbs": "number or null",
  "freight_class": "string or null",
  "estimated_value": "number or null",
  "urgency": "high | medium | low",
  "next_step": "string — suggested CRM action",
  "confidence": "number between 0 and 1"
}

Email to analyze:
${emailText}`,

    document: (docText) => `You are an expert freight document parser. Extract key data from this freight document and return ONLY valid JSON.

Required JSON schema:
{
  "document_type": "bill_of_lading | invoice | rfq | rate_confirmation | other",
  "shipper_name": "string or null",
  "shipper_address": "string or null",
  "consignee_name": "string or null",
  "consignee_address": "string or null",
  "origin": "string or null",
  "destination": "string or null",
  "commodity": "string or null",
  "weight_lbs": "number or null",
  "freight_class": "string or null",
  "invoice_amount": "number or null",
  "invoice_date": "ISO date string or null",
  "due_date": "ISO date string or null",
  "reference_number": "string or null",
  "confidence": "number between 0 and 1"
}

Document:
${docText}`,

    transcript: (transcriptText) => `You are a freight sales call analyst. Extract CRM-relevant data from this call transcript and return ONLY valid JSON.

Required JSON schema:
{
  "contact_name": "string or null",
  "company": "string or null",
  "call_outcome": "qualified | not_interested | follow_up_needed | meeting_booked | voicemail",
  "deal_stage": "new_lead | qualified | proposal | negotiation | closed_won | closed_lost",
  "action_items": ["array of action item strings"],
  "key_objections": ["array of objection strings"],
  "budget_mentioned": "number or null",
  "timeline": "string or null",
  "next_step": "string",
  "deal_signals": ["array of positive/negative signal strings"],
  "rep_notes": "string — summary for CRM note",
  "confidence": "number between 0 and 1"
}

Transcript:
${transcriptText}`
  },

  manufacturing: {
    email: (emailText) => `You are an expert manufacturing CRM data extractor. Analyze the email and return ONLY valid JSON.

Required JSON schema:
{
  "contact_name": "string or null",
  "email": "string or null",
  "company": "string or null",
  "phone": "string or null",
  "intent": "rfq | technical_inquiry | follow_up | complaint | general_inquiry",
  "part_type": "string or null",
  "material": "string or null",
  "annual_units": "number or null",
  "has_drawings": "boolean",
  "quality_certifications_required": ["array of certifications or empty array"],
  "lead_time_requested_weeks": "number or null",
  "estimated_value": "number or null",
  "urgency": "high | medium | low",
  "next_step": "string",
  "confidence": "number between 0 and 1"
}

Email:
${emailText}`,

    document: (docText) => `You are an expert manufacturing document parser. Extract data from this technical document and return ONLY valid JSON.

Required JSON schema:
{
  "document_type": "rfq | purchase_order | quality_spec | technical_drawing | other",
  "company_name": "string or null",
  "contact_name": "string or null",
  "part_number": "string or null",
  "part_description": "string or null",
  "material": "string or null",
  "quantity": "number or null",
  "unit_price": "number or null",
  "total_value": "number or null",
  "required_date": "ISO date string or null",
  "quality_requirements": ["array of strings"],
  "reference_number": "string or null",
  "confidence": "number between 0 and 1"
}

Document:
${docText}`,

    transcript: (transcriptText) => `You are a manufacturing sales call analyst. Return ONLY valid JSON.

Required JSON schema:
{
  "contact_name": "string or null",
  "company": "string or null",
  "call_outcome": "qualified | not_interested | follow_up_needed | meeting_booked | rfq_requested",
  "parts_discussed": ["array of part types"],
  "annual_volume_mentioned": "number or null",
  "action_items": ["array of strings"],
  "key_objections": ["array of strings"],
  "next_step": "string",
  "technical_requirements": "string or null",
  "rep_notes": "string",
  "confidence": "number between 0 and 1"
}

Transcript:
${transcriptText}`
  },

  services: {
    email: (emailText) => `You are an expert B2B services CRM data extractor. Analyze the email and return ONLY valid JSON.

Required JSON schema:
{
  "contact_name": "string or null",
  "email": "string or null",
  "company": "string or null",
  "phone": "string or null",
  "title": "string or null",
  "intent": "inquiry | rfp | follow_up | complaint | referral | general",
  "service_type": "string or null",
  "pain_point": "string or null",
  "budget_range": "string or null",
  "timeline": "string or null",
  "company_size": "number or null",
  "estimated_value": "number or null",
  "urgency": "high | medium | low",
  "decision_maker": "boolean",
  "next_step": "string",
  "confidence": "number between 0 and 1"
}

Email:
${emailText}`,

    document: (docText) => `You are an expert services document parser. Extract data from this document and return ONLY valid JSON.

Required JSON schema:
{
  "document_type": "rfp | statement_of_work | proposal | contract | other",
  "company_name": "string or null",
  "contact_name": "string or null",
  "service_description": "string or null",
  "contract_value": "number or null",
  "start_date": "ISO date string or null",
  "end_date": "ISO date string or null",
  "payment_terms": "string or null",
  "key_deliverables": ["array of strings"],
  "success_metrics": ["array of strings"],
  "reference_number": "string or null",
  "confidence": "number between 0 and 1"
}

Document:
${docText}`,

    transcript: (transcriptText) => `You are a B2B services sales call analyst. Return ONLY valid JSON.

Required JSON schema:
{
  "contact_name": "string or null",
  "company": "string or null",
  "title": "string or null",
  "call_outcome": "qualified | not_interested | follow_up_needed | meeting_booked | proposal_requested",
  "pain_points_identified": ["array of strings"],
  "budget_confirmed": "boolean",
  "timeline": "string or null",
  "decision_maker": "boolean",
  "action_items": ["array of strings"],
  "key_objections": ["array of strings"],
  "next_step": "string",
  "rep_notes": "string",
  "confidence": "number between 0 and 1"
}

Transcript:
${transcriptText}`
  }
};
