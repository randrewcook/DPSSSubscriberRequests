'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const stat = fs.statSync(resolvedInput);
if (stat.size === 0) {
  process.stderr.write(`Backup file is empty: ${resolvedInput}\n`);
  process.exit(1);
}

const result = spawnSync('pg_restore', ['--list', resolvedInput], { stdio: 'pipe', shell: true, encoding: 'utf8' });
if (result.error) {
  process.stderr.write(`Failed to start pg_restore --list: ${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Unable to verify backup file.\n');
  process.exit(result.status || 1);
}

process.stdout.write(`Backup verification passed: ${resolvedInput}\n`);
