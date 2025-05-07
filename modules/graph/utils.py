import json
import numpy as np
import requests
import re
from pathlib import Path
from sentence_transformers import SentenceTransformer
from config import Config

global_data = None
global_topic = "Machine Learning"
embedding_model = None

def load_embedding_model():
    global embedding_model
    try:
        embedding_model = SentenceTransformer("Alibaba-NLP/gte-Qwen2-7B-instruct", device="cpu", trust_remote_code=True)
        embedding_model.max_seq_length = 512 
        print("Embedding model loaded successfully on CPU")
        return True
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

def call_claude_api(prompt, max_tokens=1000):
    headers = {
        "x-api-key": Config.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-3-opus-20240229",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        response = requests.post(Config.CLAUDE_API_URL, headers=headers, json=data)
        response.raise_for_status()
        return response.json()['content'][0]['text']
    except Exception as e:
        print(f"Claude API error: {e}")
        return None

def parse_claude_response(response, pattern, default=None):
    if not response:
        return default
    match = re.search(pattern, response, re.IGNORECASE)
    return match.group(1) if match else default

def generate_concept_hierarchy(core_topic, depth=3, breadth=5):
    prompt = f"""
    Generate a concept hierarchy for "{core_topic}" as a JSON array of objects with these fields:
    - "id": concept name (string)
    - "level": depth level (integer, 0 for root)
    - "parent": parent concept name (string, or null for root)
    
    Go {depth} levels deep with ~{breadth} concepts per level.
    Return ONLY the JSON array with no explanation.
    """
    
    response = call_claude_api(prompt, max_tokens=2000)
    
    if not response:
        return fallback_hierarchy(core_topic)
    
    try:
        concepts = json.loads(response)
        
        if not any(c.get('id') == core_topic and c.get('level') == 0 for c in concepts):
            concepts.insert(0, {"id": core_topic, "level": 0, "parent": None})
        
        return concepts
    except json.JSONDecodeError:
        match = re.search(r'\[\s*{.*}\s*\]', response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except:
                pass
        
        return fallback_hierarchy(core_topic)

def fallback_hierarchy(core_topic):
    return [
        {"id": core_topic, "level": 0, "parent": None}
    ]

def compute_embeddings(texts, is_query=False):
    global embedding_model
    
    if embedding_model is None:
        if not load_embedding_model():
            return np.random.randn(len(texts), 768)
    
    try:
        batch_size = 8
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            if is_query:
                batch_embeddings = embedding_model.encode(batch, prompt_name="query")
            else:
                batch_embeddings = embedding_model.encode(batch)
            all_embeddings.append(batch_embeddings)
        
        return np.vstack(all_embeddings)
    except Exception as e:
        print(f"Embedding error: {e}")
        return np.random.randn(len(texts), 768)

def find_most_similar_concept(new_concept, concepts):
    concept_ids = [c["id"] for c in concepts]
    
    new_embedding = compute_embeddings([new_concept], is_query=True)
    concept_embeddings = compute_embeddings(concept_ids)
    
    similarities = (new_embedding @ concept_embeddings.T)[0]
    max_index = np.argmax(similarities)
    
    return concepts[max_index], float(similarities[max_index] * 100)

def calculate_similarities(concepts, existing_relationships=None):
    similarities = existing_relationships or {}
    parent_child_pairs = {}
    pairs_to_calculate = []
    
    for concept in concepts:
        if concept.get("parent"):
            parent = concept["parent"]
            child = concept["id"]
            pair_key = f"{parent}->{child}"
            
            if pair_key not in similarities:
                if parent not in parent_child_pairs:
                    parent_child_pairs[parent] = []
                parent_child_pairs[parent].append(child)
                pairs_to_calculate.append(pair_key)
    
    if not pairs_to_calculate:
        return similarities
        
    for parent, children in parent_child_pairs.items():
        parent_embedding = compute_embeddings([parent])[0]
        children_embeddings = compute_embeddings(children)
        
        for i, child in enumerate(children):
            pair_key = f"{parent}->{child}"
            if pair_key in pairs_to_calculate:  
                similarity = float((parent_embedding @ children_embeddings[i]) * 100)
                similarities[pair_key] = similarity
    
    return similarities

def get_parent_for_concept(core_topic, new_concept, concepts):
    concepts_by_level = {}
    for c in concepts:
        level = c.get("level", 0)
        if level not in concepts_by_level:
            concepts_by_level[level] = []
        concepts_by_level[level].append(c["id"])
    
    formatted_concepts = "\n".join([f"Level {level}:\n" + "\n".join([f"- {c}" for c in sorted(concepts)])
                                   for level, concepts in sorted(concepts_by_level.items())])
    
    prompt = f"""
    For a knowledge graph about "{core_topic}" with these concepts:
    
    {formatted_concepts}
    
    What should be the PARENT of new concept "{new_concept}" and at what LEVEL?
    
    Respond exactly as:
    PARENT: [existing concept name]
    LEVEL: [number]
    """
    
    response = call_claude_api(prompt, max_tokens=300)
    
    parent = parse_claude_response(response, r'PARENT:\s*(.+?)(?:\n|$)', core_topic)
    
    try:
        level = int(parse_claude_response(response, r'LEVEL:\s*(\d+)', "1"))
    except (TypeError, ValueError):
        level = 1
    
    if not any(c["id"] == parent for c in concepts):
        import difflib
        matches = difflib.get_close_matches(parent, [c["id"] for c in concepts], n=1)
        parent = matches[0] if matches else core_topic
    
    return parent, level

def find_best_parent_for_term(core_topic, new_term, concepts):
    concepts_by_level = {}
    for c in concepts:
        level = c.get("level", 0)
        if level not in concepts_by_level:
            concepts_by_level[level] = []
        concepts_by_level[level].append(c["id"])
    
    formatted_concepts = "\n".join([
        f"Level {level}:\n" + "\n".join([f"- {c}" for c in sorted(concepts)])
        for level, concepts in sorted(concepts_by_level.items())
    ])
    
    prompt = f"""
    For a knowledge graph about "{core_topic}" with these existing concepts:
    
    {formatted_concepts}
    
    I want to add a new concept: "{new_term}"
    
    Which EXISTING concept should be the PARENT of this new term?
    
    Consider the hierarchical relationship and conceptual relevance. Pick the most appropriate parent from the existing concepts.
    
    Respond exactly as:
    PARENT: [existing concept name]
    LEVEL: [number]
    REASON: [brief explanation of why this parent is appropriate]
    """
    
    response = call_claude_api(prompt, max_tokens=500)
    
    if not response:
        return core_topic, 1, "Defaulting to core topic as parent due to API error."
    
    parent = parse_claude_response(response, r'PARENT:\s*(.+?)(?:\n|$)', core_topic)
    
    try:
        level = int(parse_claude_response(response, r'LEVEL:\s*(\d+)', "1"))
    except (TypeError, ValueError):
        level = 1
    
    reason = parse_claude_response(response, r'REASON:\s*(.+?)(?:\n|$)', "")
    
    if not any(c["id"] == parent for c in concepts):
        import difflib
        matches = difflib.get_close_matches(parent, [c["id"] for c in concepts], n=1)
        parent = matches[0] if matches else core_topic
    
    return parent, level, reason

def expand_node(graph_data, node_id, calculate_similarity=False):
    core_topic = graph_data["core"]
    concepts = graph_data["concepts"]
    
    node_to_expand = next((c for c in concepts if c["id"] == node_id), None)
    if not node_to_expand:
        return graph_data, False, [], "Node not found"
    
    is_leaf = not any(c.get("parent") == node_id for c in concepts)
    
    existing_children = [c["id"] for c in concepts if c.get("parent") == node_id]
    
    if is_leaf:
        new_nodes, error = generate_concept_subtree(core_topic, node_id, node_to_expand.get("level", 0), existing_children)
    else:
        new_nodes, error = generate_additional_children(core_topic, node_id, node_to_expand.get("level", 0), existing_children)
    
    if error:
        return graph_data, False, [], error
    
    for new_node in new_nodes:
        concepts.append(new_node)
        
        if calculate_similarity and "relationships" in graph_data:
            parent_id = new_node.get("parent")
            if parent_id:
                key = f"{parent_id}->{new_node['id']}"
                try:
                    parent_embedding = compute_embeddings([parent_id])[0]
                    node_embedding = compute_embeddings([new_node['id']])[0]
                    similarity = float((parent_embedding @ node_embedding) * 100)
                    graph_data["relationships"][key] = similarity
                except Exception as e:
                    print(f"Error calculating similarity: {e}")
                    graph_data["relationships"][key] = 70.0
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    new_node_ids = [n["id"] for n in new_nodes]
    return graph_data, True, new_node_ids, None

def generate_concept_subtree(core_topic, parent_id, parent_level, existing_children):
    existing_formatted = "\n".join([f"- {child}" for child in existing_children])
    exclusion_text = f"Existing children to exclude:\n{existing_formatted}" if existing_children else ""
    
    prompt = f"""
    For a knowledge graph about "{core_topic}", I need to expand the node "{parent_id}" with a subtree of concepts.
    
    {exclusion_text}
    
    Generate a JSON array of objects with these fields:
    - "id": concept name (string)
    - "level": depth level (integer, {parent_level + 1} for direct children, higher for their descendants)
    - "parent": parent concept name (string, "{parent_id}" for direct children, or the ID of another new node for descendants)
    
    Create a subtree with 3-5 direct children, and 2-3 children for each of those (2 levels deep).
    Make sure all concepts are semantically relevant to both "{parent_id}" and the core topic "{core_topic}".
    Do not include any concepts that are already listed as existing children.
    
    Return ONLY the JSON array without any explanation or markdown formatting.
    """
    
    response = call_claude_api(prompt, max_tokens=2000)
    
    if not response:
        return [], "Failed to generate subtree"
    
    try:
        new_nodes = json.loads(response)
        
        for node in new_nodes:
            if not all(key in node for key in ["id", "level", "parent"]):
                return [], "Invalid node structure in generated concepts"
        
        return new_nodes, None
    except json.JSONDecodeError:
        match = re.search(r'\[\s*{.*}\s*\]', response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0)), None
            except:
                pass
        
        return [], "Failed to parse generated concepts"

def generate_additional_children(core_topic, parent_id, parent_level, existing_children):
    existing_formatted = "\n".join([f"- {child}" for child in existing_children])
    
    prompt = f"""
    For a knowledge graph about "{core_topic}", I need to add more child nodes to the concept "{parent_id}".
    
    Existing children to exclude:
    {existing_formatted}
    
    Generate a JSON array of objects with these fields:
    - "id": concept name (string)
    - "level": depth level (integer, should be {parent_level + 1} for all children)
    - "parent": parent concept name (string, should be "{parent_id}" for all)
    
    Generate 3-5 new child concepts that:
    1. Are semantically relevant to both "{parent_id}" and the core topic "{core_topic}"
    2. Are distinct from the existing children listed above
    3. Represent important aspects, subtopics, or categories of "{parent_id}"
    
    Return ONLY the JSON array without any explanation or markdown formatting.
    """
    
    response = call_claude_api(prompt, max_tokens=1000)
    
    if not response:
        return [], "Failed to generate additional children"
    
    try:
        new_nodes = json.loads(response)
        
        for node in new_nodes:
            if not all(key in node for key in ["id", "level", "parent"]):
                return [], "Invalid node structure in generated concepts"
            
            if node["parent"] != parent_id:
                node["parent"] = parent_id
            
            if node["level"] != parent_level + 1:
                node["level"] = parent_level + 1
        
        return new_nodes, None
    except json.JSONDecodeError:
        match = re.search(r'\[\s*{.*}\s*\]', response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0)), None
            except:
                pass
        
        return [], "Failed to parse generated concepts"

