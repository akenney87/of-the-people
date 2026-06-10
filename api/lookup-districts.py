"""Vercel Python serverless function: address -> resolved districts.

POST /api/lookup-districts
Body: { street_address, city, state, zip_code }
200:  { county, cong_district, state_senate_dist, state_house_dist }
4xx:  { error }

The street_address is held in this handler's memory only — we geocode it via
Nominatim, point-in-polygon it against the TIGER shapefiles, and return the
resolved district IDs. The caller (Register / Profile) then writes those onto
the public.users row in Supabase. The street is never written to the DB.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

import requests

# districts/find_district.py is imported as a module rather than spawned as a
# subprocess. Vercel's includeFiles config in vercel.json pulls the shapefiles
# alongside this file so the path resolution in find_district.py just works.
_DISTRICTS = os.path.join(os.path.dirname(__file__), "..", "districts")
sys.path.insert(0, _DISTRICTS)
from find_district import get_districts  # noqa: E402


def _normalize(d):
    """Match the column shape the supabase users table expects."""
    cong = d.get("congressional")
    senate = d.get("state_senate")
    return {
        "county": d.get("county"),
        "cong_district":          cong.zfill(2) if cong else None,
        "state_senate_dist":      senate.lstrip("0") if senate else None,
        "state_house_dist":       d.get("state_assembly") or None,
        # Sub-county layers — these may be None until shapefile data lands.
        "county_commission_dist": d.get("county_commission") or None,
        "city_council_dist":      d.get("city_council") or None,
        "school_board_dist":      d.get("school_board") or None,
    }


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "Invalid JSON body."})

        street = body.get("street_address")
        city = body.get("city")
        state = body.get("state")
        zip_code = body.get("zip_code")

        if not all([street, city, state, zip_code]):
            return self._json(400, {"error": "street_address, city, state, zip_code are required."})

        # Geocode. Polite User-Agent per Nominatim's TOS.
        try:
            geo = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": f"{street}, {city}, {state}, {zip_code}", "format": "json"},
                headers={"User-Agent": "OtP civic-tech bot (https://github.com/akenney87/of-the-people)"},
                timeout=20,
            )
            geo.raise_for_status()
            geo_rows = geo.json()
        except requests.RequestException as e:
            return self._json(502, {"error": f"Geocoding failed: {e}"})

        if not geo_rows:
            return self._json(404, {"error": "Address not found."})

        try:
            lat = float(geo_rows[0]["lat"])
            lon = float(geo_rows[0]["lon"])
        except (KeyError, ValueError):
            return self._json(502, {"error": "Geocoder returned malformed coordinates."})

        # Lookup
        try:
            districts = get_districts(lat, lon, state)
        except Exception as e:
            return self._json(500, {"error": f"District lookup failed: {e}"})

        if isinstance(districts, dict) and districts.get("error"):
            return self._json(400, {"error": districts["error"]})

        return self._json(200, _normalize(districts))

    def do_GET(self):
        # Helpful when manually probing the function. Returns 405 so curl
        # tooling treats it as a real method-not-allowed.
        self._json(405, {"error": "POST only."})
