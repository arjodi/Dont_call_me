"""Main entry point for function calling with constrained decoding.

Supports execution via:
uv run python -m src [--functions_definition <f>] [--input <f>] [--output <f>]
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional

from src.exceptions import FunctionCallingError
from src.pipeline import run_pipeline


def parse_arguments(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command line arguments for the function calling application.

    Args:
        argv: Optional list of argument strings. Defaults to sys.argv[1:].

    Returns:
        argparse.Namespace: Parsed CLI options.
    """
    parser = argparse.ArgumentParser(
        prog="python -m src",
        description="Function calling with constrained decoding on Qwen.",
    )
    parser.add_argument(
        "--functions_definition",
        type=str,
        default="data/input/functions_definition.json",
        help="Path to functions JSON (default: data/input/...)",
    )
    parser.add_argument(
        "--input",
        type=str,
        default="data/input/function_calling_tests.json",
        help="Path to input prompts JSON (default: data/input/...)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/output/function_calling_results.json",
        help="Path to output JSON (default: data/output/...)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress verbose output during execution",
    )
    return parser.parse_args(argv)


def main() -> int:
    """Execute main application lifecycle.

    Returns:
        int: Exit status code (0 for success, non-zero for error).
    """
    try:
        args = parse_arguments()
        run_pipeline(
            functions_file=args.functions_definition,
            input_file=args.input,
            output_file=args.output,
            verbose=not args.quiet,
        )
        return 0
    except FunctionCallingError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nExecution interrupted by user.", file=sys.stderr)
        return 130
    except Exception as err:
        print(f"Unexpected error: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