def build_or_load_graph(core_topic, force_regenerate=False, calculate_similarities=False):
    if not force_regenerate and Config.GRAPH_DATA_FILE.exists():
        try:
            with open(Config.GRAPH_DATA_FILE, 'r') as f:
                data = json.load(f)
                if data.get("core") == core_topic:
                    return data
        except:
            pass
    
    concepts = generate_concept_hierarchy(core_topic)
    
    if calculate_similarities:
        similarities = calculate_similarities(concepts)
    else:
        similarities = {}
    
    graph_data = {
        "core": core_topic,
        "concepts": concepts,
        "relationships": similarities
    }
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    return graph_data

def add_concept(graph_data, new_concept, parent_id=None, level=None, calculate_similarity=False):
    core_topic = graph_data["core"]
    concepts = graph_data["concepts"]
    
    if any(c["id"] == new_concept for c in concepts):
        return graph_data, False
    
    if parent_id is None or level is None:
        parent_id, level = get_parent_for_concept(core_topic, new_concept, concepts)
    
    concepts.append({
        "id": new_concept,
        "level": level,
        "parent": parent_id
    })
    
    if "relationships" not in graph_data:
        graph_data["relationships"] = {}
    
    if calculate_similarity:
        new_relationship_key = f"{parent_id}->{new_concept}"
        if new_relationship_key not in graph_data["relationships"]:
            try:
                parent_embedding = compute_embeddings([parent_id])[0]
                concept_embedding = compute_embeddings([new_concept])[0]
                similarity = float((parent_embedding @ concept_embedding) * 100)
                graph_data["relationships"][new_relationship_key] = similarity
            except Exception as e:
                print(f"Error calculating similarity: {e}")
                graph_data["relationships"][new_relationship_key] = 70.0
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    return graph_data, True

