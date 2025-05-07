from flask import jsonify, render_template, request, send_from_directory
import json
import os
from modules.graph import graph_bp
from modules.graph.utils import (
    build_or_load_graph, add_concept, delete_concept, 
    rename_concept, insert_node_between, expand_node,
    find_best_parent_for_term, prepare_d3_data,
    load_embedding_model, calculate_similarities
)
from config import Config

global_data = None
global_topic = "Machine Learning"

@graph_bp.route('/')
def index():
    return render_template('graph.html')

@graph_bp.route('/index.html')
def index_html():
    return render_template('graph.html')

@graph_bp.route('/get_graph_data', methods=['GET'])
def get_graph_data():
    global global_data, global_topic
    topic = request.args.get('topic', global_topic)
    force_regenerate = request.args.get('force', 'false').lower() == 'true'
    use_similarities = request.args.get('use_similarities', 'false').lower() == 'true'
    
    if global_data is None or topic != global_topic or force_regenerate:
        global_topic = topic
        global_data = build_or_load_graph(topic, force_regenerate, calculate_similarities=False)
    
    if use_similarities and 'concepts' in global_data:
        if 'relationships' not in global_data:
            global_data['relationships'] = {}
            
        global_data['relationships'] = calculate_similarities(
            global_data['concepts'], 
            existing_relationships=global_data.get('relationships', {})
        )
        
        with open(Config.GRAPH_DATA_FILE, 'w') as f:
            json.dump(global_data, f, indent=2)
    
    return jsonify({
        "topic": topic,
        "graph_data": prepare_d3_data(global_data, using_similarities=use_similarities)
    })

@graph_bp.route('/add_concept', methods=['POST'])
def add_concept_api():
    global global_data, global_topic
    
    data = request.json
    new_concept = data.get('concept')
    parent_id = data.get('parent')
    level = data.get('level')
    topic = data.get('core_topic', global_topic)
    calculate_similarity = data.get('calculate_similarity', False)
    
    if not new_concept:
        return jsonify({"success": False, "error": "No concept provided"})
    
    if global_data is None or topic != global_topic:
        global_topic = topic
        global_data = build_or_load_graph(topic)
    
    try:
        updated_data, success = add_concept(global_data, new_concept, parent_id, level, calculate_similarity)
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True, 
                "graph_data": prepare_d3_data(global_data, using_similarities=calculate_similarity)
            })
        else:
            return jsonify({"success": False, "error": "Concept already exists"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@graph_bp.route('/auto_add_term', methods=['POST'])
def auto_add_term_api():
    global global_data, global_topic
    
    data = request.json
    new_term = data.get('term')
    topic = data.get('core_topic', global_topic)
    calculate_similarity = data.get('calculate_similarity', False)
    
    if not new_term:
        return jsonify({"success": False, "error": "No term provided"})
    
    if global_data is None or topic != global_topic:
        global_topic = topic
        global_data = build_or_load_graph(topic)
    
    try:
        if any(c["id"] == new_term for c in global_data["concepts"]):
            return jsonify({"success": False, "error": "Term already exists in the graph"})
        
        parent_id, level, reason = find_best_parent_for_term(
            global_topic, new_term, global_data["concepts"]
        )
        
        updated_data, success = add_concept(
            global_data, new_term, parent_id, level, calculate_similarity
        )
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True,
                "graph_data": prepare_d3_data(global_data, using_similarities=calculate_similarity),
                "parent_node": parent_id,
                "level": level,
                "reason": reason
            })
        else:
            return jsonify({"success": False, "error": "Failed to add term"})
    except Exception as e:
        print(f"Error in auto_add_term: {e}")
        return jsonify({"success": False, "error": str(e)})

@graph_bp.route('/expand_node', methods=['POST'])
def expand_node_api():
    global global_data
    
    data = request.json
    node_id = data.get('node_id')
    calculate_similarity = data.get('calculate_similarity', False)
    
    if not node_id:
        return jsonify({"success": False, "error": "No node ID provided"})
    
    if global_data is None:
        return jsonify({"success": False, "error": "No graph data loaded"})
    
    try:
        updated_data, success, new_nodes, error = expand_node(global_data, node_id, calculate_similarity)
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True,
                "graph_data": prepare_d3_data(global_data, using_similarities=calculate_similarity),
                "new_nodes": new_nodes,
                "added_count": len(new_nodes)
            })
        else:
            return jsonify({"success": False, "error": error or "Failed to expand node"})
    except Exception as e:
        print(f"Error in expand_node_api: {e}")
        return jsonify({"success": False, "error": str(e)})

@graph_bp.route('/delete_concept', methods=['POST'])
def delete_concept_api():
    global global_data
    
    data = request.json
    concept_id = data.get('concept_id')
    use_similarities = data.get('use_similarities', False)
    
    if not concept_id:
        return jsonify({"success": False, "error": "No concept provided"})
    
    if global_data is None:
        return jsonify({"success": False, "error": "No graph data loaded"})
    
    try:
        updated_data, success = delete_concept(global_data, concept_id)
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True, 
                "graph_data": prepare_d3_data(global_data, using_similarities=use_similarities)
            })
        else:
            return jsonify({"success": False, "error": "Concept not found"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@graph_bp.route('/rename_concept', methods=['POST'])
def rename_concept_api():
    global global_data
    
    data = request.json
    old_id = data.get('old_id')
    new_id = data.get('new_id')
    use_similarities = data.get('use_similarities', False)
    
    if not old_id or not new_id:
        return jsonify({"success": False, "error": "Missing concept identifiers"})
    
    if global_data is None:
        return jsonify({"success": False, "error": "No graph data loaded"})
    
    try:
        updated_data, success = rename_concept(global_data, old_id, new_id)
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True, 
                "graph_data": prepare_d3_data(global_data, using_similarities=use_similarities)
            })
        else:
            return jsonify({"success": False, "error": "Concept not found or new name already exists"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@graph_bp.route('/insert_node', methods=['POST'])
def insert_node_api():
    global global_data
    
    data = request.json
    parent_id = data.get('parent_id')
    child_id = data.get('child_id')
    new_concept = data.get('new_concept')
    calculate_similarity = data.get('calculate_similarity', False)
    
    if not parent_id or not child_id or not new_concept:
        return jsonify({"success": False, "error": "Missing required parameters"})
    
    if global_data is None:
        return jsonify({"success": False, "error": "No graph data loaded"})
    
    try:
        updated_data, success = insert_node_between(global_data, parent_id, child_id, new_concept, calculate_similarity)
        
        if success:
            global_data = updated_data
            return jsonify({
                "success": True, 
                "graph_data": prepare_d3_data(global_data, using_similarities=calculate_similarity)
            })
        else:
            return jsonify({"success": False, "error": "Failed to insert node"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

load_embedding_model()
