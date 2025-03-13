import requests
import xml.etree.ElementTree as ET
import json

SENATE_XML_URL = "https://www.senate.gov/general/contact_information/senators_cfm.xml"

def scrape_senators():
    response = requests.get(SENATE_XML_URL)

    if response.status_code != 200:
        print("❌ Failed to fetch Senate XML data.")
        return []

    # Parse XML content
    root = ET.fromstring(response.content)

    senators = []

    for member in root.findall("member"):
        state = member.find("state").text.strip()
        if state != "NY":  # Only get NY senators
            continue

        senators.append({
            "name": member.find("first_name").text.strip() + " " + member.find("last_name").text.strip(),
            "state": "NY",
            "party": member.find("party").text.strip(),
            "phone": member.find("phone").text.strip(),
            "website": member.find("website").text.strip()
        })

    return senators

if __name__ == "__main__":
    reps = scrape_senators()
    with open("districts/senate_representatives.json", "w", encoding="utf-8") as f:
        json.dump(reps, f, indent=4, ensure_ascii=False)

    print(f"✅ Scraped {len(reps)} NY U.S. Senators and saved to districts/senate_representatives.json")
