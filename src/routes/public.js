const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../db');
const { config } = require('../config');
const { logger } = require('../logger');
const { requestSubmissionSchema } = require('../validation');
const { verifyRecaptcha } = require('../services/captcha');
const { getDataProducts, getDataSubscribers, getSubscriptions } = require('../services/dpssClient');
const { sendRequestSubmittedEmails } = require('../services/email');
const { resolveProtectedValue } = require('../services/secretProvider');

const router = express.Router();

async function resolveRegionCredentials(region, environment) {
  const hasUsClientId = config.dpssUsDataProductsClientId || config.dpssUsDataProductsClientIdKeyVaultUri;
  const hasUsClientSecret = config.dpssUsDataProductsClientSecret || config.dpssUsDataProductsClientSecretKeyVaultUri;
  if (region === 'USA' && hasUsClientId && hasUsClientSecret) {
    return {
      clientId: await resolveProtectedValue({ value: config.dpssUsDataProductsClientId, secretUri: config.dpssUsDataProductsClientIdKeyVaultUri, label: 'DPSS US data products client id' }),
      clientSecret: await resolveProtectedValue({ value: config.dpssUsDataProductsClientSecret, secretUri: config.dpssUsDataProductsClientSecretKeyVaultUri, label: 'DPSS US data products client secret' }),
      tokenScope: config.dpssUsDataProductsScope
    };
  }

  // Try regional Key Vault credentials first (by environment domain)
  const regionalSecrets = config.regionalKeyVaultSecretsByEnvironment[environment];
  if (regionalSecrets && (regionalSecrets.clientIdUri || regionalSecrets.clientSecretUri)) {
    const regionClientId = await resolveProtectedValue({ value: '', secretUri: regionalSecrets.clientIdUri, label: `DPSS regional client id for ${region}` });
    const regionClientSecret = await resolveProtectedValue({ value: '', secretUri: regionalSecrets.clientSecretUri, label: `DPSS regional client secret for ${region}` });
    if (regionClientId && regionClientSecret) {
      return {
        clientId: regionClientId,
        clientSecret: regionClientSecret,
        tokenScope: undefined
      };
    }
  }

  // Fallback to service account credentials
  return {
    clientId: await resolveProtectedValue({ value: config.dpssServiceClientId, secretUri: config.dpssServiceClientIdKeyVaultUri, label: 'DPSS service client id' }),
    clientSecret: await resolveProtectedValue({ value: config.dpssServiceClientSecret, secretUri: config.dpssServiceClientSecretKeyVaultUri, label: 'DPSS service client secret' }),
    tokenScope: undefined
  };
}

async function connectWithRetry(maxAttempts = 4, waitMs = 250) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.connect();
    } catch (error) {
      lastError = error;
      const retryableCodes = new Set(['EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND']);
      const code = String(error?.code || '').toUpperCase();
      const aggregate = Array.isArray(error?.aggregateErrors) ? error.aggregateErrors : [];
      const aggregateRetryable = aggregate.some((item) => retryableCodes.has(String(item?.code || '').toUpperCase()));
      const isRetryable = retryableCodes.has(code) || aggregateRetryable;
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

function resolveEnvironmentForRequest(body) {
  const region = String(body?.region || '').trim();
  if (region) {
    const mappedEnvironment = config.regionEnvironmentMap[region];
    if (!mappedEnvironment) {
      throw new Error(`No environment mapping configured for region: ${region}`);
    }
    return mappedEnvironment;
  }

  const environment = String(body?.environment || '').trim().toLowerCase();
  if (environment) {
    return environment;
  }

  throw new Error('region is required to resolve environment.');
}

function normalizeRegionForStorage(region) {
  const value = String(region || '').trim();
  if (!value) {
    return value;
  }

  if (value === 'Europe') {
    return 'EU';
  }

  return value;
}

function isDbUnavailableError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (code === 'EAI_AGAIN' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === '57P01') {
    return true;
  }

  const aggregate = Array.isArray(error?.aggregateErrors) ? error.aggregateErrors : [];
  if (aggregate.some((item) => String(item?.code || '').toUpperCase() === 'ECONNREFUSED')) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return message.includes('connection terminated unexpectedly') || message.includes('terminating connection due to administrator command');
}

