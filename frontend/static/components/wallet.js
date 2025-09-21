const WalletPage = {
  async render() {
    const me = await API.me();
    const rate = 10;
    return `
    <div class="card"><h2>我的钱包</h2>
      <div class="grid cols-3">
        <div class="kv"><div class="k">法币余额</div><div class="v">${me.fiat}</div></div>
        <div class="kv"><div class="k">三角币</div><div class="v">${me.coins}</div></div>
        <div class="kv"><div class="k">钥匙</div><div class="v">${me.keys}</div></div>
      </div>

      <h3>充值法币（先申请验证码，后台可见“金额 + 验证码”）</h3>
      <div class="input-row">
        <input id="req-amt" type="number" placeholder="申请充值法币金额"/>
        <button class="btn" id="req-btn">申请验证码</button>
      </div>
      <div class="input-row">
        <input id="cfm-code" placeholder="验证码"/>
        <button class="btn" id="cfm-btn">确认充值</button>
      </div>
      <div class="muted">申请后，后端会在 <code>sms_codes.txt</code> 记录：申请金额、验证码、账号、时间。</div>

      <h3>兑换三角币（固定 1:10）</h3>
      <div class="input-row">
        <input id="ex-amt" type="number" placeholder="要兑换的法币金额"/>
        <span id="ex-preview" class="muted"></span>
        <button class="btn" id="ex-do">兑换</button>
      </div>
    </div>`;
  },
  bind() {
    const rate = 10;

    byId("req-btn").onclick = async () => {
      const a = +byId("req-amt").value;
      if (!a) return alert("请输入申请金额");
      try { await API.topupRequest(a); alert("验证码已生成，请查看 sms_codes.txt"); } catch(e){ alert(e.message); }
    };

    byId("cfm-btn").onclick = async () => {
      const code = byId("cfm-code").value.trim();
      if (!code) return alert("请输入验证码");
      try { await API.topupConfirm(code); alert("充值成功"); location.reload(); } catch(e){ alert(e.message); }
    };

    const exAmt = byId("ex-amt"), prev = byId("ex-preview");
    exAmt.oninput = ()=> {
      const v = +exAmt.value || 0;
      prev.textContent = v ? `将获得 ${v*rate} 三角币` : "";
    };
    byId("ex-do").onclick = async () => {
      const v = +exAmt.value; if (!v) return alert("请输入法币金额");
      try { await API.exchange(v); alert("兑换成功"); location.reload(); } catch(e){ alert(e.message); }
    };
  }
};
