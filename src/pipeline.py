"""Execution pipeline for batch function calling with constrained decoding.

Reads inputs, runs decoding, validates outputs, and writes structured JSON.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, List

from llm_sdk.small_llm_model import Small_LLM_Model
from src.constrained_decoder import ConstrainedDecoder
from src.exceptions import (
    FunctionCallingError,
    InputFileNotFoundError,
    InvalidJSONInputError,
    SchemaValidationError,
)
from src.models import (
    ExecutionReport,
    FunctionCallResult,
    FunctionDefinition,
    PromptTest,
)


def load_json_file(file_path: str) -> Any:
    """Safely load and parse a JSON file with descriptive error handling.

    Args:
        file_path: Path to the target JSON file.

    Returns:
        Any: Parsed JSON data structure.

    Raises:
        InputFileNotFoundError: If the file does not exist.
        InvalidJSONInputError: If JSON syntax is invalid.
    """
    if not os.path.exists(file_path):
        raise InputFileNotFoundError(f"Input file not found at: {file_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as err:
        err_msg = (
            f"Failed to parse JSON '{file_path}': "
            f"{err.msg} at line {err.lineno}"
        )
        raise InvalidJSONInputError(err_msg) from err
    except Exception as err:
        raise FunctionCallingError(
            f"Error accessing file '{file_path}': {str(err)}"
        ) from err


def load_functions_definition(file_path: str) -> List[FunctionDefinition]:
    """Load and validate function definitions using Pydantic models.

    Args:
        file_path: Path to the functions definition JSON file.

    Returns:
        List[FunctionDefinition]: List of validated FunctionDefinition models.

    Raises:
        SchemaValidationError: If function definitions do not match schema.
    """
    raw_data = load_json_file(file_path)

    if not isinstance(raw_data, list):
        raise SchemaValidationError("Functions root must be a JSON array.")

    functions: List[FunctionDefinition] = []
    for item in raw_data:
        try:
            fn_def = FunctionDefinition.model_validate(item)
            functions.append(fn_def)
        except Exception as err:
            raise SchemaValidationError(
                f"Invalid function definition: {str(err)}"
            ) from err

    return functions


def load_test_prompts(file_path: str) -> List[PromptTest]:
    """Load and validate test prompt objects.

    Args:
        file_path: Path to the test prompts JSON file.

    Returns:
        List[PromptTest]: List of validated PromptTest instances.

    Raises:
        SchemaValidationError: If prompt objects are invalid.
    """
    raw_data = load_json_file(file_path)

    if not isinstance(raw_data, list):
        raise SchemaValidationError(
            "Test prompts file root must be a JSON array."
        )

    prompts: List[PromptTest] = []
    for idx, item in enumerate(raw_data):
        try:
            pt = PromptTest.model_validate(item)
            prompts.append(pt)
        except Exception as err:
            raise SchemaValidationError(
                f"Invalid prompt at index {idx}: {str(err)}"
            ) from err

    return prompts


def run_pipeline(
    functions_file: str,
    input_file: str,
    output_file: str,
    verbose: bool = True,
) -> ExecutionReport:
    """Run the complete function calling constrained decoding pipeline.

    Args:
        functions_file: Path to functions_definition.json.
        input_file: Path to function_calling_tests.json.
        output_file: Destination path for output JSON.
        verbose: Whether to log progress to stdout.

    Returns:
        ExecutionReport: Pydantic report containing execution metrics.
    """
    start_time = time.time()

    if verbose:
        print("=" * 60)
        print("42 Function Calling Pipeline with Constrained Decoding")
        print("=" * 60)
        print(f"Loading function definitions from: {functions_file}")

    functions = load_functions_definition(functions_file)
    if verbose:
        print(f"Loaded {len(functions)} valid function definitions.")
        print(f"Loading test prompts from: {input_file}")

    prompts = load_test_prompts(input_file)
    if verbose:
        print(f"Loaded {len(prompts)} test prompts.")

    model = Small_LLM_Model()
    decoder = ConstrainedDecoder(model=model, functions=functions)

    results: List[FunctionCallResult] = []

    for idx, item in enumerate(prompts, start=1):
        prompt_str = item.prompt
        result, steps = decoder.decode_prompt(prompt_str)
        results.append(result)

        if verbose:
            print(f"[{idx}/{len(prompts)}] Prompt: '{prompt_str}'")
            print(f"       -> Function: {result.name}")
            print(f"       -> Parameters: {result.parameters}")

    output_dir = os.path.dirname(os.path.abspath(output_file))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    serializable = [res.model_dump() for res in results]
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(serializable, f, indent=2, ensure_ascii=False)

    elapsed = time.time() - start_time
    if verbose:
        print("=" * 60)
        print(f"Processed {len(results)} prompts in {elapsed:.3f}s.")
        print(f"Results written to: {output_file}")
        print("=" * 60)

    return ExecutionReport(
        total_prompts=len(prompts),
        successful_calls=len(results),
        execution_time_seconds=elapsed,
        results=results,
    )
