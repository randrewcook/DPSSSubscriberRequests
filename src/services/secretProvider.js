const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');
const { logger } = require('../logger');

const secretCache = new Map();
let credential;

function ensureAzureCliOnWindowsPath() {
  if (process.platform !== 'win32') {
    return;
  }

  const cliDir = path.join('C:', 'Program Files', 'Microsoft SDKs', 'Azure', 'CLI2', 'wbin');
  const cliCommand = path.join(cliDir, 'az.cmd');
  const currentPath = String(process.env.PATH || '');
  const hasCliDir = currentPath.toLowerCase().split(';').includes(cliDir.toLowerCase());

  if (!hasCliDir && fs.existsSync(cliCommand)) {
    process.env.PATH = `${currentPath};${cliDir}`;
  }
}

function getCredential() {
  if (!credential) {
    ensureAzureCliOnWindowsPath();
    credential = new DefaultAzureCredential();
  }
  return credential;
}

function parseSecretUri(secretUri) {
  const url = new URL(String(secretUri || '').trim());
  const match = url.pathname.match(/^\/secrets\/([^/]+)(?:\/([^/]+))?\/?$/i);
  if (!match) {
    throw new Error(`Invalid Azure Key Vault secret URI: ${secretUri}`);
  }

  return {
    vaultUrl: `${url.protocol}//${url.host}`,
    secretName: decodeURIComponent(match[1]),
    secretVersion: match[2] ? decodeURIComponent(match[2]) : undefined
  };
}

async function getSecretFromKeyVault(secretUri, label) {
  const cacheKey = String(secretUri || '').trim();
  if (secretCache.has(cacheKey)) {
    return secretCache.get(cacheKey);
  }

  const { vaultUrl, secretName, secretVersion } = parseSecretUri(secretUri);
  const client = new SecretClient(vaultUrl, getCredential());
  const response = await client.getSecret(secretName, secretVersion ? { version: secretVersion } : undefined);

  if (!response.value) {
    throw new Error(`${label || secretName} was empty in Azure Key Vault.`);
  }

  secretCache.set(cacheKey, response.value);
  logger.info({ secretName, vaultUrl, label }, 'Loaded secret from Azure Key Vault');
  return response.value;
}

async function resolveProtectedValue({ value, secretUri, label }) {
  const fallbackValue = String(value || '');
  if (secretUri) {
    try {
      return await getSecretFromKeyVault(secretUri, label);
    } catch (error) {
      const isCredentialUnavailable = /chainedtokencredential authentication failed|credentialunavailableerror/i.test(String(error?.message || ''));
      if (config.keyVault.allowEnvFallback && fallbackValue) {
        logger.warn({ label, secretUri }, 'Key Vault resolution failed; using configured fallback value because KEY_VAULT_ALLOW_ENV_FALLBACK=true');
        return fallbackValue;
      }

      const hint = isCredentialUnavailable
        ? 'Azure auth unavailable. Configure AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET or install Azure CLI and run az login.'
        : 'Verify the secret URI and Key Vault access policy/RBAC permissions.';
      throw new Error(`${label || 'Protected value'} could not be loaded from Azure Key Vault. ${hint}`, { cause: error });
    }
  }

  return fallbackValue;
}

module.exports = {
  resolveProtectedValue
};