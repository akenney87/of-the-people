import requests
from bs4 import BeautifulSoup
import json

HOUSE_URL = "https://www.house.gov/representatives"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def scrape_house_reps():
    response = requests.get(HOUSE_URL, headers=HEADERS)

    if response.status_code != 200:
        print("❌ Failed to fetch House representatives page.")
        return []

    soup = BeautifulSoup(response.text, "html.parser")

    # Find all tables on the page
    tables = soup.find_all("table", class_="table")

    house_reps = []

    # Loop through each table and check if it contains "New York"
    for table in tables:
        rows = table.select("tbody tr")

        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 5:
                continue  # Skip invalid rows

            district = clean_text(cols[0].text.strip()).replace('st', '').replace('nd', '').replace('rd', '').replace('th', '')[:10]  # District is now assigned correctly
            name = cols[1].text.strip()  # Name is now assigned correctly
            party = cols[2].text.strip()  # Party is the third column
            phone = cols[4].text.strip()  # Phone is the fifth column (corrected)
            website = "https://www.house.gov"  # Default generic website

            # Ensure we only collect New York representatives
            if "New York" in name:
                house_reps.append({
                    "name": district.replace("New York", "").strip(),  # Correct placement
                    "district": name[:10],  # Correct placement, max 10 chars

                    "state": "NY",
                    "party": party,
                    "phone": phone,
                    "website": website
                })

    return house_reps

if __name__ == "__main__":
    reps = scrape_house_reps()
    with open("districts/house_representatives.json", "w", encoding="utf-8") as f:
        json.dump(reps, f, indent=4, ensure_ascii=False)

    print(f"✅ Scraped {len(reps)} NY House Representatives and saved to districts/house_representatives.json")
