"""
suri/rfp_intelligence/main.py — Entry point for RFP Intelligence workflow.
"""

import asyncio
from typing import Any
from core.workflow_base import BaseWorkflow
from core.ingestion import ingest_file
from core.logger import get_logger
from suri.rfp_intelligence.extractor import extract_rfp_data
from suri.rfp_intelligence.action import run_actions
from suri.rfp_intelligence.validator import RFPResult

log = get_logger(__name__)

class RFPWorkflow(BaseWorkflow):
    """
    RFP Intelligence Workflow:
    1. Ingest: Reads PDF/Text RFP documents.
    2. Extract: Uses GPT-4o to find timelines, budgets, and specs.
    3. Validate: Enforces RFPResult schema.
    4. Act: Logs summary and mocks CRM/Slack integration.
    """
    
    name = "rfp_intelligence"

    async def ingest(self, input_data: Any) -> str:
        """
        Expects input_data to be a file path (str) or a dict with 'text' or 'path'.
        """
        if isinstance(input_data, str):
            path = input_data
        elif isinstance(input_data, dict):
            if "text" in input_data:
                return input_data["text"]
            path = input_data.get("path")
        else:
            raise ValueError(f"Invalid input_data format: {type(input_data)}")

        if not path:
            raise ValueError("No file path or text provided for ingestion")

        log.info("ingesting_rfp_file", path=path)
        return ingest_file(path)

    async def validate_input(self, raw_text: str) -> str | None:
        """Validate that input contains RFP-related content."""
        lower = raw_text.lower()
        keywords = ["rfp", "request for proposal", "bid", "submission", "deadline",
                    "scope", "budget", "project", "proposal", "contract", "vendor",
                    "requirements", "specifications", "procurement"]
        if not any(kw in lower for kw in keywords):
            return (
                "This doesn't appear to be an RFP document. "
                "Expected keywords like 'RFP', 'request for proposal', 'bid', 'submission deadline', etc."
            )
        return None

    async def extract(self, raw_text: str) -> RFPResult:
        """Call the specialized RFP extractor."""
        return await extract_rfp_data(raw_text)

    async def act(self, result: RFPResult) -> dict:
        """Execute the RFP-specific action layer."""
        return await run_actions(result)


async def main():
    """CLI runner for demo/testing."""
    import os
    from pathlib import Path
    
    # Use demo file or create it if missing
    demo_dir = Path(__file__).parent / "demo"
    demo_dir.mkdir(exist_ok=True)
    
    sample_path = demo_dir / "sample_rfp.txt"
    if not sample_path.exists():
        with open(sample_path, "w") as f:
            f.write("CITY OF OAKLAND - RFP #9912\n")
            f.write("Project: Piedmont Bridge Replacement\n")
            f.write("Submission Deadline: October 15, 2025 at 4:30 PM\n")
            f.write("Estimated Budget: $1,250,000\n")
            f.write("Scope: Full removal and replacement of the concrete span at 42nd St.\n")
            f.write("Technical Requirements: Must have 10+ years civic bridge experience.\n")
            f.write("Contact: engineering@oaklandca.gov\n")

    workflow = RFPWorkflow()
    print(f"--- Running {workflow.name} Workflow ---")
    
    result = await workflow.run(str(sample_path))
    
    import json
    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
