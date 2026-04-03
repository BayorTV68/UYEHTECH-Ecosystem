/**
 * ═══════════════════════════════════════════════════════════════
 *  UYEH TECH — SITE CONTROLLER v2.0
 *  site-controller.js
 *
 *  Add ONE line to every page on uyeh.netlify.app:
 *    <script src="/site-controller.js" defer></script>
 *
 *  This script:
 *   ✅ Checks maintenance mode and shows overlay when active
 *   ✅ Shows/hides announcement banner from admin
 *   ✅ Enforces feature switches (store off = hide store links)
 *   ✅ Listens to WebSocket for instant admin changes
 *   ✅ Injects custom CSS from admin panel
 *   ✅ Loads Google Analytics / Facebook Pixel if configured
 *   ✅ Admin bypass: visit ?bypass=TOKEN to skip maintenance
 *   ✅ Polls settings every 60 seconds as fallback
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  const API = 'https://uyehtechbackend.onrender.com';
  const POLL_INTERVAL    = 60 * 1000;  // re-check settings every 60s
  const BANNER_DISMISS_KEY = 'uyeh_banner_dismissed';
  const BYPASS_STORAGE_KEY = 'uyeh_maintenance_bypass';

  // Pages that show maintenance (matches admin's maintenancePages field)
  // 'all' = every page. Otherwise comma-separated partial URL slugs.
  // e.g. 'store,checkout' — only blocks those URLs
  let currentSettings = null;
  let pollTimer       = null;

  // ── Bootstrap ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    injectStyles();
    await fetchAndApply();
    startPolling();
    connectWebSocket();
  }

  // ── Fetch settings from server ─────────────────────────────────
  async function fetchAndApply() {
    try {
      // Check for bypass token in URL or storage
      const urlBypass = new URLSearchParams(window.location.search).get('bypass');
      if (urlBypass) {
        sessionStorage.setItem(BYPASS_STORAGE_KEY, urlBypass);
        // Clean URL without reload
        const clean = new URL(window.location.href);
        clean.searchParams.delete('bypass');
        history.replaceState({}, '', clean.toString());
      }
      const bypass = urlBypass || sessionStorage.getItem(BYPASS_STORAGE_KEY) || '';

      const url = bypass
        ? `${API}/api/settings/public?bypass=${encodeURIComponent(bypass)}`
        : `${API}/api/settings/public`;

      const res  = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (data.success && data.settings) {
        currentSettings = data.settings;
        applySettings(data.settings);
      }
    } catch (e) {
      // Server down or network error — don't block the site
      console.warn('[SiteController] Could not fetch settings:', e.message);
    }
  }

  // ── Apply all settings to this page ───────────────────────────
  function applySettings(s) {
    handleMaintenance(s);
    handleBanner(s);
    handleFeatureToggles(s);
    handleCustomCSS(s);
    handleAnalytics(s);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. MAINTENANCE MODE
  // ─────────────────────────────────────────────────────────────
  function handleMaintenance(s) {
    if (!s.maintenanceMode) {
      removeMaintenance();
      return;
    }

    // Check if this page is in the affected list
    const pages = (s.maintenancePages || 'all').toLowerCase();
    if (pages !== 'all') {
      const path = window.location.pathname.toLowerCase();
      const blocked = pages.split(',').map(p => p.trim()).some(p => path.includes(p));
      if (!blocked) return; // page is not in the maintenance list
    }

    // Don't block admin pages
    if (window.location.pathname.includes('admin') ||
        window.location.pathname.includes('super-admin')) {
      return;
    }

    showMaintenanceOverlay(s);
  }

  function showMaintenanceOverlay(s) {
    if (document.getElementById('uyeh-maintenance-overlay')) return;

    const el = document.createElement('div');
    el.id = 'uyeh-maintenance-overlay';
    el.innerHTML = `
      <div class="uyeh-maint-card">
        <div class="uyeh-maint-logo">
          <img src="/uyehtech logo.png" alt="UYEH TECH" onerror="this.style.display='none'">
        </div>
        <div class="uyeh-maint-icon">🔧</div>
        <h1 class="uyeh-maint-title">${escHtml(s.maintenanceTitle || 'Under Maintenance')}</h1>
        <p class="uyeh-maint-msg">${escHtml(s.maintenanceMessage || 'We\'ll be back shortly!')}</p>
        ${s.maintenanceETA ? `
          <div class="uyeh-maint-eta">
            <span class="uyeh-maint-eta-label">⏱ Estimated return:</span>
            <span class="uyeh-maint-eta-value">${escHtml(s.maintenanceETA)}</span>
          </div>
        ` : ''}
        <div class="uyeh-maint-status">
          <span class="uyeh-maint-dot"></span>
          <span>Our team is working on this</span>
        </div>
        <div class="uyeh-maint-links">
          <a href="mailto:uyehtech@gmail.com" class="uyeh-maint-link">📧 Contact Support</a>
        </div>
        <p class="uyeh-maint-footer">© ${new Date().getFullYear()} UYEH TECH</p>
      </div>
    `;

    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
  }

  function removeMaintenance() {
    const el = document.getElementById('uyeh-maintenance-overlay');
    if (el) {
      el.classList.add('uyeh-fade-out');
      setTimeout(() => { el.remove(); document.body.style.overflow = ''; }, 500);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ANNOUNCEMENT BANNER
  // ─────────────────────────────────────────────────────────────
  function handleBanner(s) {
    const existing = document.getElementById('uyeh-site-banner');

    if (!s.banner || !s.banner.enabled || !s.banner.text) {
      if (existing) existing.remove();
    document.body.style.paddingTop = document.body.dataset.uyehOrigPadding || '';
      return;
    }

    // Check if user already dismissed this exact banner
    const dismissedText = sessionStorage.getItem(BANNER_DISMISS_KEY);
    if (dismissedText === s.banner.text) {
      if (existing) existing.remove();
      return;
    }

    if (existing) {
      // Update text if changed
      const textEl = existing.querySelector('.uyeh-banner-text');
      if (textEl) textEl.innerHTML = buildBannerInner(s.banner);
      return;
    }
    const banner = document.createElement('div');
    banner.id = 'uyeh-site-banner';
    banner.className = `uyeh-banner uyeh-banner--${s.banner.type || 'info'}`;
    banner.innerHTML = `
      <div class="uyeh-banner-inner">
        <span class="uyeh-banner-text">${buildBannerInner(s.banner)}</span>
        ${s.banner.dismissible !== false ? `
          <button class="uyeh-banner-close" onclick="window.__uyehDismissBanner()">✕</button>
        ` : ''}
      </div>
    `;

    window.__uyehDismissBanner = function() {
      if (currentSettings && currentSettings.banner) {
        sessionStorage.setItem(BANNER_DISMISS_KEY, currentSettings.banner.text);
      }
      banner.classList.add('uyeh-banner--hiding');
      setTimeout(() => banner.remove(), 400);
    };

    // Insert at very top of body, above everything
    if (!document.body.dataset.uyehOrigPadding) {
        document.body.dataset.uyehOrigPadding = getComputedStyle(document.body).paddingTop;
    }
    document.body.insertBefore(banner, document.body.firstChild);
    const bannerH = banner.offsetHeight;
    const origPad = parseInt(document.body.dataset.uyehOrigPadding) || 0;
    document.body.style.paddingTop = (origPad + bannerH) + 'px';
    document.body.style.paddingTop = document.body.dataset.uyehOrigPadding || '';
  }

 function buildBannerInner(b) {
    let html = escHtml(b.text);
    if (b.link) {
        const label = b.linkText ? escHtml(b.linkText) : 'Learn more';
        html += ` <a href="${escHtml(b.link)}" class="uyeh-banner-link">${label} →</a>`;
    }
    return html;
}

  // ─────────────────────────────────────────────────────────────
  // 3. FEATURE TOGGLES
  // ─────────────────────────────────────────────────────────────
  function handleFeatureToggles(s) {
    // Map feature flag → CSS selectors to hide when disabled
    const featureMap = {
      storeEnabled:      [
        'a[href*="store"]',
        'a[href*="products"]',
        'a[href*="checkout"]',
        '[data-feature="store"]'
      ],
      blogEnabled:       ['a[href*="blog"]', '[data-feature="blog"]'],
      chatEnabled:       ['.chat-widget', '#chatButton', '[data-feature="chat"]'],
      creatorEnabled:    ['a[href*="creator"]', '[data-feature="creator"]'],
      affiliatesEnabled: ['a[href*="affiliate"]', '[data-feature="affiliate"]']
    };

    Object.entries(featureMap).forEach(([flag, selectors]) => {
      const enabled = s[flag] !== false;
      selectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            el.style.display = enabled ? '' : 'none';
          });
        } catch (_) {}
      });
    });

    // If store is disabled and user is ON the store page, show notice
    if (s.storeEnabled === false) {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('store') || path.includes('product') || path.includes('checkout')) {
        showFeatureDisabled('🛍️', 'Store Temporarily Unavailable',
          'Our store is currently offline. Please check back soon.');
      }
    }
  }
// Add after the storeEnabled block (around line 249), replacing the single store check:
const pageBlocks = [
    { flag: 'storeEnabled',      slugs: ['store','product','checkout'],    icon: '🛍️', title: 'Store Temporarily Unavailable',       msg: 'Our store is currently offline. Please check back soon.' },
    { flag: 'blogEnabled',       slugs: ['blog'],                          icon: '📝', title: 'Blog Temporarily Unavailable',        msg: 'Our blog is currently offline. Please check back soon.' },
    { flag: 'creatorEnabled',    slugs: ['creator'],                       icon: '🏪', title: 'Creator Marketplace Unavailable',     msg: 'The creator marketplace is currently offline.' },
    { flag: 'affiliatesEnabled', slugs: ['affiliate'],                     icon: '🔗', title: 'Affiliate Program Unavailable',       msg: 'The affiliate program is currently paused.' },
];

pageBlocks.forEach(({ flag, slugs, icon, title, msg }) => {
    if (s[flag] === false) {
        const path = window.location.pathname.toLowerCase();
        if (slugs.some(slug => path.includes(slug))) {
            showFeatureDisabled(icon, title, msg);
        }
    }
});
  function showFeatureDisabled(icon, title, msg) {
    if (document.getElementById('uyeh-feature-disabled')) return;
    const el = document.createElement('div');
    el.id = 'uyeh-feature-disabled';
    el.className = 'uyeh-feature-disabled';
    el.innerHTML = `
      <div class="uyeh-fd-card">
        <div class="uyeh-fd-icon">${icon}</div>
        <h2>${escHtml(title)}</h2>
        <p>${escHtml(msg)}</p>
        <a href="/" class="uyeh-fd-btn">← Back to Home</a>
      </div>
    `;
    document.body.appendChild(el);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CUSTOM CSS FROM ADMIN
  // ─────────────────────────────────────────────────────────────
  function handleCustomCSS(s) {
    if (!s.customCSS) return;
    let styleEl = document.getElementById('uyeh-admin-custom-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'uyeh-admin-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = s.customCSS;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ANALYTICS (inject only if ID is set and not already loaded)
  // ─────────────────────────────────────────────────────────────
  function handleAnalytics(s) {
    if (s.googleAnalyticsId && !window.__uyeh_ga_loaded) {
      const gid = s.googleAnalyticsId;
      const sc = document.createElement('script');
      sc.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gid)}`;
      sc.async = true;
      document.head.appendChild(sc);
      sc.onload = function() {
        window.dataLayer = window.dataLayer || [];
        function gtag(){ window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gid);
      };
      window.__uyeh_ga_loaded = true;
    }

    if (s.facebookPixelId && !window.__uyeh_fb_loaded) {
      const pid = s.facebookPixelId;
      !function(f,b,e,v,n,t,s){
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)
      }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', pid);
      window.fbq('track', 'PageView');
      window.__uyeh_fb_loaded = true;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. WEBSOCKET — instant updates without waiting for poll
  // ─────────────────────────────────────────────────────────────
  function connectWebSocket() {
    try {
      const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://') + '/wss';
      const ws = new WebSocket(wsUrl);

      ws.onmessage = function(event) {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'settings_updated' || msg.type === 'maintenance_toggled') {
            console.log('[SiteController] Settings changed from admin — re-fetching...');
            fetchAndApply();
          }
        } catch (_) {}
      };

      ws.onclose = function() {
        // Reconnect after 30s if connection drops
        setTimeout(connectWebSocket, 30000);
      };

      ws.onerror = function() { ws.close(); };

    } catch (_) {
      // WebSocket not supported or blocked — polling covers this
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. POLLING FALLBACK
  // ─────────────────────────────────────────────────────────────
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(fetchAndApply, POLL_INTERVAL);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. STYLES
  // ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('uyeh-controller-styles')) return;
    const style = document.createElement('style');
    style.id = 'uyeh-controller-styles';
    style.textContent = `
      /* ── Maintenance Overlay ─────────────────────────────── */
      #uyeh-maintenance-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: #080808;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: uyeh-fadein 0.4s ease;
      }
      #uyeh-maintenance-overlay.uyeh-fade-out {
        animation: uyeh-fadeout 0.5s ease forwards;
      }
      .uyeh-maint-card {
        background: linear-gradient(135deg, #0f0f0f, #161616);
        border: 1px solid rgba(0,255,136,.25);
        border-radius: 20px;
        padding: 52px 44px;
        max-width: 520px;
        width: 100%;
        text-align: center;
        box-shadow: 0 0 80px rgba(0,255,136,.08), 0 40px 60px rgba(0,0,0,.6);
      }
      .uyeh-maint-logo { margin-bottom: 16px; }
      .uyeh-maint-logo img { width: 56px; height: 56px; border-radius: 14px; }
      .uyeh-maint-icon {
        font-size: 3.2rem; margin-bottom: 18px; display: block;
        animation: uyeh-float 3s ease-in-out infinite;
      }
      .uyeh-maint-title {
        font-family: 'Playfair Display', 'Georgia', serif;
        font-size: 2rem; color: #00ff88; margin-bottom: 14px; line-height: 1.2;
      }
      .uyeh-maint-msg {
        color: #9ca3af; font-size: 1rem; line-height: 1.7; margin-bottom: 24px;
        font-family: 'Montserrat', sans-serif;
      }
      .uyeh-maint-eta {
        background: rgba(0,255,136,.06);
        border: 1px solid rgba(0,255,136,.18);
        border-radius: 10px;
        padding: 12px 20px;
        margin-bottom: 20px;
        display: flex; align-items: center; gap: 10px;
        justify-content: center; flex-wrap: wrap;
      }
      .uyeh-maint-eta-label { color: #9ca3af; font-size: .85rem; }
      .uyeh-maint-eta-value { color: #00ff88; font-weight: 700; font-size: .95rem; }
      .uyeh-maint-status {
        display: flex; align-items: center; gap: 8px;
        justify-content: center; margin-bottom: 24px;
        color: #6b7280; font-size: .82rem;
      }
      .uyeh-maint-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #00ff88;
        animation: uyeh-pulse 2s ease-in-out infinite;
      }
      .uyeh-maint-links { margin-bottom: 24px; }
      .uyeh-maint-link {
        color: rgba(0,255,136,.7); text-decoration: none; font-size: .85rem;
        padding: 8px 18px;
        border: 1px solid rgba(0,255,136,.2);
        border-radius: 8px;
        transition: all .25s;
        display: inline-block;
      }
      .uyeh-maint-link:hover { color: #00ff88; border-color: rgba(0,255,136,.5); background: rgba(0,255,136,.06); }
      .uyeh-maint-footer { color: #374151; font-size: .75rem; }

      /* ── Announcement Banner ─────────────────────────────── */
      .uyeh-banner {
        position: relative; z-index: 99998;
        padding: 10px 16px;
        font-family: 'Montserrat', sans-serif;
        font-size: .88rem;
        animation: uyeh-slide-down .4s ease;
      }
      .uyeh-banner--info    { background: #0d2d45; border-bottom: 2px solid #0096ff; color: #bfdbfe; }
      .uyeh-banner--success { background: #0a2e1a; border-bottom: 2px solid #00ff88; color: #bbf7d0; }
      .uyeh-banner--warning { background: #2e1f07; border-bottom: 2px solid #ffa500; color: #fde68a; }
      .uyeh-banner--urgent  { background: #2e0b0b; border-bottom: 2px solid #ff4444; color: #fecaca; }
      .uyeh-banner--hiding  { animation: uyeh-slide-up .4s ease forwards; }
      .uyeh-banner-inner {
        display: flex; align-items: center;
        justify-content: center; gap: 12px;
        max-width: 1200px; margin: 0 auto;
      }
      .uyeh-banner-text { flex: 1; text-align: center; }
      .uyeh-banner-link {
        color: inherit; font-weight: 700; text-decoration: underline;
        white-space: nowrap;
      }
      .uyeh-banner-close {
        background: none; border: none; color: inherit;
        cursor: pointer; font-size: 1.1rem; opacity: .7;
        padding: 2px 6px; border-radius: 4px;
        transition: opacity .2s;
        flex-shrink: 0;
      }
      .uyeh-banner-close:hover { opacity: 1; }

      /* ── Feature Disabled ────────────────────────────────── */
      .uyeh-feature-disabled {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,.85);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: uyeh-fadein .3s ease;
      }
      .uyeh-fd-card {
        background: #111; border: 1px solid rgba(0,255,136,.2);
        border-radius: 16px; padding: 48px 36px;
        max-width: 420px; text-align: center;
      }
      .uyeh-fd-icon { font-size: 3rem; margin-bottom: 16px; }
      .uyeh-fd-card h2 { color: #00ff88; font-size: 1.5rem; margin-bottom: 12px; }
      .uyeh-fd-card p  { color: #9ca3af; line-height: 1.6; margin-bottom: 24px; }
      .uyeh-fd-btn {
        display: inline-block; padding: 12px 28px;
        background: rgba(0,255,136,.1);
        border: 1px solid rgba(0,255,136,.3);
        color: #00ff88; border-radius: 10px;
        text-decoration: none; font-size: .9rem;
        transition: all .25s;
      }
      .uyeh-fd-btn:hover { background: rgba(0,255,136,.18); }

      /* ── Keyframes ───────────────────────────────────────── */
      @keyframes uyeh-fadein  { from { opacity: 0 } to { opacity: 1 } }
      @keyframes uyeh-fadeout { from { opacity: 1 } to { opacity: 0 } }
      @keyframes uyeh-slide-down { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      @keyframes uyeh-slide-up   { from { transform: translateY(0); opacity: 1 } to { transform: translateY(-100%); opacity: 0 } }
      @keyframes uyeh-float  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
      @keyframes uyeh-pulse  { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .4; transform: scale(1.5) } }

      @media (max-width: 600px) {
        .uyeh-maint-card { padding: 36px 24px; }
        .uyeh-maint-title { font-size: 1.5rem; }
        .uyeh-banner { font-size: .8rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Utility ────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose a manual refresh for pages that want to force re-check
  window.uyehSiteController = { refresh: fetchAndApply, getSettings: () => currentSettings };

})();