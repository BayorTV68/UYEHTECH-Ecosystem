/**
 * UYEH TECH — Shared Cookie Consent Component v3.0
 *
 * Drop in on every page (before </body>):
 *   <div id="cookie-consent"></div>
 *   <script src="/cookie.js"></script>
 *
 * Self-contained: injects its own CSS, builds the banner + settings
 * drawer, runs all consent logic, monitors backend auth cookies.
 * No dependencies. No frameworks.
 *
 * Public API (same as before — nothing breaks):
 *   window.cookieSystem.acceptAll()
 *   window.cookieSystem.rejectAll()
 *   window.cookieSystem.showSettings()
 *   window.cookieSystem.reset()
 *   window.cookieSystem.getStatus()
 */

(function () {
  'use strict';

  // ─── DESIGN NOTES ─────────────────────────────────────────────────────────
  // Banner:   compact pill/card fixed bottom-left — not a full-width bar.
  //           Slides up from below. Privacy-first visual: small, unobtrusive.
  // Settings: full-height drawer slides in from the RIGHT — different axis
  //           from the banner so both can coexist without feeling the same.
  //           Category rows use a cleaner card-inside-drawer layout vs the
  //           old stacked list.
  // Colour:   matches the UYEH TECH brand (#00ff88 green on #0a0a0a dark).
  // Motion:   short, purposeful — 280ms ease-out. No bouncing cookie emoji.

  // ─── CSS ──────────────────────────────────────────────────────────────────

  const css = `
    /* ── Reset scope ─────────────────────────────────── */
    #ck-banner *, #ck-drawer * {
      box-sizing: border-box;
      margin: 0; padding: 0;
      font-family: 'Montserrat', 'Segoe UI', sans-serif;
    }

    /* ── Banner ──────────────────────────────────────── */
    #ck-banner {
      position: fixed;
      bottom: 28px;
      left: 24px;
      z-index: 9998;
      width: 360px;
      max-width: calc(100vw - 48px);
      background: #111418;
      border: 1px solid rgba(0,255,136,.22);
      border-radius: 16px;
      padding: 20px 22px;
      box-shadow: 0 12px 48px rgba(0,0,0,.55),
                  0 0 0 1px rgba(0,255,136,.06);
      transform: translateY(calc(100% + 40px));
      opacity: 0;
      transition: transform .3s ease-out, opacity .3s ease-out;
      pointer-events: none;
    }
    #ck-banner.ck-visible {
      transform: translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    /* top row: icon + heading + close */
    .ck-banner-top {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }
    .ck-banner-icon {
      font-size: 1.4rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .ck-banner-heading {
      flex: 1;
      color: #fff;
      font-size: .95rem;
      font-weight: 700;
      line-height: 1.3;
    }
    .ck-banner-close {
      background: none;
      border: none;
      color: rgba(255,255,255,.35);
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 2px;
      transition: color .2s;
      flex-shrink: 0;
    }
    .ck-banner-close:hover { color: #fff; }

    /* body text */
    .ck-banner-body {
      color: rgba(255,255,255,.55);
      font-size: .78rem;
      line-height: 1.65;
      margin-bottom: 16px;
    }
    .ck-banner-body a {
      color: #00ff88;
      text-decoration: none;
    }
    .ck-banner-body a:hover { text-decoration: underline; }

    /* action buttons */
    .ck-banner-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ck-btn {
      flex: 1;
      min-width: 80px;
      padding: 9px 14px;
      border-radius: 9px;
      border: none;
      font-size: .78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all .2s;
      white-space: nowrap;
      text-align: center;
    }
    .ck-btn-accept {
      background: #00ff88;
      color: #0a0a0a;
    }
    .ck-btn-accept:hover { background: #00e67a; box-shadow: 0 4px 16px rgba(0,255,136,.35); }
    .ck-btn-settings {
      background: rgba(0,255,136,.1);
      color: #00ff88;
      border: 1px solid rgba(0,255,136,.25);
    }
    .ck-btn-settings:hover { background: rgba(0,255,136,.18); }
    .ck-btn-reject {
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.5);
      border: 1px solid rgba(255,255,255,.1);
    }
    .ck-btn-reject:hover { color: #fff; background: rgba(255,255,255,.1); }

    /* ── Settings drawer ──────────────────────────────── */
    #ck-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.55);
      z-index: 9998;
      opacity: 0;
      pointer-events: none;
      transition: opacity .28s;
    }
    #ck-overlay.ck-visible {
      opacity: 1;
      pointer-events: auto;
    }

    #ck-drawer {
      position: fixed;
      top: 0; right: 0;
      height: 100%;
      width: 420px;
      max-width: 100vw;
      background: #0f1217;
      border-left: 1px solid rgba(0,255,136,.18);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform .28s ease-out;
      box-shadow: -12px 0 60px rgba(0,0,0,.5);
    }
    #ck-drawer.ck-visible { transform: translateX(0); }

    /* drawer header */
    .ck-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px 24px;
      border-bottom: 1px solid rgba(255,255,255,.07);
      flex-shrink: 0;
    }
    .ck-drawer-title {
      color: #00ff88;
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ck-drawer-close {
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      color: rgba(255,255,255,.5);
      width: 32px; height: 32px;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .2s;
    }
    .ck-drawer-close:hover {
      background: rgba(255,77,77,.12);
      border-color: rgba(255,77,77,.3);
      color: #ff6b6b;
    }

    /* drawer intro */
    .ck-drawer-intro {
      padding: 16px 24px;
      color: rgba(255,255,255,.45);
      font-size: .8rem;
      line-height: 1.7;
      border-bottom: 1px solid rgba(255,255,255,.05);
      flex-shrink: 0;
    }

    /* scrollable body */
    .ck-drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ck-drawer-body::-webkit-scrollbar { width: 4px; }
    .ck-drawer-body::-webkit-scrollbar-track { background: transparent; }
    .ck-drawer-body::-webkit-scrollbar-thumb { background: rgba(0,255,136,.2); border-radius: 4px; }

    /* category card */
    .ck-category {
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 12px;
      padding: 16px;
      transition: border-color .2s;
    }
    .ck-category:hover { border-color: rgba(0,255,136,.2); }

    .ck-category-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .ck-category-label {
      display: flex;
      align-items: center;
      gap: 9px;
      flex: 1;
    }
    .ck-category-icon { font-size: 1.1rem; flex-shrink: 0; }
    .ck-category-name {
      color: #fff;
      font-size: .88rem;
      font-weight: 600;
    }
    .ck-always-on {
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #00ff88;
      background: rgba(0,255,136,.1);
      border: 1px solid rgba(0,255,136,.2);
      padding: 2px 8px;
      border-radius: 20px;
      white-space: nowrap;
    }

    /* toggle switch */
    .ck-toggle {
      position: relative;
      width: 42px; height: 24px;
      flex-shrink: 0;
    }
    .ck-toggle input { opacity: 0; width: 0; height: 0; }
    .ck-toggle-track {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,.1);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.15);
      cursor: pointer;
      transition: background .2s, border-color .2s;
    }
    .ck-toggle-track::after {
      content: '';
      position: absolute;
      top: 3px; left: 3px;
      width: 16px; height: 16px;
      background: rgba(255,255,255,.4);
      border-radius: 50%;
      transition: transform .2s, background .2s;
    }
    input:checked ~ .ck-toggle-track {
      background: rgba(0,255,136,.25);
      border-color: #00ff88;
    }
    input:checked ~ .ck-toggle-track::after {
      transform: translateX(18px);
      background: #00ff88;
    }
    input:disabled ~ .ck-toggle-track { cursor: default; opacity: .6; }

    .ck-category-desc {
      color: rgba(255,255,255,.38);
      font-size: .75rem;
      line-height: 1.6;
    }
    .ck-category-meta {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,.05);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ck-meta-row {
      color: rgba(255,255,255,.28);
      font-size: .7rem;
      line-height: 1.5;
    }
    .ck-meta-row strong { color: rgba(255,255,255,.45); }

    /* drawer footer */
    .ck-drawer-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255,255,255,.07);
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }
    .ck-drawer-footer .ck-btn { flex: 1; }

    /* ── Responsive ───────────────────────────────────── */
    @media (max-width: 480px) {
      #ck-banner { bottom: 16px; left: 12px; right: 12px; width: auto; max-width: 100%; }
      #ck-drawer { width: 100vw; }
      .ck-banner-actions { flex-direction: column; }
      .ck-btn { flex: none; width: 100%; }
    }
  `;

  // ─── CONFIG ───────────────────────────────────────────────────────────────

  const CONFIG = {
    consentKey:    'uyeh_cookie_consent',
    consentDateKey:'uyeh_cookie_consent_date',
    backendCookies:['uyeh_auth_token','uyeh_user','uyeh_access_session'],
    expiryDays:    365,
    showDelay:     2000, // ms before banner appears on first visit
  };

  // ─── CATEGORY DEFINITIONS ─────────────────────────────────────────────────

  const CATEGORIES = [
    {
      id:       'essential',
      icon:     '🔐',
      name:     'Essential',
      alwaysOn: true,
      desc:     'Required for login sessions, security, and basic site function. Cannot be disabled.',
      meta:     [
        { label: 'Purpose',  value: 'Authentication, session management, security' },
        { label: 'Cookies',  value: 'uyeh_auth_token (7d), uyeh_user (7d), uyeh_access_session (30m)' },
      ],
    },
    {
      id:       'analytics',
      icon:     '📊',
      name:     'Analytics',
      alwaysOn: false,
      desc:     'Helps us understand how visitors use the site so we can improve it.',
      meta:     [
        { label: 'Purpose',  value: 'Page views, user behaviour analysis' },
        { label: 'Cookies',  value: '_ga (2y), _gid (24h), _gat (1m)' },
        { label: 'Provider', value: 'Google Analytics' },
      ],
    },
    {
      id:       'marketing',
      icon:     '📢',
      name:     'Marketing',
      alwaysOn: false,
      desc:     'Tracks visits across sites to show you relevant ads and campaigns.',
      meta:     [
        { label: 'Purpose',  value: 'Advertising, retargeting' },
        { label: 'Cookies',  value: '_fbp (90d), fr (90d)' },
        { label: 'Provider', value: 'Facebook / Meta' },
      ],
    },
    {
      id:       'preference',
      icon:     '⚙️',
      name:     'Preferences',
      alwaysOn: false,
      desc:     'Remembers your settings — theme, language, and personalisation choices.',
      meta:     [
        { label: 'Purpose', value: 'Theme, language, UI customisations' },
        { label: 'Storage', value: 'localStorage (persistent)' },
      ],
    },
  ];

  // ─── BUILD HTML ───────────────────────────────────────────────────────────

  function buildBanner() {
    return `
      <div id="ck-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
        <div class="ck-banner-top">
          <span class="ck-banner-icon">🍪</span>
          <span class="ck-banner-heading">We use cookies</span>
          <button class="ck-banner-close" onclick="cookieSystem.rejectAll()" aria-label="Close and reject">✕</button>
        </div>
        <p class="ck-banner-body">
          We use cookies to keep you logged in, analyse traffic, and personalise your experience.
          <a href="/privacy.html">Privacy Policy</a>
        </p>
        <div class="ck-banner-actions">
          <button class="ck-btn ck-btn-accept"   onclick="cookieSystem.acceptAll()">Accept All</button>
          <button class="ck-btn ck-btn-settings" onclick="cookieSystem.showSettings()">Manage</button>
          <button class="ck-btn ck-btn-reject"   onclick="cookieSystem.rejectAll()">Reject</button>
        </div>
      </div>`;
  }

  function buildCategoryCard(cat) {
    const checkboxId = `ck-toggle-${cat.id}`;
    return `
      <div class="ck-category">
        <div class="ck-category-top">
          <label class="ck-category-label" for="${checkboxId}">
            <span class="ck-category-icon">${cat.icon}</span>
            <span class="ck-category-name">${cat.name}</span>
            ${cat.alwaysOn ? `<span class="ck-always-on">Always on</span>` : ''}
          </label>
          <label class="ck-toggle">
            <input type="checkbox" id="${checkboxId}"
              ${cat.alwaysOn ? 'checked disabled' : ''}
              aria-label="${cat.name} cookies">
            <span class="ck-toggle-track"></span>
          </label>
        </div>
        <p class="ck-category-desc">${cat.desc}</p>
        <div class="ck-category-meta">
          ${cat.meta.map(m =>
            `<p class="ck-meta-row"><strong>${m.label}:</strong> ${m.value}</p>`
          ).join('')}
        </div>
      </div>`;
  }

  function buildDrawer() {
    return `
      <div id="ck-overlay" onclick="cookieSystem.closeSettings()" aria-hidden="true"></div>
      <div id="ck-drawer" role="dialog" aria-label="Cookie preferences" aria-modal="true">
        <div class="ck-drawer-header">
          <span class="ck-drawer-title">🍪 Cookie Preferences</span>
          <button class="ck-drawer-close" onclick="cookieSystem.closeSettings()" aria-label="Close">✕</button>
        </div>
        <p class="ck-drawer-intro">
          Choose which cookies to enable. Essential cookies are always active —
          everything else is your choice.
        </p>
        <div class="ck-drawer-body">
          ${CATEGORIES.map(buildCategoryCard).join('')}
        </div>
        <div class="ck-drawer-footer">
          <button class="ck-btn ck-btn-reject"   onclick="cookieSystem.rejectAll()">Reject All</button>
          <button class="ck-btn ck-btn-settings" onclick="cookieSystem.saveSettings()">Save</button>
          <button class="ck-btn ck-btn-accept"   onclick="cookieSystem.acceptAll()">Accept All</button>
        </div>
      </div>`;
  }

  // ─── COOKIE SYSTEM ────────────────────────────────────────────────────────

  const cookieSystem = {

    init() {
      const consent = this.getConsent();
      if (!consent) {
        setTimeout(() => this.showBanner(), CONFIG.showDelay);
      } else {
        this.applyPreferences(consent);
      }
      this.checkBackendAuth();
      this.monitorBackendCookies();
    },

    // ── Banner ──────────────────────────────────────────

    showBanner() {
      const el = document.getElementById('ck-banner');
      if (el) el.classList.add('ck-visible');
    },

    hideBanner() {
      const el = document.getElementById('ck-banner');
      if (el) el.classList.remove('ck-visible');
    },

    // ── Drawer ──────────────────────────────────────────

    showSettings() {
      const drawer  = document.getElementById('ck-drawer');
      const overlay = document.getElementById('ck-overlay');
      if (!drawer) return;
      // Populate toggles from saved prefs
      const consent = this.getConsent();
      CATEGORIES.filter(c => !c.alwaysOn).forEach(cat => {
        const el = document.getElementById(`ck-toggle-${cat.id}`);
        if (el && consent) el.checked = !!consent[cat.id];
      });
      drawer.classList.add('ck-visible');
      if (overlay) overlay.classList.add('ck-visible');
      // Trap focus roughly — focus first interactive element
      setTimeout(() => {
        const first = drawer.querySelector('button, input');
        if (first) first.focus();
      }, 50);
    },

    closeSettings() {
      const drawer  = document.getElementById('ck-drawer');
      const overlay = document.getElementById('ck-overlay');
      if (drawer)  drawer.classList.remove('ck-visible');
      if (overlay) overlay.classList.remove('ck-visible');
    },

    // ── Consent actions ─────────────────────────────────

    acceptAll() {
      this.saveConsent({ essential:true, analytics:true, marketing:true, preference:true });
      this.hideBanner();
      this.closeSettings();
    },

    rejectAll() {
      this.saveConsent({ essential:true, analytics:false, marketing:false, preference:false });
      this.hideBanner();
      this.closeSettings();
    },

    saveSettings() {
      const prefs = { essential: true };
      CATEGORIES.filter(c => !c.alwaysOn).forEach(cat => {
        const el = document.getElementById(`ck-toggle-${cat.id}`);
        prefs[cat.id] = el ? el.checked : false;
      });
      this.saveConsent(prefs);
      this.closeSettings();
      this.hideBanner();
    },

    // ── Storage ─────────────────────────────────────────

    saveConsent(prefs) {
      localStorage.setItem(CONFIG.consentKey,     JSON.stringify(prefs));
      localStorage.setItem(CONFIG.consentDateKey, new Date().toISOString());
      this.applyPreferences(prefs);
    },

    getConsent() {
      const raw = localStorage.getItem(CONFIG.consentKey);
      return raw ? JSON.parse(raw) : null;
    },

    // ── Apply ───────────────────────────────────────────

    applyPreferences(prefs) {
      if (prefs.analytics) this.enableAnalytics();
      else                 this.disableAnalytics();

      if (prefs.marketing) this.enableMarketing();
      else                 this.disableMarketing();
    },

    enableAnalytics() {
      if (typeof gtag !== 'undefined')
        gtag('consent','update',{ analytics_storage:'granted' });
    },
    disableAnalytics() {
      if (typeof gtag !== 'undefined')
        gtag('consent','update',{ analytics_storage:'denied' });
    },
    enableMarketing() {
      if (typeof fbq !== 'undefined') fbq('consent','grant');
    },
    disableMarketing() {
      if (typeof fbq !== 'undefined') fbq('consent','revoke');
    },

    // ── Backend auth monitoring ──────────────────────────

    getCookie(name) {
      const v = `; ${document.cookie}`;
      const p = v.split(`; ${name}=`);
      return p.length === 2 ? p.pop().split(';').shift() : null;
    },

    checkBackendAuth() {
      const token = this.getCookie('uyeh_auth_token');
      const raw   = this.getCookie('uyeh_user');
      if (token && raw) {
        try {
          const user = JSON.parse(decodeURIComponent(raw));
          this.updateUIForLoggedInUser(user);
        } catch (_) {}
      } else {
        this.updateUIForLoggedOutUser();
      }
    },

    monitorBackendCookies() {
      let last = this.getCookie('uyeh_auth_token');
      setInterval(() => {
        const current = this.getCookie('uyeh_auth_token');
        if (current !== last) {
          if (current) this.checkBackendAuth();
          else         this.updateUIForLoggedOutUser();
          last = current;
        }
      }, 2000);
    },

    updateUIForLoggedInUser(user) {
      // Extend here: hide login links, show account name, etc.
    },
    updateUIForLoggedOutUser() {
      // Extend here: reset nav to logged-out state, etc.
    },

    // ── Utilities ───────────────────────────────────────

    reset() {
      localStorage.removeItem(CONFIG.consentKey);
      localStorage.removeItem(CONFIG.consentDateKey);
      location.reload();
    },

    getStatus() {
      const consent = this.getConsent();
      return {
        consent,
        backendAuth: this.getCookie('uyeh_auth_token') ? 'Active' : 'Inactive',
        cookies: document.cookie,
      };
    },
  };

  // ─── MOUNT ────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('uyeh-cookie-styles')) return;
    const style = document.createElement('style');
    style.id = 'uyeh-cookie-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mount() {
    const target = document.getElementById('cookie-consent');
    if (!target) {
      console.warn('[cookie.js] No <div id="cookie-consent"> found on this page.');
      return;
    }
    injectStyles();
    target.innerHTML = buildBanner() + buildDrawer();
    cookieSystem.init();
    window.cookieSystem = cookieSystem;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();