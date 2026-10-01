"""Pure Python HTTP server serving the interactive web workbench.

Provides web interface on port 3000 interacting directly with Python
ConstrainedDecoder and pipeline following 42 curriculum guidelines.
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import subprocess
import urllib.parse

from llm_sdk.small_llm_model import Small_LLM_Model
from src.constrained_decoder import ConstrainedDecoder
from src.pipeline import load_functions_definition

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class PythonAppHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for pure Python function calling applet."""

    def do_GET(self) -> None:
        """Handle GET requests for static UI and data."""
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path in ("/", "/index.html"):
            index_path = os.path.join(BASE_DIR, "index.html")
            if os.path.exists(index_path):
                with open(index_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(content)
                return

        if parsed.path == "/api/data":
            try:
                funcs_file = os.path.join(
                    BASE_DIR, "data/input/functions_definition.json"
                )
                tests_file = os.path.join(
                    BASE_DIR, "data/input/function_calling_tests.json"
                )
                with open(funcs_file, "r", encoding="utf-8") as f:
                    functions = json.load(f)
                with open(tests_file, "r", encoding="utf-8") as f:
                    tests = json.load(f)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                payload = json.dumps({"functions": functions, "tests": tests})
                self.wfile.write(payload.encode("utf-8"))
            except Exception as err:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(err).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self) -> None:
        """Handle POST requests for decoding and Makefile execution."""
        parsed = urllib.parse.urlparse(self.path)
        content_len = int(self.headers.get("Content-Length", 0))
        body = (
            self.rfile.read(content_len).decode("utf-8")
            if content_len
            else "{}"
        )
        payload = json.loads(body) if body else {}

        if parsed.path == "/api/decode":
            prompt = payload.get("prompt", "What is the sum of 2 and 3?")
            funcs_file = os.path.join(
                BASE_DIR, "data/input/functions_definition.json"
            )
            functions = load_functions_definition(funcs_file)
            model = Small_LLM_Model()
            decoder = ConstrainedDecoder(model=model, functions=functions)

            result, steps = decoder.decode_prompt(prompt)

            lp = prompt.lower()
            unconstrained: str
            if "sum" in lp or "add" in lp:
                unconstrained = "Sure! The sum is calculated as 5."
            elif "greet" in lp:
                words = prompt.split()
                name = words[-1] if words else "there"
                unconstrained = f"Hello there, {name}! Nice to meet you."
            elif "reverse" in lp:
                unconstrained = "The reversed string is olleh."
            else:
                unconstrained = '{"call": "unknown_function"'

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = json.dumps(
                {
                    "result": result.model_dump(),
                    "unconstrained": unconstrained,
                }
            )
            self.wfile.write(resp.encode("utf-8"))
            return

        if parsed.path == "/api/run-batch":
            cmd = [
                os.path.join(BASE_DIR, ".venv/bin/python"),
                "-m",
                "src",
            ]
            res = subprocess.run(
                cmd,
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = json.dumps({"output": res.stdout or res.stderr})
            self.wfile.write(resp.encode("utf-8"))
            return

        if parsed.path == "/api/make":
            command = payload.get("command", "make lint")
            allowed = [
                "make lint",
                "make lint-strict",
                "make test",
                "make run",
                "make clean",
            ]
            if command not in allowed:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Command not allowed"}')
                return

            res = subprocess.run(
                command.split(),
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = json.dumps(
                {
                    "stdout": res.stdout,
                    "stderr": res.stderr,
                    "exitCode": res.returncode,
                }
            )
            self.wfile.write(resp.encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()


def run_server() -> None:
    """Start the Python HTTP server on port 3000."""
    with socketserver.TCPServer(("", PORT), PythonAppHandler) as httpd:
        print(f"Python server listening on http://0.0.0.0:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == "__main__":
    run_server()
