const axios  = require('axios');
const config = require('./config');

const COLORS = {
  restock:      0x1eaa52,   // green
  price_drop:   0xffcc02,   // gold
  release_day:  0xff6b35,   // fire orange
  week_warning: 0x4a7dff,   // blue
  error:        0xff4047,   // red
};

// ── Internal sender ───────────────────────────────────────────────────────────
async function send(webhookUrl, payload) {
  if (!webhookUrl) {
    console.warn('[Discord] No webhook URL configured — skipping send.');
    return;
  }
  try {
    await axios.post(webhookUrl, payload, { timeout: 8000 });
    if (config.debug) console.log('[Discord] Sent:', payload.embeds?.[0]?.title);
  } catch (err) {
    console.error('[Discord] Failed to send:', err.response?.data || err.message);
  }
}

// ── Restock alert ─────────────────────────────────────────────────────────────
async function sendRestock({ retailer, productName, price, url, setName }) {
  const embed = {
    color: COLORS.restock,
    title: '🟢  RESTOCK DETECTED',
    description: `**${productName}** is back in stock at **${retailer}**!`,
    fields: [
      { name: 'Set',      value: setName || 'Pokemon TCG', inline: true },
      { name: 'Retailer', value: retailer,                 inline: true },
      { name: 'Price',    value: price ? `$${price.toFixed(2)}` : 'Check site', inline: true },
    ],
    url,
    footer:    { text: 'PokéRadar • Restock Monitor' },
    timestamp: new Date().toISOString(),
  };

  await send(config.discord.webhookRestock, {
    content: '@everyone',
    embeds:  [embed],
  });
}

// ── Price drop alert ───────────────────────────────────────────────────────────
async function sendPriceDrop({ retailer, productName, currentPrice, msrp, url, setName, dropPct }) {
  const embed = {
    color: COLORS.price_drop,
    title: '💛  PRICE DROP',
    description: `**${productName}** dropped **${dropPct}%** below MSRP on **${retailer}**`,
    fields: [
      { name: 'Current Price', value: `$${currentPrice.toFixed(2)}`,            inline: true },
      { name: 'MSRP',         value: msrp ? `$${msrp.toFixed(2)}` : '—',        inline: true },
      { name: 'Savings',      value: msrp ? `$${(msrp - currentPrice).toFixed(2)}` : '—', inline: true },
      { name: 'Retailer',     value: retailer,                                   inline: true },
      { name: 'Set',          value: setName || 'Pokemon TCG',                   inline: true },
    ],
    url,
    footer:    { text: 'PokéRadar • Price Monitor' },
    timestamp: new Date().toISOString(),
  };

  await send(config.discord.webhookRestock, {
    content: '@here',
    embeds:  [embed],
  });
}

// ── Release day alert ─────────────────────────────────────────────────────────
async function sendReleaseDay({ name, date, products, msrp }) {
  const productList = products
    .map(p => {
      const price = msrp[p.toLowerCase().replace(/\s+/g, '_')] || null;
      return `• **${p}**${price ? ` — $${price.toFixed(2)}` : ''}`;
    })
    .join('\n');

  const embed = {
    color: COLORS.release_day,
    title: '⚡  RELEASE DAY',
    description: `**${name}** is available in stores and online **today**!`,
    fields: [
      {
        name:   'Products Available',
        value:  productList || 'Check retailers',
        inline: false,
      },
      {
        name:   'Where to Buy',
        value:  '🎯 Target • 🛒 Walmart • ⚡ PokémonCenter • 💙 Best Buy • 🃏 TCGPlayer',
        inline: false,
      },
    ],
    footer:    { text: 'PokéRadar • Release Calendar' },
    timestamp: new Date().toISOString(),
  };

  await send(config.discord.webhookReleases, {
    content: '@everyone 🔥 New Pokémon TCG set dropping today!',
    embeds:  [embed],
  });
}

// ── 7-day warning ─────────────────────────────────────────────────────────────
async function sendWeekWarning({ name, date, products }) {
  const releaseDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const embed = {
    color: COLORS.week_warning,
    title: '📅  ONE WEEK UNTIL RELEASE',
    description: `**${name}** drops in **7 days** on ${releaseDate}`,
    fields: [
      {
        name:   'Products',
        value:  products.map(p => `• ${p}`).join('\n') || '—',
        inline: false,
      },
      {
        name:   'Tip',
        value:  'Pre-orders may still be available. Check retailers now.',
        inline: false,
      },
    ],
    footer:    { text: 'PokéRadar • Release Calendar' },
    timestamp: new Date().toISOString(),
  };

  await send(config.discord.webhookReleases, {
    content: '📅 Mark your calendars — a new set is coming next week!',
    embeds:  [embed],
  });
}

module.exports = { sendRestock, sendPriceDrop, sendReleaseDay, sendWeekWarning };
