import geopandas as gpd

# Paths to shapefiles
CONG_DISTRICTS = "districts/NY_Cong/tl_2024_36_cd119.shp"
STATE_LOWER = "districts/NY_Leg_Low/tl_2024_36_sldl.shp"
STATE_UPPER = "districts/NY_Leg_upp/tl_2024_36_sldu.shp"

def inspect_shapefile(shapefile_path):
    try:
        gdf = gpd.read_file(shapefile_path)
        print(f"✅ Successfully loaded {shapefile_path}")
        print("📌 Available Columns:", gdf.columns)
    except Exception as e:
        print(f"❌ Error loading {shapefile_path}: {e}")

if __name__ == "__main__":
    print("🔍 Inspecting Congressional Districts Shapefile...")
    inspect_shapefile(CONG_DISTRICTS)

    print("\n🔍 Inspecting State Senate Districts Shapefile...")
    inspect_shapefile(STATE_UPPER)

    print("\n🔍 Inspecting State Assembly Districts Shapefile...")
    inspect_shapefile(STATE_LOWER)
