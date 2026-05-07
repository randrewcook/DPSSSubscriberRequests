const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { config, validateStartupConfig } = require('./config');
const { query } = require('./db');
const { logger } = require('./logger');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
const metrics = {
  requestsTotal: 0,
  requestsByStatus: new Map()
};

const startupFailures = validateStartupConfig(config);
if (startupFailures.length > 0) {
  throw new Error(`Startup configuration invalid:\n- ${startupFailures.join('\n- ')}`);
}

const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
cspDirectives['script-src'] = ["'self'", 'https://www.google.com', 'https://www.gstatic.com'];
cspDirectives['frame-src'] = ["'self'", 'https://www.google.com'];
cspDirectives['connect-src'] = ["'self'", 'https://www.google.com'];

app.disable('x-powered-by');
app.use((req, res, next) => {
  const headerName = String(config.observability.requestIdHeader || 'x-request-id').toLowerCase();
  const incoming = req.headers[headerName];
  const requestId = (typeof incoming === 'string' && incoming.trim()) ? incoming.trim() : randomUUID();

  req.requestId = requestId;
  res.setHeader(headerName, requestId);

  const start = Date.now();
  res.on('finish', () => {
    metrics.requestsTotal += 1;
    const codeKey = String(res.statusCode);
    metrics.requestsByStatus.set(codeKey, (metrics.requestsByStatus.get(codeKey) || 0) + 1);

    logger.info({
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    }, 'HTTP request completed');
  });

  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: cspDirectives
  }
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

const allowedOrigins = new Set(config.cors.allowedOrigins);
app.use(cors({
  origin(origin, cb) {
    if (!origin) {
      return cb(null, true);
    }
    if (allowedOrigins.size > 0 && allowedOrigins.has(origin)) {
      return cb(null, true);
    }
    return cb(new Error('CORS not allowed'));
  }
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  try {
    await query('SELECT 1 AS ok');
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.warn({ err: error }, 'Readiness check failed');
    return res.status(503).json({ status: 'not-ready', reason: 'database-unavailable' });
  }
});

app.get('/metrics', (_req, res) => {
  const lines = [
    '# HELP app_requests_total Total number of HTTP requests processed',
    '# TYPE app_requests_total counter',
    `app_requests_total ${metrics.requestsTotal}`,
    '# HELP app_requests_by_status_total Number of HTTP responses by status code',
    '# TYPE app_requests_by_status_total counter',
    '# HELP app_process_uptime_seconds Uptime of node process in seconds',
    '# TYPE app_process_uptime_seconds gauge',
    `app_process_uptime_seconds ${Math.floor(process.uptime())}`
  ];

  for (const [statusCode, count] of metrics.requestsByStatus.entries()) {
    lines.push(`app_requests_by_status_total{status="${statusCode}"} ${count}`);
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(`${lines.join('\n')}\n`);
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/captcha-config', (_req, res) => {
  res.json({ siteKey: config.recaptcha.siteKey || null });
});

app.get('/region-environment-map', (_req, res) => {
  res.json({ mapping: config.regionEnvironmentMap });
});

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.requestId }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = { app };
