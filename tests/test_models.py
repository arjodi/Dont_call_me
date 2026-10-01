"""Unit tests for Pydantic data models and schemas."""

from src.models import (
    FunctionCallResult,
    FunctionDefinition,
    ParameterProperty,
    ParametersSchema,
    PromptTest,
)


def test_parameter_property_valid() -> None:
    """Test valid parameter property construction."""
    prop = ParameterProperty(type="number", description="A test number")
    assert prop.type == "number"
    assert prop.description == "A test number"


def test_parameters_schema_default() -> None:
    """Test parameter schema defaults."""
    schema = ParametersSchema()
    assert schema.type == "object"
    assert schema.properties == {}
    assert schema.required == []


def test_function_definition_valid() -> None:
    """Test valid function definition instantiation."""
    fn = FunctionDefinition(
        name="fn_test",
        description="A test function",
        parameters=ParametersSchema(
            properties={"x": ParameterProperty(type="string")},
            required=["x"],
        ),
    )
    assert fn.name == "fn_test"
    assert "x" in fn.parameters.properties


def test_prompt_test_valid() -> None:
    """Test valid prompt test structure."""
    pt = PromptTest(prompt="What is 1 + 1?")
    assert pt.prompt == "What is 1 + 1?"


def test_function_call_result_serialization() -> None:
    """Test function call result serialization."""
    res = FunctionCallResult(
        prompt="What is 2 + 2?",
        name="fn_add_numbers",
        parameters={"a": 2, "b": 2},
    )
    dumped = res.model_dump()
    assert dumped["prompt"] == "What is 2 + 2?"
    assert dumped["name"] == "fn_add_numbers"
    assert dumped["parameters"]["a"] == 2
