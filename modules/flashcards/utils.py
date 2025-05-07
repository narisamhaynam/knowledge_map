import os
import json
import requests
import logging
from config import Config
from .cache import definition_cache

logger = logging.getLogger(__name__)

FALLBACK_DEFINITIONS = {
    "machine learning": "A field of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed, using algorithms and statistical models to analyze patterns in data.",
    "deep learning": "A subset of machine learning that uses neural networks with multiple layers (deep neural networks) to analyze various factors of data with a structure and function similar to the human brain.",
    "neural network": "A computing system inspired by biological neural networks that can learn to perform tasks by analyzing examples, typically organized in layers of connected nodes or 'neurons'.",
    "supervised learning": "A machine learning paradigm where models are trained on labeled data to predict outcomes based on input features, with the algorithm learning to map inputs to correct outputs.",
    "unsupervised learning": "A machine learning technique where algorithms find patterns in unlabeled data without specific guidance, often used for clustering, association, and dimensionality reduction.",
    "reinforcement learning": "A training method based on rewarding desired behaviors and punishing undesired ones, allowing agents to learn optimal actions through trial and error interactions with an environment.",
    "natural language processing": "A field of AI focused on enabling computers to understand, interpret, and generate human language in useful ways.",
    "computer vision": "A field of AI that trains computers to interpret and understand visual information from the world, enabling machines to identify and process images similarly to human vision.",
    "clustering": "An unsupervised learning technique that groups similar data points together based on certain features or characteristics without prior labeling.",
    "classification": "A supervised learning task where the model learns to assign input data to predefined categories or classes based on training examples.",
    "regression": "A supervised learning technique used to predict continuous values based on input features, modeling the relationship between variables.",
    "data mining": "The process of discovering patterns, correlations, and insights from large datasets using methods from statistics, machine learning, and database systems.",
    "feature extraction": "The process of selecting and transforming raw data variables into more useful features that improve model performance and accuracy.",
    "algorithm": "A step-by-step procedure or formula for solving a problem or accomplishing a task, particularly in computation and data processing.",
    "model": "A mathematical representation of a real-world process, trained on data to make predictions or decisions without being explicitly programmed for the task.",
    "training data": "The dataset used to teach a machine learning model how to make predictions by discovering patterns and relationships within the data.",
    "overfitting": "A modeling error where a model learns the training data too well, including its noise and outliers, resulting in poor performance on new, unseen data.",
    "underfitting": "A modeling error where a model is too simple to capture the underlying pattern in the data, resulting in poor performance on both training and new data.",
    "hyperparameter": "A parameter whose value is set before the learning process begins, as opposed to model parameters that are learned during training.",
    "cross-validation": "A resampling technique used to evaluate machine learning models by partitioning data into training and validation sets multiple times.",
    "batch processing": "A technique where data is collected into groups or batches before being processed, often used in machine learning to optimize computational efficiency.",
    "cats": "Small domesticated carnivorous mammals characterized by soft fur, retractable claws, keen senses, and a natural hunting ability, popular as pets worldwide.",
    "domestic cats": "Cats that have been domesticated and adapted to live with humans, typically kept as companions or pets and available in numerous breeds with varied characteristics.",
    "wild cats": "Undomesticated feline species that live in natural habitats across various ecosystems, including large cats like lions and tigers as well as smaller wildcats.",
    "hybrid cats": "Cats resulting from crossbreeding between domestic cats and wild cat species, often exhibiting physical characteristics of wild cats while retaining domestic temperament.",
    "cat anatomy": "The physical structure of cats, including skeletal, muscular, nervous, and other bodily systems that enable their agility, hunting prowess, and unique physiological traits.",
    "cat behavior": "The actions, reactions, and patterns exhibited by cats, including hunting, grooming, communication, play, and social interactions with other cats and humans."
}

