const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { config } = require('./config');
const { pool } = require('./db');

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: 'admin' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }
}

async function authenticateAdmin(email, password) {
  const result = await pool.query(
    'SELECT id, email, password_hash, is_active FROM admin_users WHERE email = $1 LIMIT 1',
    [String(email || '').trim().toLowerCase()]
  );

  if (!result.rows.length) {
    return null;
  }

  const admin = result.rows[0];
  if (!admin.is_active) {
    return null;
  }

  const validPassword = await bcrypt.compare(String(password || ''), admin.password_hash);
  if (!validPassword) {
    return null;
  }

  return admin;
}

module.exports = { signAdminToken, requireAdmin, authenticateAdmin };
