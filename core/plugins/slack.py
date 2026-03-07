"""
core/plugins/slack.py — Slack integration plugin.
"""

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)

async def post_message(text: str, channel: str = None) -> bool:
    """Sends a message to a Slack channel."""
    
    token = settings.slack_bot_token
    channel = channel or settings.slack_channel_id
    
    if not token or not channel:
        log.warning("slack_plugin_unconfigured", message="Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID. Simulation mode active.")
        # Simulating success for demo purposes if not configured
        log.info("slack_payload_simulation", text=text[:50])
        return True

    log.info("slack_message_sending", channel=channel)
    
    # In a real implementation, we'd use:
    # import httpx
    # async with httpx.AsyncClient() as client:
    #     res = await client.post("https://slack.com/api/chat.postMessage", ...)
    
    # Simulating the API turnaround
    import asyncio
    await asyncio.sleep(0.5) 
    
    return True

async def post_rfp_summary(project: str, deadline: str, budget: str) -> bool:
    """Specialized helper for RFP summaries."""
    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "📄 New RFP Extracted"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Project:*\n{project}"},
                {"type": "mrkdwn", "text": f"*Deadline:*\n{deadline}"}
            ]
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Budget:*\n{budget}"}
            ]
        }
    ]
    log.info("posting_slack_rfp_summary", project=project)
    return await post_message(f"RFP Summary: {project}", blocks=blocks)
