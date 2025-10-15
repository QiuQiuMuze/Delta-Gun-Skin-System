// 统一封装所有 REST 调用；同域访问
const API = {
  // —— 使用 sessionStorage 做“每标签页独立会话” —— //
  _tokenKey: "token",
  _me: null,
  _features: {},
  _seasonCatalog: null,

  // 初始化：若发现旧 localStorage token，则迁移到本标签页的 sessionStorage
  initSession() {
    try {
      const ssTok = sessionStorage.getItem(this._tokenKey);
      const lsTok = localStorage.getItem(this._tokenKey);
      if (!ssTok && lsTok) {
        sessionStorage.setItem(this._tokenKey, lsTok);
        localStorage.removeItem(this._tokenKey);
      }
    } catch (_) { /* 忽略 */ }
  },

  get token() {
    try { return sessionStorage.getItem(this._tokenKey) || null; }
    catch (_) { return null; }
  },

  setToken(t) {
    try {
      if (t) sessionStorage.setItem(this._tokenKey, t);
      else sessionStorage.removeItem(this._tokenKey);
      // 同时把旧 localStorage 清干净，避免误读
      localStorage.removeItem(this._tokenKey);
    } catch (_) { /* 忽略 */ }
  },

  headers() {
    const h = { "Content-Type": "application/json", "Accept": "application/json" };
    const tok = this.token;
    if (tok) h["Authorization"] = "Bearer " + tok;
    return h;
  },

  // 更稳健：先取 text，再尝试 JSON.parse；失败则保留原始文本
  async json(url, method = "GET", body = null) {
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : null,
    });

    const txt = await res.text();
    let data;
    try { data = txt ? JSON.parse(txt) : {}; }
    catch (_) { data = { raw: txt }; }

    if (!res.ok) {
      let msg = (data && (data.detail || data.msg)) || data?.raw || txt || "请求失败";

      // ★ 被别处登录顶下线（后端返回 401 + "SESSION_REVOKED"）
      if (msg === "SESSION_REVOKED") {
        try { this.setToken(null); } catch (_) {}
        alert("账号在其他设备/标签页登录，你已下线（为保证账号安全请重新登录）");
        location.hash = "#/auth";
        throw new Error("SESSION_REVOKED");
      }

      // ★ detail 可能是数组/对象，这里统一序列化，避免 [object Object]
      if (Array.isArray(msg)) {
        // FastAPI 422: [{loc:[...], msg:"...", type:"..."}...]
        msg = msg.map(i => (i && i.msg) ? i.msg : JSON.stringify(i)).join("；");
      } else if (typeof msg !== "string") {
        try { msg = JSON.stringify(msg); } catch (_) { msg = String(msg); }
      }

      throw new Error(msg);
    }

    return data;
  },

  // ---- Auth ----
  authMode: () => API.json("/auth/mode"),

  register: (username, password, want_admin = false, phone = null, reg_code = null) => {
    const payload = { username, password, want_admin };
    if (phone) payload.phone = phone;
    if (reg_code) payload.reg_code = reg_code;
    return API.json("/auth/register", "POST", payload);
  },

  sendRegisterCode: (phone) =>
    API.json("/auth/send-code", "POST", { phone, purpose: "register" }),

  loginStart: (username, password) =>
    API.json("/auth/login/start", "POST", { username, password }),

  loginVerify: (username, code) =>
    API.json("/auth/login/verify", "POST", { username, code }),

  // 通用短信（目前用于“重置密码”等用途）
  sendCode: (phone, purpose) =>
    API.json("/auth/send-code", "POST", { phone, purpose }),

  resetPassword: (phone, code, new_password) =>
    API.json("/auth/reset-password", "POST", { phone, code, new_password }),

  adminVerify: (username, code) =>
    API.json("/auth/admin-verify", "POST", { username, code }),

  me: async () => {
    const d = await API.json("/me");
    API._me = { ...d, is_admin: !!d.is_admin };
    API._features = d.features || API._features || {};
    return API._me;
  },

  // ---- Wallet ----
  // 申请验证码（带金额）
  topupRequest: (amount_fiat) =>
    API.json("/wallet/topup/request", "POST", { amount_fiat }),

  // 确认充值（带验证码 & 金额，兼容你后端的校验）
  topupConfirm: (code) =>
    API.json("/wallet/topup/confirm", "POST", { code }),


  // 兑换固定套餐（由后端校验档位）
  exchange: (amount_fiat) => API.json("/wallet/exchange", "POST", { amount_fiat }),

  // ---- Shop / Gacha / Inventory / Craft ----
  shopPrices: () => API.json("/shop/prices"),
  buyKeys: (count) => API.json("/shop/buy-keys", "POST", { count }),
  buyBricks: (count, season = null) => {
    const payload = { count };
    if (season) payload.season = season;
    return API.json("/shop/buy-bricks", "POST", payload);
  },
  brickQuote: (count, season = null) => {
    const usp = new URLSearchParams();
    usp.append("count", count);
    if (season) usp.append("season", season);
    return API.json(`/shop/brick-quote?${usp.toString()}`);
  },
  odds: () => API.json("/odds"),
  seasonCatalog: async function(force = false) {
    if (!force && this._seasonCatalog) return this._seasonCatalog;
    const data = await API.json("/seasons/catalog");
    this._seasonCatalog = data || { seasons: [], latest: null };
    return this._seasonCatalog;
  },

  open: (count, season = null, targetSkinId = null) => {
    const payload = { count };
    if (season) payload.season = season;
    if (targetSkinId) payload.target_skin_id = targetSkinId;
    return API.json("/gacha/open", "POST", payload);
  },
  inventory: (show_on_market = false) =>
    API.json("/inventory" + (show_on_market ? "?show_on_market=true" : "")),
  inventoryByColor: (show_on_market = false) =>
    API.json("/inventory/by-color" + (show_on_market ? "?show_on_market=true" : "")),
  craft: (from_rarity, inv_ids) =>
    API.json("/craft/compose", "POST", { from_rarity, inv_ids }),
  mailbox: (limit = 20) => {
    const usp = new URLSearchParams();
    if (limit) usp.append("limit", limit);
    return API.json(`/me/mailbox${usp.toString() ? `?${usp.toString()}` : ""}`);
  },

  // ---- Market ----
  marketBrowse: (params = {}) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(
      ([k, v]) => v !== undefined && v !== null && v !== "" && usp.append(k, v)
    );
    return API.json("/market/browse" + (usp.toString() ? "?" + usp.toString() : ""));
  },

  marketList: (inv_id, price) =>
    API.json("/market/list", "POST", { inv_id, price }),

  marketBuy: (market_id) => API.json(`/market/buy/${market_id}`, "POST"),

  marketMine: () => API.json("/market/my"),

  marketDelist: (market_id) => API.json(`/market/delist/${market_id}`, "POST"),
  brickBook: () => API.json("/market/bricks/book"),
  brickSell: (quantity, price, season) => {
    const payload = { quantity, price };
    if (season) payload.season = season;
    return API.json("/market/bricks/sell", "POST", payload);
  },
  brickCancelSell: (order_id) => API.json(`/market/bricks/cancel/${order_id}`, "POST"),
  brickBuyOrder: (quantity, target_price) => API.json("/market/bricks/buy-order", "POST", { quantity, target_price }),
  brickCancelBuyOrder: (order_id) => API.json(`/market/bricks/buy-order/cancel/${order_id}`, "POST"),

  // ---- Cookie Factory ----
  cookieStatus: () => API.json("/cookie-factory/status"),
  cookieLogin: () => API.json("/cookie-factory/login", "POST"),
  cookieAct: (payload) => API.json("/cookie-factory/act", "POST", payload || {}),

  // ---- Admin（JWT 管理接口）----
  adminUsers: (q = "", page = 1, page_size = 50) => {
    const usp = new URLSearchParams();
    if (q) usp.append("q", q);
    usp.append("page", page);
    usp.append("page_size", page_size);
    return API.json("/admin/users" + (usp.toString() ? "?" + usp.toString() : ""));
  },

  adminGrantFiat: (username, amount_fiat) =>
    API.json("/admin/grant-fiat", "POST", { username, amount_fiat }),

  adminTopupRequests: () => API.json("/admin/topup-requests"),

    // 管理员：读取短信验证码日志
  adminSmsLog: (limit = 200) => {
    const usp = new URLSearchParams();
    usp.append("limit", limit);
    return API.json("/admin/sms-log" + (usp.toString() ? "?" + usp.toString() : ""));
  },


  // ★ 新增：加/扣 三角币、扣 法币
  adminGrantCoins: (username, amount_coins) =>
    API.json("/admin/grant-coins", "POST", { username, amount_coins }),

  adminDeductCoins: (username, amount_coins) =>
    API.json("/admin/deduct-coins", "POST", { username, amount_coins }),

  adminDeductFiat: (username, amount_fiat) =>
    API.json("/admin/deduct-fiat", "POST", { username, amount_fiat }),
  // 删号：请求验证码 & 确认删除
  adminDeleteUserRequest: (target_username) =>
    API.json("/admin/delete-user/request", "POST", { target_username }),

  adminDeleteUserConfirm: (target_username, code) =>
    API.json("/admin/delete-user/confirm", "POST", { target_username, code }),

  cookieAdminStatus: () => API.json("/admin/cookie-factory"),
  cookieAdminToggle: (enabled) => API.json("/admin/cookie-factory/toggle", "POST", { enabled }),


  adminAuthModeGet: () => API.json("/admin/auth-mode"),

  adminAuthModeSet: (verification_free) =>
    API.json("/admin/auth-mode", "POST", { verification_free }),

  adminUserInventory: (username) => {
    const usp = new URLSearchParams();
    usp.append("username", username);
    return API.json("/admin/user-inventory" + (usp.toString() ? "?" + usp.toString() : ""));
  },



  // 旧 X-Admin-Key 配置接口（兼容保留）
  adminGetConfig: (xkey) =>
    fetch("/admin/config", {
      headers: { ...API.headers(), "X-Admin-Key": xkey },
    }).then((r) => r.json()),

  adminSetConfig: (xkey, cfg) =>
    fetch("/admin/config", {
      method: "POST",
      headers: {
        ...API.headers(),
        "X-Admin-Key": xkey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cfg),
    }).then((r) => r.json()),

  adminUpsertSkins: (xkey, skins) =>
    fetch("/admin/skins/upsert", {
      method: "POST",
      headers: {
        ...API.headers(),
        "X-Admin-Key": xkey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(skins),
    }).then((r) => r.json()),

  adminActivateSkin: (xkey, skin_id, active) =>
    fetch("/admin/skins/activate", {
      method: "POST",
      headers: {
        ...API.headers(),
        "X-Admin-Key": xkey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skin_id, active }),
    }).then((r) => r.json()),
};

// 页面入口初始化一次
API.initSession();
