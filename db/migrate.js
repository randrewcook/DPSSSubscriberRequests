const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Running idempotent SQL files in lexical order keeps local setup simple.
    await pool.query(sql);
    console.log(`Applied migration: ${file}`);
  }

  await pool.end();
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
