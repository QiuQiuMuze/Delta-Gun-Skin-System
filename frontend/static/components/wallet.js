const WalletPage = {
  async render() {
    const me = await API.me();
    const rate = 10; // 固定 1:10
    return `
    <div class="card"><h2>我的钱包</h2>
      <div class="kv"><div class="k">法币余额</div><div class="v">${me.fiat}</div></div>
      <div class="kv"><div class="k">三角币</div><div class="v">${me.coins}</div></div>

      <h3>充值法币（需要验证码）</h3>
      <div class="input-row">
        <button class="btn" id="topup-req">请求验证码</button>
        <input id="topup-code" placeholder="验证码"/>
        <input id="topup-amt" type="number" placeholder="充值法币金额"/>
        <button class="btn" id="topup-do">确认充值</button>
      </div>
      <div class="muted">点击“请求验证码”后，后端会在 <code>sms_codes.txt</code> 写入一条充值验证码。输入验证码和金额后点“确认充值”。</div>

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
    byId("topup-req").onclick = async () => {
      try { await API.topupRequest(); alert("验证码已生成，请查看 sms_codes.txt"); } catch(e){ alert(e.message); }
    };
    byId("topup-do").onclick = async () => {
      const code = byId("topup-code").value.trim();
      const amt = +byId("topup-amt").value;
      if (!code || !amt) return alert("请填写验证码与金额");
      try { await API.topupConfirm(code, amt); alert("充值成功"); location.reload(); } catch(e){ alert(e.message); }
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
}
