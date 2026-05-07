const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { config } = require('../config');
const { authenticateAdmin, signAdminToken, requireAdmin } = require('../auth');
const { statusUpdateSchema } = require('../validation');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const admin = await authenticateAdmin(email, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = signAdminToken(admin);
  return res.json({ token });
});

router.post('/auth/bootstrap', async (req, res) => {
  if (!config.auth.bootstrapEnabled) {
    return res.status(403).json({ error: 'Bootstrap is disabled.' });
  }

  const providedToken = String(req.headers['x-bootstrap-token'] || req.body?.bootstrapToken || '').trim();
  const expectedToken = String(config.auth.bootstrapToken || '').trim();
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: 'Invalid bootstrap token.' });
  }

  const existing = await pool.query('SELECT id FROM admin_users LIMIT 1');
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Bootstrap already completed.' });
  }

  const { email, password } = req.body || {};
  if (!email || !password || String(password).length < 12) {
    return res.status(400).json({ error: 'email and password (min 12 chars) are required.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  await pool.query(
    'INSERT INTO admin_users (email, password_hash, is_active) VALUES ($1, $2, true)',
    [String(email).trim().toLowerCase(), passwordHash]
  );

  return res.status(201).json({ ok: true });
});

router.get('/requests', requireAdmin, async (req, res) => {
  const statusFilter = String(req.query.status || 'open').toLowerCase();

  let sql = `
    SELECT id, status, flow_type, region, company_name, first_name, last_name, email, created_at, updated_at
    FROM subscription_requests
  `;
  const params = [];

  if (statusFilter === 'open') {
    sql += ' WHERE status IN ($1, $2)';
    params.push('New', 'In Review');
  } else if (['new', 'in review', 'complete', 'rejected'].includes(statusFilter)) {
    sql += ' WHERE status = $1';
    params.push(statusFilter === 'new' ? 'New' : statusFilter === 'in review' ? 'In Review' : statusFilter === 'complete' ? 'Complete' : 'Rejected');
  }

  sql += ' ORDER BY created_at DESC';
  const result = await pool.query(sql, params);
  return res.json(result.rows);
});

router.get('/requests/:id', requireAdmin, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ error: 'Invalid request id.' });
  }

  const requestResult = await pool.query('SELECT * FROM subscription_requests WHERE id = $1', [requestId]);
  if (!requestResult.rows.length) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  const products = await pool.query('SELECT data_product_id FROM request_product_selections WHERE request_id = $1', [requestId]);
  const tenants = await pool.query('SELECT data_product_id, tenant_id FROM request_product_tenants WHERE request_id = $1', [requestId]);
  const history = await pool.query('SELECT old_status, new_status, changed_by, notes, changed_at FROM request_status_history WHERE request_id = $1 ORDER BY changed_at ASC', [requestId]);

  return res.json({
    request: requestResult.rows[0],
    products: products.rows,
    tenants: tenants.rows,
    history: history.rows
  });
});

router.patch('/requests/:id/status', requireAdmin, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ error: 'Invalid request id.' });
  }

  const parseResult = statusUpdateSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const { status } = parseResult.data;
  const existing = await pool.query('SELECT status FROM subscription_requests WHERE id = $1', [requestId]);
  if (!existing.rows.length) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  const oldStatus = existing.rows[0].status;
  await pool.query('UPDATE subscription_requests SET status = $1, updated_at = NOW() WHERE id = $2', [status, requestId]);
  await pool.query(
    'INSERT INTO request_status_history (request_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
    [requestId, oldStatus, status, req.admin.email, String(req.body?.notes || '').slice(0, 500)]
  );

  return res.json({ id: requestId, oldStatus, status });
});

router.get('/exclusions', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, data_product_id, reason, is_active, created_at FROM data_product_exclusions ORDER BY created_at DESC');
  return res.json(result.rows);
});

router.post('/exclusions', requireAdmin, async (req, res) => {
  const dataProductId = String(req.body?.dataProductId || '').trim();
  const reason = String(req.body?.reason || '').trim();

  if (!dataProductId) {
    return res.status(400).json({ error: 'dataProductId is required.' });
  }

  await pool.query(
    `INSERT INTO data_product_exclusions (data_product_id, reason, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (data_product_id)
     DO UPDATE SET reason = EXCLUDED.reason, is_active = true`,
    [dataProductId, reason || null]
  );

  return res.status(201).json({ dataProductId, isActive: true });
});

router.delete('/exclusions/:dataProductId', requireAdmin, async (req, res) => {
  const dataProductId = String(req.params.dataProductId || '').trim();
  await pool.query('UPDATE data_product_exclusions SET is_active = false WHERE data_product_id = $1', [dataProductId]);
  return res.status(204).end();
});

module.exports = router;
