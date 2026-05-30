/**
 * ═══════════════════════════════════════════════════════════════
 *  UYEH TECH — PWA INSTALL CONTROLLER  v2.0  (pwa-install.js)
 *
 *  Add ONE line to EVERY page (before </body>):
 *    <script src="/pwa-install.js" defer></script>
 *
 *  What this does:
 *   ✅ Registers the service worker
 *   ✅ Detects SW updates and shows a non-intrusive update bar
 *   ✅ Shows install prompt banner for eligible browsers
 *   ✅ Respects user dismissal with 7-day cooldown (not just session)
 *   ✅ Detects iOS and shows manual install instructions
 *   ✅ Sends SKIP_WAITING so updates apply immediately on user click
 *   ✅ Announces offline/online state changes site-wide
 *   ✅ Never shows install banner on admin or agent pages
 *   ✅ Fixed: logo filename no longer has a space
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  const SW_PATH             = '/sw.js';
  const SW_SCOPE            = '/';
  const DISMISS_STORAGE_KEY = 'uyeh_pwa_dismissed_until';
  const DISMISS_DURATION    = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  // Never show install banner on admin/agent pages
  const IS_PRIVILEGED_PAGE  = /\/(admin|agent|super-admin)/i.test(window.location.pathname);

  let registration   = null;
  let deferredPrompt = null;
  let newWorker      = null;

  // ═══════════════════════════════════════════════════════════
  // 1. REGISTER SERVICE WORKER
  // ═══════════════════════════════════════════════════════════
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
        .then(reg => {
          registration = reg;
          console.log('[PWA] SW registered:', reg.scope);

          // Check for an update immediately and on every future visit
          reg.update().catch(() => {});

          reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // A new SW is waiting — tell the user
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));

      // When a new SW takes over (after SKIP_WAITING) — reload the page
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 2. CAPTURE INSTALL PROMPT (Chrome / Android / Edge)
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    if (IS_PRIVILEGED_PAGE) return;
    if (isAlreadyInstalled())  return;
    if (isDismissed())         return;

    // Small delay — don't interrupt page load
    setTimeout(showInstallBanner, 3000);
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
    console.log('[PWA] ✅ App installed!');
    showToast('✅ UYEH TECH installed successfully!');
  });

  // ═══════════════════════════════════════════════════════════
  // 3. iOS INSTALL HINT (Safari — no beforeinstallprompt)
  // ═══════════════════════════════════════════════════════════
  function isIos() {
    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  }
  function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  if (isIos() && !isInStandaloneMode() && !IS_PRIVILEGED_PAGE && !isDismissed()) {
    setTimeout(showIosHint, 4000);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. ONLINE / OFFLINE ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('online', () => {
    showToast('✅ You\'re back online!', 'success', 3000);
    document.dispatchEvent(new CustomEvent('uyeh:online'));
  });
  window.addEventListener('offline', () => {
    showToast('⚠️ You\'re offline — some features may be limited', 'warning', 5000);
    document.dispatchEvent(new CustomEvent('uyeh:offline'));
  });

  // ═══════════════════════════════════════════════════════════
  // 5. INSTALL BANNER UI
  // ═══════════════════════════════════════════════════════════
  function showInstallBanner() {
    if (document.getElementById('uyeh-install-banner')) return;

    injectStyles();

    const banner = document.createElement('div');
    banner.id        = 'uyeh-install-banner';
    banner.className = 'uyeh-pwa-banner';
    banner.innerHTML = `
      <div class="uyeh-pwa-banner-inner">
        <img class="uyeh-pwa-icon" src="/icons/icon-192.png" alt="UYEH TECH"
             onerror="this.style.display='none'">
        <div class="uyeh-pwa-info">
          <div class="uyeh-pwa-title">Install UYEH TECH</div>
          <div class="uyeh-pwa-desc">Faster access · Works offline · Push notifications</div>
        </div>
        <div class="uyeh-pwa-actions">
          <button id="uyeh-install-btn" class="uyeh-pwa-btn-install">Install</button>
          <button id="uyeh-install-dismiss" class="uyeh-pwa-btn-dismiss" aria-label="Dismiss">✕</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Slide in
    requestAnimationFrame(() => requestAnimationFrame(() => {
      banner.classList.add('uyeh-pwa-banner--visible');
    }));

    document.getElementById('uyeh-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      deferredPrompt = null;
      hideInstallBanner();
    });

    document.getElementById('uyeh-install-dismiss').addEventListener('click', () => {
      hideInstallBanner();
      // Snooze for 7 days
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION));
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('uyeh-install-banner');
    if (!banner) return;
    banner.classList.remove('uyeh-pwa-banner--visible');
    banner.classList.add('uyeh-pwa-banner--hiding');
    setTimeout(() => banner.remove(), 500);
  }

  // ═══════════════════════════════════════════════════════════
  // 6. iOS MANUAL INSTALL HINT
  // ═══════════════════════════════════════════════════════════
  function showIosHint() {
    if (document.getElementById('uyeh-ios-hint')) return;
    injectStyles();

    const hint = document.createElement('div');
    hint.id        = 'uyeh-ios-hint';
    hint.className = 'uyeh-ios-hint';
    hint.innerHTML = `
      <div class="uyeh-ios-hint-inner">
        <img class="uyeh-pwa-icon" src="/icons/icon-192.png" alt="UYEH TECH"
             onerror="this.style.display='none'">
        <div style="flex:1;">
          <div class="uyeh-pwa-title" style="margin-bottom:6px;">Install UYEH TECH on iPhone</div>
          <div class="uyeh-pwa-desc">
            Tap <strong style="color:#fff;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg> Share
            </strong> then
            <strong style="color:#fff;">"Add to Home Screen"</strong>
          </div>
        </div>
        <button onclick="this.closest('#uyeh-ios-hint').remove();localStorage.setItem('${DISMISS_STORAGE_KEY}', Date.now()+${DISMISS_DURATION})"
                class="uyeh-pwa-btn-dismiss" aria-label="Close">✕</button>
      </div>
      <div class="uyeh-ios-arrow"></div>
    `;

    document.body.appendChild(hint);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hint.classList.add('uyeh-ios-hint--visible');
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SW UPDATE BANNER
  // ═══════════════════════════════════════════════════════════
  function showUpdateBanner() {
    if (document.getElementById('uyeh-update-banner')) return;
    injectStyles();

    const banner = document.createElement('div');
    banner.id        = 'uyeh-update-banner';
    banner.className = 'uyeh-update-banner';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span style="font-size:1.2rem;flex-shrink:0;">🔄</span>
        <div>
          <div style="font-weight:700;font-size:.88rem;color:#fff;">New version available</div>
          <div style="font-size:.76rem;color:rgba(255,255,255,.6);">Update now for the latest features and fixes</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button id="uyeh-update-now" class="uyeh-pwa-btn-install" style="padding:8px 16px;font-size:.8rem;">
          Update Now
        </button>
        <button onclick="this.closest('#uyeh-update-banner').remove()"
                class="uyeh-pwa-btn-dismiss" aria-label="Dismiss later">Later</button>
      </div>
    `;

    document.body.appendChild(banner);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      banner.classList.add('uyeh-update-banner--visible');
    }));

    document.getElementById('uyeh-update-now').addEventListener('click', () => {
      // Tell the waiting SW to take over immediately
      if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
      } else if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 8. TOAST (lightweight notification)
  // ═══════════════════════════════════════════════════════════
  function showToast(msg, type, duration) {
    injectStyles();
    duration = duration || 4000;

    const toast = document.createElement('div');
    toast.className = `uyeh-pwa-toast uyeh-pwa-toast--${type || 'info'}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      toast.classList.add('uyeh-pwa-toast--visible');
    }));

    setTimeout(() => {
      toast.classList.remove('uyeh-pwa-toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // ═══════════════════════════════════════════════════════════
  // 9. HELPERS
  // ═══════════════════════════════════════════════════════════
  function isAlreadyInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function isDismissed() {
    try {
      const until = parseInt(localStorage.getItem(DISMISS_STORAGE_KEY) || '0', 10);
      return Date.now() < until;
    } catch { return false; }
  }

  // ── Inject all CSS once ────────────────────────────────────
  let _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected || document.getElementById('uyeh-pwa-styles')) return;
    _stylesInjected = true;

    const s = document.createElement('style');
    s.id = 'uyeh-pwa-styles';
    s.textContent = `
      /* ── Install banner ──────────────────────────── */
      .uyeh-pwa-banner {
        position: fixed; bottom: 20px; left: 50%; z-index: 99997;
        transform: translateX(-50%) translateY(120px);
        opacity: 0;
        background: linear-gradient(135deg, #0f1f14, #0a1a0f);
        border: 1px solid rgba(0,255,136,.35);
        border-radius: 18px; padding: 16px 20px;
        box-shadow: 0 8px 40px rgba(0,0,0,.65), 0 0 0 1px rgba(0,255,136,.1);
        font-family: 'Montserrat', sans-serif;
        max-width: min(480px, calc(100vw - 32px));
        width: 100%;
        transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .4s ease;
      }
      .uyeh-pwa-banner--visible  { transform: translateX(-50%) translateY(0); opacity: 1; }
      .uyeh-pwa-banner--hiding   { transform: translateX(-50%) translateY(120px); opacity: 0; }
      .uyeh-pwa-banner-inner {
        display: flex; align-items: center; gap: 14px;
      }

      /* ── iOS hint ────────────────────────────────── */
      .uyeh-ios-hint {
        position: fixed; bottom: 24px; left: 50%; z-index: 99997;
        transform: translateX(-50%) translateY(130px); opacity: 0;
        background: linear-gradient(135deg, #0f1f14, #0a1a0f);
        border: 1px solid rgba(0,255,136,.35);
        border-radius: 18px; padding: 18px 20px 24px;
        max-width: min(360px, calc(100vw - 32px)); width: 100%;
        box-shadow: 0 8px 40px rgba(0,0,0,.65);
        font-family: 'Montserrat', sans-serif;
        transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .4s ease;
      }
      .uyeh-ios-hint--visible { transform: translateX(-50%) translateY(0); opacity: 1; }
      .uyeh-ios-hint-inner    { display: flex; align-items: flex-start; gap: 12px; }
      .uyeh-ios-arrow {
        position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid rgba(0,255,136,.35);
      }

      /* ── Update banner ───────────────────────────── */
      .uyeh-update-banner {
        position: fixed; top: 16px; right: 16px; z-index: 99998;
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        background: #0f2318; border: 1px solid rgba(0,255,136,.4);
        border-radius: 14px; padding: 14px 18px;
        color: #fff; font-family: 'Montserrat', sans-serif;
        box-shadow: 0 6px 30px rgba(0,0,0,.5);
        max-width: calc(100vw - 32px);
        transform: translateY(-80px); opacity: 0;
        transition: transform .4s ease, opacity .4s ease;
      }
      .uyeh-update-banner--visible { transform: translateY(0); opacity: 1; }

      /* ── Toast ───────────────────────────────────── */
      .uyeh-pwa-toast {
        position: fixed; bottom: 90px; left: 50%; z-index: 99999;
        transform: translateX(-50%) translateY(20px); opacity: 0;
        padding: 12px 24px; border-radius: 50px;
        font-family: 'Montserrat', sans-serif; font-size: .85rem; font-weight: 600;
        color: #fff; white-space: nowrap;
        transition: transform .35s ease, opacity .35s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,.4);
        pointer-events: none;
      }
      .uyeh-pwa-toast--visible  { transform: translateX(-50%) translateY(0); opacity: 1; }
      .uyeh-pwa-toast--success  { background: #0a2e1a; border: 1px solid #00ff88; }
      .uyeh-pwa-toast--warning  { background: #2e1f07; border: 1px solid #ffa500; }
      .uyeh-pwa-toast--info     { background: #0d2d45; border: 1px solid #0096ff; }

      /* ── Shared elements ─────────────────────────── */
      .uyeh-pwa-icon {
        width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
        border: 1px solid rgba(0,255,136,.2);
      }
      .uyeh-pwa-info  { flex: 1; min-width: 0; }
      .uyeh-pwa-title { font-weight: 700; font-size: .9rem; color: #fff; margin-bottom: 2px; }
      .uyeh-pwa-desc  { font-size: .76rem; color: rgba(255,255,255,.65); line-height: 1.4; }
      .uyeh-pwa-actions { display: flex; gap: 8px; flex-shrink: 0; }

      .uyeh-pwa-btn-install {
        padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
        background: linear-gradient(135deg, #00b359, #00ff88);
        color: #fff; font-weight: 700;
        font-family: 'Montserrat', sans-serif; font-size: .83rem;
        white-space: nowrap; transition: transform .2s, box-shadow .2s;
      }
      .uyeh-pwa-btn-install:hover {
        transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,255,136,.35);
      }
      .uyeh-pwa-btn-dismiss {
        padding: 9px 12px; border-radius: 9px; cursor: pointer;
        border: 1px solid rgba(255,255,255,.2); background: transparent;
        color: rgba(255,255,255,.55); font-family: 'Montserrat', sans-serif;
        font-size: .85rem; transition: color .2s, border-color .2s;
      }
      .uyeh-pwa-btn-dismiss:hover { color: #fff; border-color: rgba(255,255,255,.4); }
    `;
    document.head.appendChild(s);
  }

  // ── Public API — pages can call window.uyehPwa.xxx ────────
  window.uyehPwa = {
    // Manually trigger install prompt (e.g. from a button in the UI)
    promptInstall: async function() {
      if (!deferredPrompt) {
        if (isIos()) { showIosHint(); return; }
        showToast('Install prompt not available — try from Chrome on Android', 'warning');
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { deferredPrompt = null; hideInstallBanner(); }
    },

    // Check if running as installed PWA
    isInstalled: isAlreadyInstalled,

    // Manually send a message to the SW
    sendToSW: function(msg) {
      if (registration?.active) registration.active.postMessage(msg);
    },

    // Clear the API cache (useful after a user logs out)
    clearApiCache: function() {
      if (registration?.active) {
        registration.active.postMessage({ type: 'CLEAR_API_CACHE' });
      }
    }
  };

})();
