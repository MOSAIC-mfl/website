#!/usr/bin/env python3
"""Validate frontend/data/datasets.json against MFL metadata rules."""

import json
import sys
from pathlib import Path

# Always-present fields. Every real record carries these; the remaining
# controlled-vocabulary fields may legitimately be null for records whose
# source metadata is incomplete or flagged for repair (see OPTIONAL_VOCAB_FIELDS).
REQUIRED_FIELDS = [
    "id", "title", "living_landscape", "readiness_status"
]

# Controlled-vocabulary fields that are validated only when present.
# null/"" is tolerated (the registry is the source of truth and some rows are
# legitimately incomplete or flagged for repair, e.g. the malformed "Soil dataset" rows).
OPTIONAL_VOCAB_FIELDS = ["country", "mfl_theme", "data_type", "access_level", "license"]

# Mirrors the catalog's authoritative enum: see catalog spec/record_schema.md
# field 4 and spec/vocab_reconciliation.md. Keep the two in step — this list is
# a copy, and it had already drifted once (the region tier below was added to
# the schema on 2026-08-03 and never reached here).
# "Global" is the pseudo-country carried by global / cross-landscape records.
# The three regions are UN M49 macro-regions, for datasets spanning many
# countries within one region; "Global" stays reserved for worldwide scope.
VALID_COUNTRIES = [
    "Cambodia", "Colombia", "Côte d'Ivoire", "Ethiopia", "Global", "India",
    "Kenya", "Laos", "Peru", "Senegal", "Tanzania", "Tunisia", "Vietnam",
    "Zimbabwe",
    "Africa", "Asia", "Latin America and the Caribbean",
]

# Canonical living-landscape codes (approved 2026-07-21).
# "GLB" is the special value for global / cross-landscape datasets.
VALID_LANDSCAPES = [
    "COL-CUM", "PER-PCL", "SEN-FK", "CIV-NZ", "TUN-NW", "ETH-OG",
    "KEN-LVB", "KEN-LEI", "ZWE-MB", "IND-CH", "MEK-3S", "GLB"
]

VALID_MFL_THEMES = [
    "Boundaries / admin units",
    "Land cover / land use",
    "Ecosystem condition",
    "Degradation / land health",
    "Water / hydrology",
    "Biodiversity / ecosystems",
    "Pressures / drivers",
    "Ecosystem services",
    "Hotspots / leverage points",
    "Scenarios / future risks",
    "Decision-support outputs",
    "Agrobiodiversity / crops",
    "Socio-economic / livelihoods"
]

VALID_DATA_TYPES = ["Raster", "Vector", "Tabular", "Mixed"]

VALID_ACCESS = ["Open", "Internal", "CGIAR-internal", "Restricted"]

VALID_READINESS = ["Raw", "Processed", "Validated"]

RECORD_COUNT_WARNING = 300


def validate(path: str) -> list[str]:
    errors = []

    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"JSON parse error: {e}"]
    except FileNotFoundError:
        return [f"File not found: {path}"]

    if not isinstance(data, list):
        return ["Top-level value must be a JSON array"]

    if len(data) >= RECORD_COUNT_WARNING:
        print(
            f"Warning: {len(data)} records in datasets.json. "
            f"Consider planning pagination for performance above {RECORD_COUNT_WARNING} records."
        )

    seen_ids: set[str] = set()

    for i, entry in enumerate(data):
        prefix = f"Entry {i} (id={entry.get('id', 'MISSING')})"

        # Required fields
        for field in REQUIRED_FIELDS:
            if field not in entry or entry[field] == "" or entry[field] is None:
                errors.append(f"{prefix}: missing required field '{field}'")

        # Unique IDs
        eid = entry.get("id")
        if eid:
            if eid in seen_ids:
                errors.append(f"{prefix}: duplicate id '{eid}'")
            seen_ids.add(eid)

        # NOTE: download_url is NOT required for Open records. MOSAIC follows a
        # "connect, don't duplicate" model: an Open dataset is reachable at its
        # external source via the metadata link, not necessarily a file we host.

        # Controlled vocabularies (validated only when present; null is tolerated)
        if entry.get("country") and entry["country"] not in VALID_COUNTRIES:
            errors.append(f"{prefix}: invalid country '{entry['country']}'")

        if entry.get("living_landscape") and entry["living_landscape"] not in VALID_LANDSCAPES:
            errors.append(
                f"{prefix}: invalid living_landscape '{entry['living_landscape']}'"
            )

        if entry.get("mfl_theme") and entry["mfl_theme"] not in VALID_MFL_THEMES:
            errors.append(f"{prefix}: invalid mfl_theme '{entry['mfl_theme']}'")

        if entry.get("data_type") and entry["data_type"] not in VALID_DATA_TYPES:
            errors.append(f"{prefix}: invalid data_type '{entry['data_type']}'")

        if entry.get("access_level") and entry["access_level"] not in VALID_ACCESS:
            errors.append(f"{prefix}: invalid access_level '{entry['access_level']}'")

        if entry.get("readiness_status") and entry["readiness_status"] not in VALID_READINESS:
            errors.append(
                f"{prefix}: invalid readiness_status '{entry['readiness_status']}'"
            )

    return errors


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: validate_datasets.py <path/to/datasets.json>")
        sys.exit(1)

    errors = validate(sys.argv[1])

    if errors:
        print(f"Validation FAILED -- {len(errors)} error(s):\n")
        for e in errors:
            print(f"  x {e}")
        sys.exit(1)
    else:
        print("Validation PASSED -- datasets.json is valid.")
        sys.exit(0)
