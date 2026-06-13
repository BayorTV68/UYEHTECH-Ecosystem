// ================================================================
//  UYEH TECH — search.js  (API-powered, no local data)
//
//  Endpoints used:
//    GET /api/search/suggest?q=   → live autocomplete dropdown
//    GET /api/search?q=&scope=&page=&limit=   → full results modal
//
//  Elements expected in your HTML:
//    #searchInput   .search-bar
//    #searchBtn     .search-btn
//    #searchClose   .search-close
//    .search-container  (wraps all three above)
// ================================================================

(function () {
    'use strict';

    // ── DOM ──────────────────────────────────────────────────────
    const searchInput = document.getElementById('searchInput');
    const searchBtn   = document.getElementById('searchBtn');
    const searchClose = document.getElementById('searchClose');
    const searchWrap  = document.querySelector('.search-container');

    if (!searchInput || !searchBtn || !searchWrap) return;

    // ── STATE ────────────────────────────────────────────────────
    let debounceTimer   = null;
    let currentQuery    = '';
    let currentScope    = 'all';
    let currentPage     = 1;
    let isFetching      = false;
    let hasMore         = false;

    // ─────────────────────────────────────────────────────────────
    //  INJECT STYLES
    // ─────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        /* ── Suggest dropdown ───────────────────────────────────── */
        #uyehSuggest {
            position: absolute;
            top: calc(100% + 8px);
            left: 0; right: 0;
            background: #0a0a0a;
            border: 1px solid rgba(0,255,136,0.35);
            border-radius: 14px;
            overflow: hidden;
            z-index: 9999;
            box-shadow: 0 10px 40px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,255,136,0.08);
            display: none;
            animation: suggestFadeIn 0.18s ease;
        }
        @keyframes suggestFadeIn {
            from { opacity:0; transform:translateY(-6px); }
            to   { opacity:1; transform:translateY(0); }
        }
        #uyehSuggest.open { display: block; }

        .sug-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px 16px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            transition: background 0.15s;
        }
        .sug-item:last-child { border-bottom: none; }
        .sug-item:hover, .sug-item.focused {
            background: rgba(0,255,136,0.08);
        }
        .sug-icon { font-size: 1.1em; flex-shrink:0; }
        .sug-label {
            flex: 1;
            color: #e2e2e2;
            font-size: 0.88em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: 'Montserrat', sans-serif;
        }
        .sug-sub {
            color: rgba(255,255,255,0.35);
            font-size: 0.75em;
            flex-shrink: 0;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .sug-badge {
            font-size: 0.65em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 8px;
            border-radius: 20px;
            flex-shrink: 0;
        }
        .sug-footer {
            padding: 9px 16px;
            font-size: 0.78em;
            color: rgba(255,255,255,0.3);
            text-align: center;
            border-top: 1px solid rgba(255,255,255,0.06);
            cursor: pointer;
            transition: color 0.2s;
        }
        .sug-footer:hover { color: #00ff88; }

        /* ── Full results modal ─────────────────────────────────── */
        #uyehSearchModal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.28s ease;
        }
        #uyehSearchModal.open {
            opacity: 1;
            pointer-events: all;
        }
        #uyehBackdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.90);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        #uyehSearchBox {
            position: relative;
            width: 92%;
            max-width: 800px;
            max-height: 88vh;
            margin: 4vh auto;
            background: #080808;
            border: 1.5px solid #00ff88;
            border-radius: 22px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow:
                0 0 0 4px rgba(0,255,136,0.06),
                0 25px 70px rgba(0,0,0,0.85);
            transform: translateY(18px) scale(0.98);
            transition: transform 0.28s ease, opacity 0.28s ease;
        }
        #uyehSearchModal.open #uyehSearchBox {
            transform: translateY(0) scale(1);
        }

        /* header */
        #uyehModalHead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 22px;
            background: linear-gradient(135deg,rgba(0,255,136,0.1),rgba(0,255,136,0.03));
            border-bottom: 1px solid rgba(0,255,136,0.2);
            flex-shrink: 0;
        }
        #uyehModalHead .head-left {
            display: flex; align-items: center; gap: 10px;
        }
        #uyehModalHead h2 {
            margin: 0;
            color: #00ff88;
            font-size: 1.05em;
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
        }
        .uyeh-count {
            background: rgba(0,255,136,0.15);
            color: #00ff88;
            border-radius: 20px;
            padding: 2px 10px;
            font-size: 0.75em;
            font-weight: 700;
        }
        #uyehModalClose {
            background: rgba(255,60,60,0.1);
            border: 1px solid rgba(255,60,60,0.35);
            color: #ff4444;
            width: 36px; height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.05em;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.22s;
            flex-shrink: 0;
        }
        #uyehModalClose:hover {
            background: rgba(255,60,60,0.25);
            transform: rotate(90deg) scale(1.1);
        }

        /* scope tabs */
        #uyehTabs {
            display: flex;
            gap: 6px;
            padding: 12px 20px 0;
            overflow-x: auto;
            flex-shrink: 0;
            scrollbar-width: none;
        }
        #uyehTabs::-webkit-scrollbar { display: none; }
        .uyeh-tab {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.45);
            padding: 5px 16px;
            border-radius: 20px;
            font-size: 0.78em;
            cursor: pointer;
            white-space: nowrap;
            font-family: 'Montserrat', sans-serif;
            font-weight: 600;
            transition: all 0.2s;
            display: flex; align-items: center; gap: 5px;
        }
        .uyeh-tab:hover { border-color: #00ff88; color: #00ff88; }
        .uyeh-tab.active {
            background: rgba(0,255,136,0.12);
            border-color: #00ff88;
            color: #00ff88;
        }
        .uyeh-tab .tc {
            background: rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 1px 6px;
            font-size: 0.85em;
        }
        .uyeh-tab.active .tc { background: rgba(0,255,136,0.2); }

        /* results list */
        #uyehResults {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px 22px;
        }
        #uyehResults::-webkit-scrollbar { width: 4px; }
        #uyehResults::-webkit-scrollbar-thumb {
            background: rgba(0,255,136,0.25);
            border-radius: 10px;
        }

        /* result card */
        .uyeh-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 15px;
            background: rgba(255,255,255,0.025);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px;
            margin-bottom: 10px;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            transition: all 0.22s;
        }
        .uyeh-card:last-child { margin-bottom: 0; }
        .uyeh-card:hover {
            background: rgba(0,255,136,0.055);
            border-color: rgba(0,255,136,0.3);
            transform: translateX(4px);
        }
        .uyeh-card-thumb {
            width: 52px; height: 52px;
            border-radius: 10px;
            object-fit: cover;
            flex-shrink: 0;
            background: rgba(255,255,255,0.05);
        }
        .uyeh-card-thumb-ph {
            width: 52px; height: 52px;
            border-radius: 10px;
            flex-shrink: 0;
            background: rgba(0,255,136,0.07);
            border: 1px solid rgba(0,255,136,0.15);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5em;
        }
        .uyeh-card-body { flex: 1; min-width: 0; }
        .uyeh-card-title {
            color: #ebebeb;
            font-size: 0.94em;
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .uyeh-card-desc {
            color: rgba(255,255,255,0.38);
            font-size: 0.81em;
            line-height: 1.45;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 7px;
        }
        .uyeh-card-meta {
            display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
        }
        .uyeh-type-badge {
            font-size: 0.68em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 2px 8px;
            border-radius: 12px;
        }
        .uyeh-price {
            color: #00ff88;
            font-size: 0.82em;
            font-weight: 800;
        }
        .uyeh-rating {
            color: #ffd700;
            font-size: 0.78em;
        }
        .uyeh-card-arrow {
            font-size: 1.05em;
            color: rgba(0,255,136,0.5);
            flex-shrink: 0;
            transition: color 0.2s;
        }
        .uyeh-card:hover .uyeh-card-arrow { color: #00ff88; }

        /* highlight */
        .uyeh-hl {
            background: rgba(0,255,136,0.22);
            color: #00ff88;
            border-radius: 3px;
            padding: 0 2px;
        }

        /* states */
        .uyeh-loading, .uyeh-empty, .uyeh-error {
            text-align: center;
            padding: 52px 20px;
        }
        .uyeh-loading-icon {
            font-size: 2.2em;
            display: block;
            margin-bottom: 14px;
            animation: uyehSpin 1s linear infinite;
        }
        @keyframes uyehSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        .uyeh-loading p { color: #00ff88; font-size: 0.9em; }
        .uyeh-empty-icon { font-size: 3em; margin-bottom: 12px; display: block; }
        .uyeh-empty h3 { color: #00ff88; margin: 0 0 8px; }
        .uyeh-empty p  { color: rgba(255,255,255,0.38); font-size: 0.88em; }
        .uyeh-error p  { color: #ff5555; font-size: 0.9em; }
        .uyeh-retry-btn {
            margin-top: 14px;
            background: rgba(0,255,136,0.1);
            border: 1px solid rgba(0,255,136,0.3);
            color: #00ff88;
            padding: 8px 22px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.85em;
            transition: background 0.2s;
        }
        .uyeh-retry-btn:hover { background: rgba(0,255,136,0.2); }

        /* load more */
        #uyehLoadMore {
            display: block;
            margin: 16px auto 0;
            background: rgba(0,255,136,0.08);
            border: 1px solid rgba(0,255,136,0.28);
            color: #00ff88;
            padding: 9px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.86em;
            font-family: 'Montserrat', sans-serif;
            font-weight: 600;
            transition: background 0.2s;
        }
        #uyehLoadMore:hover { background: rgba(0,255,136,0.18); }
        #uyehLoadMore:disabled { opacity: 0.4; cursor: not-allowed; }

        /* mobile */
        @media (max-width: 600px) {
            #uyehSearchBox {
                width: 97%; margin: 2vh auto; max-height: 93vh;
                border-radius: 16px;
            }
            #uyehModalHead { padding: 13px 15px; }
            #uyehResults   { padding: 12px 13px 16px; }
            .uyeh-card     { flex-wrap: wrap; gap: 10px; }
            #uyehTabs      { padding: 10px 13px 0; }
        }
    `;
    document.head.appendChild(style);

    // ─────────────────────────────────────────────────────────────
    //  SUGGEST DROPDOWN
    // ─────────────────────────────────────────────────────────────
    searchWrap.style.position = 'relative';

    const suggestBox = document.createElement('div');
    suggestBox.id = 'uyehSuggest';
    searchWrap.appendChild(suggestBox);

    let focusIdx = -1;
    let suggestItems = [];

    async function fetchSuggestions(q) {
        try {
            const res  = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (!data.success || !data.suggestions?.length) { closeSuggest(); return; }
            renderSuggest(data.suggestions, q);
        } catch {
            closeSuggest();
        }
    }

    function renderSuggest(items, q) {
        suggestItems = items;
        focusIdx = -1;

        const typeIcon = { product:'🛍️', creator_product:'🛍️', blog:'📝', creator:'🏪' };
        const typeColor = {
            product: { bg:'rgba(0,255,136,0.12)', color:'#00ff88' },
            blog:    { bg:'rgba(136,100,255,0.15)', color:'#bb86fc' },
            creator: { bg:'rgba(255,165,0,0.13)', color:'#ffaa00' },
        };

        suggestBox.innerHTML =
            items.map((s, i) => {
                const c = typeColor[s.type] || { bg:'rgba(255,255,255,0.08)', color:'#aaa' };
                return `
                <div class="sug-item" data-idx="${i}">
                    <span class="sug-icon">${typeIcon[s.type] || '🔍'}</span>
                    <span class="sug-label">${highlight(s.label, q)}</span>
                    <span class="sug-sub">${s.sublabel || ''}</span>
                    <span class="sug-badge" style="background:${c.bg};color:${c.color}">${s.type.replace('_',' ')}</span>
                </div>`;
            }).join('')
            + `<div class="sug-footer">Press Enter or click 🔍 to see all results for "<strong>${q}</strong>"</div>`;

        suggestBox.querySelectorAll('.sug-item').forEach(el => {
            el.addEventListener('click', () => {
                window.location.href = items[+el.dataset.idx].url;
            });
            el.addEventListener('mouseenter', () => {
                focusIdx = +el.dataset.idx;
                updateFocus();
            });
        });

        suggestBox.querySelector('.sug-footer')?.addEventListener('click', () => {
            triggerFullSearch(q, 'all', 1);
        });

        suggestBox.classList.add('open');
    }

    function updateFocus() {
        suggestBox.querySelectorAll('.sug-item').forEach((el, i) => {
            el.classList.toggle('focused', i === focusIdx);
        });
    }

    function closeSuggest() {
        suggestBox.classList.remove('open');
        suggestBox.innerHTML = '';
        focusIdx = -1;
        suggestItems = [];
    }

    // ─────────────────────────────────────────────────────────────
    //  BUILD MODAL (once)
    // ─────────────────────────────────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'uyehSearchModal';
    modal.innerHTML = `
        <div id="uyehBackdrop"></div>
        <div id="uyehSearchBox">
            <div id="uyehModalHead">
                <div class="head-left">
                    <h2 id="uyehModalTitle">🔍 Search</h2>
                    <span class="uyeh-count" id="uyehCount" style="display:none"></span>
                </div>
                <button id="uyehModalClose">✕</button>
            </div>
            <div id="uyehTabs">
                <button class="uyeh-tab active" data-scope="all">All <span class="tc" id="tc-all">—</span></button>
                <button class="uyeh-tab" data-scope="products">Products <span class="tc" id="tc-products">—</span></button>
                <button class="uyeh-tab" data-scope="blog">Blog <span class="tc" id="tc-blog">—</span></button>
                <button class="uyeh-tab" data-scope="creators">Creators <span class="tc" id="tc-creators">—</span></button>
            </div>
            <div id="uyehResults"></div>
            <button id="uyehLoadMore" style="display:none">Load more results ↓</button>
        </div>
    `;
    document.body.appendChild(modal);

    const modalTitle  = document.getElementById('uyehModalTitle');
    const countBadge  = document.getElementById('uyehCount');
    const resultsDiv  = document.getElementById('uyehResults');
    const loadMoreBtn = document.getElementById('uyehLoadMore');
    const tabs        = modal.querySelectorAll('.uyeh-tab');

    // ─────────────────────────────────────────────────────────────
    //  FULL SEARCH
    // ─────────────────────────────────────────────────────────────
    async function triggerFullSearch(q, scope, page) {
        if (isFetching || q.length < 2) return;

        currentQuery = q;
        currentScope = scope;
        currentPage  = page;
        isFetching   = true;

        closeSuggest();
        openModal();

        modalTitle.textContent = `🔍 "${q}"`;
        countBadge.style.display = 'none';
        loadMoreBtn.style.display = 'none';

        if (page === 1) {
            resultsDiv.innerHTML = `
                <div class="uyeh-loading">
                    <span class="uyeh-loading-icon">⟳</span>
                    <p>Searching for "<strong>${q}</strong>"…</p>
                </div>`;
            // Reset tab counts
            ['all','products','blog','creators'].forEach(s => {
                const el = document.getElementById(`tc-${s}`);
                if (el) el.textContent = '…';
            });
        } else {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading…';
        }

        // activate correct tab
        tabs.forEach(t => t.classList.toggle('active', t.dataset.scope === scope));

        try {
            const token = getToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const url = `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&page=${page}&limit=10`;
            const res  = await fetch(url, { headers });
            const data = await res.json();

            if (!data.success) {
                resultsDiv.innerHTML = `
                    <div class="uyeh-error">
                        <p>⚠ ${data.message || 'Search failed. Please try again.'}</p>
                        <button class="uyeh-retry-btn" onclick="document.getElementById('searchInput').focus()">Try again</button>
                    </div>`;
                isFetching = false; return;
            }

            // Update tab counts (only on page 1, scope=all for accurate full count)
            if (page === 1 && scope === 'all') {
                const r = data.results || {};
                document.getElementById('tc-all').textContent       = data.total || 0;
                document.getElementById('tc-products').textContent  = (r.products?.length  || 0);
                document.getElementById('tc-blog').textContent      = (r.blog?.length      || 0);
                document.getElementById('tc-creators').textContent  = (r.creators?.length  || 0);
            }

            // Pick the right array based on scope
            const items = scope === 'all'
                ? (data.all || [])
                : (data.results?.[scope] || []);

            hasMore = data.pagination?.hasMore || false;

            if (page === 1) {
                countBadge.textContent     = `${data.total || items.length} result${data.total !== 1 ? 's' : ''}`;
                countBadge.style.display   = 'inline';

                if (!items.length) {
                    resultsDiv.innerHTML = renderEmpty(q);
                } else {
                    resultsDiv.innerHTML = items.map(item => renderCard(item, q)).join('');
                }
            } else {
                // Append for load-more
                const frag = document.createElement('div');
                frag.innerHTML = items.map(item => renderCard(item, q)).join('');
                resultsDiv.appendChild(frag);
            }

            // Load more
            if (hasMore) {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.disabled      = false;
                loadMoreBtn.textContent   = 'Load more results ↓';
            } else {
                loadMoreBtn.style.display = 'none';
            }

        } catch (err) {
            console.error('[search.js]', err);
            resultsDiv.innerHTML = `
                <div class="uyeh-error">
                    <p>⚠ Something went wrong. Check your connection and try again.</p>
                    <button class="uyeh-retry-btn" onclick="window._uyehRetry()">Retry</button>
                </div>`;
            window._uyehRetry = () => triggerFullSearch(currentQuery, currentScope, 1);
        }

        isFetching = false;
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDER CARD
    // ─────────────────────────────────────────────────────────────
    function renderCard(item, q) {
        const typeColor = {
            product:        { bg:'rgba(0,255,136,0.1)',   color:'#00ff88' },
            creator_product:{ bg:'rgba(0,255,136,0.1)',   color:'#00ff88' },
            blog:           { bg:'rgba(136,100,255,0.14)',color:'#bb86fc' },
            creator:        { bg:'rgba(255,165,0,0.12)',  color:'#ffaa00' },
            user:           { bg:'rgba(0,191,255,0.1)',   color:'#00bfff' },
        };
        const typeIcon = {
            product:'🛍️', creator_product:'🛍️',
            blog:'📝', creator:'🏪', user:'👤'
        };
        const c = typeColor[item.type] || { bg:'rgba(255,255,255,0.07)', color:'#aaa' };

        const thumb = item.image
            ? `<img class="uyeh-card-thumb" src="${item.image}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="uyeh-card-thumb-ph">${typeIcon[item.type] || '📌'}</div>`;

        const desc = item.description || item.excerpt || '';
        const price = (item.price != null && item.price > 0)
            ? `<span class="uyeh-price">$${Number(item.price).toFixed(2)}</span>` : '';
        const rating = item.meta?.rating
            ? `<span class="uyeh-rating">★ ${Number(item.meta.rating).toFixed(1)}</span>` : '';

        return `
            <a class="uyeh-card"
               href="${item.url || '#'}"
               ${item.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                ${thumb}
                <div class="uyeh-card-body">
                    <div class="uyeh-card-title">${highlight(item.title || 'Untitled', q)}</div>
                    ${desc ? `<div class="uyeh-card-desc">${highlight(desc, q)}</div>` : ''}
                    <div class="uyeh-card-meta">
                        <span class="uyeh-type-badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.color}44">
                            ${item.type.replace('_',' ')}
                        </span>
                        ${price}
                        ${rating}
                    </div>
                </div>
                <span class="uyeh-card-arrow">→</span>
            </a>`;
    }

    function renderEmpty(q) {
        return `
            <div class="uyeh-empty">
                <span class="uyeh-empty-icon">🔍</span>
                <h3>No results for "${q}"</h3>
                <p>Try different keywords, or check for typos.</p>
            </div>`;
    }

    // ─────────────────────────────────────────────────────────────
    //  MODAL OPEN / CLOSE
    // ─────────────────────────────────────────────────────────────
    function openModal() {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        currentPage = 1;
        loadMoreBtn.style.display = 'none';
    }

    document.getElementById('uyehModalClose').addEventListener('click', closeModal);
    document.getElementById('uyehBackdrop').addEventListener('click', closeModal);

    // ─────────────────────────────────────────────────────────────
    //  SCOPE TABS
    // ─────────────────────────────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active') || isFetching) return;
            triggerFullSearch(currentQuery, tab.dataset.scope, 1);
        });
    });

    // ─────────────────────────────────────────────────────────────
    //  LOAD MORE
    // ─────────────────────────────────────────────────────────────
    loadMoreBtn.addEventListener('click', () => {
        triggerFullSearch(currentQuery, currentScope, currentPage + 1);
        currentPage++;
    });

    // ─────────────────────────────────────────────────────────────
    //  SEARCH BAR INPUT EVENTS
    // ─────────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 2) { closeSuggest(); return; }
        debounceTimer = setTimeout(() => fetchSuggestions(q), 260);
    });

    searchInput.addEventListener('keydown', (e) => {
        // Navigate suggestions with arrow keys
        if (suggestBox.classList.contains('open')) {
            const items = suggestBox.querySelectorAll('.sug-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusIdx = Math.min(focusIdx + 1, items.length - 1);
                updateFocus();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusIdx = Math.max(focusIdx - 1, -1);
                updateFocus();
                return;
            }
            if (e.key === 'Enter' && focusIdx >= 0 && suggestItems[focusIdx]) {
                e.preventDefault();
                window.location.href = suggestItems[focusIdx].url;
                return;
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const q = searchInput.value.trim();
            if (q.length >= 2) {
                triggerFullSearch(q, 'all', 1);
                collapseBar();
            }
        }

        if (e.key === 'Escape') {
            closeSuggest();
            collapseBar();
        }
    });

    // ─────────────────────────────────────────────────────────────
    //  SEARCH BAR TOGGLE
    // ─────────────────────────────────────────────────────────────
    function expandBar() {
        searchInput.classList.add('active');
        if (searchClose) searchClose.classList.add('active');
        setTimeout(() => searchInput.focus(), 80);
    }
    function collapseBar() {
        searchInput.classList.remove('active');
        if (searchClose) searchClose.classList.remove('active');
        searchInput.value = '';
        closeSuggest();
    }

    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const q = searchInput.value.trim();
        if (searchInput.classList.contains('active') && q.length >= 2) {
            triggerFullSearch(q, 'all', 1);
            collapseBar();
        } else {
            expandBar();
        }
    });

    if (searchClose) {
        searchClose.addEventListener('click', (e) => {
            e.stopPropagation();
            collapseBar();
        });
    }

    // Click outside search bar → close suggest + collapse
    document.addEventListener('click', (e) => {
        if (!searchWrap.contains(e.target)) {
            closeSuggest();
            if (searchInput.classList.contains('active') && !searchInput.value.trim()) {
                collapseBar();
            }
        }
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // Global Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal.classList.contains('open')) closeModal();
        }
    });

    // ─────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────
    function highlight(text, q) {
        if (!text || !q) return text;
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${safe})`, 'gi'),
            '<mark class="uyeh-hl">$1</mark>');
    }

    // Reads JWT token from whatever key your app uses in localStorage
    function getToken() {
        return localStorage.getItem('token')
            || localStorage.getItem('authToken')
            || localStorage.getItem('jwt')
            || '';
    }

})();
