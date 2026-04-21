/* ========================================
   NexusWatch — Dashboard Application Logic
   ======================================== */

// ─── Configuration ───────────────────────────────
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const FEED_SOURCES = {
  world: [
    { name: 'BBC World',   url: 'http://feeds.bbci.co.uk/news/world/rss.xml',   icon: '🌍' },
    { name: 'Al Jazeera',  url: 'https://www.aljazeera.com/xml/rss/all.xml',    icon: '📰' },
    { name: 'NPR News',    url: 'https://feeds.npr.org/1001/rss.xml',           icon: '🗞️' },
    { name: 'CNN',          url: 'http://rss.cnn.com/rss/edition_world.rss',     icon: '📺' },
  ],
  markets: [
    { name: 'CNBC',         url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', icon: '📊' },
    { name: 'MarketWatch',  url: 'http://feeds.marketwatch.com/marketwatch/topstories/',   icon: '📈' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex',               icon: '💹' },
  ],
  ai: [
    { name: 'TechCrunch AI',  url: 'https://techcrunch.com/category/artificial-intelligence/feed/', icon: '🤖' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/',                       icon: '🔬' },
    { name: 'Ars Technica',    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',      icon: '⚡' },
    { name: 'The Verge',       url: 'https://www.theverge.com/rss/index.xml',                       icon: '💡' },
  ],
  startups: [
    { name: 'TechCrunch',  url: 'https://techcrunch.com/feed/',         icon: '🚀' },
    { name: 'Hacker News',  url: 'https://hnrss.org/frontpage',         icon: '🧑‍💻' },
    { name: 'YC Blog',      url: 'https://www.ycombinator.com/blog/rss', icon: '🎯' },
  ]
};

const CATEGORY_META = {
  all:       { label: 'All Feeds',                subtitle: 'Aggregated from all sources',          icon: '🌐' },
  world:     { label: 'World News',               subtitle: 'Global events and geopolitics',        icon: '🌍' },
  markets:   { label: 'Markets & Business',       subtitle: 'Market shifts and business trends',    icon: '📈' },
  ai:        { label: 'AI & Technology',           subtitle: 'Artificial intelligence updates',      icon: '🤖' },
  startups:  { label: 'Startups & Opportunities', subtitle: 'Startup news and funding rounds',      icon: '🚀' },
  bookmarks: { label: 'Bookmarked',               subtitle: 'Your saved articles',                  icon: '⭐' },
};

// ─── State ───────────────────────────────────────
const state = {
  articles: [],
  bookmarks: JSON.parse(localStorage.getItem('nw_bookmarks') || '[]'),
  settings: JSON.parse(localStorage.getItem('nw_settings') || '{}'),
  notifications: [],
  currentCategory: 'all',
  searchQuery: '',
  sortBy: 'newest',
  isLoading: true,
  refreshTimer: null,
  lastRefresh: null,
};

// ─── DOM References ──────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  feedGrid:      $('#feedGrid'),
  loadingState:  $('#loadingState'),
  emptyState:    $('#emptyState'),
  errorState:    $('#errorState'),
  searchInput:   $('#searchInput'),
  sortSelect:    $('#sortSelect'),
  categoryTitle: $('#categoryTitle'),
  categorySubtitle: $('#categorySubtitle'),
  tickerContent: $('#tickerContent'),
  sidebar:       $('#sidebar'),
  menuToggle:    $('#menuToggle'),
  alertModal:    $('#alertModal'),
  notifPanel:    $('#notifPanel'),
  notifList:     $('#notifList'),
  notifBadge:    $('#notifBadge'),
  toastContainer: $('#toastContainer'),
  btnRefresh:    $('#btnRefresh'),
  // Stats
  statArticles:  $('#statArticles'),
  statBreaking:  $('#statBreaking'),
  statSources:   $('#statSources'),
  statRefresh:   $('#statRefresh'),
  // Counts
  countAll:      $('#countAll'),
  countWorld:    $('#countWorld'),
  countMarkets:  $('#countMarkets'),
  countAi:       $('#countAi'),
  countStartups: $('#countStartups'),
  countBookmarks: $('#countBookmarks'),
};

// ─── Initialization ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadSettings();
  fetchAllFeeds();
  startAutoRefresh();
});

// ─── Event Bindings ─────────────────────────────
function bindEvents() {
  // Sidebar navigation
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      setActiveCategory(cat);
    });
  });

  // Search
  dom.searchInput.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderArticles();
  }, 250));

  // Keyboard shortcut: Ctrl+K for search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      dom.searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeModal();
      closeNotifPanel();
      if (dom.sidebar.classList.contains('open')) {
        dom.sidebar.classList.remove('open');
      }
    }
  });

  // Sort
  dom.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderArticles();
  });

  // Refresh
  dom.btnRefresh.addEventListener('click', () => {
    dom.btnRefresh.classList.add('refreshing');
    fetchAllFeeds().then(() => {
      setTimeout(() => dom.btnRefresh.classList.remove('refreshing'), 600);
    });
  });

  // Menu toggle (mobile)
  dom.menuToggle.addEventListener('click', () => {
    dom.sidebar.classList.toggle('open');
  });

  // Notification panel
  $('#btnNotifications').addEventListener('click', (e) => {
    e.stopPropagation();
    dom.notifPanel.classList.toggle('hidden');
  });

  $('#btnClearNotifs').addEventListener('click', () => {
    state.notifications = [];
    renderNotifications();
  });

  // Close notif panel on outside click
  document.addEventListener('click', (e) => {
    if (!dom.notifPanel.contains(e.target) && e.target.id !== 'btnNotifications') {
      closeNotifPanel();
    }
  });

  // Alert Settings Modal
  $('#btnAlertSettings').addEventListener('click', openModal);
  $('#modalClose').addEventListener('click', closeModal);
  $('#btnCancelAlert').addEventListener('click', closeModal);
  $('#btnSaveAlert').addEventListener('click', saveSettings);
  dom.alertModal.addEventListener('click', (e) => {
    if (e.target === dom.alertModal) closeModal();
  });

  // Test notification
  $('#btnTestNotif').addEventListener('click', () => {
    if (Notification.permission === 'granted') {
      new Notification('NexusWatch Test', {
        body: 'Browser notifications are working! 🎉',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">◆</text></svg>'
      });
      showToast('Test notification sent!', 'success');
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification('NexusWatch', { body: 'Notifications enabled! ✅' });
          showToast('Notifications enabled!', 'success');
        }
      });
    } else {
      showToast('Notifications are blocked. Enable them in browser settings.', 'error');
    }
  });

  // Retry button
  $('#btnRetry').addEventListener('click', () => {
    dom.errorState.classList.add('hidden');
    fetchAllFeeds();
  });
}

