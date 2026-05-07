const request = require('supertest');
const { app } = require('../src/app');
const { config } = require('../src/config');

describe('public API', () => {
  describe('POST /api/public/validate-existing', () => {
    it('returns validation failure for missing credentials', async () => {
      const response = await request(app)
        .post('/api/public/validate-existing')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('returns validation failure for invalid region', async () => {
      const response = await request(app)
        .post('/api/public/validate-existing')
        .send({
          subscriberId: '00000000-0000-0000-0000-000000000000',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          region: 'invalid-region'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('validates that region maps to configured environment', async () => {
      const response = await request(app)
        .post('/api/public/validate-existing')
        .send({
          subscriberId: '00000000-0000-0000-0000-000000000000',
          region: 'USA'
        });

      // Should fail on credentials, not on region mapping
      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).not.toContain('No environment mapping');
    });

    it('supports all configured regions', async () => {
      const regions = Object.keys(config.regionEnvironmentMap);
      expect(regions.length).toBeGreaterThan(0);

      for (const region of regions) {
        const response = await request(app)
          .post('/api/public/validate-existing')
          .send({
            subscriberId: '00000000-0000-0000-0000-000000000000',
            region
          });

        // Should fail on credentials, not on region/environment resolution
        expect(response.status).toBe(400);
        expect(response.body.error).not.toContain('No environment mapping');
        expect(response.body.error).not.toContain('region is required');
      }
    }, 30000);
  });

  describe('POST /api/public/data-products', () => {
    it('returns 400 for an invalid region', async () => {
      const response = await request(app)
        .post('/api/public/data-products')
        .send({ region: 'InvalidRegion' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('returns empty array when credentials are missing (non-error case)', async () => {
      const response = await request(app)
        .post('/api/public/data-products')
        .send({ region: 'USA' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('supports all configured regions in data-products endpoint', async () => {
      const regions = Object.keys(config.regionEnvironmentMap);

      for (const region of regions) {
        const response = await request(app)
          .post('/api/public/data-products')
          .send({ region });

        // Should succeed (200) and return array, or fail gracefully (400 with error)
        // but should NOT fail due to region/environment resolution
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
        } else if (response.status === 400) {
          // Expected when credentials are not configured, but should not be about region mapping
          expect(response.body.error).toBeDefined();
          expect(response.body.error).not.toContain('No environment mapping');
        } else {
          throw new Error(`Unexpected status ${response.status} for region ${region}`);
        }
      }
    }, 30000);
  });

  describe('GET /region-environment-map', () => {
    it('returns configured region-to-environment mappings', async () => {
      const response = await request(app)
        .get('/region-environment-map');

      expect(response.status).toBe(200);
      expect(response.body.mapping).toBeDefined();
      expect(typeof response.body.mapping).toBe('object');

      const expectedRegions = Object.keys(config.regionEnvironmentMap);
      for (const region of expectedRegions) {
        expect(response.body.mapping[region]).toBeDefined();
      }
    });

    it('includes Prod environment mappings for all regions', async () => {
      const response = await request(app)
        .get('/region-environment-map');

      const mapping = response.body.mapping;
      expect(mapping.USA).toBe('itrontotal.com');
      expect(mapping.Canada).toBe('itrontotal.ca');
      expect(mapping.Europe).toBe('itroneyva.eu');
      expect(mapping.Australia).toBe('itroneyva.com.au');
    });
  });
});

describe('admin API', () => {
  describe('POST /api/admin/auth/login', () => {
    it('rejects login without credentials', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/requests', () => {
    it('rejects request without auth token', async () => {
      const response = await request(app)
        .get('/api/admin/requests');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('rejects request with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/requests')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
