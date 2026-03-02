# 👤 Suri's Workflows

This is your workspace. Build your 10 workflows here.

## Structure

Each workflow gets its own folder:

```
suri/
└── <workflow_name>/
    ├── main.py          # Entry point
    ├── extractor.py     # LLM extraction logic
    ├── validator.py     # Pydantic schema
    ├── action.py        # Output / side-effects
    ├── config.yaml      # Prompts + thresholds
    ├── demo/            # Sample inputs
    └── README.md        # ROI explanation
```

## How to Use Core

```python
from core.workflow_base import BaseWorkflow
from core.llm import llm_call
from core.ingestion import ingest_file
from core.validator import WorkflowResult, parse_llm_json
from core.logger import get_logger
```

## Tier 1 Suggestions (Highest ROI First)
1. **Invoice / AP Automation** — parse invoices, cross-check POs
2. **Email → Structured Parser** — extract orders/RFQs from email body
3. **Claims / Ticket Triage** — classify, prioritize, route support tickets
4. **Scheduling & Dispatch** — jobs + workers → optimized schedule
5. **Data Reconciliation** — orders vs invoices, flag discrepancies

## Running a Workflow

```bash
cd ai-strike-team
source .venv/bin/activate
python -m suri.<workflow_name>.main
```
