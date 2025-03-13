import os
import json
import psycopg2
import requests
import logging
import time
import random
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

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

# OpenAI API Configuration (if using OpenAI)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Registration issues from Register.jsx
REGISTRATION_ISSUES = [
  { "id": 1, "text": "Should the federal government set tighter limits on corporate campaign donations?", "target": "National" },
  { "id": 2, "text": "Should the government provide a universal basic income for all citizens?", "target": "National" },
  { "id": 3, "text": "Should there be universal background checks for all firearm purchases nationwide?", "target": "National" },
  { "id": 4, "text": "Should the death penalty be abolished?", "target": "National" },
  { "id": 5, "text": "Should there be a federally mandated paid family leave policy?", "target": "National" },
  { "id": 6, "text": "Should members of Congress have term limits?", "target": "National" },
  { "id": 7, "text": "Should the government prioritize renewable energy over fossil fuels?", "target": "National" },
  { "id": 8, "text": "Should same-sex marriage be protected by federal law?", "target": "National" },
  { "id": 9, "text": "Should there be a national ban on gerrymandering?", "target": "National" },
  { "id": 10, "text": "Should children of undocumented immigrants born and raised in the U.S. have a guaranteed path to citizenship?", "target": "National" },
]

def get_issues_from_db():
    """Fetch all issues from the database and include registration issues."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, name, description FROM issues ORDER BY id")
        
        db_issues = [
            {"id": row[0], "text": row[1] if row[1] else row[2], "target": "National"}
            for row in cursor.fetchall()
        ]
        
        # Check if registration issues are already in the database
        db_issue_ids = set(issue["id"] for issue in db_issues)
        
        # Add registration issues if they're not already in the database
        all_issues = db_issues.copy()
        registration_issues_added = 0
        
        for reg_issue in REGISTRATION_ISSUES:
            if reg_issue["id"] not in db_issue_ids:
                all_issues.append(reg_issue)
                registration_issues_added += 1
        
        logging.info(f"Fetched {len(db_issues)} issues from database and added {registration_issues_added} registration issues.")
        return all_issues
    except Exception as e:
        logging.error(f"Error fetching issues: {e}")
        # If database fetch fails, return at least the registration issues
        logging.info(f"Falling back to registration issues only.")
        return REGISTRATION_ISSUES
    finally:
        cursor.close()
        conn.close()

def ensure_issues_in_db():
    """Ensure registration issues are in the database."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # Get existing issue IDs
        cursor.execute("SELECT id FROM issues")
        existing_ids = {row[0] for row in cursor.fetchall()}
        
        # Insert registration issues that don't exist
        for issue in REGISTRATION_ISSUES:
            if issue["id"] not in existing_ids:
                cursor.execute(
                    "INSERT INTO issues (id, name, description) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    (issue["id"], issue["text"], issue["text"])
                )
                logging.info(f"Added registration issue to database: {issue['id']} - {issue['text']}")
        
        conn.commit()
        logging.info("Registration issues added to database if needed.")
    except Exception as e:
        conn.rollback()
        logging.error(f"Error ensuring registration issues in database: {e}")
    finally:
        cursor.close()
        conn.close()

def get_representatives():
    """Fetch all representatives from the database."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, name, position, state, party, 
                   cong_district, state_senate_district, state_assembly_district, county
            FROM representatives
        """)
        
        columns = [desc[0] for desc in cursor.description]
        representatives = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        logging.info(f"Fetched {len(representatives)} representatives from database.")
        return representatives
    except Exception as e:
        logging.error(f"Error fetching representatives: {e}")
        return []
    finally:
        cursor.close()
        conn.close()

