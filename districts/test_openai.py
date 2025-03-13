import os
from dotenv import load_dotenv
from openai import OpenAI
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)

def test_openai_key():
    # Get current directory and project root
    current_dir = Path(__file__).parent
    project_root = current_dir.parent
    env_path = project_root / '.env'
    
    logging.info(f"Current directory: {current_dir}")
    logging.info(f"Project root: {project_root}")
    logging.info(f"Looking for .env file at: {env_path}")
    logging.info(f".env file exists: {env_path.exists()}")
    
    # Load environment variables
    load_dotenv(env_path)
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        logging.error("No OpenAI API key found in .env file")
        # Print all environment variables (excluding their values for security)
        logging.info("Available environment variables:")
        for key in os.environ.keys():
            logging.info(f"- {key}")
        return False
        
    try:
        # Initialize the client with the API key
        client = OpenAI(api_key=api_key)
        
        # Make a simple API call using GPT-3.5-turbo instead of GPT-4
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello, this is a test."}],
            max_tokens=10
        )
        logging.info("OpenAI API key is valid!")
        logging.info(f"Test response: {response.choices[0].message.content}")
        return True
    except Exception as e:
        logging.error(f"Error testing OpenAI API key: {e}")
        return False

if __name__ == "__main__":
    test_openai_key() 