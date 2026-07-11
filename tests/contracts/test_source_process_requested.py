from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, cast

import pytest
from pydantic import ValidationError

from contracts.python import SourceProcessRequestedEvent

FIXTURE = Path(__file__).parents[2] / "contracts" / "fixtures" / "source-process-requested.json"


def fixture() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(FIXTURE.read_text(encoding="utf-8")))


def test_typescript_fixture_exactly_matches_authoritative_python_contract() -> None:
    raw = fixture()
    event = SourceProcessRequestedEvent.model_validate(raw)

    assert event.model_dump(mode="json") == raw
    assert event.event_type == "workspace.source.process.requested"
    assert event.payload.storage_bucket == "workspace-sources"
    assert event.payload.checksum_sha256 == (
        "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447"
    )


@pytest.mark.parametrize("field", ["project_id", "causation_id"])
def test_nullable_envelope_fields_remain_required(field: str) -> None:
    raw = fixture()
    assert raw[field] is None or field == "project_id"
    raw.pop(field)

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize("location", ["envelope", "actor", "payload"])
def test_unknown_fields_are_rejected_recursively(location: str) -> None:
    raw = fixture()
    target = raw if location == "envelope" else raw[location]
    target["unexpected"] = True

    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize(
    ("snake_name", "camel_name"),
    [
        ("event_id", "eventId"),
        ("organization_id", "organizationId"),
        ("source_id", "sourceId"),
        ("checksum_sha256", "checksumSha256"),
    ],
)
def test_camel_case_transport_fields_are_rejected(snake_name: str, camel_name: str) -> None:
    raw = fixture()
    target = raw["payload"] if snake_name in raw["payload"] else raw
    target[camel_name] = target.pop(snake_name)

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize(
    "checksum",
    ["a" * 63, "A" * 64, "g" * 64],
)
def test_invalid_checksums_are_rejected(checksum: str) -> None:
    raw = fixture()
    raw["payload"]["checksum_sha256"] = checksum

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize("size", [-1, "12", True, 1.5])
def test_size_is_a_non_negative_strict_integer(size: object) -> None:
    raw = fixture()
    raw["payload"]["size_bytes"] = size

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("event_type", "workspace.source.processing"),
        ("occurred_at", "2026-07-10T12:00:00"),
    ],
)
def test_invalid_envelope_values_are_rejected(field: str, value: object) -> None:
    raw = fixture()
    raw[field] = value

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("storage_bucket", "other-bucket"),
        ("mime_type", "image/png"),
        ("filename", "../brief.txt"),
    ],
)
def test_invalid_payload_values_are_rejected(field: str, value: object) -> None:
    raw = fixture()
    raw["payload"][field] = value

    with pytest.raises(ValidationError):
        SourceProcessRequestedEvent.model_validate(raw)


@pytest.mark.parametrize(
    ("field", "replacement"),
    [
        ("organization_id", "99999999-9999-4999-8999-999999999999"),
        ("workspace_id", "99999999-9999-4999-8999-999999999999"),
        ("source_id", "99999999-9999-4999-8999-999999999999"),
        ("source_version_id", "99999999-9999-4999-8999-999999999999"),
        ("filename", "other.txt"),
    ],
)
def test_storage_key_must_match_every_scope_component(field: str, replacement: str) -> None:
    raw = fixture()
    target = raw["payload"] if field in raw["payload"] else raw
    target[field] = replacement

    with pytest.raises(ValidationError, match="canonical tenant source path"):
        SourceProcessRequestedEvent.model_validate(raw)


def test_nullable_fields_and_service_actor_are_accepted() -> None:
    raw = deepcopy(fixture())
    raw["project_id"] = None
    raw["causation_id"] = None
    raw["actor"] = {"type": "service", "id": "document-worker"}

    event = SourceProcessRequestedEvent.model_validate(raw)
    assert event.project_id is None
    assert event.causation_id is None
    assert event.actor.type == "service"