async function storeDevFallbackRequest(payload) {
  const dir = path.join(process.cwd(), '.runtime');
  const filePath = path.join(dir, 'dev-fallback-requests.jsonl');
  const id = `DEV-${Date.now()}`;
  const entry = {
    id,
    createdAt: new Date().toISOString(),
    region: payload.region,
    subscriber: payload.subscriber,
    products: payload.products,
    productTenants: payload.productTenants
  };

  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  return id;
}

router.post('/validate-existing', async (req, res) => {
  try {
    const { subscriberId, region } = req.body || {};
    if (!subscriberId || !region) {
      return res.status(400).json({ error: 'subscriberId and region are required.' });
    }

    const environment = resolveEnvironmentForRequest(req.body);
    const { clientId, clientSecret, tokenScope } = await resolveRegionCredentials(region, environment);

    if (!clientId || !clientSecret) {
      return res.status(400).json({ valid: false, error: 'Service credentials are not configured for this region.' });
    }

    const [allSubscribers, subscriptions] = await Promise.all([
      getDataSubscribers({ clientId, clientSecret, environment, tokenScope }),
      getSubscriptions({ subscriberId, clientId, clientSecret, environment })
    ]);

    const matched = allSubscribers.find((s) => s.dataSubscriberId === subscriberId);
    if (!matched) {
      return res.status(400).json({ valid: false, error: 'Subscriber ID not found.' });
    }

    return res.json({
      valid: true,
      region,
      subscriber: {
        firstName: String(matched.firstName || ''),
        lastName: String(matched.lastName || ''),
        companyName: String(matched.companyName || ''),
        email: String(matched.email || '')
      },
      subscriptions
    });
  } catch (error) {
    return res.status(400).json({ valid: false, error: error.message || 'Validation failed.' });
  }
});

router.post('/data-products', async (req, res) => {
  try {
    const region = String(req.body?.region || '').trim();
    const environment = resolveEnvironmentForRequest(req.body);
    let excluded = new Set();
    try {
      const rows = await pool.query('SELECT data_product_id FROM data_product_exclusions WHERE is_active = true');
      excluded = new Set(rows.rows.map((item) => item.data_product_id));
    } catch (error) {
      logger.warn({ err: error }, 'Unable to load data product exclusions; continuing without exclusions');
    }

    const { clientId, clientSecret, tokenScope: regionTokenScope } = await resolveRegionCredentials(region, environment);
    const useUsSharedCredentials = region === 'USA';

    if (!clientId || !clientSecret) {
      return res.json([]);
    }

    const dataProducts = await getDataProducts({
      clientId,
      clientSecret,
      environment,
      tokenScope: useUsSharedCredentials ? regionTokenScope : undefined
    });
    const filtered = dataProducts.filter((item) => !excluded.has(String(item.dataProductId || item.id || '')));

    return res.json(filtered);
  } catch (error) {
    const message = String(error?.message || 'Unable to fetch data products.');
    const keyVaultFailure = /could not be loaded from azure key vault/i.test(message);
    return res.status(400).json({
      error: keyVaultFailure
        ? 'Unable to fetch data products because secure credentials are unavailable.'
        : (error.message || 'Unable to fetch data products.'),
      details: config.isProd ? undefined : {
        region: String(req.body?.region || '').trim(),
        keyVault: keyVaultFailure ? 'Configure Azure credentials (az login or AZURE_* env vars), or set local fallback credentials.' : undefined,
        environment: (() => {
          try {
            return resolveEnvironmentForRequest(req.body);
          } catch {
            return null;
          }
        })()
      }
    });
  }
});

