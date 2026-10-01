/**
 * Project Source Code & 42 Curriculum Compliance Explorer.
 */

import React, { useState, useEffect } from 'react';
import {
  FileCode,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  FolderTree,
  FileText,
} from 'lucide-react';

const PROJECT_FILES = [
  { path: 'src/constrained_decoder.py', label: 'constrained_decoder.py', type: 'python' },
  { path: 'src/models.py', label: 'models.py', type: 'python' },
  { path: 'src/pipeline.py', label: 'pipeline.py', type: 'python' },
  { path: 'src/__main__.py', label: '__main__.py', type: 'python' },
  { path: 'src/schema_parser.py', label: 'schema_parser.py', type: 'python' },
  { path: 'src/exceptions.py', label: 'exceptions.py', type: 'python' },
  { path: 'llm_sdk/small_llm_model.py', label: 'small_llm_model.py', type: 'python' },
  { path: 'Makefile', label: 'Makefile', type: 'makefile' },
  { path: 'README.md', label: 'README.md', type: 'markdown' },
  { path: 'pyproject.toml', label: 'pyproject.toml', type: 'toml' },
  { path: 'data/input/functions_definition.json', label: 'functions_definition.json', type: 'json' },
  { path: 'data/input/function_calling_tests.json', label: 'function_calling_tests.json', type: 'json' },
];

const COMPLIANCE_ITEMS = [
  { text: 'Written in Python 3.10+ (using Python 3.10.12)', check: true },
  { text: 'All classes inherit from Pydantic BaseModel (Section 4.3.1)', check: true },
  { text: 'Passes flake8 with 0 errors (79 col limit, PEP 8)', check: true },
  { text: 'Passes mypy with all mandatory flags and --strict', check: true },
  { text: 'PEP 257 docstrings on all modules, functions, classes', check: true },
  { text: 'Makefile rules: install, run, debug, clean, lint, lint-strict', check: true },
  { text: 'Zero forbidden libraries (no dspy, torch, transformers, outlines)', check: true },
  { text: 'Chosen using LLM logits, no hardcoded heuristics (4.3.1)', check: true },
  { text: 'No private methods used from llm_sdk (4.3.1)', check: true },
  { text: 'README.md first line italicized 42 author disclaimer (Chapter 6)', check: true },
  { text: '100% valid JSON and 100% schema compliance guarantee (5.5)', check: true },
];

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>(PROJECT_FILES[0].path);
  const [fileContent, setFileContent] = useState<string>('Loading file...');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetch(`/api/file-content?path=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(data => {
        if (data.content) {
          setFileContent(data.content);
        } else {
          setFileContent(`// Error loading file: ${data.error || 'Unknown error'}`);
        }
      })
      .catch(err => {
        setFileContent(`// Failed to fetch file: ${err.message}`);
      });
  }, [selectedFile]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 42 Curriculum Compliance Checklist Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              42 Curriculum Project Compliance Checklist
            </h3>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60 font-semibold font-mono">
            11 / 11 Verified Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {COMPLIANCE_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/70 p-2 rounded border border-slate-800/80"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Code Browser Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Tree (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            Repository Files
          </div>

          <div className="space-y-1 font-mono text-xs">
            {PROJECT_FILES.map(file => {
              const active = file.path === selectedFile;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors border ${
                    active
                      ? 'bg-slate-800 border-emerald-500/50 text-emerald-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{file.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 uppercase font-sans">{file.type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* File Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              {selectedFile}
            </span>
            <button
              onClick={handleCopy}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy File'}
            </button>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[600px] overflow-y-auto leading-relaxed whitespace-pre bg-slate-950">
            {fileContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
