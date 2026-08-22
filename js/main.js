/* =========================================================
   main.js
   ---------------------------------------------------------
   ・data/events.json を読み込み、カード一覧を描画
   ・config.js の SITE_CONFIG を参照して文言/挙動を制御
   ・イベントの追加・削除・入れ替えは events.json の編集のみでOK
   ========================================================= */

(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};

  // ---- DOM参照 ----
  const els = {
    siteName: document.getElementById("siteName"),
    siteNameSub: document.getElementById("siteNameSub"),
    catchCopy: document.getElementById("catchCopy"),
    leadText: document.getElementById("leadText"),
    footerText: document.getElementById("footerText"),
    footLogo: document.getElementById("footLogo"),
    footerLead: document.getElementById("footerLead"),
    categoryFilter: document.getElementById("categoryFilter"),
    eventGrid: document.getElementById("eventGrid"),
    statusMessage: document.getElementById("statusMessage"),
    loadMoreWrap: document.getElementById("loadMoreWrap"),
    loadMoreBtn: document.getElementById("loadMoreBtn"),
  };

  let allEvents = [];
  let currentCategory = cfg.showAllCategoryLabel || "すべて";
  let visibleCount = 0;

  // ---- 共通設定をテキストへ反映 ----
  function applyTextConfig() {
    if (cfg.siteName) els.siteName.textContent = cfg.siteName;
    if (cfg.siteNameSub) els.siteNameSub.textContent = cfg.siteNameSub;
    if (cfg.catchCopy) els.catchCopy.textContent = cfg.catchCopy;
    if (cfg.leadText) {
      els.leadText.innerHTML = escapeHtml(cfg.leadText).replace(/\n/g, "<br>");
    }
    if (cfg.footerText) els.footerText.textContent = cfg.footerText;
    if (cfg.siteName && els.footLogo) els.footLogo.textContent = cfg.siteName;
    if (cfg.footerLead && els.footerLead) els.footerLead.textContent = cfg.footerLead;
    if (cfg.loadMoreLabel) els.loadMoreBtn.textContent = cfg.loadMoreLabel;
    document.title = (cfg.siteName ? cfg.siteName + "｜" : "") + "イベント情報";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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
    const src = cfg.dataSource || "data/events.json";
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

  // ---- カテゴリフィルタ描画 ----
  function renderCategoryFilter() {
    const categories = Array.from(new Set(allEvents.map((e) => e.category).filter(Boolean)));
    const allLabel = cfg.showAllCategoryLabel || "すべて";
    const labels = [allLabel, ...categories];

    els.categoryFilter.innerHTML = "";
    labels.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (label === currentCategory ? " active" : "");
      btn.textContent = label;
      btn.addEventListener("click", () => applyFilter(label));
      els.categoryFilter.appendChild(btn);
    });
  }

  function applyFilter(category, isInitial) {
    currentCategory = category;
    visibleCount = cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : Infinity;

    // ボタンのactive状態更新
    Array.from(els.categoryFilter.children).forEach((btn) => {
      btn.classList.toggle("active", btn.textContent === category);
    });

    render();
    if (!isInitial) {
      window.scrollTo({ top: els.categoryFilter.offsetTop - 70, behavior: "smooth" });
    }
  }

  function getFilteredEvents() {
    const allLabel = cfg.showAllCategoryLabel || "すべて";
    if (currentCategory === allLabel) return allEvents;
    return allEvents.filter((e) => e.category === currentCategory);
  }

  // ---- カード描画 ----
  function render() {
    const filtered = getFilteredEvents();

    if (filtered.length === 0) {
      showStatus(cfg.emptyStateText || "現在、掲載中のイベントはありません。");
      return;
    }
    hideStatus();

    const shown = filtered.slice(0, visibleCount);
    els.eventGrid.innerHTML = "";
    shown.forEach((event) => els.eventGrid.appendChild(buildCard(event)));

    // もっと見るボタンの表示制御
    if (filtered.length > shown.length) {
      els.loadMoreWrap.hidden = false;
    } else {
      els.loadMoreWrap.hidden = true;
    }
  }

  function buildCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";

    // --- サムネイル ---
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrap";

    const categoryColor = getCategoryColor(event.category || "");

    function appendPlaceholder() {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb-placeholder";
      // 参照サイトのトーンに合わせ、背景は淡いグレー固定・文字色のみカテゴリカラーで区別
      placeholder.style.color = categoryColor;
      placeholder.style.borderColor = categoryColor;
      placeholder.textContent = event.category
        ? event.category
        : (cfg.thumbnailFallbackText || "NO IMAGE");
      thumbWrap.appendChild(placeholder);
    }

    if (event.thumbnail) {
      const base = cfg.thumbnailBasePath || "";
      const img = document.createElement("img");
      img.src = base + event.thumbnail;
      img.alt = event.title || "";
      img.loading = "lazy";
      // サムネイル画像が存在しない/読み込み失敗した場合は自動でプレースホルダー表示
      img.addEventListener("error", () => {
        img.remove();
        appendPlaceholder();
      }, { once: true });
      thumbWrap.appendChild(img);
    } else {
      // thumbnail未指定の場合は最初からプレースホルダーを表示
      appendPlaceholder();
    }

    if (event.category) {
      const badge = document.createElement("span");
      badge.className = "category-badge";
      // 白背景＋カテゴリカラーの文字/枠線という、参照サイトの丸ピルタグに準拠したスタイル
      badge.style.color = categoryColor;
      badge.textContent = event.category;
      thumbWrap.appendChild(badge);
    }

    // --- 本文 ---
    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = event.title || "(タイトル未設定)";
    body.appendChild(title);

    if (event.address) {
      const address = document.createElement("p");
      address.className = "card-address";
      address.innerHTML =
        '<span class="pin" aria-hidden="true">' + pinIcon() + "</span><span>" +
        escapeHtml(event.address) + "</span>";
      body.appendChild(address);
    }

    if (event.url) {
      const link = document.createElement("a");
      link.className = "card-link";
      link.href = event.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = escapeHtml(cfg.officialSiteLabel || "公式サイトを見る") + externalIcon();
      body.appendChild(link);
    }

    card.appendChild(thumbWrap);
    card.appendChild(body);
    return card;
  }

  function pinIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px">' +
      '<path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8z" fill="#2f7a43"/>' +
      '<circle cx="12" cy="10" r="3" fill="#fff"/></svg>';
  }
  function externalIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M14 3h7v7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M21 3l-9 9" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M19 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>";
  }

  // ---- もっと見る ----
  els.loadMoreBtn.addEventListener("click", () => {
    visibleCount += cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : 0;
    render();
  });

  // ---- ヘッダーのスクロール制御（参照サイトと同じ挙動） ----
  const hdr = document.getElementById("hdr");
  if (hdr) {
    window.addEventListener("scroll", () => {
      hdr.classList.toggle("scrolled", window.scrollY > 30);
    });
  }

  // ---- ハンバーガーメニュー（スマホ表示） ----
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navlinks");
  function toggleMenu(open) {
    if (!navLinks || !burger) return;
    const o = open !== undefined ? open : !navLinks.classList.contains("open");
    navLinks.classList.toggle("open", o);
    burger.classList.toggle("open", o);
    document.body.style.overflow = o ? "hidden" : "";
  }
  if (burger && navLinks) {
    burger.addEventListener("click", () => toggleMenu());
    navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
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
