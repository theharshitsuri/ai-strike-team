"""
core/llm.py — Unified LLM client wrapper.
Supports OpenAI and Anthropic with automatic retries.

Usage:
    from core.llm import llm_call
    response = await llm_call(prompt="Extract invoice data from: ...", system="You are an AP automation agent.")
"""

import asyncio
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)


class LLMError(Exception):
    pass


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
    Unified LLM call. Returns the text response as a string.
    Temperature=0 by default for deterministic, structured extraction.
    """
    provider = settings.llm_provider
    _max_tokens = max_tokens or settings.max_tokens

    log.info("llm_call_start", provider=provider, prompt_length=len(prompt))

    if provider == "openai":
        return await _call_openai(prompt, system, model or settings.openai_model, _max_tokens, temperature)
    elif provider == "anthropic":
        return await _call_anthropic(prompt, system, model or settings.anthropic_model, _max_tokens, temperature)
    else:
        raise LLMError(f"Unknown LLM provider: {provider}")


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
    log.info("llm_call_success", provider="openai", model=model, output_length=len(result))
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
    log.info("llm_call_success", provider="anthropic", model=model, output_length=len(result))
    return result
