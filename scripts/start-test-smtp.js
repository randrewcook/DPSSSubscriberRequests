const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const runtimeDir = path.join(process.cwd(), '.runtime');
const pidFile = path.join(runtimeDir, 'local-smtp-catcher.pid');
const uiPort = 8025;

async function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readExistingPid() {
  try {
    const raw = await fs.readFile(pidFile, 'utf8');
    const pid = Number(String(raw).trim());
    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

async function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(750);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPortOpen(port, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isPortOpen(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function main() {
  await fs.mkdir(runtimeDir, { recursive: true });

  if (await isPortOpen(uiPort)) {
    console.log('Local SMTP catcher already running (detected on port 8025)');
    return;
  }

  const existingPid = await readExistingPid();
  if (existingPid && await processIsAlive(existingPid)) {
    console.log(`Local SMTP catcher already running (pid ${existingPid})`);
    return;
  }

  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'local-smtp-catcher.js')], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
  const started = await waitForPortOpen(uiPort);
  if (!started) {
    try {
      process.kill(child.pid);
    } catch {}
    throw new Error('SMTP catcher did not start successfully (port 8025 did not open).');
  }

  await fs.writeFile(pidFile, String(child.pid), 'utf8');

  console.log(`Started local SMTP catcher (pid ${child.pid})`);
  console.log('SMTP: localhost:1025');
  console.log('Inbox UI: http://localhost:8025');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
