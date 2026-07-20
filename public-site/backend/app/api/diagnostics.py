from datetime import datetime, timezone
from typing import Any, Dict, Optional
import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


class ClientDiagnosticEvent(BaseModel):
    message: str = Field(..., max_length=2000)
    source: str = Field("frontend", max_length=100)
    level: str = Field("error", max_length=20)
    url: Optional[str] = Field(None, max_length=2000)
    user_agent: Optional[str] = Field(None, max_length=1000)
    stack: Optional[str] = Field(None, max_length=8000)
    component_stack: Optional[str] = Field(None, max_length=8000)
    extra: Dict[str, Any] = Field(default_factory=dict)


@router.post("/client-error")
async def log_client_error(event: ClientDiagnosticEvent, request: Request):
    """Receive browser-side diagnostics so frontend blank screens appear in backend logs."""
    logger.error(
        "client_diagnostic level=%s source=%s url=%s message=%s stack=%s component_stack=%s extra=%s ip=%s user_agent=%s received_at=%s",
        event.level,
        event.source,
        event.url,
        event.message,
        event.stack,
        event.component_stack,
        event.extra,
        request.client.host if request.client else None,
        event.user_agent,
        datetime.now(timezone.utc).isoformat(),
    )
    return {"logged": True}
