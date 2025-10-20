// 简易路由与页面调度
const $page = () => document.getElementById("page");
const $nav = () => document.getElementById("nav");
const $notify = () => document.getElementById("global-notify");
const byId = (id) => document.getElementById(id);
const escapeHtml = (s)=> String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

// ★★★ 关键：让 API 使用“每标签页独立会话”并迁移旧 token
API.initSession();

const OrientationHelper = {
  _initialized: false,
  _autoTried: false,
  _dismissed: false,
  _fallbackActive: false,
  button: null,
  hint: null,
  wrapper: null,
  init() {
    if (this._initialized) return;
    if (!document || !document.body) {
      document.addEventListener("DOMContentLoaded", () => this.init(), { once: true });
      return;
    }
    this._initialized = true;
    this.ensureWrapper();
    this.createUI();
    this.update();
    window.addEventListener("resize", () => this.update());
    window.addEventListener("orientationchange", () => this.update());
    document.addEventListener("fullscreenchange", () => this.update());
  },
  isMobile() {
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) return true;
    if (window.matchMedia) {
      const mq = window.matchMedia("(max-width: 900px)");
      if (mq && typeof mq.matches === "boolean" && mq.matches) return true;
    }
    return false;
  },
  isPortrait() {
    if (window.matchMedia) {
      const mq = window.matchMedia("(orientation: portrait)");
      if (mq && typeof mq.matches === "boolean") return mq.matches;
    }
    return window.innerHeight >= window.innerWidth;
  },
  supportsLock() {
    return !!(window.screen && window.screen.orientation && typeof window.screen.orientation.lock === "function");
  },
  ensureWrapper() {
    if (this.wrapper || !document || !document.body) return;
    const wrapper = document.createElement("div");
    wrapper.className = "orientation-content";
    const nodes = Array.from(document.body.childNodes);
    nodes.forEach((node) => {
      if (node !== wrapper) {
        wrapper.appendChild(node);
      }
    });
    document.body.appendChild(wrapper);
    this.wrapper = wrapper;
  },
  createUI() {
    if (this.button || !document.body) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "orientation-toggle";
    btn.innerHTML = `<span class="orientation-toggle__icon">📱</span><span class="orientation-toggle__label">横屏模式</span>`;
    btn.addEventListener("click", async () => {
      if (this._fallbackActive) {
        this.setFallback(false);
        this.update();
        return;
      }
      this._dismissed = false;
      await this.lockLandscape(true);
    });
    document.body.appendChild(btn);
    this.button = btn;

    const hint = document.createElement("div");
    hint.className = "orientation-hint";
    hint.innerHTML = `
      <div class="orientation-hint__card">
        <div class="orientation-hint__title">推荐横屏游玩</div>
        <p class="orientation-hint__text">为了在手机上获得更好的操作体验，我们建议使用横屏。可以点击“一键横屏”尝试自动切换，或手动旋转设备。</p>
        <div class="orientation-hint__actions">
          <button type="button" class="btn primary orientation-hint__apply">一键横屏</button>
          <button type="button" class="btn ghost orientation-hint__dismiss">我知道了</button>
        </div>
      </div>
    `;
    const applyBtn = hint.querySelector(".orientation-hint__apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", async () => {
        if (this._fallbackActive) {
          this.setFallback(false);
          this.update();
          return;
        }
        this._dismissed = false;
        await this.lockLandscape(true);
      });
    }
    const dismissBtn = hint.querySelector(".orientation-hint__dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        this._dismissed = true;
        this.hideHint();
      });
    }
    document.body.appendChild(hint);
    this.hint = hint;
    this.updateButtonState();
  },
  showHint() {
    if (!this.hint || this._dismissed) return;
    this.hint.classList.add("show");
  },
  hideHint() {
    if (!this.hint) return;
    this.hint.classList.remove("show");
  },
  setFallback(active) {
    if (this._fallbackActive === active) return;
    this.ensureWrapper();
    this._fallbackActive = !!active;
    if (this._fallbackActive) {
      this.hideHint();
    }
    this.updateButtonState();
    this.applyDocumentState(this.isMobile(), this.isPortrait());
  },
  updateButtonState() {
    if (!this.button) return;
    const active = this._fallbackActive;
    this.button.classList.toggle("is-active", active);
    this.button.setAttribute("aria-pressed", active ? "true" : "false");
    const label = this.button.querySelector(".orientation-toggle__label");
    if (label) {
      label.textContent = active ? "退出横屏" : "横屏模式";
    }
  },
  applyDocumentState(mobile, portrait) {
    const docEl = document.documentElement;
    if (!docEl) return;
    const landscapeLike = mobile && (!portrait || this._fallbackActive);
    docEl.classList.toggle("orientation-mobile", !!mobile);
    docEl.classList.toggle("orientation-portrait", !!mobile && !!portrait);
    docEl.classList.toggle("orientation-fallback-active", this._fallbackActive);
    docEl.classList.toggle("mobile-landscape", !!landscapeLike);
    if (this.wrapper) {
      this.wrapper.classList.toggle("orientation-content--fallback", this._fallbackActive);
      if (this._fallbackActive) {
        const vw = Math.max(window.innerWidth || 0, 1);
        const vh = Math.max(window.innerHeight || 0, 1);
        const scale = Math.min(1, vw / vh);
        this.wrapper.style.setProperty("--orientation-fallback-scale", scale.toFixed(4));
      } else {
        this.wrapper.style.removeProperty("--orientation-fallback-scale");
      }
    }
  },
  async lockLandscape(fromUser = false) {
    if (!this.isMobile() || !this.supportsLock()) {
      this.showHint();
      if (fromUser) {
        this.setFallback(true);
      }
      return false;
    }
    try {
      const orientation = window.screen.orientation;
      if (fromUser && !document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (_) {
          /* 忽略全屏失败，继续尝试锁定 */
        }
      }
      const targets = fromUser ? ["landscape-primary", "landscape-secondary", "landscape"] : ["landscape"];
      let locked = false;
      let lastError = null;
      for (const type of targets) {
        try {
          await orientation.lock(type);
          locked = true;
          break;
        } catch (lockErr) {
          lastError = lockErr;
        }
      }
      if (!locked) {
        throw lastError || new Error("orientation lock failed");
      }
      this.hideHint();
      this._autoTried = true;
      this.setFallback(false);
      return true;
    } catch (err) {
      console.warn("orientation lock failed", err);
      this.showHint();
      if (fromUser) {
        this.setFallback(true);
      }
      return false;
    }
  },
  update() {
    const mobile = this.isMobile();
    if (this.button) {
      if (mobile) {
        this.button.classList.add("show");
      } else {
        this.button.classList.remove("show");
      }
    }
    if (!mobile) {
      this.hideHint();
      this.setFallback(false);
      this.applyDocumentState(false, false);
      return;
    }
    const portrait = this.isPortrait();
    if (!portrait && this._fallbackActive) {
      this.setFallback(false);
    }
    this.applyDocumentState(mobile, portrait);
    if (portrait) {
      if (this._fallbackActive) {
        this.hideHint();
      } else {
        this.showHint();
        if (!this._autoTried) {
          this._autoTried = true;
          this.lockLandscape(false);
        }
      }
    } else {
      this.hideHint();
    }
  }
};

