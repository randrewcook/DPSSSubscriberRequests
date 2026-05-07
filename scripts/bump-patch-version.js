'use strict';
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts = pkg.version.split('.');
if (parts.length !== 3 || parts.some((p) => isNaN(parseInt(p, 10)))) {
  process.stderr.write(`Unexpected version format: ${pkg.version}\n`);
  process.exit(1);
}

const prev = pkg.version;
parts[2] = String(parseInt(parts[2], 10) + 1);
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
process.stdout.write(`Version bumped: ${prev} → ${pkg.version}\n`);

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = pkg.version;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = pkg.version;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
