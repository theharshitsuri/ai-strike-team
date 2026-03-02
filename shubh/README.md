# 👤 Shubh's Workflows

This is your workspace. Build your 10 workflows here.

## Structure

Each workflow gets its own folder:

```
shubh/
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

## Tier 2/3 Suggestions (Build After Tier 1)
1. **RFP / PDF Intelligence** — parse bids, extract requirements, draft response
2. **QA / Compliance Monitor** — flag non-compliance in inspection logs
3. **KPI Auto-Report Generator** — pull metrics, write exec summary, email it
4. **Inventory Forecast + Reorder** — demand forecast + restock alerts
5. **Internal Copilot** — RAG over company docs, SOPs, ERP exports

## Running a Workflow

```bash
cd ai-strike-team
source .venv/bin/activate
python -m shubh.<workflow_name>.main
```
