import json
import os
import psycopg2
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
import unicodedata
import logging
import re
import time

# Setup logging with reduced verbosity
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

# Set higher log level for noisy libraries
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("bs4").setLevel(logging.WARNING)

# Load environment variables
load_dotenv()

# Database connection settings
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT")
}

# OpenStates API Configuration
OPENSTATES_API_KEY = os.getenv("OPENSTATES_API_KEY")
OPENSTATES_URL = "https://v3.openstates.org/people?jurisdiction=New%20York"

# File paths
HOUSE_FILE = "districts/house_representatives.json"
SENATE_FILE = "districts/senate_representatives.json"
STATE_OFFICIALS_FILE = "districts/ny_state_officials.json"
ATTORNEYS_GENERAL_FILE = "districts/attorneys_general.json"
COMPTROLLERS_FILE = "districts/comptrollers.json"

# Clean up old files
for file in [HOUSE_FILE, SENATE_FILE, STATE_OFFICIALS_FILE, ATTORNEYS_GENERAL_FILE, COMPTROLLERS_FILE]:
    if os.path.exists(file):
        os.remove(file)

def clean_text(value):
    """Normalize text to remove invalid characters."""
    if not isinstance(value, str):
        return None
    try:
        return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("utf-8").strip()
    except Exception:
        return None

### Scrapers ###

def scrape_house_reps():
    URL = "https://www.house.gov/representatives"
    HEADERS = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(URL, headers=HEADERS)
    if response.status_code != 200:
        logging.error("Failed to fetch House page: %s", response.status_code)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    tables = soup.find_all("table", class_="table")
    house_reps = []

    for table in tables:
        caption = table.find("caption")
        if caption and "New York" not in caption.text:
            continue  # Skip non-NY tables

        rows = table.select("tbody tr")
        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 5:
                continue

            district = clean_text(cols[0].text.strip())[:10]
            name = clean_text(cols[1].text.strip())
            party = clean_text(cols[2].text.strip())
            phone = clean_text(cols[4].text.strip())
            website = cols[1].find("a", href=True)
            website = clean_text(website["href"]) if website else "https://www.house.gov"

            house_reps.append({
                "name": name,
                "position": "U.S. Representative",
                "state": "NY",
                "cong_district": district,
                "party": party,
                "phone": phone,
                "website": website
            })

    with open(HOUSE_FILE, "w", encoding="utf-8") as f:
        json.dump(house_reps, f, indent=4, ensure_ascii=False)
    logging.info("Scraped %d NY House Representatives", len(house_reps))
    return house_reps

def scrape_senate():
    URL = "https://www.senate.gov/general/contact_information/senators_cfm.xml"
    response = requests.get(URL)
    if response.status_code != 200:
        logging.error("Failed to fetch Senate XML: %s", response.status_code)
        return []

    root = ET.fromstring(response.content)
    senators = []

    for member in root.findall("member"):
        state = clean_text(member.find("state").text)
        if state != "NY":
            continue

        name = clean_text(f"{member.find('first_name').text} {member.find('last_name').text}")
        party = clean_text(member.find("party").text)
        phone = clean_text(member.find("phone").text)
        website = clean_text(member.find("website").text)

        senators.append({
            "name": name,
            "position": "U.S. Senator",
            "state": "NY",
            "party": party,
            "phone": phone,
            "website": website
        })

    with open(SENATE_FILE, "w", encoding="utf-8") as f:
        json.dump(senators, f, indent=4, ensure_ascii=False)
    logging.info("Scraped %d NY U.S. Senators", len(senators))
    return senators

def fetch_openstates_reps():
    headers = {"x-api-key": OPENSTATES_API_KEY}
    base_url = "https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction/country:us/state:ny/government"
    all_reps = []
    page = 1

    while True:
        response = requests.get(
            f"{base_url}&per_page=50&page={page}",
            headers=headers
        )
        if response.status_code != 200:
            logging.error("Failed to fetch OpenStates data: %s - %s", response.status_code, response.text)
            return []

        data = response.json()
        reps = data.get("results", [])
        if not reps:
            break

        for rep in reps:
            # Use current_role for position and district
            role = rep.get("current_role", {})
            district = clean_text(role.get("district"))  # Get district first
            org_class = role.get("org_classification", "")
            title = clean_text(role.get("title", "State Official"))

            # Standardize position
            if title == "Senator" or org_class == "upper":
                position = "State Senator"
            elif title == "Assembly Member" or org_class == "lower":
                position = "Assembly Member"
            elif "Governor" in title:
                position = "Governor"
            elif "Chief" in title or "Elections" in role.get("title", ""):
                position = "Chief of Elections"
            else:
                position = title  # Fallback to API title

            # Contact details
            phone = None
            email = clean_text(rep.get("email"))
            website = clean_text(rep.get("openstates_url"))
            if rep.get("offices"):
                office = rep["offices"][0]
                phone = clean_text(office.get("voice"))

            rep_data = {
                "name": clean_text(rep.get("name")),
                "position": position,
                "state": "NY",
                "party": clean_text(rep.get("party")),
                "phone": phone,
                "email": email,
                "website": website,
                "state_senate_district": district if position == "State Senator" else None,
                "state_assembly_district": district if position == "Assembly Member" else None
            }
            all_reps.append(rep_data)

        page += 1
        if page > data["pagination"]["max_page"]:
            break

    with open(STATE_OFFICIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_reps, f, indent=4, ensure_ascii=False)
    logging.info("Fetched %d NY officials from OpenStates", len(all_reps))
    return all_reps

