/**
 * Interactive Terminal Runner for executing Makefile targets and Python CLI.
 */

import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
  Clock,
} from 'lucide-react';

interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

const COMMAND_PRESETS = [
  {
    cmd: 'make lint',
    label: 'make lint',
    desc: 'Runs flake8 and mypy with 42 curriculum mandatory flags',
  },
  {
    cmd: 'make lint-strict',
    label: 'make lint-strict',
    desc: 'Runs flake8 and mypy with --strict flag',
  },
  {
    cmd: 'make test',
    label: 'make test',
    desc: 'Executes 11 unit tests via pytest',
  },
  {
    cmd: 'make run',
    label: 'make run',
    desc: 'Runs uv run python -m src pipeline',
  },
  {
    cmd: 'make clean',
    label: 'make clean',
    desc: 'Cleans pycache and cache artifacts',
  },
];

export const TerminalRunner: React.FC = () => {
  const [selectedCmd, setSelectedCmd] = useState<string>('make lint');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [history, setHistory] = useState<CommandResult[]>([]);

  const handleExecute = async (commandToRun: string) => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandToRun }),
      });
      const data = await res.json();
      setHistory(prev => [data, ...prev]);
    } catch (err: any) {
      setHistory(prev => [
        {
          command: commandToRun,
          stdout: '',
          stderr: `Execution error: ${err.message}`,
          exitCode: 1,
          durationMs: 0,
        },
        ...prev,
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Makefile Rules Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
              42 Curriculum Makefile Command Runner
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute live shell rules inside the Linux container
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Python 3.10.12 · uv 0.12.21</span>
        </div>

        {/* Quick Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {COMMAND_PRESETS.map((preset) => {
            const isSelected = preset.cmd === selectedCmd;
            return (
              <div
                key={preset.cmd}
                onClick={() => setSelectedCmd(preset.cmd)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-xs font-bold text-slate-200">{preset.label}</div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.desc}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecute(preset.cmd);
                  }}
                  disabled={isRunning}
                  className="mt-3 w-full py-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono shadow-sm">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-slate-200">Terminal Shell Execution Log</span>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Console
            </button>
          )}
        </div>

        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto text-xs">
          {history.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <TerminalIcon className="w-8 h-8 mx-auto text-slate-600" />
              <p>Click any rule above (e.g. `make lint-strict` or `make test`) to execute live.</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">$ {item.command}</span>
                    {item.exitCode === 0 ? (
                      <span className="text-emerald-400 flex items-center gap-0.5 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Exit 0
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-0.5 text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        Exit {item.exitCode}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.durationMs}ms
                  </span>
                </div>

                {item.stdout && (
                  <pre className="text-slate-300 text-[11px] whitespace-pre-wrap font-mono">
                    {item.stdout}
                  </pre>
                )}

                {item.stderr && (
                  <pre className="text-red-400 text-[11px] whitespace-pre-wrap font-mono">
                    {item.stderr}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
