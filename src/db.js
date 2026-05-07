const { Pool } = require('pg');
const { config } = require('./config');
const { logger } = require('./logger');

const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle PostgreSQL client error');
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
