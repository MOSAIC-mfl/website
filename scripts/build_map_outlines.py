#!/usr/bin/env python3
"""Build frontend/data/landscape_outlines.json from the canonical MOSAIC
landscape delineations.

Reads mosaic-standard/boundaries/<CODE>.geojson (one Feature per landscape,
EPSG:4326; skips the combined landscapes.geojson) and emits one SVG path
string per code in the locator map's equirectangular projection:

    x = lon + 180
    y = 90 - lat        (rounded to 2 decimals)

All rings of all polygons are concatenated into a single path with M/L/Z
subpaths (render with fill-rule="evenodd" so interior rings read as holes).
Rings are subsampled to at most MAX_RING_POINTS vertices — enough fidelity
for the click-to-zoom view — keeping the JSON well under the ~120 KB budget
for a build-time import. Each outline also carries its PROJECTED bbox
[x0, y0, x1, y1] (computed from the full-resolution geometry) so the map
can letterbox the zoom target without re-parsing the path.

Usage:
    python3 scripts/build_map_outlines.py [path/to/mosaic-standard]

The path defaults to the sibling repo layout used in MOSAIC_development/
(../mosaic-standard relative to this repo). The boundaries moved there from
the catalog repo with the v0.2 rebuild (2026-11-13).
"""

import json
import math
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = REPO_ROOT.parent / "mosaic-standard"
OUT_PATH = REPO_ROOT / "frontend" / "data" / "landscape_outlines.json"
# Full-resolution boundaries for the map explorers (served as files, loaded only by a map)
BOUNDARY_DIR = REPO_ROOT / "frontend" / "public" / "data" / "boundaries"
BOUNDARY_PRECISION = 5  # decimals of degrees (~1 m): the explorers zoom in to streets

MAX_RING_POINTS = 500  # per ring, after subsampling
PRECISION = 3  # decimals kept per projected coordinate


def project(lon: float, lat: float) -> tuple[float, float]:
    """Equirectangular projection matching data/world_land_path.json."""
    return round(lon + 180, PRECISION), round(90 - lat, PRECISION)


def subsample(ring: list) -> list:
    """Keep every Nth vertex so the ring stays under MAX_RING_POINTS."""
    if len(ring) <= MAX_RING_POINTS:
        return ring
    step = math.ceil(len(ring) / MAX_RING_POINTS)
    kept = ring[::step]
    # Preserve the last distinct vertex so the closed shape isn't clipped.
    if kept[-1] != ring[-1]:
        kept.append(ring[-1])
    return kept


def ring_to_path(ring: list) -> str:
    """One closed M/L/Z subpath; consecutive duplicates (after rounding) dropped."""
    pts = []
    for lon, lat in subsample(ring):
        p = project(lon, lat)
        if not pts or p != pts[-1]:
            pts.append(p)
    # GeoJSON rings repeat the first vertex at the end; Z closes the path.
    if len(pts) > 1 and pts[-1] == pts[0]:
        pts.pop()
    if len(pts) < 3:
        return ""
    head = f"M{pts[0][0]} {pts[0][1]}"
    body = "".join(f"L{x} {y}" for x, y in pts[1:])
    return head + body + "Z"


def geometry_rings(geometry: dict) -> list:
    gtype = geometry["type"]
    if gtype == "Polygon":
        polygons = [geometry["coordinates"]]
    elif gtype == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        raise ValueError(f"Unsupported geometry type: {gtype}")
    return [ring for polygon in polygons for ring in polygon]


def geometry_to_path(geometry: dict) -> str:
    return "".join(ring_to_path(ring) for ring in geometry_rings(geometry))


def geometry_bbox(geometry: dict) -> list[float]:
    """Projected [x0, y0, x1, y1] from the full-resolution geometry."""
    pts = [project(lon, lat) for ring in geometry_rings(geometry) for lon, lat in ring]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def write_boundary(code: str, feature: dict, prov: dict) -> None:
    """frontend/public/data/boundaries/<CODE>.geojson: the canonical outline at full resolution, with
    its licence and the attribution the licence asks for."""

    def rnd(c):  # nested coordinate arrays
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], BOUNDARY_PRECISION), round(c[1], BOUNDARY_PRECISION)]

    geometry = {"type": feature["geometry"]["type"], "coordinates": rnd(feature["geometry"]["coordinates"])}
    props = {"code": code, "name": feature.get("properties", {}).get("name")}
    props.update({k: prov.get(k) for k in ("source", "source_url", "license", "license_url", "attribution", "credit") if prov.get(k)})
    out = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": props, "geometry": geometry}]}
    (BOUNDARY_DIR / f"{code}.geojson").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )


def main() -> int:
    catalog = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CATALOG
    boundaries = catalog / "boundaries"
    if not boundaries.is_dir():
        print(f"Boundaries folder not found: {boundaries}")
        return 1

    prov_path = catalog / "legacy" / "spec" / "boundary_provenance.json"
    provenance = json.loads(prov_path.read_text(encoding="utf-8")) if prov_path.exists() else {}
    BOUNDARY_DIR.mkdir(parents=True, exist_ok=True)

    outlines: dict[str, dict] = {}
    for path in sorted(boundaries.glob("*.geojson")):
        if path.name == "landscapes.geojson":  # combined file — skip
            continue
        feature = json.loads(path.read_text(encoding="utf-8"))
        if feature.get("type") == "FeatureCollection":
            feature = feature["features"][0]
        code = feature.get("properties", {}).get("code", path.stem)
        d = geometry_to_path(feature["geometry"])
        if not d:
            print(f"Warning: empty path for {code}, skipped")
            continue
        outlines[code] = {"d": d, "bbox": geometry_bbox(feature["geometry"])}
        prov = provenance.get(code) or {}
        if prov.get("publish", True):
            write_boundary(code, feature, prov)
            outlines[code]["boundary"] = f"data/boundaries/{code}.geojson"
            outlines[code]["credit"] = prov.get("credit") or prov.get("attribution") or "MOSAIC"

    out = {
        "_meta": {
            "note": (
                "Canonical MOSAIC living-landscape boundaries, simplified for the "
                "catalogue locator map (world view + click-to-zoom). Derived from "
                "MOSAIC_catalog/boundaries/<CODE>.geojson (approved delineations, "
                "2026-07-21; EPSG:4326). Per code: 'd' is an SVG path in the "
                "locator projection x = lon + 180, y = 90 - lat, rounded to "
                f"{PRECISION} decimals, rings subsampled to <= {MAX_RING_POINTS} "
                "vertices; 'bbox' is the projected [x0, y0, x1, y1] of the "
                "full-resolution geometry (the zoom target). Render with "
                "fill-rule='evenodd'. 'boundary' (when the licence lets MOSAIC "
                "publish it) is the full-resolution file the map explorers draw, "
                "'credit' its attribution line. Regenerate with "
                "scripts/build_map_outlines.py."
            ),
            "projection": "equirectangular: x = lon + 180, y = 90 - lat",
            "max_ring_points": MAX_RING_POINTS,
            "precision": PRECISION,
        },
        "outlines": outlines,
    }

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {len(outlines)} outlines to {OUT_PATH} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