router.post('/requests', async (req, res) => {
  let client;
  let onClientError;
  try {
    client = await connectWithRetry();
    onClientError = (err) => {
      logger.error({ err }, 'PostgreSQL client error while handling public request submission');
    };
    client.on('error', onClientError);

    const parseResult = requestSubmissionSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload.', details: parseResult.error.issues });
    }

    const payload = parseResult.data;
    const recaptcha = await verifyRecaptcha(payload.recaptchaToken, req.ip);
    if (!recaptcha.success || recaptcha.score < 0.5) {
      return res.status(400).json({ error: 'Captcha validation failed.', details: recaptcha.errorCodes });
    }

    await client.query('BEGIN');

    const requestResult = await client.query(
      `INSERT INTO subscription_requests
      (status, flow_type, region, subscriber_id, client_id, client_secret_masked, company_name, phone_number,
       company_address, first_name, last_name, email, sponsor_name, sponsor_email)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id`,
      [
        'New',
        payload.subscriber.flowType,
        normalizeRegionForStorage(payload.region),
        payload.subscriber.flowType === 'existing' ? payload.subscriber.subscriberId : null,
        null,
        null,
        payload.subscriber.companyName || null,
        payload.subscriber.flowType === 'new' ? payload.subscriber.phoneNumber : null,
        payload.subscriber.flowType === 'new' ? payload.subscriber.companyAddress : null,
        payload.subscriber.firstName || null,
        payload.subscriber.lastName || null,
        payload.subscriber.email || null,
        payload.subscriber.sponsorName || null,
        payload.subscriber.sponsorEmail || null
      ]
    );

    const requestId = requestResult.rows[0].id;

    for (const dataProductId of payload.products) {
      await client.query(
        'INSERT INTO request_product_selections (request_id, data_product_id) VALUES ($1, $2)',
        [requestId, dataProductId]
      );
    }

    for (const mapping of payload.productTenants) {
      for (const tenantId of mapping.tenantIds) {
        await client.query(
          'INSERT INTO request_product_tenants (request_id, data_product_id, tenant_id) VALUES ($1, $2, $3)',
          [requestId, mapping.dataProductId, tenantId]
        );
      }
    }

    await client.query(
      'INSERT INTO request_status_history (request_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
      [requestId, null, 'New', 'system', 'Initial submission']
    );

    await client.query('COMMIT');

    const emailResult = await sendRequestSubmittedEmails({
      requesterEmail: payload.subscriber.email || null,
      requestId,
      payload
    });

    if (emailResult.internal.attempted && !emailResult.internal.sent) {
      logger.warn({ err: emailResult.internal.error, requestId }, 'Internal notification email failed');
    }
    if (emailResult.requester.attempted && !emailResult.requester.sent) {
      logger.warn({ err: emailResult.requester.error, requestId }, 'Requester acknowledgment email failed');
    }

    return res.status(201).json({
      id: requestId,
      status: 'New',
      emailNotifications: {
        internal: emailResult.internal.attempted ? emailResult.internal.sent : null,
        requester: emailResult.requester.attempted ? emailResult.requester.sent : null
      }
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (isDbUnavailableError(error)) {
      if (!config.isProd) {
        const payload = requestSubmissionSchema.safeParse(req.body || {});
        if (payload.success) {
          try {
            const fallbackId = await storeDevFallbackRequest(payload.data);
            const emailResult = await sendRequestSubmittedEmails({
              requesterEmail: payload.data.subscriber.email || null,
              requestId: fallbackId,
              payload: payload.data
            });
            if (emailResult.internal.attempted && !emailResult.internal.sent) {
              logger.warn({ err: emailResult.internal.error, requestId: fallbackId }, 'Internal notification email failed for fallback request');
            }
            if (emailResult.requester.attempted && !emailResult.requester.sent) {
              logger.warn({ err: emailResult.requester.error, requestId: fallbackId }, 'Requester acknowledgment email failed for fallback request');
            }
            logger.warn({ err: error, fallbackId }, 'Database unavailable; request stored in development fallback file');
            return res.status(201).json({
              id: fallbackId,
              status: 'New',
              persisted: false,
              warning: 'Saved locally while database was unavailable.',
              emailNotifications: {
                internal: emailResult.internal.attempted ? emailResult.internal.sent : null,
                requester: emailResult.requester.attempted ? emailResult.requester.sent : null
              }
            });
          } catch (fallbackError) {
            logger.error({ err: fallbackError }, 'Failed to store development fallback request');
          }
        }
      }
      return res.status(503).json({ error: 'Database connection temporarily unavailable. Please retry.' });
    }
    logger.error({ err: error }, 'Failed to submit public subscription request');
    return res.status(500).json({ error: error.message || 'Could not submit request.' });
  } finally {
    if (client) {
      if (onClientError) {
        client.removeListener('error', onClientError);
      }
      client.release();
    }
  }
});

module.exports = router;