// ─── Category Navigation ────────────────────────
function setActiveCategory(category) {
  state.currentCategory = category;
  
  // Update nav active state
  $$('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  // Update header
  const meta = CATEGORY_META[category];
  dom.categoryTitle.textContent = meta.label;
  dom.categorySubtitle.textContent = meta.subtitle;

  // Close mobile sidebar
  dom.sidebar.classList.remove('open');

  renderArticles();
}

// ─── Feed Fetching ──────────────────────────────
async function fetchAllFeeds() {
  state.isLoading = true;
  showLoading();

  const allArticles = [];
  const fetchPromises = [];

  for (const [category, sources] of Object.entries(FEED_SOURCES)) {
    for (const source of sources) {
      fetchPromises.push(
        fetchFeed(source.url, category, source.name, source.icon)
          .then(articles => allArticles.push(...articles))
          .catch(err => console.warn(`Failed to fetch ${source.name}:`, err))
      );
    }
  }

  await Promise.allSettled(fetchPromises);

  if (allArticles.length === 0) {
    // Try with CORS proxy fallback
    const fallbackArticles = await fetchWithFallback();
    allArticles.push(...fallbackArticles);
  }

  state.articles = deduplicateArticles(allArticles);
  state.lastRefresh = new Date();
  state.isLoading = false;

  updateStats();
  updateCounts();
  updateTicker();
  renderArticles();
  checkForBreakingNews();

  return state.articles;
}

async function fetchFeed(feedUrl, category, sourceName, sourceIcon) {
  const url = `${RSS2JSON}${encodeURIComponent(feedUrl)}`;
  
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json();
  
  if (data.status !== 'ok' || !data.items) return [];

  return data.items.map(item => ({
    id: generateId(item.title + item.pubDate),
    title: cleanText(item.title),
    description: cleanText(item.description || item.content || ''),
    link: item.link,
    pubDate: new Date(item.pubDate),
    thumbnail: item.thumbnail || item.enclosure?.link || extractImage(item.description || item.content || ''),
    category,
    sourceName,
    sourceIcon,
    author: item.author || sourceName,
  }));
}

async function fetchWithFallback() {
  // Fallback: use AllOrigins CORS proxy
  const articles = [];
  const proxyBase = 'https://api.allorigins.win/get?url=';

  for (const [category, sources] of Object.entries(FEED_SOURCES)) {
    for (const source of sources) {
      try {
        const res = await fetch(`${proxyBase}${encodeURIComponent(source.url)}`, {
          signal: AbortSignal.timeout(8000)
        });
        const data = await res.json();
        if (data.contents) {
          const parsed = parseXMLFeed(data.contents, category, source.name, source.icon);
          articles.push(...parsed);
        }
      } catch (e) { /* skip */ }
    }
  }

  return articles;
}

function parseXMLFeed(xmlString, category, sourceName, sourceIcon) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const items = doc.querySelectorAll('item');
  const articles = [];

  items.forEach(item => {
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const desc = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const mediaContent = item.querySelector('media\\:content, content')?.getAttribute('url') || '';
    const enclosure = item.querySelector('enclosure')?.getAttribute('url') || '';

    if (title) {
      articles.push({
        id: generateId(title + pubDate),
        title: cleanText(title),
        description: cleanText(desc),
        link,
        pubDate: pubDate ? new Date(pubDate) : new Date(),
        thumbnail: mediaContent || enclosure || extractImage(desc),
        category,
        sourceName,
        sourceIcon,
        author: sourceName,
      });
    }
  });

  return articles;
}

