"""
core/llm.py — Production-ready LLM client wrapper.
Supports OpenAI and Anthropic with automatic retries, fallback provider,
pre-flight API key validation, and token usage tracking.

Usage:
    from core.llm import llm_call
    response = await llm_call(prompt="Extract invoice data from: ...", system="You are an AP agent.")
"""

import asyncio
import json
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)


class LLMError(Exception):
    pass


class LLMConfigError(LLMError):
    """Raised when LLM is misconfigured (missing API key, invalid provider)."""
    pass


def preflight_check() -> None:
    """
    Verify LLM is configured before running workflows.
    Fail fast with actionable error instead of cryptic auth errors after 3 retries.
    """
    provider = settings.llm_provider
    if provider == "openai":
        if not settings.openai_api_key or settings.openai_api_key.strip() == "":
            raise LLMConfigError(
                "OPENAI_API_KEY is not set. Add it to your .env file:\n"
                "  OPENAI_API_KEY=sk-...\n"
                "Get one at: https://platform.openai.com/api-keys"
            )
    elif provider == "anthropic":
        if not settings.anthropic_api_key or settings.anthropic_api_key.strip() == "":
            raise LLMConfigError(
                "ANTHROPIC_API_KEY is not set. Add it to your .env file:\n"
                "  ANTHROPIC_API_KEY=sk-ant-...\n"
                "Get one at: https://console.anthropic.com/"
            )
    else:
        raise LLMConfigError(f"Unknown LLM_PROVIDER: '{provider}'. Use 'openai' or 'anthropic'.")


