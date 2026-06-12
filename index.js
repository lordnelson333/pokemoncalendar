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

const PORT         = process.env.PORT || 3000;
const PUBLIC_DIR   = path.join(__dirname, 'public');
const INDEX        = path.join(PUBLIC_DIR, 'index.html');
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'changeme';
const DATA_DIR     = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const EMAILS_FILE  = path.join(DATA_DIR, 'approved_emails.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mp3':  'audio/mpeg',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
};

// ── Email store helpers ───────────────────────────────────────────────────────
function loadEmails() {
  try {
    if (fs.existsSync(EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
    }
  } catch(e) {}
  return [];
}

function saveEmails(emails) {
  try { fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2)); } catch(e) {}
}

// ── Read body helper ──────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
    });
  });
}

// ── Admin HTML page ───────────────────────────────────────────────────────────
function adminPage(emails) {
  const rows = emails.map(e =>
    `<div class="row"><span>${e}</span><button onclick="removeEmail('${e}')">Remove</button></div>`
  ).join('') || '<div class="empty">No approved emails yet</div>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PokéRadar Admin</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: system-ui, sans-serif; background:#0a0a0f; color:#f0eeff; min-height:100vh; padding:24px 16px; }
  h1 { font-size:22px; font-weight:800; margin-bottom:4px; }
  h1 em { color:#ffd84d; font-style:normal; }
  .sub { font-size:12px; color:rgba(255,255,255,0.4); margin-bottom:32px; }
  .card { background:#161624; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; margin-bottom:16px; }
  .card h2 { font-size:14px; font-weight:700; color:rgba(255,255,255,0.5); letter-spacing:2px; text-transform:uppercase; margin-bottom:14px; }
  .add-row { display:flex; gap:8px; }
  input { flex:1; background:#1e1e30; border:1px solid rgba(255,255,255,0.1); border-radius:9999px; padding:11px 16px; color:#f0eeff; font-size:14px; outline:none; }
  input:focus { border-color:rgba(255,216,77,0.4); }
  input::placeholder { color:rgba(255,255,255,0.25); }
  .btn-add { background:#ffd84d; color:#111; border:none; border-radius:9999px; padding:11px 20px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; }
  .btn-add:active { opacity:0.85; }
  .row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05); gap:12px; }
  .row:last-child { border-bottom:none; }
  .row span { font-size:14px; color:#f0eeff; word-break:break-all; }
  .row button { background:rgba(255,79,107,0.12); color:#ff4f6b; border:1px solid rgba(255,79,107,0.25); border-radius:9999px; padding:5px 14px; font-size:12px; font-weight:700; cursor:pointer; flex-shrink:0; }
  .row button:active { opacity:0.8; }
  .empty { color:rgba(255,255,255,0.3); font-size:13px; padding:12px 0; }
  .count { font-size:11px; color:rgba(255,255,255,0.4); margin-top:8px; }
  .logout { display:block; text-align:center; color:rgba(255,255,255,0.3); font-size:12px; margin-top:24px; text-decoration:none; }
  #msg { font-size:12px; padding:6px 0; min-height:20px; color:#3de8a0; }
</style>
</head>
<body>
<h1>Poké<em>Radar</em> Admin</h1>
<div class="sub">Manage approved access emails</div>

<div class="card">
  <h2>Add Email</h2>
  <div class="add-row">
    <input id="new-email" type="email" placeholder="user@example.com" />
    <button class="btn-add" onclick="addEmail()">Add</button>
  </div>
  <div id="msg"></div>
</div>

<div class="card">
  <h2>Approved Emails</h2>
  <div id="email-list">${rows}</div>
  <div class="count" id="count">${emails.length} email${emails.length !== 1 ? 's' : ''} approved</div>
</div>

<a class="logout" href="/admin?logout=1">Log out</a>

<script>
var pass = sessionStorage.getItem('adminPass') || '';

async function addEmail() {
  var email = document.getElementById('new-email').value.trim().toLowerCase();
  if (!email) return;
  var res = await fetch('/api/admin', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'add', email, password: pass })
  });
  var data = await res.json();
  var msg = document.getElementById('msg');
  if (data.success) {
    msg.textContent = '✓ ' + email + ' added';
    msg.style.color = '#3de8a0';
    document.getElementById('new-email').value = '';
    refreshList();
  } else {
    msg.textContent = data.error || 'Error';
    msg.style.color = '#ff4f6b';
  }
}

async function removeEmail(email) {
  if (!confirm('Remove ' + email + '?')) return;
  var res = await fetch('/api/admin', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'remove', email, password: pass })
  });
  var data = await res.json();
  if (data.success) refreshList();
}