// ─── Rendering ──────────────────────────────────
function renderArticles() {
  let articles = getFilteredArticles();

  // Sort
  articles = sortArticles(articles);

  // Hide loading
  dom.loadingState.classList.add('hidden');
  dom.errorState.classList.add('hidden');

  if (articles.length === 0) {
    dom.feedGrid.innerHTML = '';
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  dom.feedGrid.innerHTML = articles.map((article, i) => createCardHTML(article, i)).join('');

  // Bind card events
  bindCardEvents();
}

function getFilteredArticles() {
  let articles = [...state.articles];

  // Category filter
  if (state.currentCategory === 'bookmarks') {
    articles = articles.filter(a => state.bookmarks.includes(a.id));
  } else if (state.currentCategory !== 'all') {
    articles = articles.filter(a => a.category === state.currentCategory);
  }

  // Search filter
  if (state.searchQuery) {
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(state.searchQuery) ||
      a.description.toLowerCase().includes(state.searchQuery) ||
      a.sourceName.toLowerCase().includes(state.searchQuery)
    );
  }

  return articles;
}

function sortArticles(articles) {
  switch (state.sortBy) {
    case 'newest':
      return articles.sort((a, b) => b.pubDate - a.pubDate);
    case 'oldest':
      return articles.sort((a, b) => a.pubDate - b.pubDate);
    case 'source':
      return articles.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    default:
      return articles;
  }
}

