"""Refresh the `representatives` table from external sources.

Phase 1 of the plan switched the locale from New York to Gainesville / Hall
County, Georgia. This script is the single CLI entry point for refreshing
all representative data — federal (House + Senate), state (Governor + AG +
state legislators via OpenStates), county (Hall), and city (Gainesville).

Run from the OtP/ project root:

    python districts/update_representatives.py

A future move to Supabase + scheduled Edge Functions (plan Phase 4) will
replace this CLI with a weekly cron. Until then, run it manually whenever
official rosters change.
"""

import json
import logging
import os
import re
import time
import unicodedata
import xml.etree.ElementTree as ET

import psycopg2
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv


# --- Setup -----------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("bs4").setLevel(logging.WARNING)

load_dotenv()

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}

# Locale knobs. To run this script for a different state later, change these
# four constants and add scraped JSON files at the listed paths.
STATE_CODE = "GA"
STATE_FULL_NAME = "Georgia"
OPENSTATES_JURISDICTION = "Georgia"   # OpenStates accepts the full name
COUNTY_FILE = "districts/hall_county_officials.json"
CITY_FILE = "districts/gainesville_city_officials.json"

OPENSTATES_API_KEY = os.getenv("OPENSTATES_API_KEY")

# Output paths for cached scraper results (useful for debugging without re-scraping).
HOUSE_FILE = "districts/house_representatives.json"
SENATE_FILE = "districts/senate_representatives.json"
STATE_OFFICIALS_FILE = "districts/ga_state_officials.json"
ATTORNEYS_GENERAL_FILE = "districts/attorneys_general.json"

# Wipe old cache files at start so we never accidentally re-load stale rosters.
for path in [HOUSE_FILE, SENATE_FILE, STATE_OFFICIALS_FILE, ATTORNEYS_GENERAL_FILE]:
    if os.path.exists(path):
        os.remove(path)


def clean_text(value):
    """ASCII-normalize a string; return None for non-strings or on failure."""
    if not isinstance(value, str):
        return None
    try:
        return (
            unicodedata.normalize("NFKD", value)
            .encode("ascii", "ignore")
            .decode("utf-8")
            .strip()
        )
    except Exception:
        return None


# --- Federal scrapers ------------------------------------------------------

def scrape_house_reps():
    """Federal House representatives for STATE_FULL_NAME from house.gov."""
    url = "https://www.house.gov/representatives"
    headers = {"User-Agent": "Mozilla/5.0 (OtP civic-tech bot)"}
    response = requests.get(url, headers=headers, timeout=30)
    if response.status_code != 200:
        logging.error("Failed to fetch House page: %s", response.status_code)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    tables = soup.find_all("table", class_="table")
    reps = []

    for table in tables:
        caption = table.find("caption")
        if caption and STATE_FULL_NAME not in caption.text:
            continue  # Skip non-target-state tables

        for row in table.select("tbody tr"):
            cols = row.find_all("td")
            if len(cols) < 5:
                continue

            district = clean_text(cols[0].text.strip())[:10]
            name = clean_text(cols[1].text.strip())
            party = clean_text(cols[2].text.strip())
            phone = clean_text(cols[4].text.strip())
            link = cols[1].find("a", href=True)
            website = clean_text(link["href"]) if link else "https://www.house.gov"

            reps.append({
                "name": name,
                "position": "U.S. Representative",
                "state": STATE_CODE,
                "cong_district": district,
                "party": party,
                "phone": phone,
                "website": website,
            })

    with open(HOUSE_FILE, "w", encoding="utf-8") as f:
        json.dump(reps, f, indent=4, ensure_ascii=False)
    logging.info("Scraped %d %s House Representatives", len(reps), STATE_CODE)
    return reps


def scrape_senate():
    """Federal U.S. Senators for STATE_CODE from senate.gov's XML feed."""
    url = "https://www.senate.gov/general/contact_information/senators_cfm.xml"
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        logging.error("Failed to fetch Senate XML: %s", response.status_code)
        return []

    root = ET.fromstring(response.content)
    senators = []

    for member in root.findall("member"):
        if clean_text(member.find("state").text) != STATE_CODE:
            continue

        name = clean_text(
            f"{member.find('first_name').text} {member.find('last_name').text}"
        )
        senators.append({
            "name": name,
            "position": "U.S. Senator",
            "state": STATE_CODE,
            "party": clean_text(member.find("party").text),
            "phone": clean_text(member.find("phone").text),
            "website": clean_text(member.find("website").text),
        })

    with open(SENATE_FILE, "w", encoding="utf-8") as f:
        json.dump(senators, f, indent=4, ensure_ascii=False)
    logging.info("Scraped %d %s U.S. Senators", len(senators), STATE_CODE)
    return senators


