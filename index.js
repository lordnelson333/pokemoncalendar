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

// ── Web server — serves the dashboard ─────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  // Serve dashboard on any route
  fs.readFile(HTML_FILE, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Dashboard not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Web] Dashboard live at http://localhost:${PORT}`);
  console.log(`[Web] On Railway: check your project URL in the dashboard`);
});

// ── Calendar cron — daily at 9 AM ─────────────────────────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Daily calendar check…');
  await calendar.checkReleases();
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────
cron.schedule('*/5 * * * *', () => {
  console.log(`[Heartbeat] ${new Date().toISOString()} ✓`);
});

// ── Run once on boot ──────────────────────────────────────────────────────────
(async () => {
  await calendar.checkReleases();
  console.log('[Boot] Calendar bot is live. Alerts fire daily at 9 AM.\n');
})();

process.on('uncaughtException',  err => console.error('[Error]', err.message));
process.on('unhandledRejection', err => console.error('[Error]', err?.message || err));