function createCardHTML(article, index) {
  const isBookmarked = state.bookmarks.includes(article.id);
  const timeAgo = getTimeAgo(article.pubDate);
  const desc = article.description.length > 160 
    ? article.description.substring(0, 160) + '...' 
    : article.description;

  const thumbHTML = article.thumbnail 
    ? `<img class="article-card__thumb" src="${escapeHTML(article.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.querySelector('.article-card__no-thumb').classList.remove('hidden');this.remove();">
       <div class="article-card__no-thumb article-card__no-thumb--${article.category} hidden">${article.sourceIcon}</div>`
    : `<div class="article-card__no-thumb article-card__no-thumb--${article.category}">${article.sourceIcon}</div>`;

  return `
    <article class="article-card" data-id="${article.id}" style="animation-delay: ${Math.min(index * 0.04, 0.6)}s">
      ${thumbHTML}
      <div class="article-card__body">
        <div class="article-card__meta">
          <span class="article-card__badge badge--${article.category}">${CATEGORY_META[article.category]?.label || article.category}</span>
          <span class="article-card__time">${timeAgo}</span>
        </div>
        <h3 class="article-card__title">
          <a href="${escapeHTML(article.link)}" target="_blank" rel="noopener">${escapeHTML(article.title)}</a>
        </h3>
        <p class="article-card__desc">${escapeHTML(desc)}</p>
      </div>
      <div class="article-card__footer">
        <div class="article-card__source">
          <span class="source-dot source-dot--${article.category}"></span>
          ${escapeHTML(article.sourceName)}
        </div>
        <div class="article-card__actions">
          <button class="card-action ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark" data-id="${article.id}" title="Bookmark">
            ${isBookmarked ? '★' : '☆'}
          </button>
          <button class="card-action" data-action="whatsapp" data-id="${article.id}" title="Share to WhatsApp">
            💬
          </button>
          <button class="card-action" data-action="share" data-id="${article.id}" title="Copy link">
            🔗
          </button>
        </div>
      </div>
    </article>
  `;
}

function bindCardEvents() {
  $$('.card-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const article = state.articles.find(a => a.id === id);
      if (!article) return;

      switch (action) {
        case 'bookmark':
          toggleBookmark(id);
          btn.classList.toggle('bookmarked');
          btn.textContent = state.bookmarks.includes(id) ? '★' : '☆';
          break;
        case 'whatsapp':
          shareToWhatsApp(article);
          break;
        case 'share':
          copyLink(article);
          break;
      }
    });
  });
}

// ─── Ticker ─────────────────────────────────────
function updateTicker() {
  const latest = [...state.articles]
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, 15);

  if (latest.length === 0) {
    dom.tickerContent.textContent = 'No headlines available';
    return;
  }

  // Duplicate for seamless scroll
  const items = [...latest, ...latest].map(a => 
    `<span class="ticker-item">
      <a href="${escapeHTML(a.link)}" target="_blank" rel="noopener">${escapeHTML(a.title)}</a>
      <span class="ticker-item__sep">◆</span>
    </span>`
  ).join('');

  dom.tickerContent.innerHTML = items;
}

// ─── Stats ──────────────────────────────────────
function updateStats() {
  const total = state.articles.length;
  const sources = new Set(state.articles.map(a => a.sourceName)).size;
  const oneHourAgo = new Date(Date.now() - 3600000);
  const breaking = state.articles.filter(a => a.pubDate > oneHourAgo).length;

  dom.statArticles.textContent = total;
  dom.statBreaking.textContent = breaking;
  dom.statSources.textContent = sources;
  dom.statRefresh.textContent = formatTime(state.lastRefresh);
}

function updateCounts() {
  const count = (cat) => state.articles.filter(a => a.category === cat).length;
  
  dom.countAll.textContent = state.articles.length;
  dom.countWorld.textContent = count('world');
  dom.countMarkets.textContent = count('markets');
  dom.countAi.textContent = count('ai');
  dom.countStartups.textContent = count('startups');
  dom.countBookmarks.textContent = state.bookmarks.length;
}

// ─── Bookmarks ──────────────────────────────────
function toggleBookmark(articleId) {
  const idx = state.bookmarks.indexOf(articleId);
  if (idx > -1) {
    state.bookmarks.splice(idx, 1);
    showToast('Removed from bookmarks', 'info');
  } else {
    state.bookmarks.push(articleId);
    showToast('Added to bookmarks ⭐', 'success');
  }
  localStorage.setItem('nw_bookmarks', JSON.stringify(state.bookmarks));
  dom.countBookmarks.textContent = state.bookmarks.length;
}

