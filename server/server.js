const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT) || 80;
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'vanta.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  discord_webhook_url TEXT NOT NULL,
  last_status TEXT NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('up','down','unknown')),
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

app.use(express.json({ limit: '16kb' }));

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}

function validDiscordWebhook(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['discord.com', 'discordapp.com'].includes(url.hostname) &&
      /^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(url.pathname);
  } catch { return false; }
}

app.post('/api/monitors', (req, res) => {
  const { url, discordWebhookUrl } = req.body || {};
  if (typeof url !== 'string' || !url.trim() || typeof discordWebhookUrl !== 'string' || !discordWebhookUrl.trim()) {
    return res.status(400).json({ error: 'URL and Discord webhook URL are required.' });
  }
  const cleanUrl = url.trim();
  const cleanWebhook = discordWebhookUrl.trim();
  if (!validHttpUrl(cleanUrl)) return res.status(400).json({ error: 'Enter a valid http or https URL.' });
  if (!validDiscordWebhook(cleanWebhook)) return res.status(400).json({ error: 'Enter a valid Discord webhook URL.' });
  try {
    const result = db.prepare('INSERT INTO monitors (url, discord_webhook_url) VALUES (?, ?)').run(cleanUrl, cleanWebhook);
    return res.status(201).json(db.prepare('SELECT id, url, last_status, last_checked_at, created_at FROM monitors WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    console.error('Could not add monitor:', error.message);
    return res.status(500).json({ error: 'Could not save this monitor.' });
  }
});

app.get('/api/monitors', (_req, res) => {
  try {
    res.json(db.prepare('SELECT id, url, last_status, last_checked_at, created_at FROM monitors ORDER BY created_at DESC, id DESC').all());
  } catch (error) {
    console.error('Could not list monitors:', error.message);
    res.status(500).json({ error: 'Could not load monitors.' });
  }
});

app.delete('/api/monitors/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid monitor ID.' });
  try {
    const result = db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Monitor not found.' });
    res.status(204).end();
  } catch (error) {
    console.error('Could not delete monitor:', error.message);
    res.status(500).json({ error: 'Could not delete this monitor.' });
  }
});

app.use('/server', (_req, res) => res.sendStatus(404));
app.use(express.static(path.join(__dirname, '..')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

async function checkMonitor(monitor) {
  let status = 'down';
  try {
    const response = await fetch(monitor.url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (response.status >= 200 && response.status < 400) status = 'up';
    if (response.body) await response.body.cancel().catch(() => {});
  } catch { /* Network errors and timeouts count as down. */ }

  const checkedAt = new Date().toISOString();
  const previous = monitor.last_status;
  try {
    db.prepare('UPDATE monitors SET last_status = ?, last_checked_at = ? WHERE id = ?').run(status, checkedAt, monitor.id);
  } catch (error) {
    console.error(`Could not update monitor ${monitor.id}:`, error.message);
    return;
  }

  if ((previous === 'up' || previous === 'down') && previous !== status) {
    const transition = status === 'down' ? 'went DOWN' : 'is back UP';
    try {
      const response = await fetch(monitor.discord_webhook_url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: `VANTA alert: ${monitor.url} ${transition} at ${checkedAt} UTC.` }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) console.error(`Discord webhook for monitor ${monitor.id} returned HTTP ${response.status}.`);
      if (response.body) await response.body.cancel().catch(() => {});
    } catch (error) {
      console.error(`Discord alert failed for monitor ${monitor.id}:`, error.message);
    }
  }
}

let checking = false;
async function checkAllMonitors() {
  if (checking) return;
  checking = true;
  try {
    const monitors = db.prepare('SELECT * FROM monitors ORDER BY id').all();
    await Promise.all(monitors.map(checkMonitor));
  } catch (error) {
    console.error('Monitor scheduler error:', error.message);
  } finally { checking = false; }
}

app.listen(port, () => {
  console.log(`VANTA server listening on port ${port}`);
  checkAllMonitors();
  setInterval(checkAllMonitors, 2 * 60 * 1000);
});

function shutdown() {
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
