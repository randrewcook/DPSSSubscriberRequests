'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required for restore.\n');
  process.exit(1);
}

const inputFile = process.env.DB_BACKUP_FILE || process.argv[2];
if (!inputFile) {
  process.stderr.write('Backup file path is required via DB_BACKUP_FILE or first argument.\n');
  process.exit(1);
}

const resolvedInput = path.resolve(inputFile);
if (!fs.existsSync(resolvedInput)) {
  process.stderr.write(`Backup file not found: ${resolvedInput}\n`);
  process.exit(1);
}

const args = [
  '--clean',
  '--if-exists',
  '--no-owner',
  `--dbname=${databaseUrl}`,
  resolvedInput
];

const result = spawnSync('pg_restore', args, { stdio: 'inherit', shell: true });
if (result.error) {
  process.stderr.write(`Failed to start pg_restore: ${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status || 1);
}

process.stdout.write(`Restore completed from: ${resolvedInput}\n`);
