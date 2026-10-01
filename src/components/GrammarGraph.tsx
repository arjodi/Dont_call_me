/**
 * Visual Grammar State Machine & Function Schema Explorer.
 */

import React, { useState } from 'react';
import {
  GitCommit,
  ArrowRight,
  ShieldCheck,
  Boxes,
  Code2,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { FunctionDefinition } from '../types';

interface GrammarGraphProps {
  functions: FunctionDefinition[];
}

const GRAMMAR_STATES = [
  {
    id: 'START',
    label: 'START',
    rule: '{"name": "',
    desc: 'Emits root object and opening key for function selection',
    allowedTokens: ['{"name": "', '{"name":', '{"'],
  },
  {
    id: 'FUNCTION_NAME',
    label: 'FUNCTION_NAME',
    rule: '<fn_id> ∈ Available_Functions',
    desc: 'Restricts candidate tokens strictly to valid registered function names',
    allowedTokens: ['fn_add_numbers', 'fn_greet', 'fn_reverse_string', '...'],
  },
  {
    id: 'PARAM_KEY',
    label: 'PARAM_KEY',
    rule: '<key> ∈ Schema.properties',
    desc: 'Restricts candidate tokens strictly to unfulfilled parameter names',
    allowedTokens: ['"a"', '"b"', '"weight_kg"', '"height_m"', '"city"', '...'],
  },
  {
    id: 'PARAM_VALUE',
    label: 'PARAM_VALUE',
    rule: 'Type_Validation(prop.type)',
    desc: 'Restricts logits to tokens satisfying the schema type (number, string, boolean)',
    allowedTokens: ['[0-9.-] for number', '"[a-zA-Z0-9]" for string', 'true | false'],
  },
  {
    id: 'PARAM_DELIM',
    label: 'PARAM_DELIM',
    rule: '"," or "}"',
    desc: 'If required parameters remain, enforce comma delimiter; otherwise close object',
    allowedTokens: [', ', '}', '}}'],
  },
  {
    id: 'FINISHED',
    label: 'FINISHED',
    rule: '<|endoftext|>',
    desc: 'Guarantees termination without extra prose or trailing junk tokens',
    allowedTokens: ['<|endoftext|>', '<|im_end|>'],
  },
];

export const GrammarGraph: React.FC<GrammarGraphProps> = ({ functions }) => {
  const [selectedFnName, setSelectedFnName] = useState<string>(functions[0]?.name || '');
  const [selectedStateId, setSelectedStateId] = useState<string>('FUNCTION_NAME');

  const selectedFn = functions.find(f => f.name === selectedFnName) || functions[0];
  const activeState = GRAMMAR_STATES.find(s => s.id === selectedStateId) || GRAMMAR_STATES[1];

  return (
    <div className="space-y-6">
      {/* Visual Grammar Pipeline DFA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-emerald-400" />
              Constrained Decoding Finite-State Grammar (DFA)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every autoregressive token is validated against state transitions to guarantee 100% valid JSON
            </p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60 font-mono">
            Deterministic Finite Automaton
          </span>
        </div>

        {/* State Node Graph */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2 pb-4">
          {GRAMMAR_STATES.map((st, idx) => {
            const isSelected = st.id === selectedStateId;
            return (
              <button
                key={st.id}
                onClick={() => setSelectedStateId(st.id)}
                className={`p-3 rounded-lg text-left transition-all relative border ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">
                  State {idx}
                </div>
                <div className="text-xs font-bold font-mono truncate">{st.label}</div>
                <div className="text-[11px] text-slate-400 truncate mt-1">{st.rule}</div>
              </button>
            );
          })}
        </div>

        {/* Selected State Details */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Grammar Rule: <code className="text-emerald-400">{activeState.rule}</code>
            </span>
            <span className="text-xs text-slate-500 font-mono">State: {activeState.id}</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">{activeState.desc}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Permitted Tokens:</span>
            {activeState.allowedTokens.map((tok, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-xs"
              >
                {tok}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Available Function Schemas Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Function List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-emerald-400" />
            Registered Functions ({functions.length})
          </h4>
          <div className="space-y-1.5">
            {functions.map(fn => {
              const active = fn.name === selectedFnName;
              return (
                <button
                  key={fn.name}
                  onClick={() => setSelectedFnName(fn.name)}
                  className={`w-full text-left p-3 rounded-lg transition-colors border ${
                    active
                      ? 'bg-slate-800 border-emerald-500/50 text-slate-100 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-mono text-xs text-emerald-400">{fn.name}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{fn.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Schema Details */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          {selectedFn && (
            <>
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 font-mono">{selectedFn.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{selectedFn.description}</p>
                </div>
                <span className="text-xs bg-slate-950 px-2.5 py-1 rounded text-slate-400 border border-slate-800 font-mono">
                  Returns: {selectedFn.returns?.type || 'any'}
                </span>
              </div>

              {/* Parameter Properties */}
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Required Parameters Schema
                </h5>
                <div className="space-y-2">
                  {Object.entries(selectedFn.parameters.properties).map(([key, prop]) => {
                    const isRequired = selectedFn.parameters.required.includes(key);
                    return (
                      <div
                        key={key}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-200">{key}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50 font-mono">
                              {prop.type}
                            </span>
                            {isRequired && (
                              <span className="text-[10px] text-amber-400 font-medium">required</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{prop.description || 'No description'}</div>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Raw JSON Schema */}
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Raw JSON Definition (data/input/functions_definition.json)
                </h5>
                <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedFn, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
