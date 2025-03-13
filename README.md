This PWA is very much still under development

🏛️ OtP (Of the People) - Political Representation Finder
How do your political representatives' values align with your own?
📌 Project Overview
OtP is a web app designed to help users identify their political representatives at the federal, state, and local levels. It aggregates data from multiple sources (OpenStates, Congress.gov, and more) and enables users to:

Register & verify their account via email.
Automatically determine their voting districts based on their address.
View their representatives and their stances on key issues.
Compare their views with their representatives using passion-weighted policy alignment scores.
🚀 Features
✅ Find Your Representatives
🔹 Uses address-based geolocation to fetch Congressional, State Senate, and State Assembly representatives.
🔹 Displays names, positions, party affiliations, contact details, and policy stances.

✅ Automatic District Detection
🔹 Converts the user’s address into latitude/longitude.
🔹 Maps those coordinates to districts using Census shapefiles (via geopandas).

✅ Compare Your Views
🔹 Users answer policy questions during registration.
🔹 Calculates alignment scores with each representative based on passion-weighted votes.

✅ Email Verification & Secure Login
🔹 Nodemailer handles email verification.
🔹 JWT authentication ensures secure logins.

✅ Rich Data Sources
🔹 OpenStates API provides state representatives.
🔹 Congress.gov API fetches federal representatives.
🔹 Geospatial Analysis (GeoPandas + Census Shapefiles) determines district boundaries.

📁 Project Structure
bash
Copy
📦 OtP
│── 📂 client           # Frontend (React + Vite)
│   │── 📂 src
│   │   │── 📂 pages
│   │   │   ├── Representatives.jsx  # Displays representatives
│   │   │   ├── Register.jsx          # User registration form
│   │   │   ├── VerifyEmail.jsx       # Email verification
│   │   │── 📂 components             # Reusable UI components
│   │   │── App.jsx                   # Main React app entry point
│   │   │── main.jsx                   # Renders React app
│── 📂 server           # Backend (Node.js + Express)
│   │── server.js       # Main Express API
│   │── 📂 districts    # District Mapping via Shapefiles
│   │   ├── find_district.py           # Converts lat/lon to districts
│   │   ├── inspect_shapefiles.py      # Checks shapefile integrity
│── 📂 database         # PostgreSQL setup
│   │── schema.sql      # Database schema
│── 📂 docs             # Project documentation
│── .env                # API keys & secrets (ignored in Git)
│── README.md           # Project overview (this file)
│── package.json        # Node.js dependencies
🛠️ Tech Stack
Frontend:
⚛️ React.js (Vite)
🎨 Tailwind CSS (for styling)
📦 Axios (for API requests)
Backend:
🌐 Node.js + Express.js
🔑 JWT Authentication
📬 Nodemailer (for email verification)
🌍 Axios (for API calls)
🗂️ PostgreSQL + pg-pool (for storing users & votes)
Geospatial Processing:
🌎 GeoPandas + Shapely (for shapefile analysis)
🗺️ Census TIGER Shapefiles (for district boundaries)
📍 OpenStreetMap Nominatim API (for geocoding addresses)
APIs Used:
Source	Purpose
OpenStates API	State-level representatives & district data
Congress.gov API	Federal representatives
OpenStreetMap	Address-to-Lat/Long conversion (Nominatim)
Census Shapefiles	Legislative district boundary mapping
🔧 Setup & Installation
1️⃣ Clone the repository
sh
Copy
git clone https://github.com/YOUR_USERNAME/OtP.git
cd OtP
2️⃣ Install dependencies
sh
Copy
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
3️⃣ Set up .env file
Create a .env file in the server/ directory with:

sh
Copy
PORT=5000
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_HOST=your_db_host
DB_PORT=your_db_port
JWT_SECRET=your_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
OPENSTATES_API_KEY=your_openstates_api_key
CONGRESS_API_KEY=your_congress_api_key
4️⃣ Run the Backend
sh
Copy
cd server
node server.js
5️⃣ Run the Frontend
sh
Copy
cd client
npm run dev
App should now be live at http://localhost:5173 🎉

📌 API Endpoints
User Authentication
Method	Endpoint	Description
POST	/api/register	Register a new user
POST	/api/login	Log in
GET	/api/verify/:token	Verify email
District & Representative Data
Method	Endpoint	Description
POST	/api/get-districts	Get districts from user address
GET	/api/representatives	Fetch reps based on district
GET	/api/representatives/:repId	Fetch single rep by ID
📢 Contributing
Contributions are welcome! If you’d like to improve this project:

Fork the repo
Create a feature branch
Commit your changes
Submit a pull request!
🏆 Future Enhancements
✅ Candidate Lookup (Show upcoming elections & candidates)
✅ Better Data Aggregation (Combine multiple sources)
✅ User Voting Preferences (How well do reps align with you?)

📜 License
MIT License - Free to modify & distribute.

💡 Questions? Open an issue or reach out! 🚀
