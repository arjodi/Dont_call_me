/**
 * Interactive Constrained Decoding Playground & Step-by-Step Inspector.
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  SkipForward,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Terminal,
  Filter,
} from 'lucide-react';
import { FunctionDefinition, DecodeSimulationResult } from '../types';
import { runConstrainedSimulation } from '../engine/constrainedSimulator';

interface PlaygroundProps {
  functions: FunctionDefinition[];
}

const PRESET_PROMPTS = [
  'What is the sum of 2 and 3?',
  'What is the sum of 265 and 345?',
  'Greet shrek',
  'Reverse the string \'hello\'',
  'Calculate the BMI for a person weighing 70 kilograms and standing 1.75 meters tall.',
  'Check the weather in Paris with celsius unit.',
  'Can you check if 29 is a prime number?',
  'Multiply 12 and 15 together.',
];

export const Playground: React.FC<PlaygroundProps> = ({ functions }) => {
  const [prompt, setPrompt] = useState<string>(PRESET_PROMPTS[0]);
  const [simulation, setSimulation] = useState<DecodeSimulationResult | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExecutingCli, setIsExecutingCli] = useState<boolean>(false);
  const [cliOutput, setCliOutput] = useState<string | null>(null);

  // Run simulation on prompt change
  useEffect(() => {
    if (functions.length > 0) {
      const sim = runConstrainedSimulation(prompt, functions);
      setSimulation(sim);
      setCurrentStepIdx(0);
      setIsPlaying(false);
    }
  }, [prompt, functions]);

  // Step-by-step playback timer
  useEffect(() => {
    let timer: any;
    if (isPlaying && simulation) {
      timer = setInterval(() => {
        setCurrentStepIdx(prev => {
          if (prev >= simulation.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, simulation]);

  const handleRunCli = async () => {
    setIsExecutingCli(true);
    setCliOutput(null);
    try {
      const res = await fetch('/api/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'uv run python -m src' }),
      });
      const data = await res.json();
      setCliOutput(data.stdout || data.stderr || 'Execution finished');
    } catch (e: any) {
      setCliOutput(`Error running CLI: ${e.message}`);
    } finally {
      setIsExecutingCli(false);
    }
  };

  const currentStep = simulation?.steps[currentStepIdx] || simulation?.steps[0];

  return (
    <div className="space-y-6">
      {/* Prompt Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Natural Language Query (Prompt)
          </label>
          <span className="text-xs text-slate-400">Target Model: Qwen/Qwen3-0.6B</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            placeholder="Type a natural language request, e.g. What is the sum of 40 and 2?"
          />
          <button
            onClick={() => {
              if (simulation) {
                setCurrentStepIdx(simulation.steps.length - 1);
                setIsPlaying(false);
              }
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate Output
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span className="text-slate-500 mr-1">Presets:</span>
          {PRESET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(p)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                prompt === p
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {p.length > 32 ? p.slice(0, 32) + '...' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Step Player Controls */}
      {simulation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <Play className="w-3.5 h-3.5" />
              {isPlaying ? 'Pause Stepping' : 'Auto Play Steps'}
            </button>

            <button
              onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
              disabled={currentStepIdx === 0}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded-lg text-xs border border-slate-800"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentStepIdx(prev => Math.min(simulation.steps.length - 1, prev + 1))}
              disabled={currentStepIdx === simulation.steps.length - 1}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded-lg text-xs flex items-center gap-1 border border-slate-800"
            >
              Next Step
              <SkipForward className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                setCurrentStepIdx(0);
                setIsPlaying(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-200"
              title="Reset to step 0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">
              Decoding Step <strong className="text-emerald-400">{currentStepIdx + 1}</strong> of{' '}
              {simulation.steps.length}
            </span>
            <div className="flex gap-1">
              {simulation.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentStepIdx(i);
                    setIsPlaying(false);
                  }}
                  className={`w-6 h-2 rounded-full transition-all ${
                    i === currentStepIdx
                      ? 'bg-emerald-400 w-8'
                      : i < currentStepIdx
                      ? 'bg-slate-600'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Decoding Trace & Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Token Logit Inspector (Left Column - 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Step {currentStepIdx + 1}: Logit Masking & Grammar State
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono">
                {currentStep?.grammarState}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 bg-slate-950 p-2.5 rounded border border-slate-800/80">
              {currentStep?.explanation}
            </p>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 grid grid-cols-12 px-2 py-1">
                <span className="col-span-4">Candidate Token</span>
                <span className="col-span-3 text-right">Raw Logit</span>
                <span className="col-span-3 text-right">Constrained Mask</span>
                <span className="col-span-2 text-right">Softmax P</span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                {currentStep?.topCandidates.map((cand, idx) => {
                  const isChosen = cand.tokenStr.includes(simulation?.result.name || '') ||
                    cand.tokenStr === JSON.stringify(Object.values(simulation?.result.parameters || {})[currentStepIdx - 1]);
                  
                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 items-center px-3 py-2 rounded-lg border transition-all ${
                        isChosen
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                          : cand.isValid
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-red-950/20 border-red-900/30 text-slate-500'
                      }`}
                    >
                      <div className="col-span-4 flex items-center gap-2 truncate">
                        {cand.isValid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className={`truncate ${cand.isValid ? 'font-semibold' : 'line-through opacity-70'}`}>
                          {cand.tokenStr}
                        </span>
                      </div>

                      <div className="col-span-3 text-right text-slate-400">
                        {cand.rawLogit > 0 ? `+${cand.rawLogit.toFixed(1)}` : cand.rawLogit.toFixed(1)}
                      </div>

                      <div className="col-span-3 text-right">
                        {cand.isValid ? (
                          <span className="text-emerald-400">Preserved ({cand.maskedLogit.toFixed(1)})</span>
                        ) : (
                          <span className="text-red-400 font-bold bg-red-950 px-1 py-0.5 rounded text-[11px]">
                            -∞ (-inf)
                          </span>
                        )}
                      </div>

                      <div className="col-span-2 text-right font-medium">
                        {cand.isValid ? (
                          <span className="text-emerald-300">{(cand.probAfter * 100).toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-600">0.0%</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Output & Reliability Comparison (Right Column - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Constrained Decoding (Guaranteed Valid) */}
          <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Constrained Output (100% Reliable)
                </h4>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono">Schema Compliant</span>
            </div>

            <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto">
              {JSON.stringify(
                {
                  prompt: simulation?.result.prompt,
                  name: simulation?.result.name,
                  parameters: simulation?.result.parameters,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Unconstrained Model Output (Demonstrating Section 3.3 30% Failure) */}
          <div className="bg-slate-900 border border-red-900/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-red-300">
                  Unconstrained Model Output (30% Success)
                </h4>
              </div>
              <span className="text-[11px] text-red-400">Section 3.3 Demonstration</span>
            </div>

            <p className="text-xs text-slate-400 mb-2">
              Without logit masking, small 0.6B models produce conversational chit-chat, missing fields, or invalid syntax:
            </p>

            <pre className="bg-slate-950 border border-red-900/30 p-3 rounded-lg text-xs font-mono text-red-300/90 whitespace-pre-wrap">
              {simulation?.unconstrainedOutput}
            </pre>
            <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Failed validation: output is conversational prose or unparseable JSON.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