# --- State scrapers --------------------------------------------------------

def fetch_openstates_reps():
    """State-level officials (Governor + legislators) via OpenStates v3."""
    if not OPENSTATES_API_KEY:
        logging.warning("OPENSTATES_API_KEY not set; skipping OpenStates fetch.")
        return []

    headers = {"x-api-key": OPENSTATES_API_KEY}
    base_url = (
        "https://v3.openstates.org/people"
        f"?jurisdiction={requests.utils.quote(OPENSTATES_JURISDICTION)}"
    )
    all_reps = []
    page = 1

    while True:
        response = requests.get(
            f"{base_url}&per_page=50&page={page}",
            headers=headers,
            timeout=30,
        )
        if response.status_code != 200:
            logging.error("OpenStates error: %s - %s", response.status_code, response.text)
            break

        data = response.json()
        reps = data.get("results", [])
        if not reps:
            break

        for rep in reps:
            role = rep.get("current_role") or {}
            district = clean_text(role.get("district"))
            org_class = role.get("org_classification") or ""
            title = clean_text(role.get("title", "State Official"))

            # Normalize position naming across states. GA has State Senate (upper)
            # + State House (lower); NY had State Senate + State Assembly. We
            # standardize "lower" -> "State Representative" so the same code
            # works for both.
            if title == "Senator" or org_class == "upper":
                position = "State Senator"
            elif title == "Assembly Member" or org_class == "lower":
                position = "State Representative"
            elif "Governor" in (title or ""):
                position = "Governor"
            else:
                position = title  # fallback to whatever OpenStates emitted

            offices = rep.get("offices") or []
            phone = clean_text(offices[0].get("voice")) if offices else None

            all_reps.append({
                "name": clean_text(rep.get("name")),
                "position": position,
                "state": STATE_CODE,
                "party": clean_text(rep.get("party")),
                "phone": phone,
                "email": clean_text(rep.get("email")),
                "website": clean_text(rep.get("openstates_url")),
                "state_senate_district": district if position == "State Senator" else None,
                "state_assembly_district": district if position == "State Representative" else None,
            })

        if page >= data.get("pagination", {}).get("max_page", 1):
            break
        page += 1
        time.sleep(0.5)  # be polite

    with open(STATE_OFFICIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_reps, f, indent=4, ensure_ascii=False)
    logging.info("Fetched %d %s state officials from OpenStates", len(all_reps), STATE_CODE)
    return all_reps


def scrape_attorneys_general():
    """All 50 state Attorneys General from NAAG. We filter to STATE_CODE."""
    url = "https://www.naag.org/find-my-ag/"
    headers = {"User-Agent": "Mozilla/5.0 (OtP civic-tech bot)"}

    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            logging.error("Failed to fetch NAAG page: %s", response.status_code)
            return []

        soup = BeautifulSoup(response.text, "html.parser")

        state_mapping = {
            "Alabama": "AL", "Alaska": "AK", "American Samoa": "AS", "Arizona": "AZ",
            "Arkansas": "AR", "California": "CA", "Colorado": "CO", "Connecticut": "CT",
            "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL",
            "Georgia": "GA", "Guam": "GU", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
            "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
            "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
            "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
            "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
            "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
            "North Dakota": "ND", "Northern Mariana Islands": "MP", "Ohio": "OH",
            "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Puerto Rico": "PR",
            "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
            "Tennessee": "TN", "Texas": "TX", "U.S. Virgin Islands": "VI", "Utah": "UT",
            "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
            "Wisconsin": "WI", "Wyoming": "WY",
        }

        ags = []
        for section in soup.find_all("h2"):
            name = clean_text(section.text)
            if not name or len(name) < 3:
                continue
            state_elem = section.find_next("div")
            if not state_elem:
                continue
            state_name = clean_text(state_elem.text)
            if state_name not in state_mapping:
                continue
            abbr = state_mapping[state_name]
            if abbr != STATE_CODE:
                continue
            ags.append({
                "name": name,
                "position": "Attorney General",
                "state": abbr,
                "party": "",
                "website": f"https://www.naag.org/find-my-ag/{state_name.lower().replace(' ', '-')}/",
            })

        with open(ATTORNEYS_GENERAL_FILE, "w", encoding="utf-8") as f:
            json.dump(ags, f, indent=4, ensure_ascii=False)
        logging.info("Found %d %s Attorney(s) General on NAAG", len(ags), STATE_CODE)
        return ags
    except Exception as e:
        logging.error("Error scraping NAAG: %s", e)
        return []


