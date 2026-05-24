# PokéRadar Bot

Pokemon TCG restock monitor & release calendar bot with Discord alerts.

---

## What it does

- Scans **PokémonCenter, Target, Walmart, Best Buy, TCGPlayer** every 5 min
- Fires Discord alerts when products restock or prices drop below MSRP
- Posts **release day** alerts and **7-day warnings** automatically
- Never double-alerts — SQLite tracks every notification sent

---

## Deploy to Railway (15 min)

### 1. Create your Discord webhooks

For each channel you want alerts in:
1. Open Discord → right-click your channel → **Edit Channel**
2. Go to **Integrations → Webhooks → New Webhook**
3. Copy the webhook URL

You need two webhook URLs:
- One for `#restock-alerts` (restocks + price drops)
- One for `#release-alerts` (release day + 7-day warnings)

---

### 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial PokéRadar bot"
git remote add origin https://github.com/YOUR_USERNAME/pokeradar-bot.git
git push -u origin main
```

---

### 3. Deploy on Railway

1. Go to **railway.app** → **New Project → Deploy from GitHub repo**
2. Select your `pokeradar-bot` repo
3. Railway will detect Node.js and deploy automatically

---

### 4. Add environment variables on Railway

In your Railway project → **Variables** tab, add:

| Variable | Value |
|---|---|
| `DISCORD_WEBHOOK_RESTOCK` | Your restock channel webhook URL |
| `DISCORD_WEBHOOK_RELEASES` | Your release channel webhook URL |
| `WATCH_KEYWORDS` | `Elite Trainer Box,Booster Display,Booster Bundle` |
| `SCAN_INTERVAL_STANDARD` | `5` |
| `PRICE_DROP_THRESHOLD` | `10` |
| `TZ` | `America/New_York` |
| `DEBUG` | `false` |

---

### 5. Add a Railway Volume (for persistent SQLite)

So the alert history survives bot restarts:

1. Railway project → **New → Volume**
2. Mount path: `/data`
3. Railway will set `RAILWAY_VOLUME_MOUNT_PATH=/data` automatically

---

### 6. Done ✅

Check Railway logs — you should see:

```
╔═══════════════════════════════════════╗
║         PokéRadar Bot  v1.0           ║
╚═══════════════════════════════════════╝
[Boot] Scan intervals: hot=3min  std=5min  prices=15min
[Calendar] Checking release dates…
[StockCheck] Running stock check…
```

---

## Customise watched products

Edit `WATCH_KEYWORDS` in Railway Variables:

```
Elite Trainer Box,Booster Display,Booster Bundle,Tin,Collection Box
```

The bot only alerts on products whose names contain at least one of these keywords.

---

## Add a new set to the calendar

Open `config.js` and add to the `releases` array:

```js
{
  name:     'New Set Name',
  date:     '2026-12-05',       // or null if TBD
  msrp:     { etb: 44.99, display: 149.99, bundle: 24.99 },
  products: ['Elite Trainer Box', 'Booster Display', 'Booster Bundle'],
  keywords: ['new set', 'new set name'],
},
```

Commit and push — Railway redeploys automatically.

---

## Project structure

```
pokeradar-bot/
├── index.js      ← entry point, cron jobs, alert logic
├── scraper.js    ← PokémonCenter / Target / Walmart / Best Buy / TCGPlayer
├── discord.js    ← webhook message formatting & sending
├── calendar.js   ← release day & 7-day warning checks
├── db.js         ← SQLite state (stock history, sent alerts)
├── config.js     ← all settings + release calendar
├── .env.example  ← copy to .env for local dev
└── package.json
```
