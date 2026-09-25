import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestValidator } from './middleware/validation.js';
import { getCorsOrigins, isProduction } from './config/env.js';
import { HttpError } from './utils/http.js';
import { redactUrl } from './utils/logger.js';

function buildCorsOptions() {
  const allowedOrigins = getCorsOrigins();

  if (isProduction() && !process.env.CORS_ORIGINS) {
    console.warn(
      '[config] CORS_ORIGINS is not set; only local development origins will be accepted. Set CORS_ORIGINS to your deployed frontend origin(s) (comma separated).'
    );
  }

  return {
    origin(origin, callback) {
      // No Origin header: same-origin request, curl, or a server-to-server call.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new HttpError(403, 'Origin is not allowed by CORS policy'));
    },
    // Bearer tokens are sent via the Authorization header, so credentialed
    // cross-origin requests are not needed (and "*" + credentials is invalid).
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  };
}

// Access log with user ids (which also appear as URL path segments) pseudonymized.
function buildAccessLogFormat() {
  return (tokens, req, res) =>
    [
      tokens.method(req, res),
      redactUrl(tokens.url(req, res) || ''),
      tokens.status(req, res),
      `${tokens['response-time'](req, res)}ms`,
    ].join(' ');
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '32kb' }));
  app.use(morgan(buildAccessLogFormat(), { skip: (req) => req.path === '/health' }));
  app.use(requestValidator);

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'Saarthi backend' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', chatRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