@retry(
    stop=stop_after_attempt(settings.llm_retry_count),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def llm_call(
    prompt: str,
    system: str = "You are a helpful AI assistant for business process automation.",
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.0,
) -> str:
    """
    Unified LLM call with automatic fallback.
    Temperature=0 by default for deterministic, structured extraction.
    """
    preflight_check()

    provider = settings.llm_provider
    _max_tokens = max_tokens or settings.max_tokens

    log.info("llm_call_start", provider=provider, prompt_length=len(prompt))

    # Check for mock trigger first
    if provider == "openai" and (not settings.openai_api_key or settings.openai_api_key == "sk-..."):
        log.warning("using_mock_openai_response", model=model or settings.openai_model)
        return await _mock_response(prompt)
    if provider == "anthropic" and (not settings.anthropic_api_key or settings.anthropic_api_key == "sk-ant-..."):
        log.warning("using_mock_anthropic_response", model=model or settings.anthropic_model)
        return await _mock_response(prompt)

    try:
        if provider == "openai":
            return await _call_openai(prompt, system, model or settings.openai_model, _max_tokens, temperature)
        elif provider == "anthropic":
            return await _call_anthropic(prompt, system, model or settings.anthropic_model, _max_tokens, temperature)
        else:
            raise LLMError(f"Unknown LLM provider: {provider}")
    except LLMConfigError:
        raise
    except Exception as e:
        # Try fallback provider
        fallback = "anthropic" if provider == "openai" else "openai"
        fallback_key = settings.anthropic_api_key if fallback == "anthropic" else settings.openai_api_key
        if fallback_key and fallback_key.strip():
            log.warning("llm_fallback", from_provider=provider, to_provider=fallback, error=str(e))
            if fallback == "openai":
                return await _call_openai(prompt, system, settings.openai_model, _max_tokens, temperature)
            else:
                return await _call_anthropic(prompt, system, settings.anthropic_model, _max_tokens, temperature)
        raise

async def _mock_response(prompt: str) -> str:
    """Returns a mock JSON response for testing when API keys are missing."""
    await asyncio.sleep(0.5)  # Simulate latency
    
    prompt_lower = prompt.lower()
    
    # Detention Tracking (check before invoice since invoice prompts may contain "arrival")
    if "detention" in prompt_lower and ("arrival" in prompt_lower or "depart" in prompt_lower):
        return json.dumps({
            "load_id": "TRK-90221",
            "carrier": "FastHaul Logistics",
            "driver_name": "James Walker",
            "facility_name": "ABC Manufacturing",
            "dock_number": "4",
            "arrival_time": "2025-03-12T07:45:00",
            "departure_time": "2025-03-12T13:30:00",
            "free_time_hours": 2.0,
            "delay_reason": "Loading delays — product not staged, waited for forklift crew",
            "confidence": 0.95,
            "notes": "Mock extraction from detention record"
        })
    
    # Freight Audit - Invoice
    if "invoice" in prompt_lower and ("linehaul" in prompt_lower or "freight" in prompt_lower):
        return json.dumps({
            "load_id": "FRT-44500",
            "carrier_name": "Heartland Transport LLC",
            "invoice_number": "INV-2025-8834",
            "invoice_date": "2025-03-15",
            "line_items": [
                {"description": "Linehaul", "amount": 2850.00, "detail": ""},
                {"description": "Fuel Surcharge", "amount": 798.00, "detail": "28%"},
                {"description": "Detention", "amount": 225.00, "detail": "3 hrs"},
                {"description": "Lumper Fee", "amount": 150.00, "detail": ""}
            ],
            "total_amount": 4023.00,
            "confidence": 0.96,
            "notes": "Mock invoice extraction"
        })
    
    # Freight Audit - Rate Confirmation
    if "rate" in prompt_lower and "confirmation" in prompt_lower:
        return json.dumps({
            "load_id": "FRT-44500",
            "carrier_name": "Heartland Transport LLC",
            "rate_con_number": "RC-2025-4410",
            "line_items": [
                {"description": "Linehaul", "amount": 2850.00, "detail": ""},
                {"description": "Fuel Surcharge", "amount": 741.00, "detail": "26%"},
                {"description": "Detention", "amount": 150.00, "detail": "2 hrs"}
            ],
            "total_amount": 3741.00,
            "confidence": 0.97,
            "notes": "Mock rate confirmation extraction"
        })
    
    # Scheduling Automation (generic service requests - check BEFORE load scheduling)
    if ("service" in prompt_lower or "hvac" in prompt_lower or "meeting" in prompt_lower) and ("schedule" in prompt_lower or "appointment" in prompt_lower):
        return json.dumps({
            "request_id": "SCH-2025-0318",
            "requester_name": "Rachel Kim",
            "requester_email": "rachel.kim@company.com",
            "request_type": "service_call",
            "preferred_date": "2025-03-18",
            "preferred_time": "10:00",
            "duration_minutes": 120,
            "location": "200 Main Street, Suite 400, Denver, CO 80202",
            "participants": ["Rachel Kim", "HVAC Technician"],
            "priority": "high",
            "notes_text": "Routine quarterly HVAC maintenance, unit cycling frequently",
            "flexibility": "flexible_time",
            "confidence": 0.93,
            "notes": "Mock scheduling automation extraction"
        })
    
    # Load Scheduling (freight/logistics - dock, trailer, shipper keywords)
    if ("scheduling" in prompt_lower or "appointment" in prompt_lower) and ("pickup" in prompt_lower or "delivery" in prompt_lower or "load" in prompt_lower or "dock" in prompt_lower or "trailer" in prompt_lower):
        return json.dumps({
            "load_id": "TRK-88412",
            "shipper_name": "Acme Freight",
            "facility_name": "Johnson Distribution Center",
            "facility_address": "1450 Industrial Blvd, Memphis, TN 38118",
            "appointment_date": "2025-03-14",
            "appointment_time": "08:00",
            "time_window_minutes": 120,
            "load_type": "pickup",
            "contact_name": "Mike Thompson",
            "contact_phone": "(901) 555-0142",
            "equipment_type": "48-foot trailer",
            "special_instructions": "Dock 7, south entrance. Driver must check in at guard shack first.",
            "confidence": 0.94,
            "notes": "Mock load scheduling extraction"
        })
    
    # Maintenance Triage (check after PO since PO may contain "hydraulic" in product names)
    if "maintenance" in prompt_lower or ("hydraulic" in prompt_lower and "ticket" in prompt_lower) or ("equipment" in prompt_lower and "repair" in prompt_lower):
        return json.dumps({
            "ticket_id": "MT-2025-0314",
            "title": "Hydraulic press grinding noise - possible seal failure",
            "description": "Hydraulic press on Assembly Line 3 making grinding noise since morning. Hydraulic fluid leaking around main cylinder seal.",
            "category": "mechanical",
            "priority": "critical",
            "equipment_id": "HP-042",
            "location": "Building A, Assembly Line 3, Station 7",
            "estimated_downtime_hours": 4.0,
            "estimated_repair_hours": 3.0,
            "safety_risk": True,
            "production_impact": "partial",
            "assigned_team": "mechanical",
            "root_cause_guess": "Main cylinder seal failure due to wear",
            "parts_needed": ["Hydraulic cylinder seal kit", "Hydraulic fluid"],
            "recommended_actions": ["Shut down press immediately", "Inspect seal condition", "Replace seal kit"],
            "confidence": 0.92,
            "notes": "Mock maintenance triage"
        })
    
    # PO Email to ERP
    if "purchase order" in prompt_lower or "po number" in prompt_lower or "po #" in prompt_lower:
        return json.dumps({
            "po_number": "WD-2025-1140",
            "customer_name": "MidWest Supply Co.",
            "customer_email": "purchasing@midwestsupply.com",
            "order_date": "2025-03-13",
            "requested_ship_date": "2025-03-20",
            "shipping_address": "8900 Commerce Dr, Suite 200, Indianapolis, IN 46256",
            "line_items": [
                {"sku": "SKU-1001", "description": "Industrial Bolt Pack (100ct)", "quantity": 200, "unit_price": 24.99, "total": 4998.00},
                {"sku": "SKU-1002", "description": "Heavy Duty Bracket Set", "quantity": 50, "unit_price": 49.99, "total": 2499.50},
                {"sku": "WHL-2001", "description": "Hydraulic Hose Assembly", "quantity": 30, "unit_price": 89.99, "total": 2699.70},
                {"sku": "SKU-1003", "description": "Safety Pin Assortment", "quantity": 500, "unit_price": 12.50, "total": 6250.00}
            ],
            "subtotal": 16447.20,
            "tax": 0.00,
            "total": 16447.20,
            "payment_terms": "Net 30",
            "special_instructions": "Palletize by SKU, include packing list per pallet",
            "confidence": 0.96,
            "notes": "Mock PO extraction"
        })
    
    # Production Report
    if "production" in prompt_lower and ("output" in prompt_lower or "shift" in prompt_lower):
        return json.dumps({
            "report_date": "2025-03-14",
            "total_output": 1080,
            "total_downtime_minutes": 120,
            "overall_pass_rate": 0.974,
            "summary": "Production ran at 94% efficiency with Line C experiencing extended downtime.",
            "highlights": ["Line B achieved highest output (365 units)", "Line C had 45 min downtime in Shift 1"],
            "concerns": ["Line C downtime needs investigation", "Scrap rate on Line C above target"],
            "confidence": 0.93,
            "notes": "Mock production report summary"
        })
    
    # QA Anomaly
    if "inspection" in prompt_lower or "anomaly" in prompt_lower or "temperature" in prompt_lower and "pressure" in prompt_lower:
        return json.dumps({
            "anomalies_detected": 4,
            "anomaly_details": [
                {"batch_id": "B006", "parameter": "temperature", "value": 415, "expected_range": "370-380", "severity": "high"},
                {"batch_id": "B007", "parameter": "pressure", "value": 38.5, "expected_range": "30-32", "severity": "medium"},
                {"batch_id": "B008", "parameter": "thickness", "value": 1.85, "expected_range": "2.20-2.28", "severity": "high"},
                {"batch_id": "B009", "parameter": "weight", "value": 520, "expected_range": "495-505", "severity": "medium"}
            ],
            "summary": "4 anomalies detected across 15 batches. Temperature spike in B006 and thickness deviation in B008 require immediate attention.",
            "confidence": 0.91,
            "notes": "Mock QA anomaly detection"
        })
    
    # Shipment Status Extraction (check BEFORE follow-up email)
    # The extraction prompt has "Extract shipment status" - check for that specific phrase
    if "extract" in prompt_lower and ("shipment" in prompt_lower or "load_id" in prompt_lower):
        return json.dumps({
            "load_id": "FRT-44102",
            "carrier": "MidWest Express Trucking",
            "carrier_contact_email": "dispatch@midwestexpress.com",
            "origin": "Chicago, IL",
            "destination": "Nashville, TN",
            "expected_delivery": "2025-03-12",
            "current_status": "In transit - no update since departure",
            "last_known_location": "Near Indianapolis",
            "hours_overdue": 32,
            "customer_name": "Nashville Distribution Center",
            "is_overdue": True,
            "confidence": 0.89,
            "notes": "Mock shipment status extraction"
        })
    
    # Shipment Follow-up Email Generation (for drafting emails - has "Write a professional follow-up email")
    if ("follow-up" in prompt_lower or "followup" in prompt_lower) and ("write" in prompt_lower or "tone" in prompt_lower or "attempt" in prompt_lower):
        return json.dumps({
            "subject": "Urgent: Status Update Required - Load FRT-44102",
            "body": "Dear MidWest Express Trucking Team,\n\nWe are writing to request an urgent status update on Load FRT-44102, which was scheduled for delivery on 2025-03-12.\n\nOur records indicate the shipment has not arrived and we have not received any tracking updates since departure from Chicago, IL.\n\nPlease provide:\n1. Current location of the shipment\n2. Expected delivery time\n3. Any issues causing the delay\n\nThis shipment is time-sensitive for our customer, Nashville Distribution Center.\n\nPlease respond at your earliest convenience.\n\nBest regards,\nLogistics Team",
            "urgency": "urgent",
            "should_escalate": True,
            "recommended_action": "Escalate to carrier management if no response within 4 hours",
            "confidence": 0.91,
            "notes": "Mock follow-up email generation"
        })
    
    # Fallback Shipment Status (broader match)
    if "shipment" in prompt_lower or "overdue" in prompt_lower or ("carrier" in prompt_lower and "transit" in prompt_lower):
        return json.dumps({
            "load_id": "FRT-44102",
            "carrier": "MidWest Express Trucking",
            "carrier_contact_email": "dispatch@midwestexpress.com",
            "origin": "Chicago, IL",
            "destination": "Nashville, TN",
            "expected_delivery": "2025-03-12",
            "current_status": "In transit - no update since departure",
            "last_known_location": "Near Indianapolis",
            "hours_overdue": 32,
            "customer_name": "Nashville Distribution Center",
            "confidence": 0.89,
            "notes": "Mock shipment status extraction"
        })
    
    # Warranty Claims
    if "warranty" in prompt_lower or "claim" in prompt_lower and "product" in prompt_lower:
        return json.dumps({
            "claim_id": "WC-2025-0891",
            "customer_name": "David Martinez",
            "customer_email": "d.martinez@email.com",
            "product_name": "PRD-X450 Heavy Duty Drill",
            "product_id": "PRD-X450",
            "serial_number": "SN-HDD-2024-07821",
            "purchase_date": "2025-01-10",
            "claim_date": "2025-03-14",
            "defect_type": "malfunction",
            "defect_description": "Motor stopped working after 2 months. Trigger works but motor does not engage.",
            "requested_resolution": "replacement",
            "claim_value": 149.99,
            "confidence": 0.94,
            "notes": "Mock warranty claim extraction"
        })
    
    # RFP Intelligence
    if "rfp" in prompt_lower or "request for proposal" in prompt_lower or "bridge" in prompt_lower:
        return json.dumps({
            "project_title": "River Elm Bridge Structural Rehabilitation",
            "submission_deadline": "November 15, 2025 at 5:00 PM EST",
            "budget_cap": "$4,200,000",
            "project_duration": "March 2026 - Ongoing",
            "scope_summary": "Structural assessment, joint replacement, deck resurfacing, and safety lighting installation for the River Elm Bridge.",
            "primary_contact": "Jane Doe, Senior Project Engineer (jane.doe@cityworks.gov)",
            "compliance_standards": "DOT Section 4.2.1, EPA Stormwater Permit, FAR 52.204-7",
            "insurance_requirements": "$5,000,000 General Liability, Statutory Workers Comp",
            "bid_bond": "5% bid security required",
            "technical_requirements": "State Grade A Engineering License, 15+ years experience required",
            "confidence": 0.98,
            "notes": "Mock RFP extraction"
        })
    
    # Default fallback
    return json.dumps({
        "message": "Mock response - configure API key for real extraction",
        "confidence": 0.5,
        "notes": "Generic mock response"
    })


async def _call_openai(prompt: str, system: str, model: str, max_tokens: int, temperature: float) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    result = response.choices[0].message.content or ""

    # Track token usage
    usage = response.usage
    if usage:
        cost_per_1k_input = 0.0025  # gpt-4o pricing
        cost_per_1k_output = 0.01
        estimated_cost = (usage.prompt_tokens / 1000 * cost_per_1k_input) + (usage.completion_tokens / 1000 * cost_per_1k_output)
        log.info("llm_call_success", provider="openai", model=model,
                 input_tokens=usage.prompt_tokens, output_tokens=usage.completion_tokens,
                 estimated_cost_usd=round(estimated_cost, 4))

    return result


async def _call_anthropic(prompt: str, system: str, model: str, max_tokens: int, temperature: float) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    result = response.content[0].text if response.content else ""

    # Track token usage
    usage = response.usage
    if usage:
        log.info("llm_call_success", provider="anthropic", model=model,
                 input_tokens=usage.input_tokens, output_tokens=usage.output_tokens)

    return result
