import express from 'express';
import cors from 'cors';
import path from 'path';
import connectionsRouter from './routes/connections';
import syncRouter from './routes/sync';
import discoveryRouter from './routes/discovery';
import { createLogger } from './utils/logger';

const httpLog = createLogger('http');

export function createServer(options?: { includeStatic?: boolean }) {
  const includeStatic = options?.includeStatic ?? true;
  const app = express();

  app.use(cors());
  app.use(express.json());

  // HTTP request logging
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
      httpLog.debug(`${req.method} ${req.path}`);
    }
    next();
  });

  if (includeStatic) {
    app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  // API routes
  app.use('/api/connections', connectionsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/discover', discoveryRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (includeStatic) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });
  }

  return app;
}
