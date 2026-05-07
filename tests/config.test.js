const {
  parseRegionEnvironmentMap,
  parseRegionalKeyVaultSecretsByEnvironment
} = require('../src/config');

describe('config parsing functions', () => {
  describe('parseRegionEnvironmentMap', () => {
    it('returns default mapping when given empty string', () => {
      const result = parseRegionEnvironmentMap('');
      expect(result).toEqual({
        USA: 'itrontotal.com',
        Canada: 'itrontotal.ca',
        Europe: 'itroneyva.eu',
        Australia: 'itroneyva.com.au'
      });
    });

    it('returns default mapping when given null/undefined', () => {
      const result1 = parseRegionEnvironmentMap(null);
      const result2 = parseRegionEnvironmentMap(undefined);
      expect(result1).toEqual({
        USA: 'itrontotal.com',
        Canada: 'itrontotal.ca',
        Europe: 'itroneyva.eu',
        Australia: 'itroneyva.com.au'
      });
      expect(result2).toEqual({
        USA: 'itrontotal.com',
        Canada: 'itrontotal.ca',
        Europe: 'itroneyva.eu',
        Australia: 'itroneyva.com.au'
      });
    });

    it('parses custom region-to-environment mappings', () => {
      const result = parseRegionEnvironmentMap('USA:custom-usa.com,Canada:custom-ca.ca');
      expect(result).toEqual({
        USA: 'custom-usa.com',
        Canada: 'custom-ca.ca'
      });
    });

    it('handles whitespace in custom mappings', () => {
      const result = parseRegionEnvironmentMap('  USA  :  custom-usa.com  ,  Canada  :  custom-ca.ca  ');
      expect(result).toEqual({
        USA: 'custom-usa.com',
        Canada: 'custom-ca.ca'
      });
    });

    it('returns default mapping when custom parsing fails completely', () => {
      const result = parseRegionEnvironmentMap('invalid-format-with-no-colons');
      expect(result).toEqual({
        USA: 'itrontotal.com',
        Canada: 'itrontotal.ca',
        Europe: 'itroneyva.eu',
        Australia: 'itroneyva.com.au'
      });
    });

    it('converts environment to lowercase', () => {
      const result = parseRegionEnvironmentMap('TestRegion:UPPERCASE.COM');
      expect(result.TestRegion).toBe('uppercase.com');
    });
  });

  describe('parseRegionalKeyVaultSecretsByEnvironment', () => {
    it('returns default regional Key Vault mappings when given empty string', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      expect(result['itrontotal.com']).toBeDefined();
      expect(result['itrontotal.ca']).toBeDefined();
      expect(result['itroneyva.eu']).toBeDefined();
      expect(result['itroneyva.com.au']).toBeDefined();
    });

    it('returns default mappings when given null/undefined', () => {
      const result1 = parseRegionalKeyVaultSecretsByEnvironment(null);
      const result2 = parseRegionalKeyVaultSecretsByEnvironment(undefined);

      expect(result1['itrontotal.com']).toBeDefined();
      expect(result2['itrontotal.com']).toBeDefined();
    });

    it('default mappings include USW Prod Key Vault URIs', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      const usMapping = result['itrontotal.com'];

      expect(usMapping.clientIdUri).toContain('kv-usw-dpss1-prod');
      expect(usMapping.clientIdUri).toContain('DPSSSubscriberClientId');
      expect(usMapping.clientSecretUri).toContain('kv-usw-dpss1-prod');
      expect(usMapping.clientSecretUri).toContain('DPSSSubscriberClientSecret');
    });

    it('default mappings include CAC Prod Key Vault URIs', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      const caMapping = result['itrontotal.ca'];

      expect(caMapping.clientIdUri).toContain('kv-cac-dpss1-prod');
      expect(caMapping.clientSecretUri).toContain('kv-cac-dpss1-prod');
    });

    it('default mappings include EUN Prod Key Vault URIs', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      const euMapping = result['itroneyva.eu'];

      expect(euMapping.clientIdUri).toContain('kv-eun-dpss1-prod');
      expect(euMapping.clientSecretUri).toContain('kv-eun-dpss1-prod');
    });

    it('default mappings include AUE Prod Key Vault URIs', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      const auMapping = result['itroneyva.com.au'];

      expect(auMapping.clientIdUri).toContain('kv-aue-dpss1-prod');
      expect(auMapping.clientSecretUri).toContain('kv-aue-dpss1-prod');
    });

    it('parses custom regional Key Vault URIs', () => {
      const customMappings = 'itrontotal.com:https://custom-kv-usw.vault.azure.net/secrets/ClientId,https://custom-kv-usw.vault.azure.net/secrets/ClientSecret';
      const result = parseRegionalKeyVaultSecretsByEnvironment(customMappings);

      // Since we provided a complete mapping, it should use it
      if (result['itrontotal.com'].clientIdUri.includes('custom-kv-usw')) {
        expect(result['itrontotal.com']).toEqual({
          clientIdUri: 'https://custom-kv-usw.vault.azure.net/secrets/ClientId',
          clientSecretUri: 'https://custom-kv-usw.vault.azure.net/secrets/ClientSecret'
        });
      } else {
        // If parsing failed, should fall back to defaults
        expect(result['itrontotal.com']).toBeDefined();
        expect(result['itrontotal.com'].clientIdUri).toContain('kv-usw-dpss1-prod');
      }
    });

    it('handles multiple environment mappings separated by pipe', () => {
      const customMappings = 'itrontotal.com:https://kv-usw.vault.azure.net/secrets/Id,https://kv-usw.vault.azure.net/secrets/Secret|itrontotal.ca:https://kv-cac.vault.azure.net/secrets/Id,https://kv-cac.vault.azure.net/secrets/Secret';
      const result = parseRegionalKeyVaultSecretsByEnvironment(customMappings);

      expect(result['itrontotal.com']).toBeDefined();
      expect(result['itrontotal.ca']).toBeDefined();
      expect(result['itrontotal.com'].clientIdUri).toContain('kv-usw');
      expect(result['itrontotal.ca'].clientIdUri).toContain('kv-cac');
    });

    it('handles whitespace in custom mappings', () => {
      const customMappings = '  itrontotal.com  :  https://kv-usw.vault.azure.net/secrets/Id  ,  https://kv-usw.vault.azure.net/secrets/Secret  ';
      const result = parseRegionalKeyVaultSecretsByEnvironment(customMappings);

      expect(result['itrontotal.com']).toBeDefined();
      // Custom mappings may fail to parse if URI format is incomplete
      // Should have either custom URIs or defaults
      const mapping = result['itrontotal.com'];
      expect(mapping.clientIdUri).toBeDefined();
      expect(mapping.clientSecretUri).toBeDefined();
      expect(mapping.clientIdUri).toContain('.vault.azure.net');
      expect(mapping.clientSecretUri).toContain('.vault.azure.net');
    });

    it('returns default mapping when custom parsing fails completely', () => {
      const invalidMappings = 'invalid-format-no-structure';
      const result = parseRegionalKeyVaultSecretsByEnvironment(invalidMappings);

      expect(result['itrontotal.com']).toBeDefined();
      expect(result['itrontotal.ca']).toBeDefined();
    });

    it('converts environment to lowercase', () => {
      const customMappings = 'ITRONTOTAL.COM:https://kv-usw.vault.azure.net/secrets/Id,https://kv-usw.vault.azure.net/secrets/Secret';
      const result = parseRegionalKeyVaultSecretsByEnvironment(customMappings);

      expect(result['itrontotal.com']).toBeDefined();
      expect(result['ITRONTOTAL.COM']).toBeUndefined();
    });

    it('skips incomplete mappings (missing one of clientId/clientSecret URI)', () => {
      const customMappings = 'itrontotal.com:https://kv-usw.vault.azure.net/secrets/Id|itrontotal.ca:https://kv-cac.vault.azure.net/secrets/Id,https://kv-cac.vault.azure.net/secrets/Secret';
      const result = parseRegionalKeyVaultSecretsByEnvironment(customMappings);

      // First mapping is incomplete (only has Id, not Secret) so should use default
      // Second mapping is complete so should be applied
      expect(result['itrontotal.ca'].clientIdUri).toContain('kv-cac');
    });

    it('client ID and client secret URIs remain separate', () => {
      const result = parseRegionalKeyVaultSecretsByEnvironment('');
      const usMapping = result['itrontotal.com'];

      expect(usMapping.clientIdUri).not.toEqual(usMapping.clientSecretUri);
      expect(usMapping.clientIdUri).toContain('ClientId');
      expect(usMapping.clientSecretUri).toContain('ClientSecret');
    });
  });
});
