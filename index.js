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

const MIME = {
  '.html': 'text/html',
  '.mp3':  'audio/mpeg',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const pathname = req.url.split('?')[0];
  const ext      = path.extname(pathname).toLowerCase();

  // Serve static files from public/
  const filePath = (pathname === '/' || !ext)
    ? path.join(PUBLIC_DIR, 'index.html')
    : path.join(PUBLIC_DIR, pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fall back to index.html
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
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

// Calendar cron — daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Daily calendar check…');
  await calendar.checkReleases();
});

// Heartbeat
cron.schedule('*/5 * * * *', () => {
  console.log(`[Heartbeat] ${new Date().toISOString()} ✓`);
});

(async () => {
  await calendar.checkReleases();
  console.log('[Boot] Bot is live.\n');
})();

process.on('uncaughtException',  err => console.error('[Error]', err.message));
process.on('unhandledRejection', err => console.error('[Error]', err?.message || err));
