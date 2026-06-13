/**
 * search.js — Connects the navbar search bar to the backend search API.
 *
 * Hooks into: #searchInput, #searchBtn, #searchClose (already in index.html)
 *
 * Features:
 *  - Autocomplete dropdown via GET /api/search/suggest
 *  - Full results overlay via GET /api/search
 *  - Scope tabs: All | Products | Blog | Creators
 *  - Debounced input (300ms) to avoid hammering the server
 *  - Keyboard navigation (↑ ↓ Enter Esc)
 *  - Click outside to close
 */

(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────────────────── */
  const API_BASE      = '';          // leave empty — same origin as your HTML
  const DEBOUNCE_MS   = 300;
  const MIN_CHARS     = 2;

  /* ─── DOM REFS ────────────────────────────────────────────────────────── */
  const searchInput   = document.getElementById('searchInput');
  const searchBtn     = document.getElementById('searchBtn');
  const searchClose   = document.getElementById('searchClose');
  const searchContainer = searchInput?.closest('.search-container');

  if (!searchInput || !searchBtn) return; // bail if HTML not found

  /* ─── CREATE INJECT STYLES ────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Suggest Dropdown ── */
    #searchSuggest {
      position: absolute;
      top: calc(100% + 8px);
      left: 0; right: 0;
      background: #0d0d0d;
      border: 1px solid rgba(0,255,136,0.25);
      border-radius: 12px;
      overflow: hidden;
      z-index: 9999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      display: none;
    }
    #searchSuggest.visible { display: block; }
    .suggest-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .suggest-item:hover,
    .suggest-item.focused {
      background: rgba(0,255,136,0.08);
    }
    .suggest-badge {
      font-size: 0.68em;
      padding: 2px 7px;
      border-radius: 20px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .badge-product  { background: rgba(0,255,136,0.15); color: #00ff88; }
    .badge-blog     { background: rgba(100,120,255,0.18); color: #8899ff; }
    .badge-creator  { background: rgba(255,180,0,0.15); color: #ffb400; }
    .suggest-label  { flex: 1; color: #e0e0e0; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .suggest-sub    { color: rgba(255,255,255,0.35); font-size: 0.78em; flex-shrink: 0; }

    /* ── Full Results Overlay ── */
    #searchOverlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 10000;
      display: none;
      overflow-y: auto;
      padding: 80px 16px 40px;
    }
    #searchOverlay.visible { display: block; }
    #searchOverlayInner {
      max-width: 820px;
      margin: 0 auto;
    }
    .search-overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .search-overlay-title {
      color: #00ff88;
      font-size: 1.1em;
      font-family: 'Montserrat', sans-serif;
    }
    #overlayClose {
      background: rgba(255,68,68,0.12);
      border: 1px solid rgba(255,68,68,0.3);
      color: #ff4444;
      border-radius: 8px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 1em;
      transition: background 0.2s;
    }
    #overlayClose:hover { background: rgba(255,68,68,0.25); }

    /* Scope Tabs */
    .scope-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .scope-tab {
      padding: 6px 18px;
      border-radius: 20px;
      border: 1px solid rgba(0,255,136,0.25);
      background: transparent;
      color: rgba(255,255,255,0.55);
      font-size: 0.85em;
      cursor: pointer;
      font-family: 'Montserrat', sans-serif;
      transition: all 0.2s;
    }
    .scope-tab:hover { border-color: #00ff88; color: #00ff88; }
    .scope-tab.active {
      background: rgba(0,255,136,0.12);
      border-color: #00ff88;
      color: #00ff88;
    }

    /* Result Cards */
    .result-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 12px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, background 0.2s;
      cursor: pointer;
    }
    .result-card:hover {
      border-color: rgba(0,255,136,0.3);
      background: rgba(0,255,136,0.05);
    }
    .result-thumb {
      width: 54px;
      height: 54px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      background: rgba(255,255,255,0.06);
    }
    .result-thumb-placeholder {
      width: 54px;
      height: 54px;
      border-radius: 8px;
      flex-shrink: 0;
      background: rgba(0,255,136,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4em;
    }
    .result-body { flex: 1; min-width: 0; }
    .result-title {
      color: #e8e8e8;
      font-size: 0.95em;
      font-weight: 600;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: 'Montserrat', sans-serif;
    }
    .result-desc {
      color: rgba(255,255,255,0.45);
      font-size: 0.82em;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .result-meta {
      margin-top: 6px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .result-type-badge { }  /* reuse .suggest-badge classes */
    .result-price {
      color: #00ff88;
      font-size: 0.82em;
      font-weight: 700;
    }

    /* States */
    .search-loading,
    .search-empty,
    .search-error {
      text-align: center;
      padding: 48px 0;
      color: rgba(255,255,255,0.35);
      font-size: 0.95em;
    }
    .search-loading { color: #00ff88; }
    .search-error   { color: #ff4444; }

    /* Load more */
    #loadMoreBtn {
      display: block;
      margin: 20px auto 0;
      padding: 10px 32px;
      background: rgba(0,255,136,0.1);
      border: 1px solid rgba(0,255,136,0.3);
      border-radius: 25px;
      color: #00ff88;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.2s;
    }
    #loadMoreBtn:hover { background: rgba(0,255,136,0.2); }
    #loadMoreBtn:disabled { opacity: 0.4; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  /* ─── MAKE SEARCH CONTAINER RELATIVE (for dropdown positioning) ─────── */
  if (searchContainer) {
    searchContainer.style.position = 'relative';
  }

  /* ─── BUILD SUGGEST DROPDOWN ──────────────────────────────────────────── */
  const suggestBox = document.createElement('div');
  suggestBox.id = 'searchSuggest';
  searchContainer?.appendChild(suggestBox);

  /* ─── BUILD FULL RESULTS OVERLAY ─────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'searchOverlay';
  overlay.innerHTML = `
    <div id="searchOverlayInner">
      <div class="search-overlay-header">
        <span class="search-overlay-title" id="overlayTitle">Search results</span>
        <button id="overlayClose">✕ Close</button>
      </div>
      <div class="scope-tabs">
        <button class="scope-tab active" data-scope="all">All</button>
        <button class="scope-tab" data-scope="products">Products</button>
        <button class="scope-tab" data-scope="blog">Blog</button>
        <button class="scope-tab" data-scope="creators">Creators</button>
      </div>
      <div id="searchResults"></div>
      <button id="loadMoreBtn" style="display:none">Load more</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const overlayClose  = document.getElementById('overlayClose');
  const resultsDiv    = document.getElementById('searchResults');
  const overlayTitle  = document.getElementById('overlayTitle');
  const loadMoreBtn   = document.getElementById('loadMoreBtn');
  const scopeTabs     = overlay.querySelectorAll('.scope-tab');

  /* ─── STATE ───────────────────────────────────────────────────────────── */
  let debounceTimer   = null;
  let currentQuery    = '';
  let currentScope    = 'all';
  let currentPage     = 1;
  let hasMore         = false;
  let focusedSuggest  = -1;
  let suggestItems    = [];

  /* ─── TOGGLE SEARCH BAR (open/close animation) ─────────────────────── */
  function openSearchBar() {
    searchInput.classList.add('active');
    if (searchClose) searchClose.classList.add('active');
    searchInput.focus();
  }

  function closeSearchBar() {
    searchInput.classList.remove('active');
    if (searchClose) searchClose.classList.remove('active');
    searchInput.value = '';
    hideSuggest();
  }

  searchBtn.addEventListener('click', () => {
    if (searchInput.classList.contains('active')) {
      // If there's a query, do a full search; otherwise just close
      if (searchInput.value.trim().length >= MIN_CHARS) {
        doFullSearch(searchInput.value.trim(), 'all', 1);
      } else {
        closeSearchBar();
      }
    } else {
      openSearchBar();
    }
  });

  if (searchClose) {
    searchClose.addEventListener('click', closeSearchBar);
  }

  /* ─── DEBOUNCED INPUT → SUGGESTIONS ─────────────────────────────────── */
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < MIN_CHARS) { hideSuggest(); return; }
    debounceTimer = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS);
  });

  /* ─── KEYBOARD NAVIGATION IN SUGGEST ────────────────────────────────── */
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideSuggest(); closeSearchBar(); return; }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggest >= 0 && suggestItems[focusedSuggest]) {
        window.location.href = suggestItems[focusedSuggest].url;
      } else if (searchInput.value.trim().length >= MIN_CHARS) {
        doFullSearch(searchInput.value.trim(), currentScope, 1);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedSuggest = Math.min(focusedSuggest + 1, suggestItems.length - 1);
      highlightSuggest();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedSuggest = Math.max(focusedSuggest - 1, -1);
      highlightSuggest();
    }
  });

  /* ─── FETCH SUGGESTIONS ───────────────────────────────────────────────── */
  async function fetchSuggestions(q) {
    try {
      const res  = await fetch(`${API_BASE}/api/search/suggest?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.success || !data.suggestions?.length) { hideSuggest(); return; }

      suggestItems   = data.suggestions;
      focusedSuggest = -1;
      renderSuggest(data.suggestions, q);
    } catch {
      hideSuggest();
    }
  }

  function renderSuggest(suggestions, q) {
    suggestBox.innerHTML = suggestions.map((s, i) => `
      <div class="suggest-item" data-index="${i}" data-url="${s.url}">
        <span class="suggest-badge badge-${s.type}">${s.type}</span>
        <span class="suggest-label">${highlight(s.label, q)}</span>
        <span class="suggest-sub">${s.sublabel || ''}</span>
      </div>
    `).join('');

    suggestBox.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = el.dataset.url;
      });
    });

    suggestBox.classList.add('visible');
  }

  function highlightSuggest() {
    suggestBox.querySelectorAll('.suggest-item').forEach((el, i) => {
      el.classList.toggle('focused', i === focusedSuggest);
    });
  }

  function hideSuggest() {
    suggestBox.classList.remove('visible');
    suggestBox.innerHTML = '';
    focusedSuggest = -1;
    suggestItems   = [];
  }

  /* ─── FULL SEARCH ─────────────────────────────────────────────────────── */
  async function doFullSearch(q, scope, page) {
    if (q.length < MIN_CHARS) return;

    currentQuery = q;
    currentScope = scope;
    currentPage  = page;

    hideSuggest();
    openOverlay();
    overlayTitle.textContent = `Results for "${q}"`;

    if (page === 1) {
      resultsDiv.innerHTML = `<div class="search-loading">Searching…</div>`;
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading…';
    }

    try {
      const url = `${API_BASE}/api/search?q=${encodeURIComponent(q)}&scope=${scope}&page=${page}&limit=10`;
      const res  = await fetch(url, {
        headers: getAuthHeader()
      });
      const data = await res.json();

      if (!data.success) {
        resultsDiv.innerHTML = `<div class="search-error">⚠ ${data.message || 'Search failed'}</div>`;
        return;
      }

      // Choose which results array to render based on scope
      let items;
      if (scope === 'all') {
        items = data.all || [];
      } else if (scope === 'products') {
        items = data.results?.products || [];
      } else if (scope === 'blog') {
        items = data.results?.blog || [];
      } else if (scope === 'creators') {
        items = data.results?.creators || [];
      } else {
        items = data.all || [];
      }

      hasMore = data.pagination?.hasMore || false;

      if (page === 1) {
        if (!items.length) {
          resultsDiv.innerHTML = `<div class="search-empty">No results found for <strong>"${q}"</strong></div>`;
        } else {
          resultsDiv.innerHTML = items.map(renderCard).join('');
        }
      } else {
        // Append for "load more"
        const frag = document.createElement('div');
        frag.innerHTML = items.map(renderCard).join('');
        resultsDiv.appendChild(frag);
      }

      // Attach card click handlers
      resultsDiv.querySelectorAll('.result-card').forEach(card => {
        card.addEventListener('click', () => {
          window.location.href = card.dataset.url;
        });
      });

      // Load more button
      loadMoreBtn.style.display = hasMore ? 'block' : 'none';
      loadMoreBtn.disabled      = false;
      loadMoreBtn.textContent   = 'Load more';

    } catch (err) {
      resultsDiv.innerHTML = `<div class="search-error">⚠ Network error. Please try again.</div>`;
      console.error('[search.js] Full search error:', err);
    }
  }

  /* ─── RENDER A RESULT CARD ────────────────────────────────────────────── */
  function renderCard(item) {
    const thumb = item.image
      ? `<img class="result-thumb" src="${item.image}" alt="" loading="lazy">`
      : `<div class="result-thumb-placeholder">${typeIcon(item.type)}</div>`;

    const price = item.price != null
      ? `<span class="result-price">$${Number(item.price).toFixed(2)}</span>`
      : '';

    const desc = item.description || item.excerpt || '';

    return `
      <div class="result-card" data-url="${item.url || '#'}">
        ${thumb}
        <div class="result-body">
          <div class="result-title">${item.title || 'Untitled'}</div>
          ${desc ? `<div class="result-desc">${desc}</div>` : ''}
          <div class="result-meta">
            <span class="suggest-badge badge-${item.type}">${item.type.replace('_', ' ')}</span>
            ${price}
          </div>
        </div>
      </div>
    `;
  }

  function typeIcon(type) {
    const icons = { product: '🛍️', creator_product: '🛍️', blog: '📝', creator: '🏪', user: '👤' };
    return icons[type] || '🔍';
  }

  /* ─── SCOPE TABS ──────────────────────────────────────────────────────── */
  scopeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      scopeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      doFullSearch(currentQuery, tab.dataset.scope, 1);
    });
  });

  /* ─── LOAD MORE ───────────────────────────────────────────────────────── */
  loadMoreBtn.addEventListener('click', () => {
    doFullSearch(currentQuery, currentScope, currentPage + 1);
    currentPage++;
  });

  /* ─── OVERLAY OPEN / CLOSE ────────────────────────────────────────────── */
  function openOverlay() {
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    // Activate correct scope tab
    scopeTabs.forEach(t => t.classList.toggle('active', t.dataset.scope === currentScope));
  }

  function closeOverlay() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  overlayClose.addEventListener('click', closeOverlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay(); // click backdrop
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (overlay.classList.contains('visible')) closeOverlay();
    }
  });

  /* ─── CLICK OUTSIDE SUGGEST ───────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    if (!searchContainer?.contains(e.target)) hideSuggest();
  });

  /* ─── HELPER: highlight matching text ─────────────────────────────────── */
  function highlight(text, q) {
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
      '<mark style="background:rgba(0,255,136,0.25);color:#00ff88;border-radius:3px">$1</mark>');
  }

  /* ─── HELPER: read JWT from localStorage if your app stores it ─────────── */
  function getAuthHeader() {
    // Adjust the key to wherever your app stores the token
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

})();
