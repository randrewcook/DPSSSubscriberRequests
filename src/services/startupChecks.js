const { config } = require('../config');
const { logger } = require('../logger');
const { resolveProtectedValue } = require('./secretProvider');

async function verifyKeyVaultSecrets() {
  const serviceSecretUri = String(config.dpssServiceClientSecretKeyVaultUri || '').trim();
  const usSecretUri = String(config.dpssUsDataProductsClientSecretKeyVaultUri || '').trim();
  if (serviceSecretUri && usSecretUri && serviceSecretUri === usSecretUri) {
    logger.warn({ serviceSecretUri, usSecretUri }, 'Startup check: service and US data-products Key Vault secret URIs are identical; confirm this is intentional');
  }

  const secretTargets = [
    {
      label: 'DPSS service client id',
      value: config.dpssServiceClientId,
      secretUri: config.dpssServiceClientIdKeyVaultUri
    },
    {
      label: 'DPSS service client secret',
      value: config.dpssServiceClientSecret,
      secretUri: config.dpssServiceClientSecretKeyVaultUri
    },
    {
      label: 'DPSS US data products client id',
      value: config.dpssUsDataProductsClientId,
      secretUri: config.dpssUsDataProductsClientIdKeyVaultUri
    },
    {
      label: 'DPSS US data products client secret',
      value: config.dpssUsDataProductsClientSecret,
      secretUri: config.dpssUsDataProductsClientSecretKeyVaultUri
    }
  ].filter((item) => item.secretUri);

  if (secretTargets.length === 0) {
    return;
  }

  for (const target of secretTargets) {
    try {
      await resolveProtectedValue(target);
      logger.info({ label: target.label }, 'Startup check: Key Vault secret resolved successfully');
    } catch (error) {
      logger.warn({ err: error, label: target.label }, 'Startup check: failed to resolve Key Vault secret; verify Azure auth and secret URI');
    }
  }
}

module.exports = {
  verifyKeyVaultSecrets
};