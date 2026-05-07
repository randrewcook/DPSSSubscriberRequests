const axios = require('axios');
const { config } = require('../config');

async function verifyRecaptcha(token, remoteIp) {
  if (!config.recaptcha.secret) {
    if (config.isProd) {
      throw new Error('RECAPTCHA_SECRET is required in production.');
    }
    // Dev bypass: skip verification when no secret is configured
    return { success: true, score: 1.0, errorCodes: [] };
  }

  const body = new URLSearchParams({
    secret: config.recaptcha.secret,
    response: token,
    remoteip: remoteIp || ''
  });

  const response = await axios.post(config.recaptcha.verifyUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: config.upstreamTimeoutMs
  });

  const data = response.data || {};
  return {
    success: Boolean(data.success),
    score: Number(data.score || 0),
    errorCodes: Array.isArray(data['error-codes']) ? data['error-codes'] : []
  };
}

module.exports = { verifyRecaptcha };
