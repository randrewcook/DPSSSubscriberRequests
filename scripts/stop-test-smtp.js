const fs = require('node:fs/promises');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pidFile = path.join(process.cwd(), '.runtime', 'local-smtp-catcher.pid');

function killWindowsListenersByPort(ports) {
  if (process.platform !== 'win32') {
    return;
  }

  for (const port of ports) {
    let output = '';
    try {
      output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8' });
    } catch {
      continue;
    }

    const pids = new Set();
    for (const line of String(output).split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } catch {}
    }
  }
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(pidFile, 'utf8');
  } catch {
    console.log('Local SMTP catcher is not running (no pid file).');
    return;
  }

  const pid = Number(String(raw).trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    await fs.unlink(pidFile).catch(() => {});
    console.log('Removed invalid pid file.');
    return;
  }

  try {
    process.kill(pid);
    console.log(`Stopped local SMTP catcher (pid ${pid})`);
  } catch {
    console.log(`No running process found for pid ${pid}.`);
  }

  killWindowsListenersByPort([1025, 8025]);
  await fs.unlink(pidFile).catch(() => {});
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
