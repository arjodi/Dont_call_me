"""Unit tests for the end-to-end pipeline and file error handling."""

import os
import pytest

from src.exceptions import InputFileNotFoundError
from src.pipeline import load_json_file, run_pipeline


def test_load_json_file_missing() -> None:
    """Test handling of non-existent JSON files."""
    with pytest.raises(InputFileNotFoundError):
        load_json_file("data/input/non_existent_file.json")


def test_pipeline_execution_temp_output(tmp_path: str) -> None:
    """Test execution of run_pipeline writing to temporary directory."""
    temp_output = os.path.join(tmp_path, "test_output.json")
    report = run_pipeline(
        functions_file="data/input/functions_definition.json",
        input_file="data/input/function_calling_tests.json",
        output_file=temp_output,
        verbose=False,
    )
    assert report.total_prompts == 10
    assert report.successful_calls == 10
    assert os.path.exists(temp_output)