OrientationHelper.init();
window.OrientationHelper = OrientationHelper;

const PresenceTracker = {
  _route: "home",
  _activity: null,
  _details: {},
  _timer: null,
  _lastSent: 0,
  init() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = setInterval(() => this.ping(false), 20000);
    window.addEventListener("focus", () => this.ping(true));
    window.addEventListener("beforeunload", () => {
      try { this.ping(true); } catch (_) { /* 忽略 */ }
    });
  },
  setPage(route, pageObj) {
    this._route = route || "home";
    let info = null;
    try {
      if (pageObj && typeof pageObj.presence === "function") {
        info = pageObj.presence();
      }
    } catch (_) {
      info = null;
    }
    this.updateDetails(info || {});
  },
  updateDetails(info) {
    if (!info || typeof info !== "object") info = {};
    const activity = typeof info.activity === "string" ? info.activity.trim() : "";
    this._activity = activity || null;
    this._details = info.details && typeof info.details === "object" ? info.details : {};
    this.ping(true);
  },
  compose() {
    if (!API.token) {
      this._lastSent = 0;
      return null;
    }
    const page = this._route || "home";
    const activity = this._activity || `page:${page}`;
    return { page, activity, details: this._details || {} };
  },
  async ping(force = false) {
    if (!API.token) {
      this._lastSent = 0;
      return;
    }
    const now = Date.now();
    const minGap = force ? 0 : 15000;
    if (!force && now - this._lastSent < minGap) {
      return;
    }
    const payload = this.compose();
    if (!payload) return;
    this._lastSent = now;
    try {
      const resp = await API.updatePresence(payload);
      if (resp && resp.announcement) {
        try { window.AnnouncementCenter?.show?.(resp.announcement); } catch (_) { /* ignore */ }
      }
    } catch (_) {
      /* 忽略错误，保持静默 */
    }
  },
};

