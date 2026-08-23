/* =========================================================
   main.js
   ---------------------------------------------------------
   ・events.json を読み込み、カード一覧を描画
   ・config.js の SITE_CONFIG を参照して文言/挙動を制御
   ・キーワード検索 × カテゴリ絞り込み（お気に入り絞り込みを含む）
   ・イベントカードをクリックすると詳細モーダルを表示
     → events.json の "detail" 列はHTMLとしてそのまま描画します
       （意図的にエスケープしていません。detailには信頼できる
        HTMLのみを入力してください）
   ・イベントの追加・削除・入れ替えは events.json の編集のみでOK
   ========================================================= */

(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};
  const FAVORITES_KEY = "__FAVORITES__";
  const FAVORITES_STORAGE_KEY = "machiEventDrop.favorites";

  // ---- DOM参照 ----
  const els = {
    siteName: document.getElementById("siteName"),
    siteNameSub: document.getElementById("siteNameSub"),
    catchCopy: document.getElementById("catchCopy"),
    leadText: document.getElementById("leadText"),
    resultCount: document.getElementById("resultCount"),
    siteFooter: document.getElementById("siteFooter"),
    categoryFilter: document.getElementById("categoryFilter"),
    eventGrid: document.getElementById("eventGrid"),
    statusMessage: document.getElementById("statusMessage"),
    loadMoreWrap: document.getElementById("loadMoreWrap"),
    loadMoreBtn: document.getElementById("loadMoreBtn"),
    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    // モーダル関連
    modalOverlay: document.getElementById("modalOverlay"),
    modalClose: document.getElementById("modalClose"),
    modalThumb: document.getElementById("modalThumb"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalAddress: document.getElementById("modalAddress"),
    modalDetail: document.getElementById("modalDetail"),
    modalLink: document.getElementById("modalLink"),
  };

  let allEvents = [];
  let currentCategory = cfg.showAllCategoryLabel || "すべて";
  let keyword = "";
  let visibleCount = 0;
  let lastFocusedEl = null; // モーダルを閉じたときにフォーカスを戻す先
  let favorites = loadFavorites();

  // ---- 共通設定をテキストへ反映 ----
  function applyTextConfig() {
    if (cfg.siteName) els.siteName.textContent = cfg.siteName;
    if (cfg.siteNameSub) els.siteNameSub.textContent = cfg.siteNameSub;
    if (cfg.catchCopy) els.catchCopy.textContent = cfg.catchCopy;
    if (cfg.leadText) els.leadText.textContent = cfg.leadText;
    if (cfg.footerHtml && els.siteFooter) els.siteFooter.innerHTML = cfg.footerHtml;
    if (cfg.loadMoreLabel) els.loadMoreBtn.textContent = cfg.loadMoreLabel;
    if (cfg.modalCloseLabel) els.modalClose.setAttribute("aria-label", cfg.modalCloseLabel);
    if (cfg.searchPlaceholder) {
      els.searchInput.placeholder = cfg.searchPlaceholder;
      els.searchInput.setAttribute("aria-label", cfg.searchPlaceholder);
    }
    if (cfg.searchClearLabel) els.searchClear.setAttribute("aria-label", cfg.searchClearLabel);
    document.title = (cfg.siteName ? cfg.siteName + "｜" : "") + "イベント情報";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- お気に入り（localStorage） ----
  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }
  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch (e) { /* localStorageが使えない環境では何もしない */ }
  }
  function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveFavorites();
  }

  // ---- カテゴリごとの色を決定（config優先、無ければパレットから自動割当）----
  const autoColorCache = {};
  function getCategoryColor(category) {
    if (cfg.categoryColorMap && cfg.categoryColorMap[category]) {
      return cfg.categoryColorMap[category];
    }
    if (autoColorCache[category]) return autoColorCache[category];
    const palette = cfg.categoryColorPalette && cfg.categoryColorPalette.length
      ? cfg.categoryColorPalette
      : ["#5b7fd6", "#3f9d6b", "#d9822b"];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
    }
    const color = palette[hash % palette.length];
    autoColorCache[category] = color;
    return color;
  }

  // ---- データ取得 ----
  async function loadEvents() {
    const src = cfg.dataSource || "https://tojo-rmo.github.io/event/events.json";
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error("JSON形式が不正です（配列である必要があります）");
      allEvents = json;
      renderCategoryFilter();
      applyFilter(currentCategory, true);
    } catch (err) {
      console.error("イベントデータの読み込みに失敗しました:", err);
      showStatus(cfg.loadErrorText || "イベント情報の読み込みに失敗しました。");
    }
  }

  function showStatus(text) {
    els.statusMessage.hidden = false;
    els.statusMessage.textContent = text;
    els.eventGrid.innerHTML = "";
    els.loadMoreWrap.hidden = true;
  }
  function hideStatus() {
    els.statusMessage.hidden = true;
  }

  // ---- カテゴリフィルタ描画（件数バッジ付き） ----
  function renderCategoryFilter() {
    const categories = Array.from(new Set(allEvents.map((e) => e.category).filter(Boolean)));
    const allLabel = cfg.showAllCategoryLabel || "すべて";

    els.categoryFilter.innerHTML = "";

    // 「すべて」チップ
    els.categoryFilter.appendChild(buildChip(allLabel, allEvents.length, currentCategory === allLabel, () => applyFilter(allLabel)));

    // カテゴリ別チップ
    categories.forEach((cat) => {
      const count = allEvents.filter((e) => e.category === cat).length;
      els.categoryFilter.appendChild(buildChip(cat, count, currentCategory === cat, () => applyFilter(cat)));
    });

    // お気に入りチップ（末尾に配置）
    const favChip = document.createElement("button");
    favChip.type = "button";
    favChip.className = "chip chip-fav" + (currentCategory === FAVORITES_KEY ? " active" : "");
    favChip.innerHTML = heartIcon(currentCategory === FAVORITES_KEY) +
      '<span>' + escapeHtml(cfg.favoritesChipLabel || "お気に入り") + '</span>' +
      '<span class="count" data-fav-count>(' + favorites.size + ')</span>';
    favChip.addEventListener("click", () => applyFilter(FAVORITES_KEY));
    els.categoryFilter.appendChild(favChip);
  }

  function buildChip(label, count, isActive, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (isActive ? " active" : "");
    btn.dataset.label = label;
    btn.innerHTML = escapeHtml(label) + ' <span class="count">(' + count + ')</span>';
    btn.addEventListener("click", onClick);
    return btn;
  }

  function applyFilter(category, isInitial) {
    currentCategory = category;
    visibleCount = cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : Infinity;

    Array.from(els.categoryFilter.children).forEach((btn) => {
      const isFav = btn.classList.contains("chip-fav");
      const active = isFav ? category === FAVORITES_KEY : btn.dataset.label === category;
      btn.classList.toggle("active", active);
    });

    render();

    if (!isInitial) {
      window.scrollTo({ top: document.querySelector(".filter-band").offsetTop - 8, behavior: "smooth" });
    }
  }

  function getFilteredEvents() {
    const allLabel = cfg.showAllCategoryLabel || "すべて";
    let list = allEvents;

    if (currentCategory === FAVORITES_KEY) {
      list = list.filter((e) => favorites.has(e.id));
    } else if (currentCategory !== allLabel) {
      list = list.filter((e) => e.category === currentCategory);
    }

    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter((e) => {
        const hay = [e.title, e.address, e.category].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(kw);
      });
    }
    return list;
  }

  // ---- 検索結果件数の表示 ----
  function updateResultCount(total) {
    const kw = keyword.trim();
    const suffix = cfg.resultCountSuffix || "件のイベントが見つかりました";
    if (kw) {
      const label = cfg.resultCountSearchLabel || "の検索結果：";
      els.resultCount.innerHTML =
        '「' + escapeHtml(kw) + '」' + escapeHtml(label) + '<b>' + total + '</b>' + escapeHtml(suffix);
    } else {
      els.resultCount.innerHTML = '<b>' + total + '</b>' + escapeHtml(suffix);
    }
  }

  // ---- カード描画 ----
  function render() {
    const filtered = getFilteredEvents();
    updateResultCount(filtered.length);

    if (filtered.length === 0) {
      showStatus(cfg.emptyStateText || "条件に一致するイベントが見つかりませんでした。");
      return;
    }
    hideStatus();

    const shown = filtered.slice(0, visibleCount);
    els.eventGrid.innerHTML = "";
    shown.forEach((event) => els.eventGrid.appendChild(buildCard(event)));

    els.loadMoreWrap.hidden = !(filtered.length > shown.length);
  }

  // ---- サムネイル（カード用・モーダル用で共通利用） ----
  function buildThumb(event, wrapEl) {
    const categoryColor = getCategoryColor(event.category || "");
    function appendPlaceholder() {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb-placeholder";
      placeholder.textContent = event.category
        ? event.category
        : (cfg.thumbnailFallbackText || "NO IMAGE");
      wrapEl.appendChild(placeholder);
    }
    if (event.thumbnail) {
      const base = cfg.thumbnailBasePath || "";
      const img = document.createElement("img");
      img.src = base + event.thumbnail;
      img.alt = event.title || "";
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.remove();
        appendPlaceholder();
      }, { once: true });
      wrapEl.appendChild(img);
    } else {
      appendPlaceholder();
    }
    return categoryColor;
  }

  function buildTagBadge(event, categoryColor) {
    // カテゴリは文字色で分類（色ドットは使用しない）
    const badge = document.createElement("span");
    badge.className = "tag-badge";
    badge.style.color = categoryColor;
    const label = document.createElement("span");
    label.textContent = event.category;
    badge.appendChild(label);
    return badge;
  }

  function buildCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", (event.title || "") + " の詳細を見る");

    // --- サムネイル（画像のみ。バッジ等はオーバーレイしない） ---
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrap";
    const categoryColor = buildThumb(event, thumbWrap);

    // --- 本文 ---
    const body = document.createElement("div");
    body.className = "card-body";

    // カテゴリ（文字色で分類。色ドットは使用しない）
    if (event.category) {
      const cat = document.createElement("span");
      cat.className = "card-category";
      cat.style.color = categoryColor;
      cat.textContent = event.category;
      body.appendChild(cat);
    }

    // タイトル
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = event.title || "(タイトル未設定)";
    body.appendChild(title);

    // 下部メタ行：左＝エリア（住所）／右＝アクションアイコン列
    const meta = document.createElement("div");
    meta.className = "card-meta";

    const address = document.createElement("span");
    address.className = "card-address";
    if (event.address) {
      address.innerHTML =
        '<span class="pin" aria-hidden="true">' + pinIcon() + "</span>" +
        '<span class="addr-txt">' + escapeHtml(event.address) + "</span>";
    }
    meta.appendChild(address);

    const actions = document.createElement("span");
    actions.className = "card-actions";

    // 公式サイト（外部リンク）
    if (event.url) {
      const ext = document.createElement("a");
      ext.className = "icon-btn";
      ext.href = event.url;
      ext.target = "_blank";
      ext.rel = "noopener noreferrer";
      ext.setAttribute("aria-label", cfg.externalLinkLabel || "公式サイトを開く（新しいタブ）");
      ext.innerHTML = externalIcon("currentColor");
      ext.addEventListener("click", (e) => e.stopPropagation());
      actions.appendChild(ext);
    }

    // お気に入り
    const isFav = favorites.has(event.id);
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "icon-btn fav" + (isFav ? " active" : "");
    favBtn.setAttribute("aria-pressed", String(isFav));
    favBtn.setAttribute("aria-label", isFav
      ? (cfg.favoriteRemoveLabel || "お気に入りから削除")
      : (cfg.favoriteAddLabel || "お気に入りに追加"));
    favBtn.innerHTML = heartIcon(isFav);
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(event.id);
      const nowFav = favorites.has(event.id);
      favBtn.classList.toggle("active", nowFav);
      favBtn.setAttribute("aria-pressed", String(nowFav));
      favBtn.setAttribute("aria-label", nowFav
        ? (cfg.favoriteRemoveLabel || "お気に入りから削除")
        : (cfg.favoriteAddLabel || "お気に入りに追加"));
      favBtn.innerHTML = heartIcon(nowFav);
      // お気に入りチップの件数を更新（お気に入り絞り込み表示中なら再描画）
      renderCategoryFilter();
      if (currentCategory === FAVORITES_KEY) render();
    });
    actions.appendChild(favBtn);

    meta.appendChild(actions);
    body.appendChild(meta);

    card.appendChild(thumbWrap);
    card.appendChild(body);

    // --- カード全体のクリック/キーボード操作で詳細モーダルを開く ---
    card.addEventListener("click", () => openDetail(event, card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(event, card);
      }
    });

    return card;
  }

  // ---- 詳細モーダル ----
  function openDetail(event, triggerEl) {
    lastFocusedEl = triggerEl || document.activeElement;

    els.modalThumb.innerHTML = "";
    buildThumb(event, els.modalThumb);

    els.modalCategory.innerHTML = "";
    if (event.category) {
      els.modalCategory.hidden = false;
      els.modalCategory.appendChild(buildTagBadge(event, getCategoryColor(event.category)));
    } else {
      els.modalCategory.hidden = true;
    }

    els.modalTitle.textContent = event.title || "(タイトル未設定)";

    if (event.address) {
      els.modalAddress.hidden = false;
      els.modalAddress.innerHTML =
        '<span class="pin" aria-hidden="true">' + pinIcon() + "</span><span>" +
        escapeHtml(event.address) + "</span>";
    } else {
      els.modalAddress.hidden = true;
    }

    // 詳細本文：events.json の "detail" 列をHTMLとしてそのまま描画（意図的に非エスケープ）
    els.modalDetail.innerHTML = event.detail && String(event.detail).trim()
      ? event.detail
      : "<p>" + escapeHtml(cfg.detailFallbackText || "詳細情報は準備中です。") + "</p>";

    if (event.url) {
      els.modalLink.hidden = false;
      els.modalLink.href = event.url;
      els.modalLink.innerHTML = escapeHtml(cfg.officialSiteLabel || "公式サイトを見る") + externalIcon("#fff");
    } else {
      els.modalLink.hidden = true;
    }

    els.modalOverlay.hidden = false;
    requestAnimationFrame(() => els.modalOverlay.classList.add("open"));
    document.body.style.overflow = "hidden";
    els.modalClose.focus();
  }

  function closeDetail() {
    els.modalOverlay.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { els.modalOverlay.hidden = true; }, 300);
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
  }

  els.modalClose.addEventListener("click", closeDetail);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeDetail();
  });
  els.modalLink.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modalOverlay.hidden) closeDetail();
  });

  // ---- アイコン群 ----
  function pinIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px">' +
      '<path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8z" fill="currentColor"/>' +
      '<circle cx="12" cy="10" r="3" fill="#fff"/></svg>';
  }
  function externalIcon(strokeColor) {
    const c = strokeColor || "currentColor";
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M14 3h7v7" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M21 3l-9 9" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M19 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>";
  }
  function heartIcon(filled) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 20.5s-7.6-4.6-10-9.3C.5 7.8 2.4 4.5 6 4.5c2 0 3.6 1.1 4.5 2.4C11.4 5.6 13 4.5 15 4.5c3.6 0 5.5 3.3 4 6.7-2.4 4.7-10 9.3-10 9.3z" ' +
      (filled ? 'fill="currentColor"' : 'stroke="currentColor" stroke-width="1.8"') + '/></svg>';
  }

  // ---- もっと見る ----
  els.loadMoreBtn.addEventListener("click", () => {
    visibleCount += cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : 0;
    render();
  });

  // ---- 検索フォーム ----
  els.searchForm.addEventListener("submit", (e) => e.preventDefault());
  els.searchInput.addEventListener("input", () => {
    keyword = els.searchInput.value;
    els.searchClear.hidden = keyword.length === 0;
    visibleCount = cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : Infinity;
    render();
  });
  els.searchClear.addEventListener("click", () => {
    keyword = "";
    els.searchInput.value = "";
    els.searchClear.hidden = true;
    els.searchInput.focus();
    visibleCount = cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : Infinity;
    render();
  });

  // ---- ヘッダーのスクロール制御 ----
  const hdr = document.getElementById("hdr");
  if (hdr) {
    window.addEventListener("scroll", () => {
      hdr.classList.toggle("scrolled", window.scrollY > 20);
    });
  }

  // ---- reveal（スクロールでふわっと表示） ----
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // ---- 初期化 ----
  applyTextConfig();
  loadEvents();
})();
