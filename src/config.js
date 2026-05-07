const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultRegionEnvironmentMap = {
  USA: 'itrontotal.com',
  Canada: 'itrontotal.ca',
  Europe: 'itroneyva.eu',
  Australia: 'itroneyva.com.au'
};

function parseRegionEnvironmentMap(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { ...defaultRegionEnvironmentMap };
  }

  const map = {};
  for (const segment of raw.split(',')) {
    const [regionRaw, environmentRaw] = segment.split(':');
    const region = String(regionRaw || '').trim();
    const environment = String(environmentRaw || '').trim().toLowerCase();
    if (region && environment) {
      map[region] = environment;
    }
  }

  if (Object.keys(map).length === 0) {
    return { ...defaultRegionEnvironmentMap };
  }

  return map;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 3012),
  logLevel: process.env.LOG_LEVEL || 'info',
  dpssAllowedEnvironments: parseCsv(process.env.DPSS_ALLOWED_ENVIRONMENTS),
  regionEnvironmentMap: parseRegionEnvironmentMap(process.env.REGION_ENVIRONMENT_MAP),
  dpssServiceClientId: process.env.DPSS_SERVICE_CLIENT_ID || '',
  dpssServiceClientIdKeyVaultUri: process.env.DPSS_SERVICE_CLIENT_ID_KEY_VAULT_URI || '',
  dpssServiceClientSecret: process.env.DPSS_SERVICE_CLIENT_SECRET || '',
  dpssServiceClientSecretKeyVaultUri: process.env.DPSS_SERVICE_CLIENT_SECRET_KEY_VAULT_URI || '',
  dpssUsDataProductsClientId: process.env.DPSS_US_DATA_PRODUCTS_CLIENT_ID || '',
  dpssUsDataProductsClientIdKeyVaultUri: process.env.DPSS_US_DATA_PRODUCTS_CLIENT_ID_KEY_VAULT_URI || '',
  dpssUsDataProductsClientSecret: process.env.DPSS_US_DATA_PRODUCTS_CLIENT_SECRET || '',
  dpssUsDataProductsClientSecretKeyVaultUri: process.env.DPSS_US_DATA_PRODUCTS_CLIENT_SECRET_KEY_VAULT_URI || '',
  dpssUsDataProductsScope: process.env.DPSS_US_DATA_PRODUCTS_SCOPE || 'DPSSSubscriberApi',
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 15000),
  recaptcha: {
    secret: process.env.RECAPTCHA_SECRET || '',
    siteKey: process.env.RECAPTCHA_SITE_KEY || '',
    verifyUrl: process.env.RECAPTCHA_VERIFY_URL || 'https://www.google.com/recaptcha/api/siteverify',
    minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.5)
  },
  databaseUrl: process.env.DATABASE_URL || '',
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  smtp: {
    mode: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local' ? 'local' : 'real',
    host: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local'
      ? (process.env.LOCAL_SMTP_HOST || 'localhost')
      : (process.env.SMTP_HOST || 'localhost'),
    port: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local'
      ? Number(process.env.LOCAL_SMTP_PORT || 1025)
      : Number(process.env.SMTP_PORT || 25),
    secure: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local'
      ? false
      : String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local'
      ? ''
      : (process.env.SMTP_USER || ''),
    pass: String(process.env.SMTP_MODE || 'real').trim().toLowerCase() === 'local'
      ? ''
      : (process.env.SMTP_PASS || ''),
    from: process.env.SMTP_FROM || 'no-reply@itrontotal.com',
    alertEmails: parseCsv(process.env.ALERT_EMAILS)
  },
  cors: {
    allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS)
  },
  keyVault: {
    allowEnvFallback: String(process.env.KEY_VAULT_ALLOW_ENV_FALLBACK || ((process.env.NODE_ENV || 'development') === 'production' ? 'false' : 'true')).toLowerCase() === 'true'
  }
};

module.exports = { config, parseCsv, parseRegionEnvironmentMap };
