const request = require('supertest');
const { jest: jestObject } = require('@jest/globals');

function loadAppWithEnv(overrides) {
  const keys = Object.keys(overrides || {});
  const previous = {};
  for (const key of keys) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  jestObject.resetModules();
  const { app } = require('../src/app');

  for (const key of keys) {
    if (previous[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous[key];
    }
  }

  return app;
}

describe('security regressions', () => {
  it('denies bootstrap when bootstrap feature is disabled', async () => {
    const app = loadAppWithEnv({
      ADMIN_BOOTSTRAP_ENABLED: 'false'
    });

    const response = await request(app)
      .post('/api/admin/auth/bootstrap')
      .send({ email: 'admin@example.com', password: 'VeryStrongPassword123!' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('disabled');
  });

  it('requires bootstrap token when bootstrap feature is enabled', async () => {
    const app = loadAppWithEnv({
      ADMIN_BOOTSTRAP_ENABLED: 'true',
      ADMIN_BOOTSTRAP_TOKEN: 'bootstrap-secret-token'
    });

    const response = await request(app)
      .post('/api/admin/auth/bootstrap')
      .send({ email: 'admin@example.com', password: 'VeryStrongPassword123!' });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid bootstrap token');
  });

  it('rejects invalid bootstrap token', async () => {
    const app = loadAppWithEnv({
      ADMIN_BOOTSTRAP_ENABLED: 'true',
      ADMIN_BOOTSTRAP_TOKEN: 'bootstrap-secret-token'
    });

    const response = await request(app)
      .post('/api/admin/auth/bootstrap')
      .set('x-bootstrap-token', 'wrong-token')
      .send({ email: 'admin@example.com', password: 'VeryStrongPassword123!' });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid bootstrap token');
  });

  it('denies cross-origin browser requests from unknown origins', async () => {
    const app = loadAppWithEnv({
      ALLOWED_ORIGINS: 'http://localhost:3012'
    });

    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://evil.example.com');

    expect(response.status).toBe(500);
  });

  it('allows cross-origin browser requests from allowlisted origins', async () => {
    const app = loadAppWithEnv({
      ALLOWED_ORIGINS: 'http://localhost:3012'
    });

    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3012');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3012');
  });

  it('includes admin-side HTML escaping helper in admin UI script', () => {
    const fs = require('fs');
    const path = require('path');
    const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.js'), 'utf8');

    expect(script).toContain('function escapeHtml(value)');
    expect(script).toContain('requestsBody.innerHTML');
    expect(script).toContain('escapeHtml(');
  });

  it('requires JWT secret in runtime configuration', () => {
    const appFactory = () => loadAppWithEnv({ JWT_SECRET: '' });
    expect(appFactory).toThrow('JWT_SECRET must be configured');
  });
});
