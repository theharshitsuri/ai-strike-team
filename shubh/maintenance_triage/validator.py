"""
Pydantic schemas for Maintenance Ticket Triage workflow.
Production-ready with complete field set for triage reports.
"""

from typing import Literal, Optional
from pydantic import Field, field_validator
from core.validator import WorkflowResult


class MaintenanceTicketResult(WorkflowResult):
    """Classified maintenance ticket with full triage data."""
    ticket_id: str = Field(..., description="Ticket ID")
    title: str = Field(default="", description="Brief summary")
    description: str = Field(default="", description="Full ticket description")
    category: Literal["electrical", "mechanical", "software", "plumbing", "hvac", "safety", "other"] = Field(default="other")
    priority: Literal["critical", "high", "medium", "low"] = Field(default="medium")
    equipment_id: str = Field(default="N/A")
    location: str = Field(default="N/A")
    estimated_downtime_hours: float = Field(default=0.0)
    estimated_repair_hours: float = Field(default=1.0, description="Estimated hours to fix")
    safety_risk: bool = Field(default=False)
    production_impact: str = Field(default="none", description="Impact on production: none, partial, full_stop")
    assigned_team: str = Field(default="facilities", description="Team to handle the ticket")
    recommended_team: str = Field(default="", description="LLM-suggested team (alias)")
    root_cause_guess: str = Field(default="", description="LLM's best guess at root cause")
    parts_needed: list[str] = Field(default_factory=list, description="Estimated parts required")
    recommended_actions: list[str] = Field(default_factory=list, description="Suggested next steps")

    @field_validator("assigned_team", mode="before")
    @classmethod
    def normalize_team(cls, v):
        if isinstance(v, str):
            v = v.lower().strip().replace(" ", "_")
            mapping = {
                "electrical_team": "electrical",
                "mechanics": "mechanical",
                "it_support": "it",
                "safety_officer": "safety",
            }
            return mapping.get(v, v)
        return v

    def model_post_init(self, __context):
        """Sync recommended_team → assigned_team if assigned_team is default."""
        if self.recommended_team and self.assigned_team == "facilities":
            self.assigned_team = self.recommended_team
