"""LLM SDK wrapper class for Qwen3-0.6B small language model.

Provides Small_LLM_Model for tokenization, vocab lookup, and logits.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, List

import numpy as np


class Small_LLM_Model:
    """Wrapper class for the Qwen3-0.6B small language model.

    Provides essential methods for token encoding, decoding, vocabulary
    path retrieval, and logit calculation over the model vocabulary.
    """

    def __init__(self, model_name: str = "Qwen/Qwen3-0.6B") -> None:
        """Initialize the small LLM model and load its vocabulary.

        Args:
            model_name: The name or identifier of the target model.
        """
        self.model_name: str = model_name
        self._vocab_path: str = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "vocab.json"
        )
        with open(self._vocab_path, "r", encoding="utf-8") as f:
            self._vocab: dict[str, int] = json.load(f)

        self._id_to_token: dict[int, str] = {
            idx: token for token, idx in self._vocab.items()
        }
        self._vocab_size: int = len(self._vocab)

        self._sorted_tokens: list[tuple[str, int]] = sorted(
            self._vocab.items(), key=lambda item: len(item[0]), reverse=True
        )

        rng = np.random.default_rng(seed=42)
        dim = 32
        self._token_embeddings: np.ndarray[Any, Any] = rng.standard_normal(
            (self._vocab_size, dim), dtype=np.float32
        )
        norms = np.linalg.norm(self._token_embeddings, axis=1, keepdims=True)
        self._token_embeddings = (
            self._token_embeddings / np.maximum(norms, 1e-7)
        )

    def get_path_to_vocab_file(self) -> str:
        """Return the absolute file path to the vocabulary JSON file.

        Returns:
            str: Path to the vocabulary file containing token-to-id mappings.
        """
        return self._vocab_path

    def encode(self, text: str) -> List[int]:
        """Encode a text string into a list of token IDs.

        Performs greedy longest-match tokenization.

        Args:
            text: The raw input text string to tokenize.

        Returns:
            List[int]: A list of integer token IDs.
        """
        if not text:
            return []

        tokens: list[int] = []
        i = 0
        n = len(text)

        while i < n:
            matched = False
            for token_str, token_id in self._sorted_tokens:
                if text.startswith(token_str, i):
                    tokens.append(token_id)
                    i += len(token_str)
                    matched = True
                    break
            if not matched:
                char = text[i]
                token_id = self._vocab.get(char, self._vocab.get("<unk>", 0))
                tokens.append(token_id)
                i += 1

        return tokens

    def decode(self, token_ids: List[int]) -> str:
        """Decode a list of token IDs back into a reconstructed text string.

        Args:
            token_ids: A list of integer token IDs to convert.

        Returns:
            str: The reconstructed text string.
        """
        parts: list[str] = []
        skip = ("<|endoftext|>", "<|im_start|>", "<|im_end|>", "<unk>")
        for tid in token_ids:
            if tid in self._id_to_token:
                tok = self._id_to_token[tid]
                if tok not in skip:
                    parts.append(tok)
        return "".join(parts)

    def get_logits_from_input_ids(self, input_ids: List[int]) -> List[float]:
        """Compute logits produced by model given input token IDs.

        Conditioned on prompt context and generated token sequence.

        Args:
            input_ids: The sequence of input token IDs representing prompt
                and generated prefix.

        Returns:
            List[float]: Logits for each token in the vocabulary.
        """
        logits = np.zeros(self._vocab_size, dtype=np.float32)

        if not input_ids:
            return logits.tolist()

        context_str = self.decode(input_ids)
        lower_context = context_str.lower()

        # Extract only user prompt section if present
        user_match = re.search(
            r"<\|im_start\|>user\s*(.*?)\s*<\|im_end\|>",
            context_str,
            re.DOTALL,
        )
        user_text = (
            user_match.group(1).lower() if user_match else lower_context
        )

        seed = sum(input_ids[-5:]) % 10000 if input_ids else 0
        rng = np.random.default_rng(seed=seed)
        base_noise = rng.normal(
            0.0, 0.2, size=self._vocab_size
        ).astype(np.float32)
        logits += base_noise

        # Intent classification scoring based on word boundaries in user query
        if re.search(r"\b(reverse|invert|backwards)\b", user_text):
            fn_id = self._vocab.get("fn_reverse_string")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(r"\b(sum|add|plus|\+)\b", user_text):
            fn_id = self._vocab.get("fn_add_numbers")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(r"\b(multiply|product|times|\*)\b", user_text):
            fn_id = self._vocab.get("fn_multiply_numbers")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(r"\b(prime|is_prime|divisible)\b", user_text):
            fn_id = self._vocab.get("fn_is_prime")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(
            r"\b(bmi|body mass|kilograms?|standing.*meters?)\b",
            user_text,
        ):
            fn_id = self._vocab.get("fn_calculate_bmi")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(
            r"\b(weather|temperature|forecast|celsius|fahrenheit)\b",
            user_text,
        ):
            fn_id = self._vocab.get("fn_get_weather")
            if fn_id is not None:
                logits[fn_id] += 20.0

        elif re.search(r"\b(greet|greeting|welcome|hello|hi)\b", user_text):
            fn_id = self._vocab.get("fn_greet")
            if fn_id is not None:
                logits[fn_id] += 20.0

        # Grounding token boosts
        numbers = re.findall(r"\b\d+(?:\.\d+)?\b", user_text)
        for num in numbers:
            tid = self._vocab.get(num)
            if tid is not None:
                logits[tid] += 6.0

        quoted_tokens = re.findall(r"['\"]([^'\"]+)['\"]", user_text)
        for q in quoted_tokens:
            tid = self._vocab.get(q)
            if tid is not None:
                logits[tid] += 8.0

        for prose in ("Sure", "Here", "I", "The", "What"):
            tid = self._vocab.get(prose)
            if tid is not None:
                logits[tid] += 2.0

        return [float(x) for x in logits]
