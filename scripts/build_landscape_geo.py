#!/usr/bin/env python3
"""Build frontend/data/landscape_geo.json for the Landscapes page explorer.

Inputs (both outside this repo, in the MOSAIC_development/ layout):
  - MOSAIC_catalog/boundaries/<CODE>.geojson — canonical delineations (EPSG:4326)
  - MOSAIC_LLV_delim/for global map/ne_50m_countries.geojson — Natural Earth
    1:50m admin-0 countries (public domain)

Outputs, per landscape code:
  - area_ha: area of the full-resolution boundary, computed in an equal-area
    projection (EPSG:6933, WGS 84 / NSIDC EASE-Grid 2.0 Global)
  - countries: ISO3 codes of the countries the boundary intersects
And once for the page:
  - countries: simplified country outlines as SVG paths in the page's
    equirectangular projection (x = lon + 180, y = 90 - lat), plus a coarser
    lon/lat ring list for the orthographic inset globe, which is projected
    in the browser.

Usage:
    python3 scripts/build_landscape_geo.py
"""

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon, box

REPO_ROOT = Path(__file__).resolve().parents[1]
DEV_ROOT = REPO_ROOT.parent
BOUNDARIES = DEV_ROOT / "MOSAIC_catalog" / "boundaries"
COUNTRIES = DEV_ROOT / "MOSAIC_LLV_delim" / "for global map" / "ne_50m_countries.geojson"
LANDSCAPES = REPO_ROOT / "frontend" / "data" / "landscapes.json"
OUT_PATH = REPO_ROOT / "frontend" / "data" / "landscape_geo.json"

MAP_TOLERANCE = 0.03     # degrees — flat outline of a landscape's own country
NEIGHBOUR_TOLERANCE = 0.12  # degrees — surrounding countries (context only)
GLOBE_TOLERANCE = 0.6    # degrees — inset globe (tiny)
GLOBE_MIN_AREA = 0.5     # sq. degrees — drop specks on the globe


def polygons(geom):
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return []


def svg_path(geom, precision=2):
    """Equirectangular SVG path (x = lon + 180, y = 90 - lat)."""
    parts = []
    for poly in polygons(geom):
        for ring in [poly.exterior, *poly.interiors]:
            pts = [(round(x + 180, precision), round(90 - y, precision)) for x, y in ring.coords]
            if len(pts) < 4:
                continue
            parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts[:-1]) + "Z")
    return "".join(parts)


def globe_rings(geom):
    rings = []
    for poly in polygons(geom):
        if poly.area < GLOBE_MIN_AREA:
            continue
        rings.append([[round(x, 1), round(y, 1)] for x, y in poly.exterior.coords[:-1]])
    return rings


def main():
    codes = [l["code"] for l in json.loads(LANDSCAPES.read_text())]
    world = gpd.read_file(COUNTRIES)[["ADM0_A3", "ADMIN", "geometry"]]
    world = world[world["ADMIN"] != "Antarctica"].reset_index(drop=True)

    landscapes = {}
    for code in codes:
        gdf = gpd.read_file(BOUNDARIES / f"{code}.geojson").to_crs(4326)
        geom = gdf.geometry.union_all()
        area_ha = gpd.GeoSeries([geom], crs=4326).to_crs(6933).area.iloc[0] / 10_000
        hits = world[world.intersects(geom)]
        # Rank by overlap so the "home" country comes first; ignore slivers
        # (< 2 % of the landscape) caused by the coarse 1:50m borders.
        share = {r.ADM0_A3: r.geometry.intersection(geom).area / geom.area for r in hits.itertuples()}
        ranked = sorted((c for c, v in share.items() if v >= 0.02), key=lambda c: -share[c])
        landscapes[code] = {
            "area_ha": int(round(area_ha)),
            "countries": ranked,
        }

    # Flat outlines only for the landscapes' countries and their surroundings
    # (whatever a country-level view can show), to keep the page light.
    home = world[world["ADM0_A3"].isin({c for v in landscapes.values() for c in v["countries"]})]
    near = set()
    for row in home.itertuples():
        bx0, by0, bx1, by1 = row.geometry.bounds
        pad = max(bx1 - bx0, by1 - by0) * 0.6 + 2
        near |= set(world[world.intersects(box(bx0 - pad, by0 - pad, bx1 + pad, by1 + pad))]["ADM0_A3"])

    countries = {}
    for row in world.itertuples():
        tol = MAP_TOLERANCE if row.ADM0_A3 in set(home['ADM0_A3']) else NEIGHBOUR_TOLERANCE
        flat = row.geometry.simplify(tol, preserve_topology=True)
        globe = row.geometry.simplify(GLOBE_TOLERANCE, preserve_topology=True)
        countries[row.ADM0_A3] = {
            "name": row.ADMIN,
            "d": svg_path(flat) if row.ADM0_A3 in near else "",
            "bbox": [round(v, 2) for v in (
                row.geometry.bounds[0] + 180, 90 - row.geometry.bounds[3],
                row.geometry.bounds[2] + 180, 90 - row.geometry.bounds[1])],
            "globe": globe_rings(globe),
        }

    out = {
        "_meta": {
            "note": "Built by scripts/build_landscape_geo.py. area_ha from the canonical "
                    "boundaries (MOSAIC_catalog/boundaries) in EPSG:6933. Country outlines: "
                    "Natural Earth 1:50m admin-0 (public domain), simplified. Flat paths use "
                    "x = lon + 180, y = 90 - lat; globe rings are [lon, lat].",
            "map_tolerance_deg": MAP_TOLERANCE,
            "neighbour_tolerance_deg": NEIGHBOUR_TOLERANCE,
            "globe_tolerance_deg": GLOBE_TOLERANCE,
        },
        "landscapes": landscapes,
        "countries": countries,
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e3:.0f} KB)")
    for code, v in landscapes.items():
        print(code, f"{v['area_ha']:,} ha", v["countries"])


if __name__ == "__main__":
    main()
