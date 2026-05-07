'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required for backup.\n');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDir = process.env.DB_BACKUP_DIR || path.join(process.cwd(), '.runtime', 'backups');
const outputFile = process.env.DB_BACKUP_FILE || path.join(targetDir, `dpss-backup-${timestamp}.dump`);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });

const args = [
  '--format=custom',
  `--file=${outputFile}`,
  databaseUrl
];

const result = spawnSync('pg_dump', args, { stdio: 'inherit', shell: true });
if (result.error) {
  process.stderr.write(`Failed to start pg_dump: ${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status || 1);
}

const stat = fs.statSync(outputFile);
if (!stat.size) {
  process.stderr.write(`Backup file is empty: ${outputFile}\n`);
  process.exit(1);
}

process.stdout.write(`Backup created: ${outputFile}\n`);
