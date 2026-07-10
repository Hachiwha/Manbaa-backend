from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DomainEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: int = Field(ge=1)
    eventId: UUID
    eventType: str = Field(min_length=1)
    organizationId: UUID
    workspaceId: Optional[UUID] = None
    userId: UUID
    correlationId: UUID
    causationId: Optional[UUID] = None
    stateVersion: Optional[int] = Field(default=None, ge=0)
    timestamp: datetime
    payload: Dict[str, Any]