def scrape_attorneys_general():
    """Scrape all Attorneys General from NAAG website."""
    URL = "https://www.naag.org/find-my-ag/"
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
    
    logging.info("Scraping Attorneys General from NAAG...")
    
    try:
        response = requests.get(URL, headers=HEADERS)
        if response.status_code != 200:
            logging.error(f"Failed to fetch NAAG page: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, "html.parser")
        attorneys_general = []
        
        # State abbreviation mapping
        state_mapping = {
            "Alabama": "AL", "Alaska": "AK", "American Samoa": "AS", "Arizona": "AZ", "Arkansas": "AR",
            "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
            "Florida": "FL", "Georgia": "GA", "Guam": "GU", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
            "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
            "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
            "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH",
            "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
            "Northern Mariana Islands": "MP", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
            "Puerto Rico": "PR", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
            "Tennessee": "TN", "Texas": "TX", "U.S. Virgin Islands": "VI", "Utah": "UT", "Vermont": "VT",
            "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
        }
        
        # Find all AG entries - they're in h2 elements with state info below
        ag_sections = soup.find_all("h2")
        
        for section in ag_sections:
            name = clean_text(section.text)
            if not name or len(name) < 3:  # Skip empty or very short names
                continue
                
            # Find state - it's usually in a nearby element
            state_elem = section.find_next("div")
            if not state_elem:
                continue
                
            state_name = clean_text(state_elem.text)
            if not state_name or state_name not in state_mapping:
                continue
                
            state_abbr = state_mapping[state_name]
            
            attorneys_general.append({
                "name": name,
                "position": "Attorney General",
                "state": state_abbr,
                "party": "",  # Party info not available on this page
                "website": f"https://www.naag.org/find-my-ag/{state_name.lower().replace(' ', '-')}/"
            })
        
        logging.info(f"Found {len(attorneys_general)} Attorneys General")
        
        # Save to JSON file
        with open(ATTORNEYS_GENERAL_FILE, "w", encoding="utf-8") as f:
            json.dump(attorneys_general, f, indent=4, ensure_ascii=False)
            
        return attorneys_general
        
    except Exception as e:
        logging.error(f"Error scraping Attorneys General: {str(e)}")
        return []

def scrape_comptrollers():
    """Scrape all Comptrollers/Controllers from Ballotpedia."""
    URL = "https://ballotpedia.org/List_of_current_controllers_in_the_United_States"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    logging.info("Scraping Comptrollers from Ballotpedia...")
    
    try:
        # Make request with extended timeout and retries
        session = requests.Session()
        retries = 3
        comptrollers = []
        
        for attempt in range(retries):
            try:
                response = session.get(URL, headers=HEADERS, timeout=30)
                response.raise_for_status()
                break
            except (requests.RequestException, requests.Timeout) as e:
                if attempt < retries - 1:
                    logging.warning(f"Request failed, retrying ({attempt+1}/{retries})")
                    time.sleep(2)  # Wait before retrying
                else:
                    logging.error(f"Failed to fetch Ballotpedia page after {retries} attempts")
                    return []
        
        # Parse HTML
        html_content = response.text
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Find tables with comptroller data
        all_tables = soup.find_all('table')
        logging.debug(f"Found {len(all_tables)} tables on the page")
        
        for table in all_tables:
            # Check if this table has headers or caption related to comptrollers
            table_text = table.get_text().lower()
            if 'comptroller' in table_text or 'controller' in table_text:
                # Process rows
                rows = table.find_all('tr')
                for row in rows[1:]:  # Skip header row
                    cells = row.find_all('td')
                    if len(cells) < 3:
                        continue
                    
                    office_text = clean_text(cells[0].text)
                    name = clean_text(cells[1].text)
                    party = clean_text(cells[2].text) if len(cells) > 2 else ""
                    
                    if not office_text or not name:
                        continue
                    
                    # Skip rows that don't look like comptroller entries
                    if "offices" in office_text.lower():
                        continue
                    
                    # Extract state from office text
                    state_name = None
                    
                    # Try different patterns to extract state name
                    patterns = [
                        r"^([A-Za-z\s]+)\s+(?:Comptroller|Controller)",
                        r"^([A-Za-z\s]+)\s+State\s+(?:Comptroller|Controller)",
                        r"^([A-Za-z\s]+)"
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, office_text)
                        if match:
                            state_name = match.group(1).strip()
                            break
                    
                    if not state_name:
                        continue
                    
                    # Map state name to abbreviation
                    state_mapping = {
                        "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
                        "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
                        "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
                        "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
                        "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
                        "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
                        "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
                        "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
                        "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
                        "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
                    }
                    
                    state_abbr = state_mapping.get(state_name)
                    if not state_abbr:
                        # Try partial matching
                        for full_name, abbr in state_mapping.items():
                            if full_name.lower() in state_name.lower() or state_name.lower() in full_name.lower():
                                state_abbr = abbr
                                break
                    
                    if not state_abbr:
                        continue
                    
                    comptrollers.append({
                        "name": name,
                        "position": "Comptroller",
                        "state": state_abbr,
                        "party": party,
                        "website": ""
                    })
        
        # Save results
        if comptrollers:
            logging.info(f"Found {len(comptrollers)} Comptrollers")
            
            # Save to JSON file
            with open(COMPTROLLERS_FILE, "w", encoding="utf-8") as f:
                json.dump(comptrollers, f, indent=4, ensure_ascii=False)
            
            return comptrollers
        else:
            logging.error("Could not find any comptrollers on the page")
            return []
            
    except Exception as e:
        logging.error(f"Error scraping Comptrollers: {str(e)}")
        return []

def scrape_ny_county_officials():
    """Load verified NY county officials from JSON file."""
    logging.info("Loading NY county officials from verified data...")
    
    try:
        with open("districts/ny_county_officials.json", "r") as f:
            county_data = json.load(f)
        
        county_officials = []
        
        for county, data in county_data.items():
            # Add county-wide officials
            for official in data["county_wide"]:
                county_officials.append({
                    "name": official["name"],
                    "position": official["position"],
                    "state": "NY",
                    "county": county,
                    "party": official.get("party", ""),
                    "website": ""  # Can be updated with verified URLs later
                })
            
            # Add legislature members if present
            if "legislature" in data:
                for member in data["legislature"]:
                    position = f"County Legislature District {member['district']}"
                    county_officials.append({
                        "name": member["name"],
                        "position": position,
                        "state": "NY",
                        "county": county,
                        "party": member.get("party", ""),
                        "website": ""
                    })
        
        logging.info(f"Loaded {len(county_officials)} NY county officials from verified data")
        return county_officials
        
    except Exception as e:
        logging.error(f"Error loading county officials: {e}")
        return []

### Database Updater ###

def update_representatives():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # Fetch existing names/positions to detect resignations
    cursor.execute("SELECT name, position FROM representatives")
    existing_reps = {(row[0], row[1]) for row in cursor.fetchall()}

    # Collect all new data
    all_data = [
        *scrape_house_reps(),
        *scrape_senate(),
        *fetch_openstates_reps(),
        *scrape_attorneys_general(),
        *scrape_comptrollers(),
        *scrape_ny_county_officials()
    ]

    # Upsert new/updated reps
    for rep in all_data:
        cursor.execute("""
            INSERT INTO representatives (
                name, position, state, party, phone, email, website,
                cong_district, state_senate_district, state_assembly_district, county
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name, position) DO UPDATE SET
                party = EXCLUDED.party,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                website = EXCLUDED.website,
                cong_district = EXCLUDED.cong_district,
                state_senate_district = EXCLUDED.state_senate_district,
                state_assembly_district = EXCLUDED.state_assembly_district,
                county = EXCLUDED.county
        """, (
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
            rep.get("county")
        ))
        existing_reps.discard((rep["name"], rep["position"]))

    # Clear contact info for resigned reps (not in new data)
    for name, position in existing_reps:
        cursor.execute("""
            UPDATE representatives
            SET phone = NULL, email = NULL, website = NULL
            WHERE name = %s AND position = %s
        """, (name, position))

    conn.commit()
    cursor.close()
    conn.close()
    logging.info("Representative database update complete!")

if __name__ == "__main__":
    update_representatives()