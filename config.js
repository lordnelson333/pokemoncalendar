require('dotenv').config();

module.exports = {
  discord: {
    webhookRestock:  process.env.DISCORD_WEBHOOK_RESTOCK,
    webhookReleases: process.env.DISCORD_WEBHOOK_RELEASES,
  },

  tcgplayer: {
    publicKey:  process.env.TCGPLAYER_PUBLIC_KEY  || '',
    privateKey: process.env.TCGPLAYER_PRIVATE_KEY || '',
  },

  scan: {
    intervalHot:      parseInt(process.env.SCAN_INTERVAL_HOT)      || 3,
    intervalStandard: parseInt(process.env.SCAN_INTERVAL_STANDARD) || 5,
    intervalPrices:   parseInt(process.env.SCAN_INTERVAL_PRICES)   || 15,
  },

  watchKeywords: (process.env.WATCH_KEYWORDS || 'Elite Trainer Box,Booster Display,Booster Bundle')
    .split(',')
    .map(k => k.trim().toLowerCase()),

  priceDropThreshold: parseInt(process.env.PRICE_DROP_THRESHOLD) || 10,

  debug: process.env.DEBUG === 'true',

  // ── 2026 Release Calendar ─────────────────────────────────────────────────
  // Add new sets here as they are announced.
  // date: JS Date string (YYYY-MM-DD) or null for TBD
  releases: [
    {
      name:     'Mega Evolution: Chaos Rising',
      date:     '2026-05-22',
      msrp:     { etb: 44.99, display: 149.99, bundle: 24.99 },
      products: ['Elite Trainer Box', 'Booster Display', 'Booster Bundle', 'Build and Battle'],
      keywords: ['chaos rising'],
    },
    {
      name:     'First Partner Collection Series 2',
      date:     '2026-06-19',
      msrp:     { etb: null, display: null, bundle: 19.99 },
      products: ['Collection Box', 'Poster Collection', 'Booster Bundle'],
      keywords: ['first partner', 'first partner series 2'],
    },
    {
      name:     'Mega Evolution: Pitch Black Night',
      date:     '2026-07-17',
      msrp:     { etb: 44.99, display: 149.99, bundle: 24.99 },
      products: ['Elite Trainer Box', 'Booster Display', 'Booster Bundle'],
      keywords: ['pitch black night', 'pitch black'],
    },
    {
      name:     '30th Anniversary Celebration Set',
      date:     '2026-09-18',
      msrp:     { etb: null, display: 189.99, bundle: 29.99 },
      products: ['Booster Display', 'Premium Collection', 'Collector Chest'],
      keywords: ['30th anniversary', 'anniversary celebration'],
    },
    {
      name:     'Mega Evolution: Storm Emerald',
      date:     null, // TBD
      msrp:     { etb: 44.99, display: 149.99, bundle: 24.99 },
      products: ['Elite Trainer Box', 'Booster Display', 'Booster Bundle'],
      keywords: ['storm emerald'],
    },
  ],
};
