// 钱包页：法币充值（验证码两步） + 固定档位兑换（法币蓝色，三角币金色）
const WalletPage = {
  async render() {
    const me = await API.me();
    return `
    <div class="card">
      <h2>我的钱包</h2>
      <div class="grid cols-4">
        <div class="kv">
          <div class="k"><span class="c-fiat">法币余额</span></div>
          <div class="v c-fiat" id="fiat-balance">${me.fiat}</div>
        </div>
        <div class="kv">
          <div class="k"><span class="c-coins">三角币</span></div>
          <div class="v c-coins" id="coin-balance">${me.coins}</div>
        </div>
        <div class="kv"><div class="k">钥匙</div><div class="v" id="key-balance">${me.keys}</div></div>
        <div class="kv"><div class="k">未开砖</div><div class="v" id="brick-balance">${me.unopened_bricks}</div></div>
      </div>
    </div>

    <div class="card">
      <h3>充值<span class="c-fiat">法币</span></h3>
      <div class="input-row">
        <input id="topup-amount" type="number" min="1" placeholder="充值金额（法币）"/>
        <button class="btn" id="btn-topup-request">申请验证码</button>
      </div>
      <div class="input-row">
        <input id="topup-code" placeholder="短信验证码"/>
        <button class="btn" id="btn-topup-confirm">确认充值</button>
      </div>
      <div class="muted">申请后，向后端或管理员索要验证码。</div>
    </div>

    <div class="card">
      <h3>兑换<span class="c-coins">三角币</span>（固定套餐）</h3>
      <div class="grid cols-3" id="bundle-grid">
        ${[
          {fiat:6,   coins:60},
          {fiat:30,  coins:320},
          {fiat:68,  coins:750},
          {fiat:128, coins:1480},
          {fiat:328, coins:3950},
          {fiat:648, coins:8100}
        ].map(b => `
          <div class="card soft">
            <div class="kv">
              <div class="k c-fiat">法币</div>
              <div class="v c-fiat">${b.fiat}</div>
            </div>
            <div class="kv">
              <div class="k c-coins">可得三角币</div>
              <div class="v c-coins">${b.coins}</div>
            </div>
            <button class="btn" data-exchange="${b.fiat}">兑换</button>
          </div>
        `).join("")}
      </div>
    </div>
    `;
  },

  bind() {
    // 充值验证码：申请
    byId("btn-topup-request").onclick = async () => {
      const amt = parseInt(byId("topup-amount").value, 10) || 0;
      if (amt <= 0) return alert("请输入有效的充值金额");
      try {
        await API.topupRequest(amt);
        alert("验证码已生成，请联系管理员查看。");
      } catch (e) {
        alert(e.message || "申请验证码失败");
      }
    };

    // 充值验证码：确认（code + amount）
    byId("btn-topup-confirm").onclick = async () => {
      const code = (byId("topup-code").value || "").trim();
      const amt  = parseInt(byId("topup-amount").value, 10) || 0;
      if (amt <= 0) return alert("请输入有效的充值金额");
      if (!code)   return alert("请输入验证码");

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

    // 固定套餐兑换
    document.querySelectorAll("[data-exchange]").forEach(btn => {
      btn.onclick = async () => {
        const amt = parseInt(btn.getAttribute("data-exchange"), 10);
        try {
          const ret = await API.exchange(amt);
          const me  = await API.me();
          byId("fiat-balance").textContent  = me.fiat;
          byId("coin-balance").textContent  = me.coins;
          alert(`兑换成功：法币-${ret.exchanged_fiat}  →  三角币+${ret.gained_coins}`);
        } catch (e) {
          alert(e.message || "兑换失败");
        }
      };
    });
  }
};
