import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from contracts.python import DomainEvent

FIXTURE = Path(__file__).parents[2] / "contracts" / "fixtures" / "domain-event.json"


def test_typescript_fixture_matches_pydantic_contract() -> None:
    event = DomainEvent(**json.loads(FIXTURE.read_text()))
    assert event.schemaVersion == 1
    assert event.eventType == "workspace.ai.task.requested"


def test_unknown_envelope_fields_are_rejected() -> None:
    payload = json.loads(FIXTURE.read_text())
    payload["unexpected"] = True
    with pytest.raises(ValidationError):
        DomainEvent(**payload)
