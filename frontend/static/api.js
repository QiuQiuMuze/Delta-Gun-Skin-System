// 统一封装所有 REST 调用；同域访问，无需 CORS
const API = {
  token: localStorage.getItem("token") || null,
  _me: null, // 缓存当前用户信息（含 is_admin）

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem("token", t); else localStorage.removeItem("token");
  },

  headers() {
    const h = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = "Bearer " + this.token;
    return h;
  },

  async json(url, method="GET", body=null) {
    const res = await fetch(url, {
      method, headers: this.headers(),
      body: body ? JSON.stringify(body) : null
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(data?.detail || JSON.stringify(data));
    return data;
  },

  // ---- Auth ----
  // 新增 want_admin 参数（后端若未处理也兼容）
  register: (username, phone, password, want_admin=false) =>
    API.json("/auth/register", "POST", { username, phone, password, want_admin }),
  loginStart: (username, password) =>
    API.json("/auth/login/start", "POST", { username, password }),
  loginVerify: (username, code) =>
    API.json("/auth/login/verify", "POST", { username, code }),
  sendCode: (phone, purpose) =>
    API.json("/auth/send-code", "POST", { phone, purpose }),
  resetPassword: (phone, code, new_password) =>
    API.json("/auth/reset-password", "POST", { phone, code, new_password }),
  // 管理员验证（注册为管理员第二步）
  adminVerify: (username, code) =>
    API.json("/auth/admin-verify", "POST", { username, code }),

  me: async () => {
    const d = await API.json("/me");
    // 兼容后端暂未返回 is_admin 的场景
    API._me = { ...d, is_admin: !!d.is_admin };
    return API._me;
  },

  // ---- Wallet/Shop ----
  // 顶充改为两段式：请求验证码 + 确认
  topupRequest: () => API.json("/wallet/topup/request", "POST", {}),
  topupConfirm: (code, amount_fiat) => API.json("/wallet/topup/confirm", "POST", { code, amount_fiat }),
  // 兑换固定 1:10：只传法币金额，后端固定比率
  exchange: (amount_fiat) => API.json("/wallet/exchange", "POST", { amount_fiat }),

  buyKeys: (count) => API.json("/shop/buy-keys", "POST", { count }),
  buyBricks: (count) => API.json("/shop/buy-bricks", "POST", { count }),

  // ---- Gacha ----
  odds: () => API.json("/odds"),
  open: (count) => API.json("/gacha/open", "POST", { count }),

  // ---- Inventory ----
  inventory: () => API.json("/inventory"),
  inventoryByColor: () => API.json("/inventory/by-color"),

  // ---- Craft ----
  craft: (from_rarity, inv_ids) => API.json("/craft/compose", "POST", { from_rarity, inv_ids }),

  // ---- Market ----
  marketBrowse: (params={}) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => (v !== undefined && v !== null && v !== "") && usp.append(k, v));
    const qs = usp.toString(); const url = "/market/browse" + (qs?`?${qs}`:"");
    return API.json(url);
  },
  marketList: (inv_id, price) => API.json("/market/list", "POST", { inv_id, price }),
  marketBuy: (market_id) => API.json(`/market/buy/${market_id}`, "POST"),
  marketMine: () => API.json("/market/my"),
  marketDelist: (market_id) => API.json(`/market/delist/${market_id}`, "POST"),

  // ---- Admin（新增） ----
  adminUsers: (q="", page=1, page_size=20) => {
    const usp = new URLSearchParams({ q, page, page_size });
    return API.json("/admin/users?"+usp.toString());
  },
  adminGrantFiat: (username, amount_fiat) =>
    API.json("/admin/grant-fiat", "POST", { username, amount_fiat }),

  // 你旧的皮肤配置接口保持不变（若仍需要）
  adminGetConfig: (xkey) => fetch("/admin/config", { headers: { ...API.headers(), "X-Admin-Key": xkey }}).then(r=>r.json()),
  adminSetConfig: (xkey, cfg) => fetch("/admin/config", { method:"POST", headers: { ...API.headers(), "X-Admin-Key": xkey, "Content-Type":"application/json"}, body: JSON.stringify(cfg)}).then(r=>r.json()),
  adminUpsertSkins: (xkey, skins) => fetch("/admin/skins/upsert", { method:"POST", headers:{...API.headers(),"X-Admin-Key":xkey,"Content-Type":"application/json"}, body: JSON.stringify({skins})}).then(r=>r.json()),
  adminActivateSkin: (xkey, skin_id, active) => fetch("/admin/skins/activate", { method:"POST", headers:{...API.headers(),"X-Admin-Key":xkey,"Content-Type":"application/json"}, body: JSON.stringify({skin_id, active})}).then(r=>r.json()),
};
