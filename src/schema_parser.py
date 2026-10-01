"""Schema parsing and grammar state machine for constrained JSON decoding.

Provides state transitions and schema-aware token validation.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field

from src.exceptions import SchemaValidationError
from src.models import FunctionDefinition


class GrammarState(str, Enum):
    """Enumeration of possible parser states during constrained generation."""

    START = "START"
    FUNCTION_NAME = "FUNCTION_NAME"
    AFTER_FUNCTION_NAME = "AFTER_FUNCTION_NAME"
    PARAM_KEY = "PARAM_KEY"
    PARAM_COLON = "PARAM_COLON"
    PARAM_VALUE = "PARAM_VALUE"
    PARAM_DELIMITER = "PARAM_DELIMITER"
    CLOSING_BRACKET = "CLOSING_BRACKET"
    FINISHED = "FINISHED"


class ParserContext(BaseModel):
    """Execution context tracking state during token-by-token decoding."""

    state: GrammarState = Field(default=GrammarState.START)
    selected_function: Optional[str] = Field(default=None)
    current_key: Optional[str] = Field(default=None)
    completed_keys: Set[str] = Field(default_factory=set)
    current_value_buffer: str = Field(default="")
    in_string_value: bool = Field(default=False)
    accumulated_text: str = Field(default="")


class SchemaGrammarEngine:
    """State machine enforcing JSON syntax and function calling schema."""

    def __init__(
        self,
        functions: List[FunctionDefinition],
        vocab: Dict[str, int],
    ) -> None:
        """Initialize engine with available functions and model vocabulary.

        Args:
            functions: List of valid callable function definitions.
            vocab: Mapping from token string to vocabulary token ID.
        """
        self.functions: Dict[str, FunctionDefinition] = {
            f.name: f for f in functions
        }
        self.vocab: Dict[str, int] = vocab
        self.id_to_token: Dict[int, str] = {
            idx: tok for tok, idx in vocab.items()
        }

        if not self.functions:
            raise SchemaValidationError("Function definitions required.")

    def get_valid_token_ids(
        self,
        context: ParserContext,
        prompt_text: str,
    ) -> List[int]:
        """Compute valid token IDs allowed at current grammar state.

        Args:
            context: Current decoding parser context state.
            prompt_text: Original user prompt providing grounding context.

        Returns:
            List[int]: List of token IDs permitted to be selected next.
        """
        valid_ids: List[int] = []

        if context.state == GrammarState.START:
            prefixes = ['{"name": "', '{"name":', '{"', '{']
            for p in prefixes:
                if p in self.vocab:
                    valid_ids.append(self.vocab[p])

        elif context.state == GrammarState.FUNCTION_NAME:
            for fn_name in self.functions.keys():
                full_lit = f'"{fn_name}"'
                if full_lit in self.vocab:
                    valid_ids.append(self.vocab[full_lit])
                if fn_name in self.vocab:
                    valid_ids.append(self.vocab[fn_name])

        elif context.state == GrammarState.AFTER_FUNCTION_NAME:
            transitions = [
                '", "parameters": {',
                '", "parameters":{',
                ', "parameters": {',
            ]
            for t in transitions:
                if t in self.vocab:
                    valid_ids.append(self.vocab[t])

        elif context.state == GrammarState.PARAM_KEY:
            if not context.selected_function:
                return []
            fn = self.functions[context.selected_function]
            all_props = fn.parameters.properties
            remaining_keys = [
                k for k in all_props.keys()
                if k not in context.completed_keys
            ]

            if not remaining_keys:
                if "}" in self.vocab:
                    valid_ids.append(self.vocab["}"])
            else:
                for k in remaining_keys:
                    quoted_key = f'"{k}"'
                    if quoted_key in self.vocab:
                        valid_ids.append(self.vocab[quoted_key])
                    if k in self.vocab:
                        valid_ids.append(self.vocab[k])

        elif context.state == GrammarState.PARAM_COLON:
            for c in (': ', ':', '": '):
                if c in self.vocab:
                    valid_ids.append(self.vocab[c])

        elif context.state == GrammarState.PARAM_VALUE:
            if not context.selected_function or not context.current_key:
                return []
            fn = self.functions[context.selected_function]
            prop = fn.parameters.properties.get(context.current_key)
            if not prop:
                return []

            param_type = prop.type.lower()
            if param_type in ("number", "integer"):
                digits = [
                    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-"
                ]
                for d in digits:
                    if d in self.vocab:
                        valid_ids.append(self.vocab[d])
            elif param_type == "string":
                if not context.in_string_value:
                    if '"' in self.vocab:
                        valid_ids.append(self.vocab['"'])
                else:
                    if context.current_value_buffer and '"' in self.vocab:
                        valid_ids.append(self.vocab['"'])
            elif param_type == "boolean":
                for b in ("true", "false"):
                    if b in self.vocab:
                        valid_ids.append(self.vocab[b])

        elif context.state == GrammarState.PARAM_DELIMITER:
            if not context.selected_function:
                return []
            fn = self.functions[context.selected_function]
            remaining = [
                k for k in fn.parameters.properties.keys()
                if k not in context.completed_keys
            ]
            if remaining:
                for d in (', ', ',', '", "'):
                    if d in self.vocab:
                        valid_ids.append(self.vocab[d])
            else:
                for c in ('}', '}}', '"}}', '}\n'):
                    if c in self.vocab:
                        valid_ids.append(self.vocab[c])

        elif context.state == GrammarState.CLOSING_BRACKET:
            for c in ('}', '}\n', '<|endoftext|>'):
                if c in self.vocab:
                    valid_ids.append(self.vocab[c])

        seen: Set[int] = set()
        unique_ids: List[int] = []
        for vid in valid_ids:
            if vid not in seen:
                seen.add(vid)
                unique_ids.append(vid)

        return unique_ids
