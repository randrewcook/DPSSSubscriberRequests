const request = require('supertest');
const { app } = require('../src/app');

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
  });

  describe('POST /api/public/data-products', () => {
    it('returns 400 for an invalid region', async () => {
      const response = await request(app)
        .post('/api/public/data-products')
        .send({ region: 'InvalidRegion' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
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
