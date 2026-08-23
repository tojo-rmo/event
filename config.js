/* =========================================================
   config.js
   ---------------------------------------------------------
   サイト全体の共通設定ファイル。
   ・イベント情報そのものは events.json のみを編集すればOK
   ・サイト名/文言/色/挙動などの「共通設定」はすべてこのファイルに集約
   ・HTML/CSS/JSのロジック側は基本的に触らずに済むようにしています
   ========================================================= */

const SITE_CONFIG = {
  // ---- サイト基本情報 -------------------------------------------------
  siteName: "とうじょう縁側",             // ヘッダーのロゴ／ページタイトルに表示
  siteNameSub: "EVENTS in our Town",     // ロゴ下のサブタイトル
  catchCopy: "地域のイベントを探す",       // 一覧セクションの見出し（h1）
  // ---- フッター -----------------------------------------------------------
  // フッターの中身（<footer id="siteFooter"> の内側）をHTMLとして描画します。
  // リンクや文言の変更は、このHTMLを編集するだけでOKです。
  footerHtml: `
    <div class="wrap">
      <div class="foot-top">
        <div class="foot-brand">
          <div class="logo">とうじょうRMO<small>兵庫県加東市 東条地域</small></div>
          <p>岡本・森・南山の3地区が協力し、農地を守り、地域資源を活かし、暮らしを支える農村型地域運営組織です。</p>
        </div>
        <div class="foot-nav">
          <a href="https://sites.google.com/view/okamotoeinou/" target="_blank" rel="noopener">とうじょうＲＭＯ</a>
          <a href="https://sites.google.com/view/okamotoeinou/" target="_blank" rel="noopener">㈱岡本営農互助会</a>
          <a href="https://www.welovetojo.com/" target="_blank" rel="noopener">We Love シン東条</a>
          <a href="https://www.city.kato.lg.jp/" target="_blank" rel="noopener">加東市役所</a>
        </div>
      </div>
      <div class="foot-bot"><p>© 2026 とうじょうRMO ｜ 兵庫県加東市東条地域</p></div>
    </div>
  `,

  // ---- データソース -----------------------------------------------------
  // ここだけ差し替えれば掲載イベントが切り替わる「CMS代わりのJSON」
  // 絶対URL（サイトURL基準）で指定。どの階層から読んでも同じJSONを参照します。
  dataSource: "events.json",

  // ---- 画像関連 ---------------------------------------------------------
  // サムネイル画像フォルダを絶対URL（サイトURL基準）で指定。
  // JSONのthumbnailはファイル名のみでOK（例: "sample-art.jpg"）。
  thumbnailBasePath: "images/thumbnails/",
  thumbnailFallbackText: "NO IMAGE",       // 画像読み込み失敗時に表示するラベル

  // ---- カテゴリ表示色 -----------------------------------------------------
  // カード上のカテゴリ名や、モーダルのカテゴリバッジの「文字色」に使用します。
  // （色ドットでの分類は廃止し、文字色でカテゴリを区別します）
  // 彩度を抑えたアースカラーで統一（既知のカテゴリ名にはここで色を固定可・省略可）
  categoryColorMap: {
    "農業": "#2f7a43",
    "体験": "#4a6d8c",
    "グルメ": "#b3923f",
    "カルチャー": "#8a5a44",
    "マルシェ・マーケット": "#7d6b4f",
    "アクティビティ・健康": "#4f7d78"
  },
  // 上記に無いカテゴリが来た場合、この配列から自動で色を割り当てる（循環）
  categoryColorPalette: [
    "#2f7a43", "#b3923f", "#5b7a8c", "#8a5a44",
    "#4f7d78", "#7d6b4f", "#9c6b8a", "#6b7d4f",
  ],

  // ---- 検索・絞り込み -----------------------------------------------------
  showAllCategoryLabel: "すべて",             // フィルタの「すべて表示」ボタンの文言
  searchPlaceholder: "キーワード・エリアで検索", // 検索ボックスのプレースホルダー
  searchClearLabel: "検索キーワードをクリア",
  favoritesChipLabel: "お気に入り",           // お気に入り絞り込みチップの文言
  favoriteAddLabel: "お気に入りに追加",
  favoriteRemoveLabel: "お気に入りから削除",
  resultCountSuffix: "件のイベントが見つかりました",
  resultCountSearchLabel: "の検索結果：",     // 「〇〇の検索結果：△件」の連結文言

  // ---- 一覧表示の挙動 -----------------------------------------------------
  officialSiteLabel: "公式サイトを見る", // モーダル内リンクボタンの文言
  externalLinkLabel: "公式サイトを開く（新しいタブ）", // カード上の外部リンクアイコンのaria-label
  itemsPerLoad: 12,                    // 「もっと見る」1回あたりの表示件数（0以下で無効化）
  loadMoreLabel: "もっと見る",
  emptyStateText: "条件に一致するイベントが見つかりませんでした。",
  loadErrorText: "イベント情報の読み込みに失敗しました。時間をおいて再度お試しください。",

  // ---- 詳細モーダル関連 ---------------------------------------------------
  detailFallbackText: "詳細情報は準備中です。", // detailが未設定の場合に表示する文言
  modalCloseLabel: "閉じる",             // モーダル閉じるボタンのaria-label
};

// main.js は window.SITE_CONFIG を参照します。
// 通常の<script>では const 宣言は window に載らないため、明示的に公開します。
// （この1行が無いと設定が反映されず、画像パス等がすべて既定値になります）
window.SITE_CONFIG = SITE_CONFIG;