def get_term_definition(term):
    term_lower = term.lower()
    
    cached_definition = definition_cache.get(term_lower)
    if cached_definition:
        logger.debug(f"Using cached definition for '{term}'")
        return cached_definition
    
    try:
        context = get_term_context(term)
        
        prompt = f"""Define the term {term} in a clear, concise way that would be suitable for a flashcard. The definition should be 1-3 sentences long and focus on the essential characteristics. Context: This term is related to {context}"""
        
        payload = {
            "model": "claude-3-haiku-20240307",
            "max_tokens": 150,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }
        
        logger.debug(f"Claude API Request URL: {Config.CLAUDE_API_URL}")
        logger.debug(f"Claude API Request Headers: x-api-key: [REDACTED], anthropic-version: 2023-06-01")
        logger.debug(f"Claude API Request Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            Config.CLAUDE_API_URL,
            headers={
                "x-api-key": Config.CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-3-opus-20240229",  
                "max_tokens": 150,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            },
            timeout=10
        )
        
        logger.debug(f"Claude API Response Status: {response.status_code}")
        logger.debug(f"Claude API Response Content: {response.text[:200]}...") 
        
        response.raise_for_status()
        
        try:
            response_data = response.json()
            logger.debug(f"Successfully parsed JSON response")
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response: {response.text}")
            raise
        
        content = response_data.get("content", [])
        definition = ""
        
        if content and len(content) > 0:
            definition = content[0].get("text", "")
            logger.debug(f"Successfully extracted definition from response")
        else:
            logger.warning(f"No content found in response: {json.dumps(response_data)}")
        
        definition = definition.strip()
        
        if not definition:
            if term_lower in FALLBACK_DEFINITIONS:
                definition = FALLBACK_DEFINITIONS[term_lower]
                logger.debug(f"Using fallback definition due to empty response for '{term}'")
            else:
                definition = f"A term related to {context} in the field of knowledge."
                logger.debug(f"Using generic definition due to empty response for '{term}'")
        
        definition_cache.set(term_lower, definition)
            
        return definition
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making request to Claude API: {str(e)}")
        logger.error(f"Request details: URL={Config.CLAUDE_API_URL}, Headers=[REDACTED]")
        
        if term_lower in FALLBACK_DEFINITIONS:
            definition = FALLBACK_DEFINITIONS[term_lower]
            logger.debug(f"Using fallback definition after API error for '{term}'")
            definition_cache.set(term_lower, definition)
            return definition
        
        return f"A concept or term in the knowledge domain. (API error: definition service temporarily unavailable)"

def get_term_context(term):
    try:
        data_file = Config.GRAPH_DATA_FILE
        
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        term_data = next((concept for concept in data['concepts'] if concept['id'].lower() == term.lower()), None)
        
        if term_data:
            parent_id = term_data.get('parent')
            
            if parent_id:
                siblings = [concept['id'] for concept in data['concepts'] 
                            if concept.get('parent') == parent_id and concept['id'] != term]
                
                children = [concept['id'] for concept in data['concepts'] 
                            if concept.get('parent') == term]
                
                context = f"the broader category of '{parent_id}'"
                
                if siblings:
                    sibling_str = ", ".join([f"'{s}'" for s in siblings[:3]])
                    if len(siblings) > 3:
                        sibling_str += f", and {len(siblings) - 3} other terms"
                    context += f". It's related to {sibling_str}"
                
                if children:
                    child_str = ", ".join([f"'{c}'" for c in children[:3]])
                    if len(children) > 3:
                        child_str += f", and {len(children) - 3} other subtopics"
                    context += f". It includes subtopics like {child_str}"
                
                return context
            else:
                children = [concept['id'] for concept in data['concepts'] 
                            if concept.get('parent') == term]
                
                if children:
                    child_str = ", ".join([f"'{c}'" for c in children[:3]])
                    if len(children) > 3:
                        child_str += f", and {len(children) - 3} other subtopics"
                    return f"a main category that includes {child_str}"
                else:
                    return "the main topic in the knowledge graph"
        
        if term.lower() == "machine learning":
            return "artificial intelligence, data science, and statistical modeling"
        elif "cat" in term.lower():
            return "feline biology, behavior, or domestic and wild species"
        else:
            return "the current topic in the knowledge graph"
    except Exception as e:
        logger.error(f"Error getting context for term '{term}': {str(e)}")
        return "the current topic in the knowledge graph"
