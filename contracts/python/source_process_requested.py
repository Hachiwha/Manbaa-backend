from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

SUPPORTED_SOURCE_MIME_TYPES = frozenset(
    {
        "text/plain",
        "text/markdown",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)


class _StrictContract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceProcessRequestedActor(_StrictContract):
    type: Literal["user", "service"]
    id: str = Field(min_length=1, max_length=255)


class SourceProcessRequestedPayload(_StrictContract):
    source_id: UUID
    source_version_id: UUID
    storage_bucket: Literal["workspace-sources"]
    storage_key: str = Field(min_length=1, max_length=1024)
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str
    size_bytes: StrictInt = Field(ge=0)
    checksum_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        if (
            value in {".", ".."}
            or "/" in value
            or "\\" in value
            or any(ord(character) < 32 or ord(character) == 127 for character in value)
            or len(value.encode("utf-8")) > 255
        ):
            raise ValueError("filename must be a safe basename of at most 255 UTF-8 bytes")
        return value

    @field_validator("mime_type")
    @classmethod
    def validate_mime_type(cls, value: str) -> str:
        if value not in SUPPORTED_SOURCE_MIME_TYPES:
            raise ValueError(f"Unsupported source MIME type: {value!r}")
        return value


class SourceProcessRequestedEvent(_StrictContract):
    event_id: UUID
    event_type: Literal["workspace.source.process.requested"]
    occurred_at: datetime
    organization_id: UUID
    workspace_id: UUID
    project_id: UUID | None
    correlation_id: UUID
    causation_id: UUID | None
    actor: SourceProcessRequestedActor
    payload: SourceProcessRequestedPayload

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_storage_key(self) -> SourceProcessRequestedEvent:
        payload = self.payload
        expected_key = (
            f"organizations/{self.organization_id}/workspaces/{self.workspace_id}/"
            f"sources/{payload.source_id}/versions/{payload.source_version_id}/"
            f"{payload.filename}"
        )
        if payload.storage_key != expected_key:
            raise ValueError("storage_key must exactly match the canonical tenant source path")
        return self
