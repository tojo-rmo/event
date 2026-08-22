/* =========================================================
   main.js
   ---------------------------------------------------------
   ・data/events.json を読み込み、カード一覧を描画
   ・config.js の SITE_CONFIG を参照して文言/挙動を制御
   ・イベントカードをクリックすると詳細モーダルを表示
     → events.json の "detail" 列はHTMLとしてそのまま描画します
       （意図的にエスケープしていません。detailには信頼できる
        HTMLのみを入力してください）
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
    // モーダル関連
    modalOverlay: document.getElementById("modalOverlay"),
    modalBox: document.getElementById("modalBox"),
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
  let visibleCount = 0;
  let lastFocusedEl = null; // モーダルを閉じたときにフォーカスを戻す先

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
    if (cfg.modalCloseLabel) els.modalClose.setAttribute("aria-label", cfg.modalCloseLabel);
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

    if (filtered.length > shown.length) {
      els.loadMoreWrap.hidden = false;
    } else {
      els.loadMoreWrap.hidden = true;
    }
  }

  // ---- サムネイル（カード用・モーダル用で共通利用） ----
  function buildThumb(event, wrapEl) {
    const categoryColor = getCategoryColor(event.category || "");

    function appendPlaceholder() {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb-placeholder";
      placeholder.style.color = categoryColor;
      placeholder.style.borderColor = categoryColor;
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

  function buildCard(event) {
    const card = document.createElement("article");
    card.className = "event-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", (event.title || "") + " の詳細を見る");

    // --- サムネイル ---
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrap";
    const categoryColor = buildThumb(event, thumbWrap);

    if (event.category) {
      const badge = document.createElement("span");
      badge.className = "category-badge";
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

    // 「くわしく見る」ヒント（カード全体がクリック可能であることの案内）
    const hint = document.createElement("span");
    hint.className = "card-hint";
    hint.innerHTML = escapeHtml(cfg.detailHintLabel || "くわしく見る") + arrowIcon();
    body.appendChild(hint);

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

    // サムネイル
    els.modalThumb.innerHTML = "";
    buildThumb(event, els.modalThumb);

    // カテゴリ
    const categoryColor = getCategoryColor(event.category || "");
    if (event.category) {
      els.modalCategory.hidden = false;
      els.modalCategory.style.color = categoryColor;
      els.modalCategory.textContent = event.category;
    } else {
      els.modalCategory.hidden = true;
    }

    // タイトル
    els.modalTitle.textContent = event.title || "(タイトル未設定)";

    // 住所
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

    // 公式サイトリンク
    if (event.url) {
      els.modalLink.hidden = false;
      els.modalLink.href = event.url;
      els.modalLink.innerHTML = escapeHtml(cfg.officialSiteLabel || "公式サイトを見る") + externalIcon();
    } else {
      els.modalLink.hidden = true;
    }

    els.modalOverlay.hidden = false;
    // hidden解除の直後にクラスを付けるとtransitionが効くようrAFを挟む
    requestAnimationFrame(() => {
      els.modalOverlay.classList.add("open");
    });
    document.body.style.overflow = "hidden";
    els.modalClose.focus();
  }

  function closeDetail() {
    els.modalOverlay.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => {
      els.modalOverlay.hidden = true;
    }, 300);
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  els.modalClose.addEventListener("click", closeDetail);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeDetail();
  });
  els.modalLink.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modalOverlay.hidden) closeDetail();
  });

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
  function arrowIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ---- もっと見る ----
  els.loadMoreBtn.addEventListener("click", () => {
    visibleCount += cfg.itemsPerLoad && cfg.itemsPerLoad > 0 ? cfg.itemsPerLoad : 0;
    render();
  });

  // ---- ヘッダーのスクロール制御 ----
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
