import geopandas as gpd
from shapely.geometry import Point
import sys
import json

# Load shapefiles
cong_districts = gpd.read_file("districts/NY_Cong/tl_2024_36_cd119.shp")
senate_districts = gpd.read_file("districts/NY_Leg_upp/tl_2024_36_sldu.shp")
assembly_districts = gpd.read_file("districts/NY_Leg_Low/tl_2024_36_sldl.shp")
counties = gpd.read_file("districts/counties/tl_2024_us_county.shp")

def get_districts(lat, lon):
    point = Point(lon, lat)  # Longitude first!

    # Find congressional district
    cong_district = cong_districts[cong_districts.contains(point)]
    senate_district = senate_districts[senate_districts.contains(point)]
    assembly_district = assembly_districts[assembly_districts.contains(point)]
    
    # Find county
    county_match = counties[counties.contains(point)]
    county_name = None
    if not county_match.empty:
        # The county name is typically in the NAME column
        county_name = county_match["NAME"].values[0] if "NAME" in county_match.columns else None

    return {
        "congressional": cong_district["CD119FP"].values[0] if not cong_district.empty else None,
        "state_senate": senate_district["SLDUST"].values[0] if not senate_district.empty else None,
        "state_assembly": assembly_district["SLDLST"].values[0] if not assembly_district.empty else None,
        "county": county_name
    }

if __name__ == "__main__":
    lat = float(sys.argv[1])
    lon = float(sys.argv[2])
    result = get_districts(lat, lon)
    print(json.dumps(result))  # Output as pure JSON
