"""Point-in-polygon district lookup for a given (lat, lon) and state code.

Called from api/lookup-districts.py (Vercel Python function) and from the
districts/ CLI:
    python districts/find_district.py <lat> <lon> [state_code]

Returns JSON on stdout:
    {
        "state": "GA",
        "congressional": "09",
        "state_senate":  "49",
        "state_assembly": "029",      # GA state house; key kept for legacy compat
        "county": "Hall",
        "county_commission": "D3",    # optional, set when the local layer exists
        "city_council": null          # TBD, schema-ready
    }

Adding another state means dropping its TIGER shapefiles into a sibling
directory and registering it in SHAPEFILES below. Local sub-county layers
(commission, city council) plug in via LOCAL_LAYERS.
"""

import os
import sys
import json

import geopandas as gpd
from shapely.geometry import Point


DISTRICTS_DIR = os.path.dirname(os.path.abspath(__file__))

# state code -> TIGER shapefile bundle paths. FIPS: NY=36, GA=13.
SHAPEFILES = {
    "NY": {
        "cong":  "NY_Cong/tl_2024_36_cd119.shp",
        "upper": "NY_Leg_upp/tl_2024_36_sldu.shp",
        "lower": "NY_Leg_low/tl_2024_36_sldl.shp",
    },
    "GA": {
        "cong":  "GA_Cong/tl_2024_13_cd119.shp",
        "upper": "GA_Leg_upp/tl_2024_13_sldu.shp",
        "lower": "GA_Leg_low/tl_2024_13_sldl.shp",
    },
}

PER_STATE_COUNTIES = {
    "GA": "GA_Counties/tl_2024_13_county.shp",
}
COUNTIES_FALLBACK_PATH = "counties/tl_2024_us_county.shp"

# Sub-county layers, registered per (state, county). Each entry resolves a
# single field on the returned dict from a single layer file. Missing layers
# silently return None for that field so signups don't blow up before we have
# data for a given county / city.
#
# `field`     — key in the JSON output
# `path`      — file path under districts/, can be .shp or .geojson
# `attribute` — column to read on a positive contains() match
LOCAL_LAYERS = [
    {
        "state":  "GA",
        "county": "Hall",
        "field":  "county_commission",
        "path":   "Hall_Commission/hall_commission_districts.geojson",
        "attribute": "District",   # "D1", "D2", ...
    },
    # Future entries (need shapefile data):
    # {
    #     "state": "GA", "county": "Hall", "city": "Gainesville",
    #     "field": "city_council", "path": "Gainesville_Council/wards.shp",
    #     "attribute": "WARD",
    # },
]


def _read(rel_path):
    return gpd.read_file(os.path.join(DISTRICTS_DIR, rel_path))


def _read_counties(state):
    per_state = PER_STATE_COUNTIES.get(state)
    if per_state and os.path.exists(os.path.join(DISTRICTS_DIR, per_state)):
        return _read(per_state)
    return _read(COUNTIES_FALLBACK_PATH)


def _resolve_local_layers(point, state, county):
    """Run any registered sub-county layers for this (state, county)."""
    out = {}
    for layer in LOCAL_LAYERS:
        if layer["state"].upper() != state: continue
        if layer.get("county") and layer["county"] != county: continue
        full = os.path.join(DISTRICTS_DIR, layer["path"])
        if not os.path.exists(full):
            out[layer["field"]] = None
            continue
        try:
            gdf = _read(layer["path"])
            match = gdf[gdf.contains(point)]
            if not match.empty and layer["attribute"] in match.columns:
                out[layer["field"]] = str(match[layer["attribute"]].values[0])
            else:
                out[layer["field"]] = None
        except Exception:
            out[layer["field"]] = None
    return out


def get_districts(lat, lon, state="GA"):
    state = state.upper()
    if state not in SHAPEFILES:
        return {
            "error": f"State '{state}' not supported. Supported: {sorted(SHAPEFILES.keys())}"
        }

    point = Point(lon, lat)  # Shapely is (x, y) = (lon, lat)
    bundle = SHAPEFILES[state]

    cong = _read(bundle["cong"])
    senate = _read(bundle["upper"])
    house = _read(bundle["lower"])
    counties = _read_counties(state)

    cong_match = cong[cong.contains(point)]
    senate_match = senate[senate.contains(point)]
    house_match = house[house.contains(point)]
    county_match = counties[counties.contains(point)]

    county_name = None
    if not county_match.empty and "NAME" in county_match.columns:
        county_name = county_match["NAME"].values[0]

    cong_col = next(
        (c for c in cong_match.columns if c.startswith("CD") and c.endswith("FP")),
        None,
    )

    result = {
        "state": state,
        "congressional": (
            str(cong_match[cong_col].values[0])
            if (cong_col and not cong_match.empty)
            else None
        ),
        "state_senate": (
            str(senate_match["SLDUST"].values[0])
            if (not senate_match.empty and "SLDUST" in senate_match.columns)
            else None
        ),
        "state_assembly": (
            str(house_match["SLDLST"].values[0])
            if (not house_match.empty and "SLDLST" in house_match.columns)
            else None
        ),
        "county": county_name,
    }

    # Sub-county layers (commission district, city council ward, etc.) only
    # run after we know which county we're in.
    result.update(_resolve_local_layers(point, state, county_name))
    return result


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: find_district.py <lat> <lon> [state_code]"}))
        sys.exit(1)

    lat = float(sys.argv[1])
    lon = float(sys.argv[2])
    state = sys.argv[3] if len(sys.argv) >= 4 else "GA"

    print(json.dumps(get_districts(lat, lon, state)))
