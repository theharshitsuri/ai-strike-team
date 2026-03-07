"""
core/llm.py — Production-ready LLM client wrapper.
Supports OpenAI and Anthropic with automatic retries, fallback provider,
pre-flight API key validation, and token usage tracking.

Usage:
    from core.llm import llm_call
    response = await llm_call(prompt="Extract invoice data from: ...", system="You are an AP agent.")
"""

import asyncio
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
    await asyncio.sleep(1)  # Simulate latency
    
    # Simple heuristic to detect which workflow is calling
    if "RFP" in prompt or "Structural Rehabilitation" in prompt:
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
            "notes": "Extracted from provided demo text. All key fields identified."
        })
    
    return json.dumps({
        "error": "Mock response not implemented for this prompt.",
        "confidence": 0.0
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