def delete_concept(graph_data, concept_id):
    concepts = graph_data["concepts"]
    relationships = graph_data.get("relationships", {})
    
    concept_to_delete = next((c for c in concepts if c["id"] == concept_id), None)
    if not concept_to_delete:
        return graph_data, False
    
    to_delete = set([concept_id])
    
    while True:
        found = False
        for concept in concepts:
            if concept.get("parent") in to_delete and concept["id"] not in to_delete:
                to_delete.add(concept["id"])
                found = True
        if not found:
            break
    
    concepts[:] = [c for c in concepts if c["id"] not in to_delete]
    
    relationships_to_keep = {}
    for key, value in relationships.items():
        source, target = key.split("->")
        if source not in to_delete and target not in to_delete:
            relationships_to_keep[key] = value
    graph_data["relationships"] = relationships_to_keep
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    return graph_data, True

def rename_concept(graph_data, old_id, new_id):
    concepts = graph_data["concepts"]
    relationships = graph_data.get("relationships", {})
    
    if any(c["id"] == new_id for c in concepts):
        return graph_data, False
    
    concept = next((c for c in concepts if c["id"] == old_id), None)
    if not concept:
        return graph_data, False
    
    concept["id"] = new_id
    
    for c in concepts:
        if c.get("parent") == old_id:
            c["parent"] = new_id
    
    new_relationships = {}
    for k, v in relationships.items():
        source, target = k.split("->")
        
        if source == old_id:
            source = new_id
        if target == old_id:
            target = new_id
            
        new_relationships[f"{source}->{target}"] = v
    
    graph_data["relationships"] = new_relationships
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    return graph_data, True

