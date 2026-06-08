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

const PORT       = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX      = path.join(PUBLIC_DIR, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mp3':  'audio/mpeg',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
  '.js':   'application/javascript',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const raw      = req.url.split('?')[0];
  const pathname = decodeURIComponent(raw);
  const ext      = path.extname(pathname).toLowerCase();

  // Root or no extension → serve index.html
  if (pathname === '/' || !ext) {
    fs.readFile(INDEX, (err, data) => {
      if (err) { res.writeHead(500); res.end('Dashboard not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }

  // Static file — serve from public/
  const filePath = path.join(PUBLIC_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found → serve index.html
      fs.readFile(INDEX, (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type':  contentType,
      'Cache-Control': ext === '.mp3' ? 'public, max-age=86400' : 'no-cache',
      'Accept-Ranges': 'bytes',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Web] Dashboard live at http://localhost:${PORT}`);
});

cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Daily calendar check…');
  await calendar.checkReleases();
});

cron.schedule('*/5 * * * *', () => {
  console.log(`[Heartbeat] ${new Date().toISOString()} ✓`);
});

(async () => {
  await calendar.checkReleases();
  console.log('[Boot] Bot is live.\n');
})();

process.on('uncaughtException',  err => console.error('[Error]', err.message));
process.on('unhandledRejection', err => console.error('[Error]', err?.message || err));
