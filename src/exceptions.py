"""Custom exceptions for function calling constrained decoding.

Provides structured error handling for input reading, schema validation,
and decoding operations following 42 curriculum requirements.
"""

from __future__ import annotations


class FunctionCallingError(Exception):
    """Base exception for all function calling and decoding errors."""

    pass


class InputFileNotFoundError(FunctionCallingError):
    """Raised when an expected input or schema file cannot be found."""

    pass


class InvalidJSONInputError(FunctionCallingError):
    """Raised when input files contain malformed or unparseable JSON."""

    pass


class SchemaValidationError(FunctionCallingError):
    """Raised when a function definition or output fails schema check."""

    pass


class DecodingExecutionError(FunctionCallingError):
    """Raised when constrained decoding encounters unrecoverable state."""

    pass
