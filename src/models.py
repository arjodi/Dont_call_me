"""Pydantic data models for function schemas, inputs, and outputs.

Adheres strictly to the requirement that all classes use Pydantic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ParameterProperty(BaseModel):
    """Specification of an individual function parameter property."""

    type: str = Field(
        description="Data type of the parameter, e.g. number, string"
    )
    description: Optional[str] = Field(
        default=None, description="Human readable parameter explanation"
    )


class ParametersSchema(BaseModel):
    """Schema container describing parameter object of a function."""

    type: str = Field(
        default="object", description="Type of the container"
    )
    properties: Dict[str, ParameterProperty] = Field(
        default_factory=dict, description="Parameter property schemas"
    )
    required: List[str] = Field(
        default_factory=list, description="List of required parameter keys"
    )


class ReturnSchema(BaseModel):
    """Specification of a function's return value."""

    type: str = Field(
        default="any", description="Data type of return value"
    )
    description: Optional[str] = Field(
        default=None, description="Explanation of the return value"
    )


class FunctionDefinition(BaseModel):
    """Definition of an available callable tool or function."""

    name: str = Field(description="Unique function identifier")
    description: str = Field(
        description="Description of function capability and usage"
    )
    parameters: ParametersSchema = Field(
        default_factory=ParametersSchema,
        description="JSON schema describing arguments",
    )
    returns: Optional[ReturnSchema] = Field(
        default=None, description="Schema describing return structure"
    )


class PromptTest(BaseModel):
    """Natural language prompt test case item."""

    prompt: str = Field(description="Raw natural language user query")


class FunctionCallResult(BaseModel):
    """Structured function call output matching the 42 specification."""

    prompt: str = Field(description="The original natural-language request")
    name: str = Field(description="The name of the function to call")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="All required arguments with the correct types",
    )


class CandidateLogit(BaseModel):
    """Representation of an individual token candidate and its logits."""

    token_id: int = Field(description="Integer ID of token in vocabulary")
    token_str: str = Field(description="Decoded string of token")
    raw_logit: float = Field(description="Model logit before mask")
    masked_logit: float = Field(description="Logit after constrained mask")
    is_valid: bool = Field(description="Whether token complies with schema")


class DecodedTokenStep(BaseModel):
    """Step trace of a single token generation during constrained decoding."""

    step_index: int = Field(description="0-based index of decoding step")
    chosen_token_id: int = Field(description="Token ID selected by argmax")
    chosen_token_str: str = Field(description="String of selected token")
    grammar_state: str = Field(description="State of grammar at this step")
    top_candidates: List[CandidateLogit] = Field(
        default_factory=list, description="Top candidates at this step"
    )
    accumulated_json: str = Field(description="JSON generated so far")


class ExecutionReport(BaseModel):
    """Summary of batch processing across test prompts."""

    total_prompts: int = Field(description="Total prompts processed")
    successful_calls: int = Field(description="Valid calls produced")
    execution_time_seconds: float = Field(description="Execution time")
    results: List[FunctionCallResult] = Field(
        default_factory=list, description="List of generated function calls"
    )
