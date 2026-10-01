/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API: Get input and output data files
  app.get('/api/data', (_req, res) => {
    try {
      const funcsPath = path.join(__dirname, 'data/input/functions_definition.json');
      const testsPath = path.join(__dirname, 'data/input/function_calling_tests.json');
      const outResultsPath = path.join(__dirname, 'data/output/function_calling_results.json');
      const outCallsPath = path.join(__dirname, 'data/output/function_calls.json');

      const functions = fs.existsSync(funcsPath) ? JSON.parse(fs.readFileSync(funcsPath, 'utf-8')) : [];
      const tests = fs.existsSync(testsPath) ? JSON.parse(fs.readFileSync(testsPath, 'utf-8')) : [];
      
      let results = [];
      if (fs.existsSync(outResultsPath)) {
        results = JSON.parse(fs.readFileSync(outResultsPath, 'utf-8'));
      } else if (fs.existsSync(outCallsPath)) {
        results = JSON.parse(fs.readFileSync(outCallsPath, 'utf-8'));
      }

      res.json({ functions, tests, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Run terminal commands (make lint, make test, uv run python -m src, etc.)
  app.post('/api/run-command', (req, res) => {
    const { command } = req.body;
    const allowed = ['make lint', 'make lint-strict', 'make test', 'make run', 'make clean', 'uv run python -m src'];
    
    if (!allowed.includes(command) && !command.startsWith('uv run python -m src')) {
      return res.status(400).json({ error: 'Command not permitted' });
    }

    const startTime = Date.now();
    exec(command, { cwd: __dirname, timeout: 30000 }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      res.json({
        command,
        stdout,
        stderr,
        exitCode: error ? error.code || 1 : 0,
        durationMs: duration,
      });
    });
  });

  // API: Get source code file contents for inspector
  app.get('/api/file-content', (req, res) => {
    const filePath = req.query.path as string;
    const safeBase = __dirname;
    const resolved = path.resolve(safeBase, filePath || '');

    if (!resolved.startsWith(safeBase)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      const content = fs.readFileSync(resolved, 'utf-8');
      res.json({ path: filePath, content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