async function refreshList() {
  var res = await fetch('/api/admin', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'list', password: pass })
  });
  var data = await res.json();
  if (data.emails) {
    var list = document.getElementById('email-list');
    list.innerHTML = data.emails.map(function(e) {
      return '<div class="row"><span>' + e + '</span><button onclick="removeEmail(\\'' + e + '\\')">Remove</button></div>';
    }).join('') || '<div class="empty">No approved emails yet</div>';
    document.getElementById('count').textContent = data.emails.length + ' email' + (data.emails.length !== 1 ? 's' : '') + ' approved';
    document.getElementById('msg').textContent = '';
  }
}

document.getElementById('new-email').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') addEmail();
});
</script>
</body>
</html>`;
}

// ── Login page ────────────────────────────────────────────────────────────────
function loginPage(error) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PokéRadar Admin Login</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,sans-serif; background:#0a0a0f; color:#f0eeff; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .box { background:#161624; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:32px 24px; width:100%; max-width:360px; }
  h1 { font-size:22px; font-weight:800; margin-bottom:4px; text-align:center; }
  h1 em { color:#ffd84d; font-style:normal; }
  .sub { font-size:12px; color:rgba(255,255,255,0.4); text-align:center; margin-bottom:24px; }
  input { width:100%; background:#1e1e30; border:1px solid rgba(255,255,255,0.1); border-radius:9999px; padding:13px 18px; color:#f0eeff; font-size:15px; outline:none; margin-bottom:12px; }
  input:focus { border-color:rgba(255,216,77,0.4); }
  button { width:100%; background:#ffd84d; color:#111; border:none; border-radius:9999px; padding:14px; font-size:15px; font-weight:800; cursor:pointer; }
  .error { color:#ff4f6b; font-size:12px; text-align:center; margin-bottom:12px; }
</style>
</head>
<body>
<div class="box">
  <h1>Poké<em>Radar</em></h1>
  <div class="sub">Admin Access</div>
  ${error ? '<div class="error">Incorrect password</div>' : ''}
  <form method="POST" action="/admin">
    <input type="password" name="password" placeholder="Enter admin password" autofocus />
    <button type="submit">Login</button>
  </form>
</div>
</body>
</html>`;
}

// ── Server ────────────────────────────────────────────────────────────────────
const sessions = new Set();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const raw      = req.url.split('?')[0];
  const pathname = decodeURIComponent(raw);
  const query    = new URL(req.url, 'http://localhost').searchParams;

  // ── POST /api/auth — check if email is approved ───────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth') {
    const body  = await readBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const emails = loadEmails();
    const approved = emails.includes(email);
    console.log(`[Auth] ${email} → ${approved ? 'APPROVED' : 'DENIED'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ approved }));
    return;
  }

  // ── POST /api/admin — manage email list ───────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/admin') {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASS) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    let emails = loadEmails();
    if (body.action === 'add') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid email' })); return; }
      if (!emails.includes(email)) { emails.push(email); saveEmails(emails); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, emails }));
    } else if (body.action === 'remove') {
      const email = (body.email || '').trim().toLowerCase();
      emails = emails.filter(e => e !== email);
      saveEmails(emails);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, emails }));
    } else if (body.action === 'list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, emails }));
    }
    return;
  }

  // ── GET /admin — admin dashboard ──────────────────────────────────────────
  if (pathname === '/admin') {
    const sessionId = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
    if (query.get('logout')) {
      sessions.delete(sessionId);
      res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': 'session=; Max-Age=0; Path=/' });
      res.end(); return;
    }
    if (sessions.has(sessionId)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(adminPage(loadEmails())); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loginPage(false)); return;
  }

  // ── POST /admin — handle login ────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/admin') {
    const body = await readBody(req);
    let formData = '';
    await new Promise(resolve => {
      let raw2 = '';
      req.on('data', c => raw2 += c);
      req.on('end', () => { formData = raw2; resolve(); });
    });
    const params  = new URLSearchParams(formData || '');
    const pass    = params.get('password') || body.password || '';
    if (pass === ADMIN_PASS) {
      const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessions.add(sid);
      res.writeHead(302, { 'Location': '/admin', 'Set-Cookie': `session=${sid}; Path=/; HttpOnly` });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(true));
    }
    return;
  }

  // ── GET /api/optcg?name=... — proxy One Piece TCG API ────────────────────
  if (req.method === 'GET' && pathname === '/api/optcg') {
    const params = new URL(req.url, 'http://localhost');
    const name   = params.get('name') || '';
    (async () => {
      try {
        const apiRes = await fetch('https://optcgapi.com/api/sets/filtered/?name=' + encodeURIComponent(name), {
          headers: { 'Accept': 'application/json', 'User-Agent': 'PokéRadar/1.0' }
        });
        const data = await apiRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(data));
      } catch(err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const ext = path.extname(pathname).toLowerCase();
  const filePath = (pathname === '/' || !ext)
    ? path.join(PUBLIC_DIR, 'index.html')
    : path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
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
  console.log(`[Web] Admin panel at http://localhost:${PORT}/admin`);
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