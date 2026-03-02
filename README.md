# 🤖 AI Strike Team — Workflow Automation Library

> Forward-deployed AI consulting toolkit. Build once, deploy fast.

## Philosophy
- **Modular**: Every workflow is a plug-and-play module
- **Reusable**: Swap connectors, tweak prompts — not rewrite from scratch
- **Observable**: Every run is logged, every edge case is flagged
- **Fast**: Each workflow deployable in < 14 days

## Structure

```
ai-strike-team/
├── core/                   # Shared infrastructure (don't touch per-workflow)
│   ├── config.py           # Env vars, API keys, settings
│   ├── llm.py              # LLM client wrapper (OpenAI/Anthropic)
│   ├── ingestion.py        # File/email ingestion helpers
│   ├── validator.py        # Pydantic base schemas
│   ├── logger.py           # Structured logging
│   └── workflow_base.py    # Base workflow class every workflow extends
│
├── suri/                   # Suri's 10 workflows
│   └── README.md
│
├── shubh/                  # Shubh's 10 workflows
│   └── README.md
│
├── .env.example            # Copy to .env and fill in your keys
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Quick Start

```bash
# 1. Clone / navigate to project
cd ai-strike-team

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 5. Run any workflow
python suri/<workflow_name>/main.py
python shubh/<workflow_name>/main.py
```

## Workflow Template Structure

Each workflow in `suri/` or `shubh/` should follow this pattern:

```
<workflow_name>/
├── main.py          # Entry point — trigger + orchestrate
├── extractor.py     # Ingestion + LLM extraction logic
├── validator.py     # Pydantic schema for this workflow's data
├── action.py        # Output/action layer (write DB, send Slack, etc.)
├── config.yaml      # Workflow-specific config (prompts, thresholds)
├── demo/            # Sample inputs for demos + testing
│   └── sample_input.*
└── README.md        # What it does, ROI, how to deploy
```

## Core Stack
- **LLM**: OpenAI GPT-4o / Anthropic Claude
- **Orchestration**: n8n or custom Python runner
- **Backend**: FastAPI
- **DB**: PostgreSQL (via SQLAlchemy)
- **Validation**: Pydantic v2
- **Logging**: Structured JSON logs

## Priority Workflows (Tier 1 — Build First)
1. Invoice / AP Automation Agent
2. Email → Structured Data Parser
3. Claims / Ticket Triage Agent
