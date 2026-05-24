const config  = require('./config');
const db      = require('./db');
const discord = require('./discord');

function daysUntil(dateStr) {
  const now    = new Date();
  const target = new Date(dateStr);
  const nowDay    = Date.UTC(now.getFullYear(),    now.getMonth(),    now.getDate());
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay - nowDay) / 86_400_000);
}

async function checkReleases() {
  console.log('[Calendar] Checking release dates…');

  for (const release of config.releases) {
    if (!release.date) continue;

    const days = daysUntil(release.date);

    if (days === 7) {
      const key = `${release.name}::${release.date}::week`;
      if (db.shouldSend('week_warning', key)) {
        console.log(`[Calendar] 7-day warning → ${release.name}`);
        await discord.sendWeekWarning({ name: release.name, date: release.date, products: release.products });
      }
    }

    if (days === 0) {
      const key = `${release.name}::${release.date}::launch`;
      if (db.shouldSend('release_day', key)) {
        console.log(`[Calendar] Release day → ${release.name}`);
        await discord.sendReleaseDay({ name: release.name, date: release.date, products: release.products, msrp: release.msrp });
      }
    }

    if (days > 0 && days <= 30) {
      console.log(`[Calendar] ${release.name} → in ${days} day${days === 1 ? '' : 's'}`);
    }
  }
}

module.exports = { checkReleases, daysUntil };
