from flask import Blueprint

graph_bp = Blueprint(
    'graph', 
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/graph/static'
)

from modules.graph import routes
