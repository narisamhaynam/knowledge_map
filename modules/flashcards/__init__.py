import logging
from flask import Blueprint

logger = logging.getLogger(__name__)

flashcards_bp = Blueprint('flashcards', __name__, 
                        template_folder='templates',
                        static_folder='static',
                        url_prefix='/flashcards')

from . import routes

logger.debug("Flashcards module initialized")
