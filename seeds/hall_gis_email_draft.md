# Draft email — Hall County / Gainesville GIS data request

**To**: Hall County GIS (`gis@hallcounty.org` per their contact page, or call 770-531-6809 and ask for the email of the GIS dept)
**Cc**: City of Gainesville Clerk (if you can find a direct email)
**Subject**: Open data request — Gainesville city council wards + Hall County commission + school board district boundaries

---

> To whom it may concern,
>
> My name is Alexander Kenney and I am the founder of "Of the People," a non-profit civic-tech project in beta within Gainesville and Hall County. The app helps residents see, in plain language, how closely their elected officials represent them — from the U.S. Senate down to City Council.
>
> To match users to the correct local representatives, we need the geographic boundary data for three districts I have not been able to find as a public download:
>
> 1. **City of Gainesville council ward boundaries** (5 wards)
> 2. **Hall County Board of Commissioners district boundaries** (4 districts)
> 3. **Hall County School Board district boundaries** (5 districts, if separate from commission)
>
> Any of the following formats works, in order of preference: **Esri Shapefile (.shp + sidecars), GeoJSON, KML, or an ArcGIS REST endpoint** I can query. We can also work from CSV / Excel of voter precincts if a direct ward shapefile is not maintained.
>
> The project is open-source, non-commercial, and not partisan. The data would be used solely to associate a user's address with their elected representatives in our app. We're happy to credit Hall County GIS as a data source, link to your portal, and acknowledge any usage terms you require.
>
> If a formal Open Records Request is needed I'm glad to submit one through the proper channel — please let me know which form to use.
>
> Thank you for your time,
>
> Alexander Kenney
> Of the People (501(c)(3) status pending)
> [email]
> [phone]

---

## After they reply

If they send **shapefiles**: drop the contents in `districts/gainesville_council/`, `districts/hall_commission/`, `districts/hall_school_board/`. Then add 3 entries to `SHAPEFILES` in `districts/find_district.py` (and the lookup function reads the right column names).

If they send **GeoJSON**: convert to shapefile with one line —
```
ogr2ogr -f "ESRI Shapefile" districts/gainesville_council/wards.shp wards.geojson
```
(`ogr2ogr` ships with GDAL; `pip install gdal` or `brew install gdal`.)

If they send an **ArcGIS REST endpoint**: even simpler — geopandas can read it directly via
```python
gpd.read_file("https://services.arcgis.com/.../FeatureServer/0/query?where=1=1&outFields=*&f=geojson")
```

Once any of these lands, I update `find_district.py`, `api/lookup-districts.py`, and Profile.jsx so existing users can re-resolve their address and pick up the new fields.