def insert_node_between(graph_data, parent_id, child_id, new_concept, calculate_similarity=False):
    concepts = graph_data["concepts"]
    
    if "relationships" not in graph_data:
        graph_data["relationships"] = {}
    relationships = graph_data["relationships"]
    
    if any(c["id"] == new_concept for c in concepts):
        return graph_data, False
    
    parent = next((c for c in concepts if c["id"] == parent_id), None)
    child = next((c for c in concepts if c["id"] == child_id), None)
    
    if not parent or not child:
        return graph_data, False
    
    new_level = parent.get("level", 0) + 1
    
    if child.get("level", 0) <= new_level:
        child["level"] = new_level + 1
    
    concepts.append({
        "id": new_concept,
        "level": new_level,
        "parent": parent_id
    })
    
    old_key = f"{parent_id}->{child_id}"
    old_similarity = relationships.get(old_key)
    
    child["parent"] = new_concept
    
    if calculate_similarity:
        parent_new_key = f"{parent_id}->{new_concept}"
        new_child_key = f"{new_concept}->{child_id}"
        
        try:
            parent_embedding = compute_embeddings([parent_id])[0]
            new_concept_embedding = compute_embeddings([new_concept])[0]
            parent_new_similarity = float((parent_embedding @ new_concept_embedding) * 100)
            relationships[parent_new_key] = parent_new_similarity
            
            child_embedding = compute_embeddings([child_id])[0]
            new_child_similarity = float((new_concept_embedding @ child_embedding) * 100)
            relationships[new_child_key] = new_child_similarity
        except Exception as e:
            print(f"Error calculating similarity: {e}")
            relationships[parent_new_key] = 70.0
            relationships[new_child_key] = 70.0  
    
    if old_key in relationships:
        del relationships[old_key]
    
    with open(Config.GRAPH_DATA_FILE, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    return graph_data, True

def prepare_d3_data(graph_data, using_similarities=False):
    concepts = graph_data["concepts"]
    relationships = graph_data.get("relationships", {})
    
    nodes = [{"id": c["id"], "level": c.get("level", 0), "group": c.get("level", 0)} 
             for c in concepts]
    
    links = []
    for c in concepts:
        if c.get("parent"):
            source = c["parent"]
            target = c["id"]
            key = f"{source}->{target}"
            
            if using_similarities:
                if key in relationships:
                    similarity = relationships[key]
                    dissonance = (100 - similarity) / 100
                    line_type = "dotted" if dissonance > 0.3 else "solid"
                else:
                    similarity = None  
                    dissonance = 0.3   
                    line_type = "solid"
            else:
                similarity = None
                dissonance = 0.3
                line_type = "solid"
            
            links.append({
                "source": source,
                "target": target,
                "similarity": similarity / 100 if similarity is not None else None,  
                "dissonance": dissonance,
                "value": dissonance,  
                "line_type": line_type,
                "key": key  
            })
    
    return {"nodes": nodes, "links": links}