def check_table_structure():
    """Check if the representative_votes table has the correct structure."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # First, check if the table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'representative_votes'
            );
        """)
        
        if not cursor.fetchone()[0]:
            logging.error("The representative_votes table does not exist")
            return False
        
        # Check if the table has the correct columns
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'representative_votes'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        # Check if we have the expected columns
        expected_columns = {
            'id': 'integer',
            'rep_id': 'integer',
            'issue_id': 'integer',
            'vote': 'boolean',
            'passion_weight': 'integer'
        }
        
        actual_columns = {col[0]: col[1] for col in columns}
        
        # Check if all expected columns exist with correct types
        for col_name, col_type in expected_columns.items():
            if col_name not in actual_columns:
                logging.error(f"Column {col_name} missing from representative_votes table")
                return False
            
            if col_type not in actual_columns[col_name]:
                logging.error(f"Column {col_name} has wrong type: {actual_columns[col_name]} (expected {col_type})")
                return False
        
        # Check for primary key constraint
        cursor.execute("""
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.table_name = 'representative_votes'
            AND tc.constraint_type = 'PRIMARY KEY';
        """)
        
        if cursor.rowcount == 0:
            logging.error("Missing PRIMARY KEY constraint on representative_votes table")
            return False
        
        # Check for unique constraint on rep_id, issue_id
        cursor.execute("""
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu 
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'representative_votes'
            AND tc.constraint_type = 'UNIQUE'
            AND ccu.column_name IN ('rep_id', 'issue_id')
            GROUP BY tc.constraint_name
            HAVING COUNT(ccu.column_name) = 2;
        """)
        
        if cursor.rowcount == 0:
            logging.error("Missing UNIQUE constraint on (rep_id, issue_id)")
            return False
        
        # Check for foreign key constraints
        cursor.execute("""
            SELECT ccu.table_name AS referenced_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu 
                ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'representative_votes';
        """)
        
        fk_tables = [row[0] for row in cursor.fetchall()]
        
        if 'representatives' not in fk_tables or 'issues' not in fk_tables:
            logging.error("Missing foreign key constraints to representatives and/or issues tables")
            return False
        
        logging.info("representative_votes table structure is correct.")
        return True
    except Exception as e:
        logging.error(f"Error checking table structure: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def infer_votes_with_ai(representative, issues):
    """Use AI to infer representative votes with passion weights."""
    logging.info(f"Inferring votes for {representative['name']}...")
    
    # Prepare representative info for the AI
    rep_info = {
        "name": representative["name"],
        "position": representative["position"],
        "party": representative["party"],
        "state": representative["state"],
        "district": representative.get("cong_district") or representative.get("state_senate_district") or representative.get("state_assembly_district"),
        "county": representative.get("county")
    }
    
    # Prepare the AI prompt
    prompt = f"""
You are a political analyst with deep knowledge of American politics. 
Based on the following information about a political representative, predict how they would likely vote (YES or NO) on each issue, and assign a passion weight (1-5, where 5 is highest passion).

Representative Information:
Name: {rep_info['name']}
Position: {rep_info['position']}
Party: {rep_info['party'] or 'Unknown'}
State: {rep_info['state'] or 'Unknown'}
District: {rep_info['district'] or 'Unknown'}
County: {rep_info['county'] or 'Unknown'}

For each issue, provide:
1. YES or NO vote
2. Passion weight (1-5)
3. Brief explanation (1-2 sentences)

Format your response as JSON like this:
{{
  "issues": [
    {{
      "issue_id": 101,
      "vote": true,  // true for YES, false for NO
      "passion_weight": 4,
      "explanation": "Brief explanation here"
    }},
    // ... more issues
  ]
}}
"""

    try:
        # OPTION 1: Use OpenAI API (uncomment to use)
        # if OPENAI_API_KEY:
        #     response = requests.post(
        #         "https://api.openai.com/v1/chat/completions",
        #         headers={
        #             "Authorization": f"Bearer {OPENAI_API_KEY}",
        #             "Content-Type": "application/json"
        #         },
        #         json={
        #             "model": "gpt-4",
        #             "messages": [{"role": "user", "content": prompt}],
        #             "temperature": 0.7
        #         }
        #     )
        #     
        #     if response.status_code == 200:
        #         ai_response = json.loads(response.json()["choices"][0]["message"]["content"])
        #         return ai_response["issues"]
        #     else:
        #         logging.error(f"Error from OpenAI API: {response.text}")
        #         # Fall back to mock data if API fails
        
        # OPTION 2: Generate mock data based on party affiliation
        # This is used by default or as fallback if AI API fails
        mock_votes = []
        
        for issue in issues:
            # Default probability for yes vote
            yes_probability = 0.5
            
            # Progressive issues (more likely yes from Democrats)
            progressive_issues = [
                2, 3, 4, 5, 7, 8, 9, 10,  # Registration issues
                102, 103, 105, 107, 108, 112, 116, 118, 119, 127, 128, 
                201, 202, 203, 205, 207, 209, 211, 215, 216, 218, 219, 220
            ]
            
            # Conservative issues (more likely yes from Republicans)
            conservative_issues = [
                1, 6,  # Registration issues
                101, 113, 114, 115, 121, 122, 123, 125, 213
            ]
            
            # Adjust probability based on party and issue
            if representative["party"] == "Democratic":
                # Democrats more likely to vote yes on progressive issues
                if issue["id"] in progressive_issues:
                    yes_probability = 0.8
                elif issue["id"] in conservative_issues:
                    yes_probability = 0.2
            elif representative["party"] == "Republican":
                # Republicans more likely to vote yes on conservative issues
                if issue["id"] in conservative_issues:
                    yes_probability = 0.8
                elif issue["id"] in progressive_issues:
                    yes_probability = 0.2
            
            # Generate vote
            vote = random.random() < yes_probability
            
            # Generate passion weight - higher for more partisan issues
            base_passion = 3  # Default middle passion
            
            # Adjust passion based on how strongly partisan the issue is
            partisan_strength = abs(yes_probability - 0.5) * 2  # 0 to 1 scale
            
            # More partisan issues get higher passion weights
            if partisan_strength > 0.5:  # Strongly partisan
                passion_weights = [3, 4, 5]  # Higher passion weights
                weights = [0.2, 0.4, 0.4]  # More likely to be passionate
            else:  # Less partisan
                passion_weights = [1, 2, 3, 4]  # Full range
                weights = [0.2, 0.3, 0.3, 0.2]  # More balanced
            
            passion_weight = random.choices(passion_weights, weights=weights)[0]
            
            # For issues directly related to their jurisdiction, increase passion
            if (issue["target"] == "New York" and representative["state"] == "NY") or \
               (issue["target"] == "National" and "U.S." in representative["position"]):
                passion_weight = min(passion_weight + 1, 5)
            
            mock_votes.append({
                "issue_id": issue["id"],
                "vote": vote,
                "passion_weight": passion_weight,
                "explanation": f"This is a mock explanation for {representative['name']} on issue {issue['id']}."
            })
        
        return mock_votes
        
    except Exception as e:
        logging.error(f"Error inferring votes for {representative['name']}: {e}")
        return []

def store_representative_votes(rep_id, votes):
    """Store the inferred votes in the database."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        for vote in votes:
            cursor.execute("""
                INSERT INTO representative_votes (rep_id, issue_id, vote, passion_weight)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (rep_id, issue_id) DO UPDATE
                SET vote = EXCLUDED.vote, passion_weight = EXCLUDED.passion_weight
            """, (rep_id, vote["issue_id"], vote["vote"], vote["passion_weight"]))
        
        conn.commit()
        logging.info(f"Stored {len(votes)} votes for representative ID {rep_id}")
        return True
    except Exception as e:
        conn.rollback()
        logging.error(f"Error storing votes for representative ID {rep_id}: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def generate_all_representative_votes():
    """Generate and store votes for all representatives."""
    # Check if the representative_votes table has the correct structure
    if not check_table_structure():
        logging.error("Table structure check failed. Please ensure the representative_votes table exists with the correct structure.")
        return
    
    # Ensure registration issues are in the database
    ensure_issues_in_db()
    
    # Get all issues from the database (including registration issues)
    issues = get_issues_from_db()
    if not issues:
        logging.error("No issues found in the database. Please ensure the issues table is populated.")
        return
    
    # Get all representatives
    representatives = get_representatives()
    if not representatives:
        logging.error("No representatives found in the database. Please run update_representatives.py first.")
        return
    
    # Process each representative
    success_count = 0
    for rep in representatives:
        # Infer votes using AI or mock data
        votes = infer_votes_with_ai(rep, issues)
        
        if votes:
            # Store the votes in the database
            if store_representative_votes(rep["id"], votes):
                success_count += 1
        
        # Add a small delay to avoid overwhelming any APIs
        time.sleep(0.5)
    
    logging.info(f"Successfully generated votes for {success_count} out of {len(representatives)} representatives.")

if __name__ == "__main__":
    logging.info("Starting representative vote generation...")
    generate_all_representative_votes()
    logging.info("Representative vote generation complete.") 