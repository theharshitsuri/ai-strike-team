"""
Action layer for PO Email → ERP — validate line items and save ERP payload.
"""

import json
from pathlib import Path

import yaml

from core.logger import get_logger
from shubh.po_email_to_erp.validator import (
    PurchaseOrderResult, ERPEntryResult, POLineItemValidation
)

log = get_logger(__name__)

OUTPUT_DIR = Path(__file__).parent / "output"
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def _load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def validate_and_prepare_erp(po: PurchaseOrderResult) -> ERPEntryResult:
    """Validate PO line items against catalog and prepare ERP payload."""
    config = _load_config()["validation"]
    catalog = config.get("catalog", {})
    price_tol = config["price_tolerance_pct"]
    valid_prefixes = config["valid_sku_prefixes"]

    validations = []
    issues = []

    for item in po.line_items:
        sku_upper = item.sku.upper()
        sku_valid = any(sku_upper.startswith(p) for p in valid_prefixes)
        catalog_price = catalog.get(item.sku, 0.0)

        if catalog_price > 0:
            diff_pct = abs(item.unit_price - catalog_price) / catalog_price * 100
            price_valid = diff_pct <= price_tol
        else:
            diff_pct = 0
            price_valid = True  # No catalog entry to compare

        if not sku_valid and not price_valid:
            status = "both_issues"
            issues.append(f"SKU {item.sku}: unknown SKU + price mismatch (${item.unit_price} vs ${catalog_price})")
        elif not sku_valid:
            status = "sku_unknown"
            issues.append(f"SKU {item.sku}: not found in catalog")
        elif not price_valid:
            status = "price_mismatch"
            issues.append(f"SKU {item.sku}: price ${item.unit_price} differs from catalog ${catalog_price} by {diff_pct:.1f}%")
        else:
            status = "ok"

        validations.append(POLineItemValidation(
            sku=item.sku,
            sku_valid=sku_valid,
            price_valid=price_valid,
            catalog_price=catalog_price,
            price_difference_pct=round(diff_pct, 2),
            status=status,
        ))

    all_valid = all(v.status == "ok" for v in validations)

    result = ERPEntryResult(
        po_number=po.po_number,
        customer_name=po.customer_name,
        line_items=po.line_items,
        validations=validations,
        total=po.total,
        all_valid=all_valid,
        issues=issues,
        confidence=po.confidence,
    )

    # Save ERP payload
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"erp_payload_{po.po_number}.json"
    with open(out_path, "w") as f:
        json.dump(result.model_dump(), f, indent=2, default=str)
    result.erp_payload_saved = True

    log.info("erp_payload_prepared", po=po.po_number, all_valid=all_valid, issues=len(issues))
    return result