PresenceTracker.init();
window.PresenceTracker = PresenceTracker;

const Notifier = {
  pushDiamond(payload = {}) {
    const wrap = $notify();
    if (!wrap) return;
    const username = escapeHtml(payload.username || "玩家");
    const item = payload.item || {};
    const name = escapeHtml(item.name || "未知皮肤");
    const rarity = escapeHtml(item.rarity || "");
    const node = document.createElement("div");
    node.className = "notify-card diamond";
    node.innerHTML = `
      <div class="notify-title">🎉 ${username}</div>
      <div class="notify-body">抽出了钻石模板 <span>${name}</span>${rarity ? ` · ${rarity}` : ""}</div>
    `;
    wrap.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 320);
    }, 10000);
  }
};

window.Notifier = Notifier;

const AnnouncementCenter = {
  _displayed: new Set(),
  show(payload = {}) {
    if (!payload) return;
    const message = (payload.message || "").trim();
    if (!message) return;
    const id = payload.id || `announcement-${Date.now()}`;
    if (this._displayed.has(id)) return;
    const expiresAt = Number(payload.expires_at || 0);
    if (expiresAt && expiresAt * 1000 < Date.now()) return;
    const wrap = $notify();
    if (!wrap) return;
    this._displayed.add(id);
    const node = document.createElement("div");
    node.className = "notify-card notice";
    node.innerHTML = `
      <button type="button" class="notify-close" aria-label="关闭公告">×</button>
      <div class="notify-title">📢 全服公告</div>
      <div class="notify-body">${escapeHtml(message)}</div>
    `;
    wrap.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    const seconds = Math.max(5, Math.min(Number(payload.duration || 60), 60));
    let dismissed = false;
    const hide = () => {
      if (dismissed) return;
      dismissed = true;
      node.classList.remove("show");
      setTimeout(() => node.remove(), 320);
    };
    const timer = setTimeout(hide, seconds * 1000);
    const closeBtn = node.querySelector(".notify-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        clearTimeout(timer);
        hide();
      });
    }
  }
};

window.AnnouncementCenter = AnnouncementCenter;

let maintenanceNotifiedKey = null;
window.addEventListener('app-maintenance', (event) => {
  const info = (event && event.detail) || {};
  const message = info.message || "网站进入维护模式，请稍后再试。";
  const updated = info.updated_at ? Number(info.updated_at) : Date.now();
  const key = info.updated_at ? `maintenance-${info.updated_at}` : `maintenance-${message}`;
  if (maintenanceNotifiedKey === key) return;
  maintenanceNotifiedKey = key;
  AnnouncementCenter.show({ id: `maintenance-${updated}`, message, duration: 60 });
  try { alert(message); } catch (_) { /* ignore */ }
  location.hash = "#/auth";
});

