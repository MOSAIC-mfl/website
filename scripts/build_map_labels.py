#!/usr/bin/env python3
"""Build frontend/data/landscape_labels.json — places, rivers and lakes for the
Landscapes page map.

Source: Natural Earth 1:10m (public domain), downloaded from naciscdn.org:
    cultural/ne_10m_populated_places_simple.zip
    physical/ne_10m_rivers_lake_centerlines.zip
    physical/ne_10m_lakes.zip
Unzip them into one folder (one sub-folder per zip, named like the zip) and
pass that folder:

    python3 scripts/build_map_labels.py /path/to/natural_earth_10m

Only features around the 11 living landscapes are kept: each landscape's map
region (its countries' bbox, padded — the map's resting view).
Geometry uses the page projection x = lon + 180, y = 90 - lat.

Per feature, `z` is Natural Earth's own `min_zoom` (lower = more important);
the page shows a feature once the map is zoomed in far enough for it.
"""

import json
import math
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union

REPO_ROOT = Path(__file__).resolve().parents[1]
GEO = REPO_ROOT / "frontend" / "data" / "landscape_geo.json"
OUT_PATH = REPO_ROOT / "frontend" / "data" / "landscape_labels.json"

RIVER_TOLERANCE = 0.02   # degrees
LAKE_TOLERANCE = 0.02
MAX_UNNAMED_RIVER_ZOOM = 6  # unnamed rivers: only the main ones
MIN_LAKE_AREA = 0.002     # sq. degrees — drop ponds
ANCHOR_STEP = 0.6        # degrees between candidate river-label positions


def load(ne_dir: Path, name: str) -> gpd.GeoDataFrame:
    return gpd.read_file(ne_dir / name / f"{name}.shp").to_crs(4326)


def regions() -> list:
    """Map regions (lon/lat boxes) — mirrors restView() in the page script."""
    geo = json.loads(GEO.read_text())
    out = []
    for v in geo["landscapes"].values():
        bbs = [geo["countries"][c]["bbox"] for c in v["countries"]]
        x0 = min(b[0] for b in bbs); y0 = min(b[1] for b in bbs)
        x1 = max(b[2] for b in bbs); y1 = max(b[3] for b in bbs)
        pad = max(x1 - x0, y1 - y0) * 0.12 + 0.5
        x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        out.append(box(x0 - 180, 90 - y1, x1 - 180, 90 - y0))
    return out


def lines(geom):
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    if hasattr(geom, "geoms"):
        return [g for g in geom.geoms if isinstance(g, LineString)]
    return []


def polys(geom):
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    if hasattr(geom, "geoms"):
        return [g for g in geom.geoms if isinstance(g, Polygon)]
    return []


def px(lon, lat):
    return round(lon + 180, 2), round(90 - lat, 2)


def name_of(row, keys=("name_en", "name", "label")):
    for k in keys:
        v = getattr(row, k, None)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def main(ne_dir: Path):
    area = unary_union(regions())

    # --- places ---
    places = load(ne_dir, "ne_10m_populated_places_simple")
    places = places[places.intersects(area)]
    out_places = []
    for r in places.itertuples():
        x, y = px(r.geometry.x, r.geometry.y)
        # compact row: [name, x, y, min_zoom, is_capital]
        out_places.append([r.name, x, y, round(float(r.min_zoom), 1), 1 if r.adm0cap == 1 else 0])
    out_places.sort(key=lambda p: (p[3], -p[4]))

    # --- rivers ---
    rivers = load(ne_dir, "ne_10m_rivers_lake_centerlines")
    rivers = rivers[rivers.intersects(area)]
    # lake centerlines duplicate the lake polygons (and their names)
    rivers = rivers[~rivers["featurecla"].str.startswith("Lake")]
    by_name: dict = {}
    for r in rivers.itertuples():
        nm = name_of(r)
        if not nm and float(r.min_zoom) > MAX_UNNAMED_RIVER_ZOOM:
            continue
        geom = r.geometry.intersection(area).simplify(RIVER_TOLERANCE)
        key = nm or f"_{r.ne_id}"
        e = by_name.setdefault(key, {"n": nm, "z": float(r.min_zoom), "lines": []})
        e["z"] = min(e["z"], float(r.min_zoom))
        e["lines"].extend(lines(geom))
    out_rivers = []
    for e in by_name.values():
        d = ""
        anchors = []
        for ln in e["lines"]:
            pts = [px(x, y) for x, y in ln.coords]
            if len(pts) < 2:
                continue
            d += "M" + "L".join(f"{x:g},{y:g}" for x, y in pts)
            # candidate label anchors along the line, with its local direction
            if e["n"] and ln.length > ANCHOR_STEP:
                k = ANCHOR_STEP / 2
                while k < ln.length:
                    a, b = ln.interpolate(max(0, k - 0.08)), ln.interpolate(min(ln.length, k + 0.08))
                    ang = math.degrees(math.atan2(-(b.y - a.y), b.x - a.x))
                    if ang > 90: ang -= 180
                    if ang < -90: ang += 180
                    p = ln.interpolate(k)
                    anchors.append([*px(p.x, p.y), round(ang)])
                    k += ANCHOR_STEP
        if d:
            out_rivers.append({"n": e["n"], "z": round(e["z"], 1), "d": d, "a": anchors})

    # --- lakes ---
    lakes = load(ne_dir, "ne_10m_lakes")
    lakes = lakes[lakes.intersects(area)]
    out_lakes = []
    for r in lakes.itertuples():
        # 'label' carries the full name ("Lake Victoria"; name_en says "Nyanza")
        lake_name = name_of(r, ("label", "name", "name_en"))
        if r.geometry.area < MIN_LAKE_AREA and not lake_name:
            continue
        geom = r.geometry.intersection(area).simplify(LAKE_TOLERANCE, preserve_topology=True)
        d = ""
        for pg in polys(geom):
            for ring in [pg.exterior, *pg.interiors]:
                pts = [px(x, y) for x, y in ring.coords][:-1]
                if len(pts) >= 3:
                    d += "M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z"
        if not d:
            continue
        lp = r.geometry.intersection(area).representative_point()
        x, y = px(lp.x, lp.y)
        out_lakes.append({"n": lake_name, "z": round(float(r.min_zoom), 1), "d": d, "x": x, "y": y})

    out = {
        "_meta": {
            "note": "Built by scripts/build_map_labels.py from Natural Earth 1:10m populated places "
                    "(simple), rivers + lake centerlines and lakes (public domain, naturalearthdata.com). "
                    "Clipped to the living-landscape map regions. x = lon + 180, y = 90 - lat; "
                    "places rows = [name, x, y, min_zoom, capital]; z = Natural Earth min_zoom (lower = "
                    "more important); river 'a' = label anchors [x, y, angle].",
        },
        "places": out_places,
        "rivers": out_rivers,
        "lakes": out_lakes,
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e3:.0f} KB): "
          f"{len(out_places)} places, {len(out_rivers)} rivers, {len(out_lakes)} lakes")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
