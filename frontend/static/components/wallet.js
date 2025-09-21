const WalletPage = {
  async render() {
    const me = await API.me();
    return `
    <div class="card"><h2>我的钱包</h2>
      <div class="kv"><div class="k">法币余额</div><div class="v">${me.fiat}</div></div>
      <div class="kv"><div class="k">三角币</div><div class="v">${me.coins}</div></div>
      <div class="input-row"><input id="topup" type="number" placeholder="充值金额"/><button class="btn" id="do-topup">充值法币</button></div>
      <div class="input-row"><input id="ex-amt" type="number" placeholder="兑换法币金额"/><input id="ex-rate" type="number" placeholder="汇率(默认10)"/><button class="btn" id="do-ex">兑换三角币</button></div>
    </div>`;
  },
  bind() {
    byId("do-topup").onclick = async () => {
      const amt = +byId("topup").value; try{ await API.topup(amt); location.reload(); }catch(e){ alert(e.message); }
    };
    byId("do-ex").onclick = async () => {
      const a = +byId("ex-amt").value, r = +(byId("ex-rate").value || 10);
      try{ await API.exchange(a, r); location.reload(); }catch(e){ alert(e.message); }
    };
  }
}
