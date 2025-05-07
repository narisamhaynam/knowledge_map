import os
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta
from config import Config

logger = logging.getLogger(__name__)

class DefinitionCache:
    
    def __init__(self, cache_file=None):
      
        if cache_file is None:
            self.cache_file = Path(Config.DATA_DIR) / "definition_cache.json"
        else:
            self.cache_file = Path(cache_file)
        
        if not self.cache_file.exists():
            try:
                self.cache_file.parent.mkdir(exist_ok=True)
                self._save_cache({})
            except Exception as e:
                logger.error(f"Error creating cache file: {str(e)}")
        
        self.cache = self._load_cache()
        
        logger.debug(f"Loaded {len(self.cache)} cached definitions")
    
    def get(self, term):
        term = term.lower()
        
        if term in self.cache:
            timestamp = self.cache[term]['timestamp']
            try:
                expiration_date = datetime.fromisoformat(timestamp) + timedelta(days=7)
                
                if datetime.now() < expiration_date:
                    logger.debug(f"Cache hit for term '{term}'")
                    return self.cache[term]['definition']
                else:
                    logger.debug(f"Cache expired for term '{term}'")
            except (ValueError, TypeError) as e:
                logger.error(f"Error parsing timestamp for cached term '{term}': {str(e)}")
        
        logger.debug(f"Cache miss for term '{term}'")
        return None
    
    def set(self, term, definition):
        term = term.lower()
        
        self.cache[term] = {
            'definition': definition,
            'timestamp': datetime.now().isoformat()
        }
        
        self._save_cache(self.cache)
        logger.debug(f"Added definition for '{term}' to cache")
    
    def _load_cache(self):
        try:
            if not self.cache_file.exists():
                logger.warning(f"Cache file {self.cache_file} does not exist, returning empty cache")
                return {}
                
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Error loading cache: {str(e)}")
            return {}
    
    def _save_cache(self, cache_data):
        try:
            self.cache_file.parent.mkdir(exist_ok=True)
            
            temp_file = self.cache_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
            
            temp_file.replace(self.cache_file)
        except Exception as e:
            logger.error(f"Error saving cache: {str(e)}")

definition_cache = DefinitionCache()
