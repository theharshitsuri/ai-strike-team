"""
suri/rfp_intelligence/validator.py — Pydantic schema for RFP extraction.
"""

from typing import Optional
from pydantic import Field
from core.validator import WorkflowResult


class RFPResult(WorkflowResult):
    """Structured data extracted from an RFP/PDF document."""
    
    project_title: str = Field(..., description="The official name of the project or RFP")
    submission_deadline: Optional[str] = Field(None, description="The date and time bids are due")
    budget_cap: Optional[str] = Field(None, description="The maximum budget or project value mentioned")
    project_duration: Optional[str] = Field(None, description="The expected timeframe for completion")
    scope_summary: str = Field(..., description="A concise summary of the work requested")
    primary_contact: Optional[str] = Field(None, description="Main point of contact (name/email/phone)")
    compliance_standards: Optional[str] = Field(None, description="FAR clauses, OSHA, EPA or other regulations")
    insurance_requirements: Optional[str] = Field(None, description="Required liability/workers comp coverage")
    bid_bond: Optional[str] = Field(None, description="Bid bond or security requirements (e.g. 5%)")
    liquidated_damages: Optional[str] = Field(None, description="Penalties for delays or contract breaches")
    minority_participation: Optional[str] = Field(None, description="DBE/WBE/MBE participation goals or requirements")
    plan_issue_date: Optional[str] = Field(None, description="The date the plans or RFP were officially issued")
    technical_requirements: Optional[str] = Field(None, description="Key technical specs or qualifications needed")
    
    # Optional field for the industry context
    industry: Optional[str] = Field(None, description="The industry/vertical (e.g. Construction, Healthcare)")
