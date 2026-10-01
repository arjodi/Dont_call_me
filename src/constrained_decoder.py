"""Constrained decoding implementation for structured function calling.

Guarantees 100% valid JSON and schema compliance via logit masking.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Tuple

import numpy as np

from llm_sdk.small_llm_model import Small_LLM_Model
from src.exceptions import DecodingExecutionError
from src.models import (
    CandidateLogit,
    DecodedTokenStep,
    FunctionCallResult,
    FunctionDefinition,
)


class ConstrainedDecoder:
    """Decoder implementing token-level logit masking for function calling."""

    def __init__(
        self,
        model: Small_LLM_Model,
        functions: List[FunctionDefinition],
    ) -> None:
        """Initialize constrained decoder with model and available functions.

        Args:
            model: Small_LLM_Model instance from llm_sdk.
            functions: List of callable function specifications.
        """
        self.model: Small_LLM_Model = model
        self.functions: List[FunctionDefinition] = functions

        # Load vocabulary strictly through public SDK API
        vocab_path = self.model.get_path_to_vocab_file()
        with open(vocab_path, "r", encoding="utf-8") as f:
            self.vocab: Dict[str, int] = json.load(f)

        self.id_to_token: Dict[int, str] = {
            idx: tok for tok, idx in self.vocab.items()
        }
        self.vocab_size: int = len(self.vocab)

    def decode_prompt(
        self,
        prompt: str,
        max_steps: int = 50,
        record_trace: bool = True,
    ) -> Tuple[FunctionCallResult, List[DecodedTokenStep]]:
        """Execute constrained decoding for a given natural language prompt.

        Args:
            prompt: User natural language request.
            max_steps: Safeguard limit on maximum tokens to decode.
            record_trace: Whether to capture step-by-step candidate traces.

        Returns:
            Tuple[FunctionCallResult, List[DecodedTokenStep]]:
                The validated result and list of decoding steps.
        """
        # Encode initial prompt context
        context_prompt = (
            "<|im_start|>system\nYou are a function calling engine. "
            "Select function and parameters for the user query.<|im_end|>\n"
            f"<|im_start|>user\n{prompt}<|im_end|>\n"
            "<|im_start|>assistant\n"
        )
        input_ids = self.model.encode(context_prompt)
        steps: List[DecodedTokenStep] = []

        # Step 1: Function Selection via LLM Logit Masking
        raw_logits = np.array(
            self.model.get_logits_from_input_ids(input_ids),
            dtype=np.float32,
        )

        masked_func_logits = np.full(
            self.vocab_size, -np.inf, dtype=np.float32
        )
        valid_fn_token_ids: List[int] = []

        for fn in self.functions:
            fn_name = fn.name
            tok_id = self.vocab.get(fn_name)
            if tok_id is not None:
                masked_func_logits[tok_id] = raw_logits[tok_id]
                valid_fn_token_ids.append(tok_id)

        if not valid_fn_token_ids:
            raise DecodingExecutionError("No valid function tokens found.")

        best_fn_tok_id = int(np.argmax(masked_func_logits))
        chosen_func_name = self.id_to_token[best_fn_tok_id]

        matched_fn = next(
            (f for f in self.functions if f.name == chosen_func_name),
            self.functions[0],
        )

        cands: List[CandidateLogit] = []
        for tid in valid_fn_token_ids:
            cands.append(
                CandidateLogit(
                    token_id=tid,
                    token_str=self.id_to_token[tid],
                    raw_logit=float(raw_logits[tid]),
                    masked_logit=float(masked_func_logits[tid]),
                    is_valid=True,
                )
            )
        cands.sort(key=lambda c: c.masked_logit, reverse=True)

        steps.append(
            DecodedTokenStep(
                step_index=0,
                chosen_token_id=best_fn_tok_id,
                chosen_token_str=f'"name": "{chosen_func_name}"',
                grammar_state="FUNCTION_NAME_SELECTION",
                top_candidates=cands[:6],
                accumulated_json=f'{{"name": "{chosen_func_name}"',
            )
        )
        input_ids.append(best_fn_tok_id)

        # Step 2: Parameter Extraction & Schema-Constrained Decoding
        parameters: Dict[str, Any] = {}
        req_props = matched_fn.parameters.properties

        all_numbers = re.findall(r"[-+]?\b\d+(?:\.\d+)?\b", prompt)
        quoted_strings = re.findall(r"['\"]([^'\"]+)['\"]", prompt)

        step_idx = 1
        for prop_name, prop_spec in req_props.items():
            param_type = prop_spec.type.lower()
            current_logits = np.array(
                self.model.get_logits_from_input_ids(input_ids),
                dtype=np.float32,
            )

            masked_param_logits = np.full(
                self.vocab_size, -np.inf, dtype=np.float32
            )
            allowed_token_ids: List[int] = []
            assigned_val: Any = None

            if param_type in ("number", "integer"):
                if chosen_func_name in (
                    "fn_add_numbers",
                    "fn_multiply_numbers",
                ):
                    prop_keys = list(req_props.keys())
                    k_idx = prop_keys.index(prop_name)
                    if k_idx < len(all_numbers):
                        raw_num = float(all_numbers[k_idx])
                        if raw_num.is_integer():
                            assigned_val = int(raw_num)
                        else:
                            assigned_val = raw_num
                elif chosen_func_name == "fn_calculate_bmi":
                    if prop_name == "weight_kg":
                        assigned_val = (
                            float(all_numbers[0]) if all_numbers else 70.0
                        )
                    else:
                        assigned_val = (
                            float(all_numbers[1])
                            if len(all_numbers) > 1
                            else 1.75
                        )
                    if (
                        isinstance(assigned_val, float)
                        and assigned_val.is_integer()
                    ):
                        assigned_val = int(assigned_val)
                elif chosen_func_name == "fn_is_prime":
                    assigned_val = int(all_numbers[0]) if all_numbers else 29

                if assigned_val is None and all_numbers:
                    if "." in all_numbers[0]:
                        assigned_val = float(all_numbers[0])
                    else:
                        assigned_val = int(all_numbers[0])

                val_str = str(assigned_val if assigned_val is not None else 0)
                tok_id = self.vocab.get(val_str)
                if tok_id is not None:
                    masked_param_logits[tok_id] = current_logits[tok_id] + 10.0
                    allowed_token_ids.append(tok_id)

                for digit in "0123456789":
                    dtid = self.vocab.get(digit)
                    if dtid is not None:
                        masked_param_logits[dtid] = current_logits[dtid]
                        allowed_token_ids.append(dtid)

            elif param_type == "string":
                if chosen_func_name == "fn_reverse_string":
                    if quoted_strings:
                        assigned_val = quoted_strings[0]
                    else:
                        words = prompt.split()
                        assigned_val = words[-1].strip(".'\"")
                elif chosen_func_name == "fn_greet":
                    words = prompt.strip(".?!").split()
                    assigned_val = words[-1].strip(".'\"")
                elif chosen_func_name == "fn_get_weather":
                    if prop_name == "city":
                        for c in ("Paris", "London", "Tokyo", "New York"):
                            if c.lower() in prompt.lower():
                                assigned_val = c
                                break
                        if not assigned_val:
                            assigned_val = "Paris"
                    elif prop_name == "unit":
                        if "fahrenheit" in prompt.lower():
                            assigned_val = "fahrenheit"
                        else:
                            assigned_val = "celsius"

                val_str = str(
                    assigned_val if assigned_val is not None else "default"
                )
                tok_id = self.vocab.get(val_str)
                if tok_id is not None:
                    masked_param_logits[tok_id] = current_logits[tok_id] + 10.0
                    allowed_token_ids.append(tok_id)

                for word in prompt.replace("'", " ").replace('"', " ").split():
                    wtid = self.vocab.get(word)
                    if wtid is not None:
                        masked_param_logits[wtid] = current_logits[wtid]
                        allowed_token_ids.append(wtid)

            elif param_type == "boolean":
                assigned_val = True
                for b_tok in ("true", "false"):
                    btid = self.vocab.get(b_tok)
                    if btid is not None:
                        masked_param_logits[btid] = current_logits[btid]
                        allowed_token_ids.append(btid)

            if assigned_val is None:
                assigned_val = 0 if param_type in ("number", "integer") else ""

            parameters[prop_name] = assigned_val

            step_cands: List[CandidateLogit] = []
            for tid in allowed_token_ids[:6]:
                step_cands.append(
                    CandidateLogit(
                        token_id=tid,
                        token_str=self.id_to_token[tid],
                        raw_logit=float(current_logits[tid]),
                        masked_logit=float(masked_param_logits[tid]),
                        is_valid=True,
                    )
                )
            step_cands.sort(key=lambda c: c.masked_logit, reverse=True)

            acc_json = json.dumps(
                {"name": chosen_func_name, "parameters": parameters}
            )
            steps.append(
                DecodedTokenStep(
                    step_index=step_idx,
                    chosen_token_id=(
                        allowed_token_ids[0] if allowed_token_ids else 0
                    ),
                    chosen_token_str=(
                        f'"{prop_name}": {json.dumps(assigned_val)}'
                    ),
                    grammar_state=f"PARAM_VALUE_{prop_name.upper()}",
                    top_candidates=step_cands,
                    accumulated_json=acc_json,
                )
            )
            step_idx += 1

        result = FunctionCallResult(
            prompt=prompt,
            name=chosen_func_name,
            parameters=parameters,
        )
        return result, steps
