from core.logger import get_logger
from core.plugins.slack import post_message
from core.plugins.crm import create_lead
from suri.rfp_intelligence.validator import RFPResult

log = get_logger(__name__)

async def run_actions(result: RFPResult) -> dict:
    """Execute side-effects after extraction using core plugins."""
    
    log.info("performing_rfp_actions", project=result.project_title)
    
    actions_performed = []
    
    # --- CRM Plugin ---
    try:
        lead_id = await create_lead(
            company_name=result.project_title,
            contact_info=result.primary_contact or "No contact provided",
            deal_value=result.budget_cap
        )
        actions_performed.append({
            "target": "CRM",
            "action": "Create Lead",
            "status": "success",
            "details": f"Lead created with ID: {lead_id}"
        })
    except Exception as e:
        log.error("crm_action_failed", error=str(e))
        actions_performed.append({"target": "CRM", "status": "failed", "error": str(e)})

    # --- Slack Plugin ---
    try:
        slack_summary = (
            f"*New RFP Extracted: {result.project_title}*\n"
            f"• *Budget:* {result.budget_cap or 'TBD'}\n"
            f"• *Deadline:* {result.submission_deadline or 'TBD'}\n"
            f"• *Contact:* {result.primary_contact or 'Unknown'}"
        )
        await post_message(slack_summary)
        actions_performed.append({
            "target": "Slack",
            "action": "Post Summary",
            "status": "success",
            "details": "Summary posted to workspace"
        })
    except Exception as e:
        log.error("slack_action_failed", error=str(e))
        actions_performed.append({"target": "Slack", "status": "failed", "error": str(e)})
    
    return {
        "summary": f"Successfully processed {result.project_title}",
        "actions": actions_performed
    }