# --- Local (county + city) loaders -----------------------------------------

def load_hall_county_officials():
    """Read the hand-curated Hall County roster. Skips _README keys."""
    try:
        with open(COUNTY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logging.error("Could not load %s: %s", COUNTY_FILE, e)
        return []

    officials = []
    for county, county_data in data.items():
        if county.startswith("_"):
            continue
        for official in county_data.get("county_wide", []):
            if official.get("name", "").upper() == "TBD":
                continue  # Skip unfilled placeholder rows
            officials.append({
                "name": official["name"],
                "position": official["position"],
                "state": STATE_CODE,
                "county": county,
                "party": official.get("party", ""),
                "website": "",
            })
    logging.info("Loaded %d Hall County officials", len(officials))
    return officials


def load_gainesville_city_officials():
    """Read the hand-curated City of Gainesville roster."""
    try:
        with open(CITY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logging.error("Could not load %s: %s", CITY_FILE, e)
        return []

    officials = []
    for city, city_data in data.items():
        if city.startswith("_"):
            continue
        for bucket in ("city_wide", "council"):
            for official in city_data.get(bucket, []):
                if official.get("name", "").upper() == "TBD":
                    continue
                officials.append({
                    "name": official["name"],
                    "position": official["position"],
                    "state": STATE_CODE,
                    "county": "Hall",   # Gainesville sits inside Hall County
                    "city": city,
                    "party": official.get("party", ""),
                    "website": "",
                })
    logging.info("Loaded %d Gainesville city officials", len(officials))
    return officials


# --- Database updater ------------------------------------------------------

def update_representatives():
    """Upsert all scraped + curated reps into the representatives table."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("SELECT name, position FROM representatives")
    existing = {(row[0], row[1]) for row in cursor.fetchall()}

    all_data = [
        *scrape_house_reps(),
        *scrape_senate(),
        *fetch_openstates_reps(),
        *scrape_attorneys_general(),
        *load_hall_county_officials(),
        *load_gainesville_city_officials(),
    ]

    for rep in all_data:
        cursor.execute(
            """
            INSERT INTO representatives (
                name, position, state, party, phone, email, website,
                cong_district, state_senate_district, state_assembly_district,
                county, city
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name, position) DO UPDATE SET
                party = EXCLUDED.party,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                website = EXCLUDED.website,
                cong_district = EXCLUDED.cong_district,
                state_senate_district = EXCLUDED.state_senate_district,
                state_assembly_district = EXCLUDED.state_assembly_district,
                county = EXCLUDED.county,
                city = EXCLUDED.city
            """,
            (
                rep.get("name"),
                rep.get("position"),
                rep.get("state"),
                rep.get("party"),
                rep.get("phone"),
                rep.get("email"),
                rep.get("website"),
                rep.get("cong_district"),
                rep.get("state_senate_district"),
                rep.get("state_assembly_district"),
                rep.get("county"),
                rep.get("city"),
            ),
        )
        existing.discard((rep["name"], rep["position"]))

    # Soft-retire reps no longer in the fresh data: blank their contact fields
    # so the UI shows "no contact info" instead of a stale phone/email.
    for name, position in existing:
        cursor.execute(
            """
            UPDATE representatives
               SET phone = NULL, email = NULL, website = NULL
             WHERE name = %s AND position = %s
            """,
            (name, position),
        )

    conn.commit()
    cursor.close()
    conn.close()
    logging.info("Representative database update complete.")


if __name__ == "__main__":
    update_representatives()
