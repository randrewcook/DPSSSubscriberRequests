'use strict';
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'scripts', 'pre-commit');
const hooksDir = path.join(root, '.git', 'hooks');
const dst = path.join(hooksDir, 'pre-commit');

if (!fs.existsSync(src)) {
  process.stderr.write(`Hook source not found: ${src}\n`);
  process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });
fs.copyFileSync(src, dst);
try { fs.chmodSync(dst, 0o755); } catch { /* Windows: best-effort chmod */ }
process.stdout.write(`Git pre-commit hook installed → ${dst}\n`);
