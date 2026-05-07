const { randomUUID } = require('crypto');
const axios = require('axios');
const { config } = require('../config');

function resolveServers(environment) {
  const normalized = String(environment || '').trim().toLowerCase();
  if (!config.dpssAllowedEnvironments.includes(normalized)) {
    throw new Error(`Environment is not allowed: ${environment}`);
  }
  return {
    tokenServer: `https://idenserver.${normalized}`,
    apiServer: `https://k8s.${normalized}`
  };
}

async function fetchAccessToken({ clientId, clientSecret, environment, scope = 'DPSSApi DPSSSubscriberApi DIDCReceiverAPI' }) {
  const { tokenServer } = resolveServers(environment);
  const tokenUrl = new URL('/connect/token', tokenServer).toString();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });
  if (scope) {
    body.set('scope', scope);
  }

  const response = await axios.post(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: config.upstreamTimeoutMs
  });

  if (!response.data || !response.data.access_token) {
    throw new Error('Token response did not contain access_token.');
  }

  return response.data.access_token;
}

async function getDataProducts({ clientId, clientSecret, environment, tokenScope }) {
  const { apiServer } = resolveServers(environment);
  const token = await fetchAccessToken({ clientId, clientSecret, environment, scope: tokenScope });

  const response = await axios.get(new URL('/dpss/api/v1/data-products', apiServer).toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Itron-CorrelationId': randomUUID(),
      Accept: 'application/json'
    },
    timeout: config.upstreamTimeoutMs
  });

  return Array.isArray(response.data) ? response.data : [];
}

async function getDataSubscribers({ clientId, clientSecret, environment, tokenScope }) {
  const { apiServer } = resolveServers(environment);
  const token = await fetchAccessToken({ clientId, clientSecret, environment, scope: tokenScope });

  const response = await axios.get(new URL('/dpss/api/v1/data-subscribers', apiServer).toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Itron-CorrelationId': randomUUID(),
      Accept: 'application/json'
    },
    timeout: config.upstreamTimeoutMs
  });

  return Array.isArray(response.data) ? response.data : [];
}

async function getSubscriptions({ subscriberId, clientId, clientSecret, environment }) {
  const { apiServer } = resolveServers(environment);
  const token = await fetchAccessToken({ clientId, clientSecret, environment });

  const path = `/dpss/api/v1/data-subscribers/${subscriberId}/subscriptions`;
  const response = await axios.get(new URL(path, apiServer).toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Itron-CorrelationId': randomUUID(),
      Accept: 'application/json'
    },
    timeout: config.upstreamTimeoutMs
  });

  return Array.isArray(response.data) ? response.data : [];
}

module.exports = {
  resolveServers,
  fetchAccessToken,
  getDataProducts,
  getDataSubscribers,
  getSubscriptions
};
