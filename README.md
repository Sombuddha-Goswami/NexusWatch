# ◆ NexusWatch

**Real-time News & Opportunity Tracking Dashboard**

A premium, dark-themed dashboard that aggregates news from 14+ RSS sources across World News, Markets & Business, AI & Technology, and Startups — with built-in WhatsApp/Email/Browser alert integrations.

![NexusWatch Dashboard](https://img.shields.io/badge/Status-Live-brightgreen) ![Sources](https://img.shields.io/badge/Sources-14+-blue) ![License](https://img.shields.io/badge/License-MIT-purple)

---

## ✨ Features

- 🔴 **Live Ticker** — Breaking headlines scrolling in real-time
- 🌍 **World News** — BBC, CNN, Al Jazeera, NPR
- 📈 **Markets & Business** — CNBC, MarketWatch, Yahoo Finance
- 🤖 **AI & Technology** — TechCrunch AI, MIT Tech Review, Ars Technica, The Verge
- 🚀 **Startups** — TechCrunch, Hacker News, Y Combinator
- 🔍 **Search & Filter** — Full-text search with `Ctrl+K`, sort by newest/oldest/source
- ⭐ **Bookmarks** — Save articles locally
- 💬 **WhatsApp Sharing** — One-click share on every article
- 📧 **Email Alerts** — Via EmailJS integration (200 free/month)
- 🔔 **Browser Notifications** — Desktop push alerts for breaking news
- 🔄 **Auto-Refresh** — Feeds update every 5 minutes

## 🚀 Quick Start

No build steps. No dependencies. Just serve and go.

```bash
# Option 1: Python
python -m http.server 3000

# Option 2: Node.js
npx serve .

# Option 3: Just open index.html directly
```

Then visit **http://localhost:3000**

## 🔔 Alert Setup

### Email (via EmailJS)
1. Create a free account at [emailjs.com](https://www.emailjs.com/)
2. Set up an Email Service + Template
3. Enter your Service ID, Template ID, and Public Key in Alert Settings

### WhatsApp
1. Open Alert Settings → WhatsApp
2. Enter your number with country code (+91...)
3. Share articles directly to WhatsApp

### Browser Notifications
1. Toggle on in Alert Settings
2. Allow browser permission
3. Get instant desktop push alerts

## 📁 Structure

```
├── index.html    # Dashboard layout
├── styles.css    # Premium dark theme (glassmorphism, animations)
├── app.js        # Feed fetching, search, alerts, bookmarks
└── README.md
```

## 🛠 Tech Stack

- **HTML5** + **CSS3** + **Vanilla JavaScript**
- RSS feeds via [rss2json](https://rss2json.com) API
- Zero dependencies. Zero build steps.

## 📄 License

MIT
