# Knowledge Graph Explorer

## Overview

Knowledge Graph Explorer is a web application for creating, visualizing, and interacting with concept hierarchies. Built with Flask and D3.js, it provides an intuitive interface to generate, explore, and manipulate knowledge graphs on any topic. The application leverages AI through the Claude API to automatically generate related concepts and suggest hierarchical relationships.

## Features

- **Interactive Visualization**: Dynamic force-directed graph visualization with D3.js
- **AI-Powered Graph Generation**: Automatically generate concept hierarchies on any topic
- **Concept Management**: Add, rename, delete, and rearrange concepts within the graph
- **Semantic Analysis**: Calculate and visualize semantic similarity between related concepts
- **Context Menu Interactions**: Right-click functionality for node and edge operations
- **Responsive Layout**: Auto-organizing layout that maintains conceptual relationships
- **Modular Architecture**: Flask blueprint-based architecture for extensibility

## Technology Stack

- **Backend**: Python 3.8+, Flask 2.x
- **Frontend**: JavaScript (ES6), D3.js 7.x
- **AI Integration**: Claude API for concept generation
- **Embeddings**: Sentence Transformers for semantic similarity calculation
- **Data Storage**: JSON-based persistence

## Installation

### Prerequisites

- [Anaconda](https://www.anaconda.com/products/distribution) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/knowledge-graph-explorer.git
   cd knowledge-graph-explorer
   ```

2. Create and activate the conda environment:
   ```bash
   conda env create -f environment.yml
   conda activate knowledge-graph-env  # Or whatever name is specified in your YAML file
   ```

3. Create the directory structure:
   ```bash
   python create_structure.py
   ```

4. Set up Claude API credentials in `config.py` or as environment variables:
   ```bash
   # In config.py
   CLAUDE_API_KEY = "your_claude_api_key"
   
   # Or as environment variable
   export CLAUDE_API_KEY=your_claude_api_key
   ```

## Configuration

The application can be configured through `config.py`:

```python
class Config:
    # API Settings
    CLAUDE_API_KEY = "your_claude_api_key"  # Or use os.environ.get('CLAUDE_API_KEY')
    CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
    
    # Application Settings
    DATA_DIR = Path("data")
    GRAPH_DATA_FILE = Path("data/concept_graph_data.json")
    
    # Web Server Settings
    DEBUG = True
    PORT = 5001
```

## Environment Setup

Here's an example of what your `environment.yml` file might look like:

```yaml
name: knowledge-graph-env
channels:
  - conda-forge
  - defaults
dependencies:
  - python=3.9
  - flask=2.0
  - pip
  - numpy
  - requests
  - pip:
    - sentence-transformers
    - "torch>=1.9.0"
```

## Usage

1. Start the application:
   ```bash
   python app.py
   ```

2. Navigate to `http://localhost:5001` in your browser.

3. Enter a topic in the input field and press "Change Topic" to generate a new knowledge graph.

4. Interact with the graph:
   - Click on nodes to view relationship details
   - Right-click on nodes for context menu options
   - Use the zoom controls to navigate the graph
   - Toggle semantic similarity visualization with the switch
   - Drag nodes to rearrange the layout (except the root node)

## Architecture

The application follows a modular architecture using Flask blueprints:

```
knowledge_graph_app/
├── app.py                  # Main application file
├── config.py               # Configuration settings
├── environment.yml         # Conda environment specification
├── create_structure.py     # Script to create directory structure
├── data/                   # Data storage
│   └── concept_graph_data.json
└── modules/                # Application modules
    ├── graph/              # Graph module
    │   ├── __init__.py     # Blueprint initialization
    │   ├── routes.py       # API endpoints
    │   ├── utils.py        # Backend utilities
    │   ├── templates/      # HTML templates
    │   │   └── graph.html  # Main graph template
    │   └── static/         # Static assets
    │       ├── js/
    │       │   └── graph.js
    │       └── css/
    │           └── graph.css
    └── future_modules/     # Placeholder for future extensions
```

### Key Components

- **app.py**: Flask application initialization and blueprint registration
- **graph module**: Self-contained blueprint for graph functionality
  - **__init__.py**: Blueprint definition and initialization
  - **routes.py**: API endpoint handlers
  - **utils.py**: Backend utilities for concept generation and analysis
  - **templates/graph.html**: Main frontend template
  - **static/js/graph.js**: D3.js visualization and interaction logic
  - **static/css/graph.css**: Styling for the graph interface

## API Endpoints

The application provides the following RESTful endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main graph visualization view |
| `/get_graph_data` | GET | Retrieve graph data for visualization |
| `/add_concept` | POST | Add a new concept to the graph |
| `/auto_add_term` | POST | Add a term with AI-suggested placement |
| `/expand_node` | POST | Expand a node with AI-generated concepts |
| `/delete_concept` | POST | Delete a concept and its descendants |
| `/rename_concept` | POST | Rename a concept |
| `/insert_node` | POST | Insert a node between two existing nodes |

## Core Functionality

### Graph Initialization and Centering

The application uses D3.js force-directed graph layout with custom physics to ensure the graph is properly organized:

- The root node (core topic) is fixed at the center of the visualization
- Child nodes organize in radial layers around the root
- Strong repulsion forces ensure even distribution of nodes
- Node positions are based on their hierarchical level in the concept tree

### Concept Generation

Concept generation leverages the Claude API to:

1. Create an initial hierarchical concept tree on a given topic
2. Suggest appropriate parent nodes for new terms
3. Generate additional related concepts when expanding nodes
4. Calculate semantically meaningful relationships

### Semantic Similarity

The application uses Sentence Transformers to:

1. Generate embeddings for concepts
2. Calculate semantic similarity between parent-child pairs
3. Visualize relationship strength through link attributes
4. Identify conceptual dissonance in the hierarchy

## Development

### Extending the Application

To add a new feature module:

1. Create a new directory in `modules/`
2. Define a blueprint in `__init__.py`
3. Implement routes and utilities
4. Register the blueprint in `app.py`

Example of a new module initialization:

```python
from flask import Blueprint

new_feature_bp = Blueprint(
    'new_feature', 
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/new_feature/static'
)

from modules.new_feature import routes
```

### Customizing the Graph Visualization

The D3.js visualization can be extended by modifying `graph.js`:

```javascript
// Add custom forces to the simulation
setupForceSimulation() {
    // ... existing code ...
    
    // Add a new custom force
    .force('myCustomForce', myCustomForceFunction())
    
    // ... rest of the function ...
}

// Add new node visual elements
createVisualElements(g) {
    // ... existing code ...
    
    // Add custom decorators to nodes
    this.elements.node
        .append('circle')
        .attr('class', 'node-indicator')
        .attr('r', 5)
        .attr('cx', 15)
        .attr('cy', 0);
        
    // ... rest of the function ...
}
```

## Performance Considerations

For large graphs (>100 nodes), consider:

1. Adjusting the simulation parameters to reduce computational load
2. Implementing node collapsing/expanding for hierarchical navigation
3. Using WebGL rendering for better performance with large node counts
4. Implementing pagination or lazy-loading for API responses

## Troubleshooting

### Common Issues

- **Graph not rendering**: Check browser console for JavaScript errors
- **API connection fails**: Verify your Claude API key in config.py
- **Nodes overlap or cluster**: Adjust force parameters in setupForceSimulation()
- **Embedding model fails to load**: Ensure conda environment includes all dependencies
