const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { config } = require('./config');
const { logger } = require('./logger');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
cspDirectives['script-src'] = ["'self'", 'https://www.google.com', 'https://www.gstatic.com'];
cspDirectives['frame-src'] = ["'self'", 'https://www.google.com'];
cspDirectives['connect-src'] = ["'self'", 'https://www.google.com'];

app.disable('x-powered-by');
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
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
      return cb(null, true);
    }
    return cb(new Error('CORS not allowed'));
  }
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = { app };
