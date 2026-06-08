"""Point-in-polygon district lookup for a given (lat, lon) and state code.

Called from server.js as:
    python districts/find_district.py <lat> <lon> [state_code]

Returns JSON on stdout:
    {
        "state": "GA",
        "congressional": "09",
        "state_senate":  "49",
        "state_assembly": "29",   // GA state house; key kept for compat with server.js
        "county": "Hall"
    }

State code is optional and defaults to "GA" — the current beta locale.
Adding another state means dropping its TIGER shapefiles into a sibling
directory and registering it in SHAPEFILES below.
"""

import os
import sys
import json

import geopandas as gpd
from shapely.geometry import Point


# Resolve paths relative to this script so the call site (server.js root vs.
# the districts/ folder vs. a future Vercel Python function) doesn't matter.
DISTRICTS_DIR = os.path.dirname(os.path.abspath(__file__))

# state code -> shapefile bundle paths. TIGER state FIPS codes: NY=36, GA=13.
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

COUNTIES_PATH = "counties/tl_2024_us_county.shp"


def _read(rel_path):
    return gpd.read_file(os.path.join(DISTRICTS_DIR, rel_path))


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
    counties = _read(COUNTIES_PATH)

    cong_match = cong[cong.contains(point)]
    senate_match = senate[senate.contains(point)]
    house_match = house[house.contains(point)]
    county_match = counties[counties.contains(point)]

    county_name = None
    if not county_match.empty and "NAME" in county_match.columns:
        county_name = county_match["NAME"].values[0]

    # TIGER 2024 column names. CD119FP for the 119th Congress; SLDUST / SLDLST for
    # the upper / lower state legislative districts (both 3-char strings).
    cong_col = next(
        (c for c in cong_match.columns if c.startswith("CD") and c.endswith("FP")),
        None,
    )

    return {
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
        # JSON key stays "state_assembly" so server.js' SQL keeps working;
        # in Georgia this is the State House, in New York the Assembly.
        "state_assembly": (
            str(house_match["SLDLST"].values[0])
            if (not house_match.empty and "SLDLST" in house_match.columns)
            else None
        ),
        "county": county_name,
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: find_district.py <lat> <lon> [state_code]"}))
        sys.exit(1)

    lat = float(sys.argv[1])
    lon = float(sys.argv[2])
    state = sys.argv[3] if len(sys.argv) >= 4 else "GA"

    print(json.dumps(get_districts(lat, lon, state)))
