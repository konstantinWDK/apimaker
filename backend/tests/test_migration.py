"""Tests for the JSON migration script — camelCase → snake_case conversion."""

import json
import tempfile
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from migrate_json_to_db import _camel_to_snake, _convert_keys


def test_camel_to_snake_simple() -> None:
    assert _camel_to_snake("sampleRows") == "sample_rows"
    assert _camel_to_snake("authMethod") == "auth_method"
    assert _camel_to_snake("targetStack") == "target_stack"
    assert _camel_to_snake("operationType") == "operation_type"
    assert _camel_to_snake("sourceType") == "source_type"


def test_camel_to_snake_already_snake() -> None:
    assert _camel_to_snake("sample_rows") == "sample_rows"
    assert _camel_to_snake("id") == "id"
    assert _camel_to_snake("name") == "name"


def test_camel_to_snake_acronym() -> None:
    assert _camel_to_snake("APIKey") == "api_key"
    assert _camel_to_snake("JWTSecret") == "jwt_secret"


def test_convert_keys_dict() -> None:
    data = {
        "sampleRows": [{"pokemonId": 1, "pokemonName": "Pikachu"}],
        "authMethod": "none",
        "targetStack": "fastapi",
    }
    result = _convert_keys(data)
    assert "sample_rows" in result
    assert "auth_method" in result
    assert "target_stack" in result
    assert "sampleRows" not in result
    assert result["sample_rows"][0]["pokemon_id"] == 1
    assert result["sample_rows"][0]["pokemon_name"] == "Pikachu"


def test_convert_keys_list() -> None:
    data = [
        {"projectName": "Demo", "apiKey": "xyz"},
        {"projectName": "Test", "apiKey": "abc"},
    ]
    result = _convert_keys(data)
    assert len(result) == 2
    assert result[0]["project_name"] == "Demo"
    assert result[0]["api_key"] == "xyz"


def test_convert_keys_nested() -> None:
    data = {
        "dataset": {
            "sourceType": "upload",
            "sampleRows": [],
            "fieldSchema": {"fieldName": "id", "isPrimaryKey": True},
        }
    }
    result = _convert_keys(data)
    assert result["dataset"]["source_type"] == "upload"
    assert result["dataset"]["field_schema"]["field_name"] == "id"
    assert result["dataset"]["field_schema"]["is_primary_key"] is True


def test_convert_keys_mixed_case_preserves_values() -> None:
    """Verify values are preserved correctly after key conversion."""
    data = {
        "sampleRows": [
            {"pokedexId": 25, "name": "Pikachu", "isLegendary": False},
        ]
    }
    result = _convert_keys(data)
    assert result["sample_rows"][0]["pokedex_id"] == 25
    assert result["sample_rows"][0]["name"] == "Pikachu"
    assert result["sample_rows"][0]["is_legendary"] is False


def test_convert_keys_full_project_json() -> None:
    """Test conversion with a realistic project JSON structure."""
    project = {
        "id": "proj-1",
        "name": "Pokédex demo",
        "authMethod": "none",
        "targetStack": "fastapi",
        "dataset": {
            "id": "ds-1",
            "name": "pokemon",
            "sourceType": "upload",
            "fields": [
                {"id": "f-1", "name": "pokedex_id", "type": "integer", "required": True},
                {"id": "f-2", "name": "name", "type": "string", "required": True},
            ],
            "sampleRows": [
                {"pokedexId": 25, "name": "Pikachu", "type": "electric"},
                {"pokedexId": 6, "name": "Charizard", "type": "fire"},
            ],
        },
        "endpoints": [
            {"id": "ep-1", "name": "List", "method": "GET", "path": "/pokemon", "operationType": "list"},
        ],
    }
    result = _convert_keys(project)
    assert result["auth_method"] == "none"
    assert result["target_stack"] == "fastapi"
    assert result["dataset"]["source_type"] == "upload"
    assert result["dataset"]["sample_rows"][0]["pokedex_id"] == 25
    assert result["endpoints"][0]["operation_type"] == "list"
