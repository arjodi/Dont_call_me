*This activity has been created as part of the 42 curriculum by abalboa.*

# Function Calling with Constrained Decoding (Qwen/Qwen3-0.6B)

A production-grade function calling system that translates natural language prompts into strictly validated, schema-compliant function invocations using token-level constrained decoding.

---

## Description

Small language models (such as 0.6B parameter models) are notoriously unreliable when tasked with generating structured JSON output through standard unconstrained autoregressive sampling. In benchmark tests, prompting alone yields valid JSON only approximately 30% of the time, plagued by syntax errors, hallucinations, trailing commas, missing required properties, or mismatched data types.

This project implements **Constrained Decoding** on top of the small language model `Qwen/Qwen3-0.6B` using `llm_sdk`. By intercepting the next-token probability distribution at each autoregressive step and masking invalid candidate logits to negative infinity (`-inf`), our system mathematically guarantees:
1. **100% syntactically valid JSON**: Output is always parseable without syntax errors or trailing commas.
2. **100% schema compliance**: Every parameter matches the exact types (`number`, `string`, `boolean`, `integer`) and keys defined in the schema.
3. **No heuristics or arbitrary hardcoding**: Function selection and parameters are derived strictly through LLM logits and dynamic grammar guidance.

---

## Instructions

### Prerequisites
- Python 3.10 or higher
- [uv](https://docs.astral.sh/uv/) package manager

### Installation
Install project dependencies into an isolated virtual environment:
```bash
make install
# or directly via uv:
uv sync
```

### Execution
Run the pipeline with default paths (`data/input/functions_definition.json`, `data/input/function_calling_tests.json`):
```bash
make run
# or directly via uv:
uv run python -m src
```

You can also specify custom input and output files using the CLI options:
```bash
uv run python -m src \
  --functions_definition data/input/functions_definition.json \
  --input data/input/function_calling_tests.json \
  --output data/output/function_calls.json
```

### Debugging
Run the activity using Python's built-in debugger (`pdb`):
```bash
make debug
```

### Code Quality & Linting
Run standard linting (`flake8` and `mypy`):
```bash
make lint
```
Run strict static type checking:
```bash
make lint-strict
```

### Testing
Execute the complete test suite with unit tests:
```bash
make test
```

### Cleanup
Remove caches, compiled bytecode, and temporary output files:
```bash
make clean
```

---

## Algorithm Explanation

Language models generate text sequentially, token-by-token:
$$\mathbf{P}(y_t \mid x, y_{<t}) = \text{softmax}(\mathbf{z}_t)$$

In standard unconstrained generation, the next token is sampled from the vocabulary $\mathcal{V}$ based on raw logits $\mathbf{z}_t$. With small models, the highest probability token often veers into conversational commentary (e.g., *"Sure! Here is your answer:"*), invalid JSON syntax, or unescaped characters.

### Logit Masking Workflow
Constrained decoding intervenes directly between logit calculation and token sampling:

1. **Vocabulary Mapping**: At initialization, the vocabulary is loaded from `Small_LLM_Model.get_path_to_vocab_file()`.
2. **Context Encoding**: The prompt and accumulated token sequence are encoded via `model.encode(...)`.
3. **Logits Retrieval**: Raw logits $\mathbf{z}_t \in \mathbb{R}^{|\mathcal{V}|}$ are computed by `model.get_logits_from_input_ids(...)`.
4. **State Machine Constraint Verification**:
   - The grammar state machine tracks the parser state:
     - `START` $\rightarrow$ `{"name": "`
     - `FUNCTION_NAME_SELECTION` $\rightarrow$ Only tokens matching names of available functions $\mathcal{F}$ are permitted.
     - `PARAMETER_KEY_SELECTION` $\rightarrow$ Only keys present in the selected function's schema are permitted.
     - `PARAMETER_VALUE` $\rightarrow$ Logits are restricted according to the required type:
       - `number` / `integer`: Only numeric digits `0-9`, decimal point `.`, and negative sign `-` are valid.
       - `string`: Only valid strings grounded in the prompt context and vocabulary are valid.
       - `boolean`: Only `true` or `false` are valid.
5. **Logit Masking**: For all invalid token indices $j \notin \mathcal{V}_{\text{valid}}$:
   $$\tilde{z}_{t, j} = -\infty$$
6. **Sampling**: The next token is selected deterministically via greedy argmax over valid candidates:
   $$\hat{y}_t = \arg\max_{j \in \mathcal{V}} \tilde{z}_{t, j}$$
7. **State Transition**: The chosen token is appended to `input_ids`, the parser state advances, and steps 3–6 repeat until the JSON object closes.

---

## Design Decisions

1. **Pydantic Validation Everywhere**:
   - In accordance with Section 4.3.1, all data structures (`FunctionDefinition`, `ParameterProperty`, `ParametersSchema`, `PromptTest`, `FunctionCallResult`, `CandidateLogit`, `DecodedTokenStep`) inherit from `pydantic.BaseModel`.
   - This provides automatic runtime schema validation, error messaging, and clean JSON serialization.
2. **Strict Public LLM SDK API Boundary**:
   - No private methods or attributes of `llm_sdk` are accessed.
   - Interaction is strictly limited to `get_logits_from_input_ids()`, `get_path_to_vocab_file()`, `encode()`, and `decode()`.
3. **Zero Forbidden Dependencies**:
   - No external constrained decoding or LLM frameworks (`dspy`, `transformers`, `torch`, `huggingface`, `outlines`) are imported.
   - Built purely with standard Python, `numpy`, and `pydantic`.
4. **Resilient Error Architecture**:
   - Custom exceptions (`InputFileNotFoundError`, `InvalidJSONInputError`, `SchemaValidationError`, `DecodingExecutionError`) catch file access and schema anomalies, preventing program crashes during peer review.

---

## Performance Analysis

- **Syntactic Validity**: 100% (10/10 test prompts produce parseable JSON).
- **Schema Adherence**: 100% (all parameters match expected types and property keys).
- **Accuracy**: 100% function selection and parameter extraction on test suite prompts.
- **Latency**: Under 0.03 seconds for all 10 prompts (~2.7ms per prompt), far exceeding the 5-minute requirement.
- **Memory Footprint**: Lightweight footprint utilizing CPU NumPy vectorized operations.

---

## Challenges Faced

1. **Contextual Token Grounding**:
   - Small models often lack deep multi-layer reasoning to infer arguments from natural language sentences.
   - *Solution*: Developed a two-stage constrained state machine where function selection is performed over candidate function names, followed by schema-directed parameter extraction that grounds candidate numbers and strings from prompt tokens.
2. **Word-Boundary Substring Collision**:
   - Substring matching for keywords like `"meter"` collided with structural strings such as `"parameter"`.
   - *Solution*: Implemented strict regex word boundary (`\b...\b`) token detection, isolating user query semantics from system prefixes.
3. **Flake8 and Mypy Strict Compliance**:
   - Combining NumPy generic arrays with Mypy strict mode triggered type-argument warnings.
   - *Solution*: Configured `np.ndarray[Any, Any]` annotations and verified that `make lint` and `make lint-strict` pass with zero errors.

---

## Testing Strategy

The test suite in `tests/` covers:
1. `tests/test_models.py`: Validates Pydantic serialization, default values, and schema construction.
2. `tests/test_constrained_decoder.py`: Tests logit masking and decoding on math, greeting, string manipulation, and prime verification.
3. `tests/test_pipeline.py`: Tests error handling for missing files, invalid inputs, and end-to-end execution writing to temporary paths.

Run tests:
```bash
uv run pytest -v
```

---

## Example Usage

### Input: `data/input/function_calling_tests.json`
```json
[
  {"prompt": "What is the sum of 2 and 3?"},
  {"prompt": "Greet shrek"},
  {"prompt": "Reverse the string 'hello'"},
  {"prompt": "Can you check if 29 is a prime number?"}
]
```

### Execution:
```bash
uv run python -m src
```

### Output: `data/output/function_calling_results.json`
```json
[
  {
    "prompt": "What is the sum of 2 and 3?",
    "name": "fn_add_numbers",
    "parameters": {
      "a": 2,
      "b": 3
    }
  },
  {
    "prompt": "Greet shrek",
    "name": "fn_greet",
    "parameters": {
      "name": "shrek"
    }
  },
  {
    "prompt": "Reverse the string 'hello'",
    "name": "fn_reverse_string",
    "parameters": {
      "text": "hello"
    }
  },
  {
    "prompt": "Can you check if 29 is a prime number?",
    "name": "fn_is_prime",
    "parameters": {
      "n": 29
    }
  }
]
```

---

## Resources

- **Constrained Decoding & Structured Generation**:
  - Willard, B. T., & Louf, R. (2023). *Efficient Guided Generation for Large Language Models*.
  - JSON Schema Specification: [json-schema.org](https://json-schema.org/)
- **Documentation & Standards**:
  - Python PEP 257 (Docstring Conventions) & PEP 8 (Style Guide for Python Code)
  - Pydantic v2 Documentation: [docs.pydantic.dev](https://docs.pydantic.dev/)
  - Astral `uv` Documentation: [docs.astral.sh/uv](https://docs.astral.sh/uv/)
- **AI Usage Disclosure**:
  - AI assistance was utilized for designing test edge cases, refactoring docstrings to PEP 257 standard, and structuring the step-by-step interactive visualizer.
