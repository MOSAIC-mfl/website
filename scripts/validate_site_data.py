#!/usr/bin/env python3
"""Check the website's own data files (frontend/data/): the landscape content the site keeps.

The catalogue is not in the site any more (it is read from mosaic-api); what is checked here is what
the Landscapes page reads at build time:

- every file is valid JSON;
- every landscape of landscapes.json has its outline, centroid, area / countries and boundary file;
- photos and descriptions only name known landscapes; every photo has its credit and licence;
- the sources of the descriptions are web addresses.

    python scripts/validate_site_data.py            # exit 1 and a list of problems when something is wrong
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "frontend" / "data"


def load(name: str) -> object:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> int:
    problems: list[str] = []
    try:
        for path in sorted(DATA.glob("*.json")):
            json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"invalid JSON: {exc}")
        return 1

    codes = [entry["code"] for entry in load("landscapes.json")]  # type: ignore[index, union-attr]
    known = set(codes)
    if len(known) != len(codes):
        problems.append("landscapes.json: a code appears twice")

    outlines = load("landscape_outlines.json")["outlines"]  # type: ignore[index]
    centroids = {c["code"] for c in load("landscape_centroids.json")["landscapes"]}  # type: ignore[index]
    geo = load("landscape_geo.json")["landscapes"]  # type: ignore[index]
    boundaries = {b["code"] for b in load("landscape_boundaries.json")["landscapes"]}  # type: ignore[index]
    for code in codes:
        for what, have in (("outline", outlines), ("centroid", centroids), ("area/countries", geo), ("boundary", boundaries)):
            if code not in have:
                problems.append(f"{code}: no {what}")

    photos = load("landscape_photos.json")["photos"]  # type: ignore[index]
    for code, items in photos.items():
        if code not in known:
            problems.append(f"landscape_photos.json: unknown landscape {code}")
        for ph in items:
            for key in ("file", "alt", "author", "licence", "source_url"):
                if not ph.get(key):
                    problems.append(f"landscape_photos.json: {code} {ph.get('file', '?')}: no {key}")

    profiles = load("landscape_profiles.json")["profiles"]  # type: ignore[index]
    for code, prof in profiles.items():
        if code not in known:
            problems.append(f"landscape_profiles.json: unknown landscape {code}")
        for src in prof.get("sources", []):
            if not str(src.get("source", "")).startswith(("http://", "https://")):
                problems.append(f"landscape_profiles.json: {code} {src.get('field')}: source is not a web address")

    for p in problems:
        print(p)
    print(f"{len(codes)} landscapes, {sum(len(v) for v in photos.values())} photos, {len(profiles)} descriptions: "
          f"{'OK' if not problems else f'{len(problems)} problems'}")  # fmt: skip
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
