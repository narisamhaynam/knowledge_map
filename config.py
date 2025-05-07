from pathlib import Path

class Config:
    DATA_DIR = Path("data") 
    DATA_DIR.mkdir(exist_ok=True)
    GRAPH_DATA_FILE = Path("data/concept_graph_data.json")
    
    CLAUDE_API_KEY = ""
    CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
    
    DEBUG = True
    PORT = 5001