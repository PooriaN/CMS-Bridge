import express from 'express';
import cors from 'cors';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import connectionsRouter from './routes/connections';
import syncRouter from './routes/sync';
import discoveryRouter from './routes/discovery';
import { createLogger } from './utils/logger';
import {
  createSessionToken,
  getAuthConfig,
  hasValidSession,
  isApiRequest,
  isProductionLike,
  passwordMatches,
  sendAuthUnavailable,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  wantsHtml,
} from './utils/auth';

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

  const allowedPaths = new Set(['/login', '/login.html', '/logout', '/api/login', '/api/logout', '/api/health']);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const config = getAuthConfig();
    const pathName = req.path;
    const apiRequest = isApiRequest(req);
    const htmlRequest = wantsHtml(req);
    const loginPath = pathName === '/login' || pathName === '/login.html';
    const logoutPath = pathName === '/logout';

    if (!config) {
      if (!isProductionLike()) {
        next();
        return;
      }

      if (pathName === '/api/health') {
        next();
        return;
      }

      sendAuthUnavailable(res, apiRequest || !htmlRequest);
      return;
    }

    const authenticated = hasValidSession(req, config);
    if (loginPath && authenticated) {
      res.redirect('/');
      return;
    }

    if (allowedPaths.has(pathName)) {
      next();
      return;
    }

    if (authenticated) {
      next();
      return;
    }

    if (apiRequest) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (logoutPath) {
      next();
      return;
    }

    res.redirect('/login');
  });

  app.post('/api/login', (req, res) => {
    const config = getAuthConfig();
    if (!config) {
      sendAuthUnavailable(res, true);
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!passwordMatches(password, config.password)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.setHeader('Set-Cookie', serializeSessionCookie(createSessionToken(config.sessionSecret), req));
    res.json({ ok: true });
  });

  app.all('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', serializeClearedSessionCookie());
    if (req.method === 'GET' || wantsHtml(req)) {
      res.redirect('/login');
      return;
    }
    res.json({ ok: true });
  });

  if (includeStatic) {
    app.get('/login', (_req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
    });

    app.get('/logout', (_req, res) => {
      res.setHeader('Set-Cookie', serializeClearedSessionCookie());
      res.redirect('/login');
    });
  }

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
