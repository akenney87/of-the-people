import requests
from bs4 import BeautifulSoup
import json
import re

BASE_URL = "https://nyassembly.gov"
MEMBERS_URL = f"{BASE_URL}/mem/"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def scrape_assembly_members():
    response = requests.get(MEMBERS_URL, headers=HEADERS)

    if response.status_code != 200:
        print("❌ Failed to fetch page, status code:", response.status_code)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    members = []

    # Find all member sections
    member_sections = soup.select("section.mem-item")
    print(f"\n🔍 Found {len(member_sections)} members on the page.\n")

    for member in member_sections:
        # Extract name
        name_tag = member.select_one("h3.mem-name a")
        name = re.sub(r"\s*District\s*\d+", "", name_tag.text.strip()) if name_tag else "Unknown"

        # Extract district from section ID
        district = member["id"] if "id" in member.attrs else "Unknown"

        # Extract email
        email_tag = member.select_one("div.mem-email a")
        email = email_tag.text.strip() if email_tag else "Not available"

        # Extract profile URL
        profile_url = BASE_URL + name_tag["href"] if name_tag else "Not available"

        print(f"✅ {name} - District {district} - Email: {email}")

        members.append({
            "name": name,
            "district": district,
            "email": email,
            "profile_url": profile_url
        })

    return members

if __name__ == "__main__":
    members = scrape_assembly_members()
    with open("ny_assembly_members.json", "w", encoding="utf-8") as f:
        json.dump(members, f, indent=4, ensure_ascii=False)

    print(f"\n✅ Scraped {len(members)} NY Assembly members and saved to ny_assembly_members.json")
