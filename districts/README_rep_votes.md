# Representative Voting Data Generation

This script generates voting data for representatives in your database, including passion weights for each vote.

## Overview

The `generate_rep_votes.py` script:
1. Checks if the `representative_votes` table has the correct structure
2. Ensures registration issues from the user registration process are in the database
3. Fetches all issues from your database (including registration issues)
4. Fetches all representatives from your database (those added by `update_representatives.py`)
5. For each representative, generates voting data on all issues with passion weights (1-5)
6. Stores the generated votes in the database

## Requirements

- Python 3.6+
- PostgreSQL database
- The following Python packages:
  - psycopg2
  - requests
  - python-dotenv
  - logging

## Setup

Ensure your `.env` file contains the database connection details:
```
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=your_database_host
DB_PORT=your_database_port
```

(Optional) If you want to use AI-powered vote generation, add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key
```

## Usage

Run the script after you've updated your representatives with `update_representatives.py`:

```bash
python districts/generate_rep_votes.py
```

## How It Works

### Database Integration

The script works with your existing database structure:
- Uses the `representatives` table populated by `update_representatives.py`
- Uses the `issues` table for issue data
- Includes registration issues from the user registration process
- Stores votes in the `representative_votes` table with the structure:
  ```
  id             | integer | PRIMARY KEY
  rep_id         | integer | REFERENCES representatives(id)
  issue_id       | integer | REFERENCES issues(id)
  vote           | boolean | NOT NULL
  passion_weight | integer | CHECK (passion_weight >= 1 AND passion_weight <= 5)
  ```

### Registration Issues

The script includes the 10 issues used during user registration:
1. Should the federal government set tighter limits on corporate campaign donations?
2. Should the government provide a universal basic income for all citizens?
3. Should there be universal background checks for all firearm purchases nationwide?
4. Should the death penalty be abolished?
5. Should there be a federally mandated paid family leave policy?
6. Should members of Congress have term limits?
7. Should the government prioritize renewable energy over fossil fuels?
8. Should same-sex marriage be protected by federal law?
9. Should there be a national ban on gerrymandering?
10. Should children of undocumented immigrants born and raised in the U.S. have a guaranteed path to citizenship?

These issues are automatically added to the database if they don't already exist, ensuring that representatives have voting data for the same issues that users vote on during registration.

### Vote Generation

The script offers two methods for generating representative votes:

1. **Mock Data Generation (Default)**
   - Uses probabilistic logic based on party affiliation
   - Adjusts vote probabilities based on issue type and representative party
   - Generates passion weights (1-5) with higher weights for more partisan issues
   - Increases passion for issues directly related to the representative's jurisdiction

2. **AI-Powered Generation (Optional)**
   - Uses OpenAI's API to generate more accurate voting predictions
   - Provides detailed representative information to the AI
   - Requires an OpenAI API key in your `.env` file
   - To use this method, uncomment the OpenAI API section in the code

### Passion Weight Logic

Passion weights (1-5) are generated based on:
- How partisan the issue is (more partisan issues get higher passion)
- The representative's jurisdiction (representatives care more about issues in their jurisdiction)
- The representative's party (representatives care more about core party issues)

## Customization

You can customize the script by:
- Modifying the issue categorization (progressive vs. conservative)
- Adjusting the voting probability logic for more accurate mock data
- Enhancing the AI prompt to provide more context for better predictions
- Adding more sophisticated passion weight logic

## Notes

- The script is designed to be run after `update_representatives.py` has populated your representatives table
- For production use, the AI-powered generation will provide more realistic results
- The script uses an "upsert" operation, so it can be run multiple times without creating duplicate votes
- The script validates the database structure before running to ensure compatibility 