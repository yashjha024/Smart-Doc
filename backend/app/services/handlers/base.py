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
        Returns a dictionary containing at least 'output_reference'.
        """
        pass
