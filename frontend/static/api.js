// 统一封装所有 REST 调用；同域访问
const API = {
  token: localStorage.getItem("token") || null,
  _me: null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  },

  headers() {
    const h = { "Content-Type": "application/json", "Accept": "application/json" };
    if (this.token) h["Authorization"] = "Bearer " + this.token;
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
      const msg = (data && (data.detail || data.msg)) || data?.raw || txt || "请求失败";
      throw new Error(msg);
    }
    return data;
  },

  // ---- Auth ----
  register: (username, phone, password, want_admin = false) =>
    API.json("/auth/register", "POST", { username, phone, password, want_admin }),

  loginStart: (username, password) =>
    API.json("/auth/login/start", "POST", { username, password }),

  loginVerify: (username, code) =>
    API.json("/auth/login/verify", "POST", { username, code }),

  sendCode: (phone, purpose) =>
    API.json("/auth/send-code", "POST", { phone, purpose }),

  resetPassword: (phone, code, new_password) =>
    API.json("/auth/reset-password", "POST", { phone, code, new_password }),

  adminVerify: (username, code) =>
    API.json("/auth/admin-verify", "POST", { username, code }),

  me: async () => {
    const d = await API.json("/me");
    API._me = { ...d, is_admin: !!d.is_admin };
    return API._me;
  },

  // ---- Wallet ----
  // 兼容两种后端：申请阶段也传 amount_fiat，确认阶段传 code + amount_fiat
  topupRequest: (amount_fiat) =>
    API.json("/wallet/topup/request", "POST", { amount_fiat }),

  topupConfirm: (code, amount_fiat) =>
    API.json("/wallet/topup/confirm", "POST", { code, amount_fiat }),

  // 兑换固定 1:10，后端已固化汇率
  exchange: (amount_fiat) => API.json("/wallet/exchange", "POST", { amount_fiat }),

  // ---- Shop / Gacha / Inventory / Craft ----
  buyKeys: (count) => API.json("/shop/buy-keys", "POST", { count }),
  buyBricks: (count) => API.json("/shop/buy-bricks", "POST", { count }),
  odds: () => API.json("/odds"),
  open: (count) => API.json("/gacha/open", "POST", { count }),
  inventory: () => API.json("/inventory"),
  inventoryByColor: () => API.json("/inventory/by-color"),
  craft: (from_rarity, inv_ids) =>
    API.json("/craft/compose", "POST", { from_rarity, inv_ids }),

  // ---- Market ----
  marketBrowse: (params = {}) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(
      ([k, v]) => v !== undefined && v !== null && v !== "" && usp.append(k, v)
    );
    return API.json(
      "/market/browse" + (usp.toString() ? "?" + usp.toString() : "")
    );
  },

  marketList: (inv_id, price) =>
    API.json("/market/list", "POST", { inv_id, price }),

  marketBuy: (market_id) => API.json(`/market/buy/${market_id}`, "POST"),

  marketMine: () => API.json("/market/my"),

  marketDelist: (market_id) => API.json(`/market/delist/${market_id}`, "POST"),

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
