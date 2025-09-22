// 钱包页：申请验证码时携带 amount_fiat；确认时携带 code + amount_fiat
const WalletPage = {
  async render() {
    const me = await API.me();
    return `
    <div class="card">
      <h2>我的钱包</h2>
      <div class="grid cols-4">
        <div class="kv"><div class="k">法币余额</div><div class="v" id="fiat-balance">${me.fiat}</div></div>
        <div class="kv"><div class="k">三角币</div><div class="v" id="coin-balance">${me.coins}</div></div>
        <div class="kv"><div class="k">钥匙</div><div class="v" id="key-balance">${me.keys}</div></div>
        <div class="kv"><div class="k">未开砖</div><div class="v" id="brick-balance">${me.unopened_bricks}</div></div>
      </div>
    </div>

    <div class="card">
      <h3>充值法币（先申请验证码，后台可见“金额 + 验证码”）</h3>
      <div class="input-row">
        <input id="topup-amount" type="number" min="1" placeholder="充值金额（法币）"/>
        <button class="btn" id="btn-topup-request">申请验证码</button>
      </div>
      <div class="input-row">
        <input id="topup-code" placeholder="短信验证码"/>
        <button class="btn" id="btn-topup-confirm">确认充值</button>
      </div>
      <div class="muted">申请后，后台会在 <code>sms_codes.txt</code> 写入记录（purpose: wallet-topup）。</div>
    </div>

    <div class="card">
      <h3>兑换三角币（固定 1:10）</h3>
      <div class="input-row">
        <input id="exchange-amount" type="number" min="1" placeholder="要兑换的法币金额"/>
        <button class="btn" id="btn-exchange">兑换</button>
      </div>
    </div>
    `;
  },

  bind() {
    // 申请验证码：必须带金额（兼容你的后端 422 校验）
    byId("btn-topup-request").onclick = async () => {
      const amt = parseInt(byId("topup-amount").value, 10) || 0;
      if (amt <= 0) return alert("请输入有效的充值金额");
      try {
        await API.topupRequest(amt);
        alert("验证码已生成，请到后端目录 sms_codes.txt 查看。");
      } catch (e) {
        alert(e.message || "申请验证码失败");
      }
    };

    // 确认充值：code + amount_fiat
    byId("btn-topup-confirm").onclick = async () => {
      const code = (byId("topup-code").value || "").trim();
      const amt = parseInt(byId("topup-amount").value, 10) || 0;
      if (amt <= 0) return alert("请输入有效的充值金额");
      if (!code) return alert("请输入验证码");

      try {
        await API.topupConfirm(code, amt);
        const me = await API.me();
        byId("fiat-balance").textContent = me.fiat;
        alert("充值成功！");
        byId("topup-code").value = "";
      } catch (e) {
        alert(e.message || "充值失败");
      }
    };

    // 兑换三角币（固定 1:10）
    byId("btn-exchange").onclick = async () => {
      const amt = parseInt(byId("exchange-amount").value, 10) || 0;
      if (amt <= 0) return alert("请输入有效的法币金额");
      try {
        await API.exchange(amt);
        const me = await API.me();
        byId("fiat-balance").textContent = me.fiat;
        byId("coin-balance").textContent = me.coins;
        alert(`兑换成功，当前三角币：${me.coins}`);
        byId("exchange-amount").value = "";
      } catch (e) {
        alert(e.message || "兑换失败");
      }
    };
  }
};
