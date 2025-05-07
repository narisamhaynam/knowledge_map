from flask import render_template, request, jsonify
import json
import os
import logging
from config import Config
from . import flashcards_bp
from .utils import get_term_definition

logger = logging.getLogger(__name__)

@flashcards_bp.route('/')
def index():
    return render_template('flashcards.html')

@flashcards_bp.route('/terms')
def get_terms():
    try:
        data_file = Config.GRAPH_DATA_FILE
        
        if not os.path.exists(data_file):
            logger.error(f"Data file not found: {data_file}")
            return jsonify({'status': 'error', 'message': 'Data file not found'})
        
        with open(data_file, 'r') as f:
            data = json.load(f)
            
        terms = [concept['id'] for concept in data['concepts']]
        
        logger.debug(f"Retrieved {len(terms)} terms from the knowledge graph")
        
        return jsonify({'status': 'success', 'terms': terms})
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Invalid JSON in data file'})
    except Exception as e:
        logger.error(f"Error retrieving terms: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@flashcards_bp.route('/definition', methods=['POST'])
def get_definition():
    term = request.json.get('term')
    
    if not term:
        logger.warning("No term provided in definition request")
        return jsonify({'status': 'error', 'message': 'No term provided'})
    
    try:
        logger.debug(f"Getting definition for term: {term}")
        definition = get_term_definition(term)
        
        return jsonify({
            'status': 'success',
            'term': term,
            'definition': definition
        })
    except Exception as e:
        logger.error(f"Error getting definition for '{term}': {str(e)}")
        return jsonify({
            'status': 'success',  
            'term': term,
            'definition': f"A concept or term in the knowledge domain. (Error retrieving definition)"
        })

@flashcards_bp.route('/filter-by-level/<int:level>')
def filter_by_level(level):
    try:
        data_file = Config.GRAPH_DATA_FILE
        
        with open(data_file, 'r') as f:
            data = json.load(f)
        terms = [concept['id'] for concept in data['concepts'] if concept.get('level') == level]
        
        logger.debug(f"Retrieved {len(terms)} terms at level {level}")
        
        return jsonify({'status': 'success', 'terms': terms})
    except Exception as e:
        logger.error(f"Error retrieving terms at level {level}: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@flashcards_bp.route('/filter-by-parent/<parent>')
def filter_by_parent(parent):
    try:
        data_file = Config.GRAPH_DATA_FILE
        
        with open(data_file, 'r') as f:
            data = json.load(f)
            
        terms = [concept['id'] for concept in data['concepts'] if concept.get('parent') == parent]
        
        logger.debug(f"Retrieved {len(terms)} terms with parent '{parent}'")
        
        return jsonify({'status': 'success', 'terms': terms})
    except Exception as e:
        logger.error(f"Error retrieving terms with parent '{parent}': {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@flashcards_bp.route('/categories')
def get_categories():
    try:
        data_file = Config.GRAPH_DATA_FILE
        
        with open(data_file, 'r') as f:
            data = json.load(f)
            
        parent_ids = set(concept.get('parent') for concept in data['concepts'] if concept.get('parent'))
        
        categories = [concept['id'] for concept in data['concepts'] if concept['id'] in parent_ids]
        
        logger.debug(f"Retrieved {len(categories)} category terms")
        
        return jsonify({'status': 'success', 'categories': categories})
    except Exception as e:
        logger.error(f"Error retrieving categories: {str(e)}")
        return jsonify({'status': 'success', 'categories': []}) 
