// 简易路由与页面调度
const $page = () => document.getElementById("page");
const $nav = () => document.getElementById("nav");
const $notify = () => document.getElementById("global-notify");
const byId = (id) => document.getElementById(id);
const escapeHtml = (s)=> String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

// ★★★ 关键：让 API 使用“每标签页独立会话”并迁移旧 token
API.initSession();

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

const Pages = {
  home: { render: () => `<div class="card"><h2>欢迎</h2><p>这是三角洲砖皮模拟器的网站版，我终于给他弄出来啦，快夸我~</p></div>`, bind: ()=>{} },
  auth: AuthPage,
  me: {
    async render() {
      const [d, mailboxRaw] = await Promise.all([
        API.me(),
        API.mailbox().catch(() => ({ brick: { buy: [], sell: [] }, skin: { buy: [], sell: [] } })),
      ]);
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
          const meta = mode === "buy"
            ? `花费 <b>${total}</b> 三角币 · 均价 ${unit}`
            : `售出金额 <b>${total}</b> 三角币 · 实得 <b>${net}</b>`;
          return `
            <div class="mail-entry">
              <div class="mail-entry__head">
                <span class="mail-entry__time">${time}</span>
                <span class="mail-entry__qty">×${qty}</span>
              </div>
              <div class="mail-entry__body">
                <span class="mail-entry__name">${name}</span>
                <span class="mail-entry__meta">${meta}</span>
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

function renderNav() { $nav().innerHTML = Nav.render(); Nav.bind(); }

async function renderRoute() {
  const r = (location.hash.replace(/^#\//,"") || "home");

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
  const p = Pages[r] || Pages.home;
  const html = await (p.render?.() ?? "");
  $page().innerHTML = html;
  p.bind?.();
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("load", renderRoute);
