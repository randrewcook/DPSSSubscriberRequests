const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { SMTPServer } = require('smtp-server');

const SMTP_PORT = Number(process.env.TEST_SMTP_PORT || 1025);
const HTTP_PORT = Number(process.env.TEST_SMTP_UI_PORT || 8025);
const runtimeDir = path.join(process.cwd(), '.runtime');
const messagesFile = path.join(runtimeDir, 'test-emails.jsonl');

const messages = [];

function parseHeader(raw, headerName) {
  const pattern = new RegExp(`^${headerName}:\\s*(.+)$`, 'im');
  const match = String(raw || '').match(pattern);
  return match ? match[1].trim() : '';
}

function extractBody(raw) {
  const text = String(raw || '');
  const separator = /\r?\n\r?\n/;
  const parts = text.split(separator);
  if (parts.length < 2) {
    return '';
  }
  return parts.slice(1).join('\n\n').trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function persistMessage(message) {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.appendFile(messagesFile, `${JSON.stringify(message)}\n`, 'utf8');
}

const smtpServer = new SMTPServer({
  secure: false,
  authOptional: true,
  disabledCommands: ['STARTTLS', 'AUTH'],
  onData(stream, session, callback) {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const message = {
          id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          at: new Date().toISOString(),
          from: session.envelope.mailFrom?.address || '',
          to: (session.envelope.rcptTo || []).map((rcpt) => rcpt.address),
          subject: parseHeader(raw, 'Subject'),
          raw
        };
        messages.unshift(message);
        await persistMessage(message);
      } catch (error) {
        console.error('Failed to persist email:', error.message);
      }
      callback();
    });
  }
});

const uiServer = http.createServer((req, res) => {
  if (req.url === '/api/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ count: messages.length, messages }, null, 2));
    return;
  }

  if (req.url === '/api/messages/clear' && req.method === 'POST') {
    messages.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const rows = messages.slice(0, 25).map((m) => {
    const body = extractBody(m.raw);
    return `
    <tr>
      <td>${escapeHtml(m.at)}</td>
      <td>${escapeHtml(m.from)}</td>
      <td>${escapeHtml(m.to.join(', '))}</td>
      <td>${escapeHtml(m.subject || '')}</td>
      <td><pre>${escapeHtml(body)}</pre></td>
    </tr>
  `;
  }).join('');

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Local SMTP Catcher</title>
      <style>
        body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; }
        h1 { margin: 0 0 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; text-align: left; }
        th { background: #f4f4f4; }
        pre { margin: 0; white-space: pre-wrap; font-family: Consolas, monospace; }
      </style>
    </head>
    <body>
      <h1>Local SMTP Catcher</h1>
      <p>Total messages: ${messages.length}</p>
      <table>
        <thead>
          <tr><th>Received</th><th>From</th><th>To</th><th>Subject</th><th>Body</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>JSON API: <a href="/api/messages">/api/messages</a></p>
    </body>
  </html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

smtpServer.listen(SMTP_PORT, () => {
  console.log(`SMTP catcher listening on port ${SMTP_PORT}`);
});

uiServer.listen(HTTP_PORT, () => {
  console.log(`SMTP catcher UI listening on http://localhost:${HTTP_PORT}`);
});
