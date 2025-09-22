const AdminPage = {
  render() {
    return `
    <div class="card"><h2>管理员</h2>
      <div class="muted">
        可做：1）查看/搜索所有用户；2）发放/扣减法币；3）发放/扣减三角币；
        4）查看“充值申请”（玩家申请时的金额+验证码）；5）查看“短信验证码日志”（注册/登录/重置/管理员验证/充值）。<br>
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
        <h3>余额操作</h3>
        <div class="input-row">
          <input id="op-username" placeholder="用户名"/>
        </div>
        <div class="grid cols-2">
          <div>
            <div class="muted">法币</div>
            <div class="input-row">
              <input id="fiat-amt" type="number" placeholder="金额（法币）"/>
              <button class="btn" id="fiat-grant">发放法币</button>
              <button class="btn danger" id="fiat-deduct">扣除法币</button>
            </div>
          </div>
          <div>
            <div class="muted">三角币</div>
            <div class="input-row">
              <input id="coin-amt" type="number" placeholder="数量（三角币）"/>
              <button class="btn" id="coin-grant">发放三角币</button>
              <button class="btn danger" id="coin-deduct">扣除三角币</button>
            </div>
          </div>
        </div>
        <div class="muted">提示：扣除会先校验余额，不足会失败并提示；不会出现负数。</div>
      </div>

      <div class="card">
        <h3>充值申请（未使用/未过期）</h3>
        <div class="input-row">
          <button class="btn" id="req-refresh">刷新</button>
        </div>
        <div id="req-list"></div>
      </div>

      <div class="card">
        <h3>短信验证码日志</h3>
        <div class="input-row">
          <select id="sms-purpose">
            <option value="">全部 purpose</option>
            <option value="register">register（注册）</option>
            <option value="login2">login2（登录第二步）</option>
            <option value="reset">reset（重置密码）</option>
            <option value="admin-verify">admin-verify（管理员验证）</option>
            <option value="wallet-topup">wallet-topup（充值）</option>
          </select>
          <input id="sms-limit" type="number" min="1" max="1000" value="200" style="width:120px" />
          <button class="btn" id="sms-refresh">刷新</button>
        </div>
        <div id="sms-list"></div>
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

    const renderSms = (items=[])=>{
      const rows = items.map(x=>{
        const ts = /^\d+$/.test(x.ts) ? new Date(parseInt(x.ts,10)*1000).toLocaleString() : (x.ts||"");
        return `
          <tr>
            <td>${escapeHtml(ts)}</td>
            <td>${escapeHtml(x.purpose||"")}</td>
            <td>${escapeHtml(x.tag||"")}</td>
            <td>${escapeHtml(x.code||"")}</td>
            <td>${x.amount!=null ? x.amount : ""}</td>
          </tr>`;
      }).join("");
      byId("sms-list").innerHTML = `
        <table class="table">
          <thead><tr><th>时间</th><th>purpose</th><th>账号/手机号</th><th>验证码</th><th>金额</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    // 初次加载：全部用户 + 充值申请 + 短信日志
    try { const d = await API.adminUsers("",1,50); renderUsers(d.items||[]); } catch(e){ /* 忽略 */ }
    try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ /* 忽略 */ }

    const loadSms = async ()=>{
      const limit = parseInt(byId("sms-limit").value, 10) || 200;
      try {
        const data = await API.adminSmsLog(limit);
        const all = data.items || [];
        const purpose = byId("sms-purpose").value;
        const filtered = purpose ? all.filter(x=> String(x.purpose)===purpose) : all;
        renderSms(filtered);
      } catch(e){ alert(e.message); }
    };
    try { await loadSms(); } catch(e){ /* 忽略 */ }

    // 搜索
    byId("do-q").onclick = async ()=>{
      const q = byId("q").value.trim();
      try { const d = await API.adminUsers(q,1,50); renderUsers(d.items||[]); } catch(e){ alert(e.message); }
    };
    byId("do-all").onclick = async ()=>{
      try { const d = await API.adminUsers("",1,50); renderUsers(d.items||[]); } catch(e){ alert(e.message); }
    };

    // 余额操作
    const getUserAndNum = (idUser, idAmt) => {
      const u = byId(idUser).value.trim();
      const n = parseInt(byId(idAmt).value, 10) || 0;
      return {u, n};
    };

    byId("fiat-grant").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "fiat-amt");
      if (!u || n<=0) return alert("请填写用户名与金额（法币）");
      try { await API.adminGrantFiat(u, n); alert("已发放"); } catch(e){ alert(e.message); }
    };

    byId("fiat-deduct").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "fiat-amt");
      if (!u || n<=0) return alert("请填写用户名与金额（法币）");
      try { await API.adminDeductFiat(u, n); alert("已扣除"); } catch(e){ alert(e.message); }
    };

    byId("coin-grant").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "coin-amt");
      if (!u || n<=0) return alert("请填写用户名与数量（三角币）");
      try { await API.adminGrantCoins(u, n); alert("已发放"); } catch(e){ alert(e.message); }
    };

    byId("coin-deduct").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "coin-amt");
      if (!u || n<=0) return alert("请填写用户名与数量（三角币）");
      try { await API.adminDeductCoins(u, n); alert("已扣除"); } catch(e){ alert(e.message); }
    };

    // 充值申请刷新
    byId("req-refresh").onclick = async ()=>{
      try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ alert(e.message); }
    };

    // 短信日志刷新 + 目的筛选
    byId("sms-refresh").onclick = loadSms;
    byId("sms-purpose").onchange = loadSms;
  }
};
