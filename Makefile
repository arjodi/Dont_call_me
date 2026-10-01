# Makefile for 42 Curriculum Function Calling with Constrained Decoding

VENV_BIN := .venv/bin
PYTHON := $(VENV_BIN)/python
FLAKE8 := $(VENV_BIN)/flake8
MYPY := $(VENV_BIN)/mypy
PYTEST := $(VENV_BIN)/pytest

.PHONY: all install run debug clean lint lint-strict test

all: install run

install:
	uv sync

run:
	uv run python -m src

debug:
	uv run python -m pdb -m src

clean:
	rm -rf __pycache__ src/__pycache__ llm_sdk/__pycache__ tests/__pycache__
	rm -rf .pytest_cache .mypy_cache
	rm -rf data/output/*.json

lint:
	$(FLAKE8) . --exclude=.venv
	$(MYPY) . --warn-return-any --warn-unused-ignores --ignore-missing-imports --disallow-untyped-defs --check-untyped-defs --exclude=.venv

lint-strict:
	$(FLAKE8) . --exclude=.venv
	$(MYPY) . --strict --exclude=.venv

test:
	$(PYTEST) -v
