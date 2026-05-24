const fs   = require('fs');
const path = require('path');

// Railway persists /data — fall back to local for development
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const DB_FILE  = path.join(DATA_DIR, 'pokeradar.json');

// ── In-memory store (loaded from disk on boot) ────────────────────────────────
let store = { sentAlerts: {}, stockState: {} };

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      console.log('[DB] Loaded state from', DB_FILE);
    }
  } catch (e) {
    console.warn('[DB] Could not load state, starting fresh:', e.message);
    store = { sentAlerts: {}, stockState: {} };
  }
}

function save() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[DB] Could not save state:', e.message);
  }
}

// Load on startup
load();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if this alert has NOT been sent before, and records it.
 */
function shouldSend(type, key) {
  const id = `${type}::${key}`;
  if (store.sentAlerts[id]) return false;
  store.sentAlerts[id] = new Date().toISOString();
  save();
  return true;
}

/**
 * Get the last known stock state for a product.
 */
function getStockState(retailer, productUrl) {
  const id = `${retailer}::${productUrl}`;
  return store.stockState[id] || null;
}

/**
 * Update the stock state for a product.
 */
function setStockState(retailer, productUrl, inStock, price) {
  const id = `${retailer}::${productUrl}`;
  store.stockState[id] = { in_stock: inStock ? 1 : 0, price: price || null, checked_at: new Date().toISOString() };
  save();
}

/**
 * Clear alert keys older than 8 days so they can re-fire.
 */
function clearExpiredAlerts() {
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  let cleared = 0;
  for (const [key, sentAt] of Object.entries(store.sentAlerts)) {
    if (sentAt < cutoff) {
      delete store.sentAlerts[key];
      cleared++;
    }
  }
  if (cleared > 0) {
    console.log(`[DB] Cleared ${cleared} expired alert keys`);
    save();
  }
}

module.exports = { shouldSend, getStockState, setStockState, clearExpiredAlerts };
