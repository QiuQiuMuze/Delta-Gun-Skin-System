// 简易路由与页面调度
const $page = () => document.getElementById("page");
const $nav = () => document.getElementById("nav");
const byId = (id) => document.getElementById(id);
const escapeHtml = (s)=> String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

const Pages = {
  home: { render: () => `<div class="card"><h2>欢迎</h2><p>这是三角洲砖皮模拟器的网站版，我终于给他弄出来啦，快夸我~</p></div>`, bind: ()=>{} },
  auth: AuthPage,
  me: {
    async render() {
      const d = await API.me();
      return `<div class="card"><h2>我的信息</h2>
        <div class="grid cols-3">
          <div class="kv"><div class="k">用户名</div><div class="v">${d.username}</div></div>
          <div class="kv"><div class="k">手机号</div><div class="v">${d.phone}</div></div>
          <div class="kv"><div class="k">三角币</div><div class="v">${d.coins}</div></div>
          <div class="kv"><div class="k">法币</div><div class="v">${d.fiat}</div></div>
          <div class="kv"><div class="k">钥匙</div><div class="v">${d.keys}</div></div>
          <div class="kv"><div class="k">未开砖</div><div class="v">${d.unopened_bricks}</div></div>
          <div class="kv"><div class="k">是否管理员</div><div class="v">${d.is_admin ? '是' : '否'}</div></div>
        </div></div>`;
    }, bind:()=>{}
  },
  wallet: WalletPage,
  shop: ShopPage,
  gacha: GachaPage,
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

  // 若已登录，每次进入路由前刷新一次 /me，获取 is_admin 并供导航显示
  if (API.token) {
    try { await API.me(); } catch(e) { /* 忽略 */ }
  } else {
    API._me = null;
  }

  // 非管理员访问 admin -> 跳回首页
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