const Pages = {
  home: { render: () => `<div class="card"><h2>欢迎</h2><p>这是三角洲砖皮模拟器的网站版。</p></div>`, bind: ()=>{} },
  auth: AuthPage,
  me: {
    async render() {
      const [d, mailboxRaw, seasonCatalog] = await Promise.all([
        API.me(),
        API.mailbox().catch(() => ({ brick: { buy: [], sell: [] }, skin: { buy: [], sell: [] } })),
        API.seasonCatalog().catch(() => ({ seasons: [] })),
      ]);
      const seasonMap = {};
      if (seasonCatalog?.seasons) {
        seasonCatalog.seasons.forEach(season => {
          if (!season?.id) return;
          seasonMap[season.id] = season.name;
          seasonMap[String(season.id).toUpperCase()] = season.name;
        });
      }
      const mail = mailboxRaw || { brick: { buy: [], sell: [] }, skin: { buy: [], sell: [] } };
      const formatTs = (ts) => {
        if (!ts) return "-";
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString("zh-CN", { hour12: false });
      };
      const renderList = (items, mode) => {
        if (!items || !items.length) {
          return `<div class="muted">暂无记录</div>`;
        }
        return items.map(item => {
          const name = escapeHtml(item.item_name || "未知物品");
          const qty = item.quantity || 0;
          const total = item.total_amount || 0;
          const unit = item.unit_price || 0;
          const net = item.net_amount || 0;
          const time = formatTs(item.created_at);
          const seasonId = item.season || "";
          const seasonLabelRaw = seasonMap[seasonId] || seasonMap[String(seasonId).toUpperCase()] || seasonId;
          const seasonLabel = seasonId ? (seasonLabelRaw || seasonId) : "";
          const meta = mode === "buy"
            ? `花费 <b>${total}</b> 三角币 · 均价 ${unit}`
            : `售出金额 <b>${total}</b> 三角币 · 实得 <b>${net}</b>`;
          const seasonMeta = seasonLabel ? ` · 赛季 ${escapeHtml(seasonLabel)}` : "";
          return `
            <div class="mail-entry">
              <div class="mail-entry__head">
                <span class="mail-entry__time">${time}</span>
                <span class="mail-entry__qty">×${qty}</span>
              </div>
              <div class="mail-entry__body">
                <span class="mail-entry__name">${name}</span>
                <span class="mail-entry__meta">${meta}${seasonMeta}</span>
              </div>
            </div>`;
        }).join("");
      };
      const brickBuy = renderList(mail?.brick?.buy || [], "buy");
      const brickSell = renderList(mail?.brick?.sell || [], "sell");
      const skinBuy = renderList(mail?.skin?.buy || [], "buy");
      const skinSell = renderList(mail?.skin?.sell || [], "sell");
      return `<div class="card"><h2>我的信息</h2>
        <div class="grid cols-3">
          <div class="kv"><div class="k">用户ID</div><div class="v">${d.user_id}</div></div>
          <div class="kv"><div class="k">用户名</div><div class="v">${d.username}</div></div>
          <div class="kv"><div class="k">手机号</div><div class="v">${d.phone}</div></div>
          <div class="kv"><div class="k">三角币</div><div class="v">${d.coins}</div></div>
          <div class="kv"><div class="k">法币</div><div class="v">${d.fiat}</div></div>
          <div class="kv"><div class="k">钥匙</div><div class="v">${d.keys}</div></div>
          <div class="kv"><div class="k">未开砖</div><div class="v">${d.unopened_bricks}</div></div>
          <div class="kv"><div class="k">是否管理员</div><div class="v">${d.is_admin ? '是' : '否'}</div></div>
        </div>
        <div class="mailbox">
          <div class="mailbox-header">
            <h3>交易邮箱</h3>
            <div class="mailbox-tabs">
              <button class="mailbox-tab active" data-mail-tab="brick">砖交易</button>
              <button class="mailbox-tab" data-mail-tab="skin">枪皮交易</button>
            </div>
          </div>
          <div class="mailbox-panels">
            <div class="mailbox-panel active" data-mail-panel="brick">
              <div class="mailbox-sub">
                <h4>购买记录</h4>
                <div class="mailbox-list" id="mail-brick-buy">${brickBuy}</div>
              </div>
              <div class="mailbox-sub">
                <h4>售出记录</h4>
                <div class="mailbox-list" id="mail-brick-sell">${brickSell}</div>
              </div>
            </div>
            <div class="mailbox-panel" data-mail-panel="skin">
              <div class="mailbox-sub">
                <h4>购买记录</h4>
                <div class="mailbox-list" id="mail-skin-buy">${skinBuy}</div>
              </div>
              <div class="mailbox-sub">
                <h4>售出记录</h4>
                <div class="mailbox-list" id="mail-skin-sell">${skinSell}</div>
              </div>
            </div>
          </div>
        </div></div>`;
    },
    bind() {
      const tabs = document.querySelectorAll('[data-mail-tab]');
      const panels = document.querySelectorAll('[data-mail-panel]');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.mailTab;
          tabs.forEach(btn => btn.classList.toggle('active', btn === tab));
          panels.forEach(panel => panel.classList.toggle('active', panel.dataset.mailPanel === target));
        });
      });
    }
  },
  wallet: WalletPage,
  shop: ShopPage,
  gacha: GachaPage,
  cookie: CookieFactoryPage,
  starfall: StarfallPage,
  cultivation: CultivationPage,
  dungeon: DungeonCrawlerPage,
  friends: FriendsPage,
  inventory: InventoryPage,
  craft: CraftPage,
  market: MarketPage,
  odds: {
    async render(){ const o = await API.odds(); return `<div class="card"><h2>当前概率</h2><pre>${escapeHtml(JSON.stringify(o,null,2))}</pre></div>`; },
    bind:()=>{}
  },
  admin: AdminPage,
  logout: {
    render(){ return `<div class="card"><h2>退出</h2><p>已退出。</p></div>`; },
    bind(){ API.setToken(null); setTimeout(()=>location.hash="#/home", 300); }
  }
};

