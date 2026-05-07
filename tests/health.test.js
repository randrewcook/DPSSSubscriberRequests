const request = require('supertest');
const { app } = require('../src/app');
const { config } = require('../src/config');

describe('health endpoint', () => {
  it('returns ok status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('configuration health', () => {
  it('has region-to-environment mappings configured', () => {
    expect(config.regionEnvironmentMap).toBeDefined();
    expect(typeof config.regionEnvironmentMap).toBe('object');
    expect(Object.keys(config.regionEnvironmentMap).length).toBeGreaterThan(0);
  });

  it('includes standard regions in environment mappings', () => {
    const expectedRegions = ['USA', 'Canada', 'Europe', 'Australia'];
    for (const region of expectedRegions) {
      expect(config.regionEnvironmentMap[region]).toBeDefined();
      expect(typeof config.regionEnvironmentMap[region]).toBe('string');
    }
  });

  it('maps regions to expected Prod environments', () => {
    expect(config.regionEnvironmentMap.USA).toBe('itrontotal.com');
    expect(config.regionEnvironmentMap.Canada).toBe('itrontotal.ca');
    expect(config.regionEnvironmentMap.Europe).toBe('itroneyva.eu');
    expect(config.regionEnvironmentMap.Australia).toBe('itroneyva.com.au');
  });

  it('has regional Key Vault secret mappings configured', () => {
    expect(config.regionalKeyVaultSecretsByEnvironment).toBeDefined();
    expect(typeof config.regionalKeyVaultSecretsByEnvironment).toBe('object');
  });

  it('includes Key Vault mappings for all Prod environments', () => {
    const prodEnvironments = [
      'itrontotal.com',
      'itrontotal.ca',
      'itroneyva.eu',
      'itroneyva.com.au'
    ];

    for (const env of prodEnvironments) {
      expect(config.regionalKeyVaultSecretsByEnvironment[env]).toBeDefined();
      const mapping = config.regionalKeyVaultSecretsByEnvironment[env];
      expect(mapping.clientIdUri).toBeDefined();
      expect(mapping.clientSecretUri).toBeDefined();
    }
  });

  it('Key Vault URIs point to regional vaults', () => {
    const uswMapping = config.regionalKeyVaultSecretsByEnvironment['itrontotal.com'];
    expect(uswMapping.clientIdUri).toContain('kv-usw-dpss1-prod');
    expect(uswMapping.clientSecretUri).toContain('kv-usw-dpss1-prod');

    const cacMapping = config.regionalKeyVaultSecretsByEnvironment['itrontotal.ca'];
    expect(cacMapping.clientIdUri).toContain('kv-cac-dpss1-prod');
    expect(cacMapping.clientSecretUri).toContain('kv-cac-dpss1-prod');

    const eunMapping = config.regionalKeyVaultSecretsByEnvironment['itroneyva.eu'];
    expect(eunMapping.clientIdUri).toContain('kv-eun-dpss1-prod');
    expect(eunMapping.clientSecretUri).toContain('kv-eun-dpss1-prod');

    const aueMapping = config.regionalKeyVaultSecretsByEnvironment['itroneyva.com.au'];
    expect(aueMapping.clientIdUri).toContain('kv-aue-dpss1-prod');
    expect(aueMapping.clientSecretUri).toContain('kv-aue-dpss1-prod');
  });

  it('Key Vault secret URIs reference correct secret names', () => {
    for (const env of Object.keys(config.regionalKeyVaultSecretsByEnvironment)) {
      const mapping = config.regionalKeyVaultSecretsByEnvironment[env];
      expect(mapping.clientIdUri).toContain('DPSSSubscriberClientId');
      expect(mapping.clientSecretUri).toContain('DPSSSubscriberClientSecret');
    }
  });

  it('clientId and clientSecret URIs are distinct', () => {
    for (const env of Object.keys(config.regionalKeyVaultSecretsByEnvironment)) {
      const mapping = config.regionalKeyVaultSecretsByEnvironment[env];
      expect(mapping.clientIdUri).not.toEqual(mapping.clientSecretUri);
    }
  });

  it('Key Vault URIs use https protocol', () => {
    for (const env of Object.keys(config.regionalKeyVaultSecretsByEnvironment)) {
      const mapping = config.regionalKeyVaultSecretsByEnvironment[env];
      expect(mapping.clientIdUri).toMatch(/^https:\/\//);
      expect(mapping.clientSecretUri).toMatch(/^https:\/\//);
    }
  });

  it('region count matches environment count', () => {
    const regionCount = Object.keys(config.regionEnvironmentMap).length;
    const envCount = Object.values(config.regionEnvironmentMap).length;
    expect(regionCount).toEqual(envCount);
  });

  it('all mapped environments have Key Vault configurations', () => {
    const mappedEnvironments = new Set(Object.values(config.regionEnvironmentMap));
    for (const env of mappedEnvironments) {
      expect(config.regionalKeyVaultSecretsByEnvironment[env]).toBeDefined();
    }
  });

  it('Key Vault fallback is appropriately set for environment', () => {
    expect(config.keyVault.allowEnvFallback).toBeDefined();
    expect(typeof config.keyVault.allowEnvFallback).toBe('boolean');

    // In development, fallback should be enabled by default
    if (config.nodeEnv === 'development') {
      expect(config.keyVault.allowEnvFallback).toBe(true);
    }

    // In production, fallback should be disabled by default
    if (config.nodeEnv === 'production') {
      expect(config.keyVault.allowEnvFallback).toBe(false);
    }
  });
});
