const AdminPage = {
  render() {
    return `
    <div class="card"><h2>管理员</h2>
      <div class="muted">
        可做：1）查看/搜索所有用户；2）发放法币；3）查看“充值申请”（玩家申请时的金额+验证码）。<br>
        普通用户无法自助充值法币，需验证码或由管理员发放。
      </div>

      <div class="card">
        <h3>所有用户</h3>
        <div class="input-row">
          <input id="q" placeholder="按用户名/手机号搜索"/>
          <button class="btn" id="do-q">搜索</button>
          <button class="btn" id="do-all">全部</button>
        </div>
        <div id="list"></div>
      </div>

      <div class="card">
        <h3>发放法币</h3>
        <div class="input-row">
          <input id="g-username" placeholder="用户名"/>
          <input id="g-amt" type="number" placeholder="金额（法币）"/>
          <button class="btn" id="g-do">发放</button>
        </div>
      </div>

      <div class="card">
        <h3>充值申请（未使用/未过期）</h3>
        <div class="input-row">
          <button class="btn" id="req-refresh">刷新</button>
        </div>
        <div id="req-list"></div>
      </div>
    </div>`;
  },
  async bind() {
    if (!API._me?.is_admin) { alert("非管理员"); location.hash="#/home"; return; }

    const renderUsers = (items=[])=>{
      const rows = items.map(u=>`
        <tr>
          <td>${escapeHtml(u.username||"")}</td>
          <td>${escapeHtml(u.phone||"")}</td>
          <td>${u.fiat}</td>
          <td>${u.coins}</td>
          <td>${u.is_admin?'是':'否'}</td>
        </tr>`).join("");
      byId("list").innerHTML = `
        <table class="table">
          <thead><tr><th>用户名</th><th>手机号</th><th>法币</th><th>三角币</th><th>管理员</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const renderReqs = (items=[])=>{
      const rows = items.map(r=>`
        <tr>
          <td>${escapeHtml(r.username||"")}</td>
          <td>${r.amount_fiat}</td>
          <td>${escapeHtml(r.code)}</td>
          <td>${new Date(r.expire_at*1000).toLocaleString()}</td>
        </tr>`).join("");
      byId("req-list").innerHTML = `
        <table class="table">
          <thead><tr><th>用户名</th><th>申请金额</th><th>验证码</th><th>过期时间</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    // 初次加载：全部用户 + 充值申请
    try { const d = await API.adminUsers("",1,50); renderUsers(d.items||[]); } catch(e){ /* 忽略 */ }
    try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ /* 忽略 */ }

    byId("do-q").onclick = async ()=>{
      const q = byId("q").value.trim();
      try { const d = await API.adminUsers(q,1,50); renderUsers(d.items||[]); } catch(e){ alert(e.message); }
    };
    byId("do-all").onclick = async ()=>{
      try { const d = await API.adminUsers("",1,50); renderUsers(d.items||[]); } catch(e){ alert(e.message); }
    };

    byId("g-do").onclick = async ()=>{
      const u = byId("g-username").value.trim(); const a = +byId("g-amt").value;
      if (!u || !a) return alert("请填写用户名与金额");
      try { await API.adminGrantFiat(u, a); alert("已发放"); } catch(e){ alert(e.message); }
    };

    byId("req-refresh").onclick = async ()=>{
      try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ alert(e.message); }
    };
  }
};
