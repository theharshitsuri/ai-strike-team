"""
core/client_config.py — Per-client configuration system.

This is the KEY to making workflows plug-and-play.

Instead of hardcoding thresholds, prompts, and catalog data per workflow,
each client gets a config directory with overrides.

Usage:
    # Deploy for a new client:
    python -m core.client_config --create "acme_logistics"

    # Run a workflow for a specific client:
    python -m shubh.freight_audit.main --client acme_logistics

Layout:
    clients/
    └── acme_logistics/
        ├── client.yaml         # Company info, API keys, vertical
        ├── overrides/
        │   ├── freight_audit.yaml    # Override thresholds/prompts for this client
        │   └── load_scheduling.yaml
        └── data/               # Client-specific reference data (catalogs, SKU lists)
"""

import os
import shutil
from pathlib import Path
from typing import Any, Optional

import yaml

from core.logger import get_logger

log = get_logger(__name__)

CLIENTS_DIR = Path(__file__).parent.parent / "clients"

# ── Default client template ──────────────────────────────────────────────────

DEFAULT_CLIENT_YAML = """
# Client Configuration
company_name: "{company_name}"
vertical: "logistics"  # logistics | manufacturing | wholesale | construction | healthcare
contact_name: ""
contact_email: ""

# Deployment info
deployment_start: ""
deployment_status: "setup"  # setup | active | retainer | completed

# Which workflows are enabled for this client
enabled_workflows:
  - load_scheduling
  - detention_tracking
  - shipment_followup
  - freight_audit

# Client-specific API integrations (optional)
integrations:
  erp_api_url: ""
  erp_api_key: ""
  calendar_api: "google"  # google | outlook
  slack_webhook: ""
  email_provider: "sendgrid"  # sendgrid | mailgun | smtp

# Billing
contract_type: "deployment"  # deployment | retainer | both
contract_value: 0
monthly_retainer: 0
"""


def create_client(company_name: str, vertical: str = "logistics") -> Path:
    """
    Create a new client configuration directory.
    Returns path to client directory.
    """
    slug = company_name.lower().replace(" ", "_").replace("-", "_")
    client_dir = CLIENTS_DIR / slug

    if client_dir.exists():
        log.warning("client_exists", client=slug)
        return client_dir

    client_dir.mkdir(parents=True, exist_ok=True)
    (client_dir / "overrides").mkdir()
    (client_dir / "data").mkdir()

    # Write client config
    config_content = DEFAULT_CLIENT_YAML.format(company_name=company_name)
    # Update vertical in the template
    config_content = config_content.replace('vertical: "logistics"', f'vertical: "{vertical}"')
    (client_dir / "client.yaml").write_text(config_content, encoding="utf-8")

    log.info("client_created", client=slug, path=str(client_dir))
    return client_dir


def get_client_config(client_slug: str) -> dict:
    """Load client configuration."""
    client_dir = CLIENTS_DIR / client_slug
    config_path = client_dir / "client.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Client '{client_slug}' not found at {config_path}")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def get_workflow_config(workflow_name: str, client_slug: Optional[str] = None) -> dict:
    """
    Load workflow config with optional client overrides merged in.

    Priority: client override > workflow default
    """
    # Load workflow default config
    # Look in both shubh/ and suri/
    for owner in ["shubh", "suri"]:
        default_path = Path(__file__).parent.parent / owner / workflow_name / "config.yaml"
        if default_path.exists():
            break
    else:
        raise FileNotFoundError(f"Workflow '{workflow_name}' config not found")

    with open(default_path, "r") as f:
        config = yaml.safe_load(f) or {}

    # Merge client overrides if provided
    if client_slug:
        override_path = CLIENTS_DIR / client_slug / "overrides" / f"{workflow_name}.yaml"
        if override_path.exists():
            with open(override_path, "r") as f:
                overrides = yaml.safe_load(f) or {}
            config = _deep_merge(config, overrides)
            log.info("client_overrides_applied", client=client_slug, workflow=workflow_name)

    return config


def list_clients() -> list[dict]:
    """List all configured clients."""
    if not CLIENTS_DIR.exists():
        return []
    clients = []
    for d in sorted(CLIENTS_DIR.iterdir()):
        if d.is_dir() and (d / "client.yaml").exists():
            cfg = get_client_config(d.name)
            clients.append({
                "slug": d.name,
                "company": cfg.get("company_name", d.name),
                "vertical": cfg.get("vertical", "unknown"),
                "status": cfg.get("deployment_status", "unknown"),
                "workflows": cfg.get("enabled_workflows", []),
            })
    return clients


def _deep_merge(base: dict, override: dict) -> dict:
    """Deep merge override into base dict."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage:")
        print("  python -m core.client_config --create <company_name> [vertical]")
        print("  python -m core.client_config --list")
        sys.exit(1)

    action = sys.argv[1]

    if action == "--create":
        name = sys.argv[2]
        vertical = sys.argv[3] if len(sys.argv) > 3 else "logistics"
        path = create_client(name, vertical)
        print(f"✅ Client created: {path}")
    elif action == "--list":
        for c in list_clients():
            print(f"  {c['slug']}: {c['company']} ({c['vertical']}) — {c['status']}")
    else:
        print(f"Unknown action: {action}")
