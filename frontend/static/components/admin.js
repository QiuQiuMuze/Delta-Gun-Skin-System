const AdminPage = {
  render() {
    return `
    <div class="card"><h2>管理员</h2>
      <div class="muted">
        管理员可：1）搜索已注册用户；2）给用户发放法币（单位：法币）。<br>
        普通用户无法自助充值法币，需验证码或由管理员发放。
      </div>

      <div class="card">
        <h3>搜索用户</h3>
        <div class="input-row">
          <input id="q" placeholder="按用户名/手机号搜索"/>
          <button class="btn" id="do-q">搜索</button>
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
    </div>`;
  },
  async bind() {
    if (!API._me?.is_admin) { alert("非管理员"); location.hash="#/home"; return; }

    const renderList = (items=[])=>{
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

    byId("do-q").onclick = async ()=>{
      const q = byId("q").value.trim();
      try { const d = await API.adminUsers(q,1,50); renderList(d.items||[]); } catch(e){ alert(e.message); }
    };

    byId("g-do").onclick = async ()=>{
      const u = byId("g-username").value.trim(); const a = +byId("g-amt").value;
      if (!u || !a) return alert("请填写用户名与金额");
      try { await API.adminGrantFiat(u, a); alert("已发放"); } catch(e){ alert(e.message); }
    };
  }
}