let _currentRouteKey = null;
let _currentPageObj = null;

function renderNav() {
  const navNode = $nav();
  if (!navNode) return;
  navNode.innerHTML = Nav.render();
  Nav.bind();
  window.AudioEngine?.decorateArea?.(navNode);
}

async function renderRoute() {
  const r = (location.hash.replace(/^#\//,"") || "home");
  const nextPage = Pages[r] || Pages.home;
  const prevRoute = _currentRouteKey;
  const prevPage = _currentPageObj;

  if (prevPage && prevRoute && prevRoute !== r) {
    try { prevPage.teardown?.(); } catch (_) {}
  }
  if (prevRoute && prevRoute !== r) {
    window.AudioEngine?.stopAllSfx?.();
  }

  _currentRouteKey = r;
  _currentPageObj = nextPage;

  if (API.token) {
    try { await API.me(); } catch(e) { /* 忽略 */ }
  } else {
    API._me = null;
  }

  if (r === "admin" && !API._me?.is_admin) {
    location.hash = "#/home";
    return;
  }

  renderNav();
  window.AudioEngine?.setRoute?.(r);
  const p = nextPage;
  PresenceTracker.setPage(r, p);
  const html = await (p.render?.() ?? "");
  $page().innerHTML = html;
  p.bind?.();
  window.AudioEngine?.decorateArea?.($page());
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("load", renderRoute);
