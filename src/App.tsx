/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  CheckCircle2,
  Terminal,
  FolderTree,
  GitCommit,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Playground } from './components/Playground';
import { TestSuite } from './components/TestSuite';
import { GrammarGraph } from './components/GrammarGraph';
import { TerminalRunner } from './components/TerminalRunner';
import { CodeExplorer } from './components/CodeExplorer';
import { FunctionDefinition, FunctionCallResult } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'playground' | 'suite' | 'grammar' | 'terminal' | 'code'>('playground');
  const [functions, setFunctions] = useState<FunctionDefinition[]>([]);
  const [tests, setTests] = useState<{ prompt: string }[]>([]);
  const [results, setResults] = useState<FunctionCallResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data.functions) setFunctions(data.functions);
        if (data.tests) setTests(data.tests);
        if (data.results) setResults(data.results);
      })
      .catch(err => {
        console.error('Failed to load initial data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-slate-100">
                  Constrained Decoding Function Calling
                </span>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  Qwen3-0.6B
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>42 Curriculum Activity</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500">100% Valid JSON & Schema Guarantee</span>
              </div>
            </div>
          </div>

          {/* Quick Status Badges */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>flake8: 0 errors</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>mypy: strict passed</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">Python 3.10+ · uv</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 overflow-x-auto py-1.5">
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'playground'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Playground & Logit Inspector
          </button>

          <button
            onClick={() => setActiveTab('suite')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'suite'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Batch Test Suite (10 Cases)
          </button>

          <button
            onClick={() => setActiveTab('grammar')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'grammar'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            Grammar DFA & Schema Graph
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'terminal'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Makefile Runner (lint / test / run)
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'code'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            42 Code Explorer & Checklist
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {isLoading ? (
          <div className="py-24 text-center text-slate-500 font-mono text-xs">
            Loading 42 environment and function definitions...
          </div>
        ) : (
          <>
            {activeTab === 'playground' && <Playground functions={functions} />}
            {activeTab === 'suite' && <TestSuite tests={tests} functions={functions} results={results} />}
            {activeTab === 'grammar' && <GrammarGraph functions={functions} />}
            {activeTab === 'terminal' && <TerminalRunner />}
            {activeTab === 'code' && <CodeExplorer />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-4 text-center text-xs text-slate-500 font-mono">
        <p>
          42 Curriculum Activity · Built with Python 3.10, uv, Pydantic, NumPy & Constrained Logit Masking
        </p>
      </footer>
    </div>
  );
}
