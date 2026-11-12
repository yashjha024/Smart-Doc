from abc import ABC, abstractmethod
from typing import Dict, Any
from sqlalchemy.orm import Session

class BaseHandler(ABC):
    """
    Contract for processing handlers.
    Each handler must implement the execute method.
    """
    
    @classmethod
    @abstractmethod
    def execute(cls, job_id: str, db: Session, **kwargs) -> Dict[str, Any]:
        """
        Executes the processing task.
        Returns a dictionary with 'output_files' (list of stored references) and optional 'metadata'.
        Raise ValueError with a user-readable message for bad input.
        """
        pass
