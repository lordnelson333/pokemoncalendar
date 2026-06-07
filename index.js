require('dotenv').config();
const cron     = require('node-cron');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const config   = require('./config');
const db       = require('./db');
const calendar = require('./calendar');

console.log('');
console.log('  ╔══════════════════════════════════════╗');
console.log('  ║       PokéRadar  —  Release Bot      ║');
console.log('  ╠══════════════════════════════════════╣');
console.log(`  ║  Releases tracked : ${config.releases.length}                   ║`);
console.log(`  ║  Timezone         : ${(process.env.TZ || 'America/New_York').padEnd(17)} ║`);
console.log('  ╚══════════════════════════════════════╝');
console.log('');

db.clearExpiredAlerts();

const PORT      = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'public', 'index.html');

// ── Price proxy helper (async) ────────────────────────────────────────────────
async function proxyPrices(q, limit, key) {
  const apiUrl = `https://api.tcgpricelookup.com/v1/cards/search?q=${encodeURIComponent(q)}&game=pokemon&limit=${limit}`;
  const apiRes = await fetch(apiUrl, {
    headers: {
      'X-API-Key':  key,
      'User-Agent': 'PokéRadar/1.0',
      'Accept':     'application/json',
    },
  });
  const data = await apiRes.json();
  console.log(`[API] TCGPriceLookup ${apiRes.status} for "${q}"`);
  return { status: apiRes.status, data };
}

// ── Web server ────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const pathname = req.url.split('?')[0];

  // ── GET /api/config ────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: !!process.env.TCGPL_API_KEY }));
    return;
  }

  // ── GET /api/prices?q=...&limit=... ───────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/prices') {
    const params = new URL(req.url, 'http://localhost');
    const q      = params.get('q') || '';
    const limit  = params.get('limit') || '5';
    const key    = process.env.TCGPL_API_KEY || '';

    if (!key) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'TCGPL_API_KEY not set in Railway Variables' }));
      return;
    }
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter q' }));
      return;
    }

    console.log(`[API] /api/prices?q=${q}`);
    proxyPrices(q, limit, key)
      .then(({ status, data }) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        console.error('[API] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // ── Serve dashboard ────────────────────────────────────────────────────────
  fs.readFile(HTML_FILE, (err, data) => {
    if (err) { res.writeHead(500); res.end('Dashboard not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Web] Dashboard live at http://localhost:${PORT}`);
  if (!process.env.TCGPL_API_KEY) console.warn('[Web] ⚠️  TCGPL_API_KEY not set in Railway Variables');
});

// ── Crons ─────────────────────────────────────────────────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Daily calendar check…');
  await calendar.checkReleases();
});

cron.schedule('*/5 * * * *', () => {
  console.log(`[Heartbeat] ${new Date().toISOString()} ✓`);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  await calendar.checkReleases();
  console.log('[Boot] Bot is live.\n');
})();

process.on('uncaughtException',  err => console.error('[Error]', err.message));
process.on('unhandledRejection', err => console.error('[Error]', err?.message || err));