// ─── WhatsApp & Sharing ─────────────────────────
function shareToWhatsApp(article) {
  const text = `📰 *${article.title}*\n\n${article.description.substring(0, 200)}...\n\n🔗 ${article.link}\n\n— via NexusWatch`;
  const number = state.settings.whatsappNumber?.replace(/\D/g, '') || '';
  const url = number 
    ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyLink(article) {
  navigator.clipboard.writeText(article.link).then(() => {
    showToast('Link copied to clipboard! 🔗', 'success');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = article.link;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Link copied! 🔗', 'success');
  });
}

// ─── Breaking News Detection ────────────────────
function checkForBreakingNews() {
  if (!state.settings.browserNotifications) return;
  
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const breaking = state.articles.filter(a => a.pubDate > fiveMinAgo);

  breaking.forEach(article => {
    const notifId = `notif_${article.id}`;
    if (!state.notifications.find(n => n.id === notifId)) {
      state.notifications.unshift({
        id: notifId,
        icon: article.sourceIcon,
        title: article.sourceName,
        text: article.title,
        time: new Date(),
        link: article.link,
      });

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(`${article.sourceIcon} ${article.sourceName}`, {
          body: article.title,
          tag: notifId,
        });
      }
    }
  });

  renderNotifications();
}

// ─── Notifications ──────────────────────────────
function renderNotifications() {
  const badge = state.notifications.length;
  dom.notifBadge.textContent = badge;
  dom.notifBadge.classList.toggle('hidden', badge === 0);

  if (state.notifications.length === 0) {
    dom.notifList.innerHTML = '<div class="notif-empty">No new notifications</div>';
    return;
  }

  dom.notifList.innerHTML = state.notifications.slice(0, 20).map(n => `
    <div class="notif-item" onclick="window.open('${escapeHTML(n.link)}', '_blank')">
      <span class="notif-item__icon">${n.icon}</span>
      <div>
        <div class="notif-item__text"><strong>${escapeHTML(n.title)}</strong>: ${escapeHTML(n.text)}</div>
        <div class="notif-item__time">${getTimeAgo(n.time)}</div>
      </div>
    </div>
  `).join('');
}

function closeNotifPanel() {
  dom.notifPanel.classList.add('hidden');
}

// ─── Settings Modal ─────────────────────────────
function openModal() {
  dom.alertModal.classList.remove('hidden');
  populateSettingsForm();
}

function closeModal() {
  dom.alertModal.classList.add('hidden');
}

function populateSettingsForm() {
  const s = state.settings;
  $('#emailToggle').checked = s.emailEnabled || false;
  $('#alertEmail').value = s.email || '';
  $('#emailjsServiceId').value = s.emailjsServiceId || '';
  $('#emailjsTemplateId').value = s.emailjsTemplateId || '';
  $('#emailjsPublicKey').value = s.emailjsPublicKey || '';
  $('#whatsappToggle').checked = s.whatsappEnabled || false;
  $('#whatsappNumber').value = s.whatsappNumber || '';
  $('#browserNotifToggle').checked = s.browserNotifications || false;
}

function saveSettings() {
  state.settings = {
    emailEnabled: $('#emailToggle').checked,
    email: $('#alertEmail').value,
    emailjsServiceId: $('#emailjsServiceId').value,
    emailjsTemplateId: $('#emailjsTemplateId').value,
    emailjsPublicKey: $('#emailjsPublicKey').value,
    whatsappEnabled: $('#whatsappToggle').checked,
    whatsappNumber: $('#whatsappNumber').value,
    browserNotifications: $('#browserNotifToggle').checked,
  };

  localStorage.setItem('nw_settings', JSON.stringify(state.settings));

  // Request notification permission if enabled
  if (state.settings.browserNotifications && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  closeModal();
  showToast('Settings saved successfully! ✅', 'success');
}

function loadSettings() {
  const saved = localStorage.getItem('nw_settings');
  if (saved) {
    try { state.settings = JSON.parse(saved); } catch(e) {}
  }
}

// ─── Auto Refresh ───────────────────────────────
function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    fetchAllFeeds();
  }, REFRESH_INTERVAL);
}

// ─── Loading States ─────────────────────────────
function showLoading() {
  dom.feedGrid.innerHTML = Array(8).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-thumb"></div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-line--short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-line--medium"></div>
        <div class="skeleton-line skeleton-line--short"></div>
      </div>
    </div>
  `).join('');
  dom.loadingState.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.errorState.classList.add('hidden');
}

// ─── Toast Notifications ────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Utility Functions ──────────────────────────
function generateId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'art_' + Math.abs(hash).toString(36);
}

function cleanText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function extractImage(html) {
  const match = html.match(/<img[^>]+src=["']([^"']+)/i);
  return match ? match[1] : null;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getTimeAgo(date) {
  if (!date || isNaN(date)) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
