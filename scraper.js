const axios  = require('axios');
const config = require('./config');

// ── TCGPlayer Public API ──────────────────────────────────────────────────────
// No API key needed. This is the same endpoint TCGPlayer's own site uses.
const TCGP_BASE = 'https://mp-search-api.tcgplayer.com/v1/search/request';
const TCGP_CATALOG = 'https://api.tcgplayer.com/catalog/products';

function log(...args) {
  if (config.debug) console.log('[TCGPlayer]', ...args);
}

function isWatched(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return config.watchKeywords.some(k => lower.includes(k));
}

function parsePrice(val) {
  if (!val) return null;
  const m = String(val).replace(/,/g, '').match(/\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

// ── Search sealed products ────────────────────────────────────────────────────
// Returns current market prices and stock for sealed Pokemon TCG products
async function searchTCGPlayer(query) {
  const params = new URLSearchParams({
    q:                   query,
    isFoil:              '',
    inStock:             'true',
    isPreorder:          'false',
    index:               'product',
    pageSize:            '20',
    page:                '0',
    channel:             'website',
    minPrice:            '',
    maxPrice:            '',
    productLineName:     'pokemon',
    productTypeName:     'Sealed Products',
  });

  const { data } = await axios.get(`${TCGP_BASE}?${params}`, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept':     'application/json',
      'Origin':     'https://www.tcgplayer.com',
      'Referer':    'https://www.tcgplayer.com/',
    },
  });

  return data?.results?.[0]?.hits || [];
}

// ── Get price history for a specific product ──────────────────────────────────
async function getProductPrices(productId) {
  try {
    const { data } = await axios.get(
      `https://mp-search-api.tcgplayer.com/v1/product/${productId}/pricepoints`,
      {
        timeout: 10000,
        headers: {
          'Accept':   'application/json',
          'Origin':   'https://www.tcgplayer.com',
          'Referer':  'https://www.tcgplayer.com/',
        },
      }
    );
    return data?.result || [];
  } catch (_) {
    return [];
  }
}

// ── Main scrape function ──────────────────────────────────────────────────────
async function scrapeTCGPlayer() {
  const results = [];
  const seen    = new Set();

  // Search for each watched keyword
  const searches = [
    'pokemon elite trainer box',
    'pokemon booster display box',
    'pokemon booster bundle',
  ];

  for (const query of searches) {
    try {
      log(`Searching: "${query}"`);
      const hits = await searchTCGPlayer(query);

      for (const hit of hits) {
        const name       = hit.productName || hit.name || '';
        const productId  = hit.productId   || hit.id  || '';

        if (!isWatched(name))     continue;
        if (seen.has(productId))  continue;
        seen.add(productId);

        const marketPrice  = parsePrice(hit.marketPrice);
        const lowestPrice  = parsePrice(hit.lowestListingPrice || hit.lowestPrice);
        const totalListing = hit.totalListings || 0;
        const inStock      = totalListing > 0;
        const setName      = hit.setName || hit.expansionName || '';
        const pUrl         = `https://www.tcgplayer.com/product/${productId}`;

        // Find MSRP from our config
        const msrp = findMsrp(name);

        results.push({
          retailer:     'TCGPlayer',
          productName:  name,
          productId,
          setName,
          inStock,
          price:        lowestPrice || marketPrice,
          marketPrice,
          lowestPrice,
          msrp,
          totalListings: totalListing,
          url:          pUrl,
        });

        log(`${name} → lowest=$${lowestPrice} market=$${marketPrice} listings=${totalListing}`);
      }
    } catch (err) {
      console.error(`[TCGPlayer] Search "${query}" failed:`, err.message);
    }

    // Small delay between searches
    await new Promise(r => setTimeout(r, 1500));
  }

  return results;
}

// ── Find MSRP from config ─────────────────────────────────────────────────────
function findMsrp(productName) {
  const lower = productName.toLowerCase();
  for (const release of config.releases) {
    const matchesSet = release.keywords.some(k => lower.includes(k));
    if (!matchesSet) continue;
    if (lower.includes('display') || lower.includes('booster box')) return release.msrp.display;
    if (lower.includes('elite trainer') || lower.includes('etb'))   return release.msrp.etb;
    if (lower.includes('bundle'))                                    return release.msrp.bundle;
  }
  return null;
}

// ── scrapeAll — called by index.js ────────────────────────────────────────────
async function scrapeAll() {
  console.log('[TCGPlayer] Scanning sealed products…');
  const results = await scrapeTCGPlayer();
  console.log(`[TCGPlayer] Found ${results.length} watched products`);
  return results;
}

module.exports = { scrapeAll, isWatched, parsePrice, findMsrp };
