from flask import Flask, redirect, url_for
import logging
from config import Config
from modules.graph import graph_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    logging.basicConfig(level=logging.DEBUG)
    app.logger.setLevel(logging.DEBUG)
    
    app.register_blueprint(graph_bp)
    
    app.logger.debug("Registered routes:")
    for rule in app.url_map.iter_rules():
        app.logger.debug(f"{rule.endpoint}: {rule.rule}")
    
    @app.route('/')
    def index():
        return redirect(url_for('graph.index'))
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)
