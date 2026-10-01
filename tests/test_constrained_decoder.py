"""Unit tests for ConstrainedDecoder and token logit masking."""

from typing import List, Tuple
import pytest

from llm_sdk.small_llm_model import Small_LLM_Model
from src.constrained_decoder import ConstrainedDecoder
from src.models import FunctionDefinition
from src.pipeline import load_functions_definition


@pytest.fixture
def test_setup() -> Tuple[Small_LLM_Model, List[FunctionDefinition]]:
    """Fixture providing model and loaded functions."""
    model = Small_LLM_Model()
    functions = load_functions_definition(
        "data/input/functions_definition.json"
    )
    return model, functions


def test_decoder_add_numbers(
    test_setup: Tuple[Small_LLM_Model, List[FunctionDefinition]]
) -> None:
    """Test constrained decoding for addition prompt."""
    model, functions = test_setup
    decoder = ConstrainedDecoder(model=model, functions=functions)
    result, steps = decoder.decode_prompt("What is the sum of 40 and 2?")
    assert result.name == "fn_add_numbers"
    assert result.parameters == {"a": 40, "b": 2}
    assert len(steps) > 0


def test_decoder_greet(
    test_setup: Tuple[Small_LLM_Model, List[FunctionDefinition]]
) -> None:
    """Test constrained decoding for greeting prompt."""
    model, functions = test_setup
    decoder = ConstrainedDecoder(model=model, functions=functions)
    result, steps = decoder.decode_prompt("Greet shrek")
    assert result.name == "fn_greet"
    assert result.parameters == {"name": "shrek"}


def test_decoder_reverse_string(
    test_setup: Tuple[Small_LLM_Model, List[FunctionDefinition]]
) -> None:
    """Test constrained decoding for reverse string prompt."""
    model, functions = test_setup
    decoder = ConstrainedDecoder(model=model, functions=functions)
    result, steps = decoder.decode_prompt("Reverse the string 'hello'")
    assert result.name == "fn_reverse_string"
    assert result.parameters == {"text": "hello"}


def test_decoder_prime_check(
    test_setup: Tuple[Small_LLM_Model, List[FunctionDefinition]]
) -> None:
    """Test constrained decoding for prime check prompt."""
    model, functions = test_setup
    decoder = ConstrainedDecoder(model=model, functions=functions)
    prompt = "Can you check if 29 is a prime number?"
    result, steps = decoder.decode_prompt(prompt)
    assert result.name == "fn_is_prime"
    assert result.parameters == {"n": 29}
