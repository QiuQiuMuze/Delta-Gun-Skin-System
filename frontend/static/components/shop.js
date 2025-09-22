// 商店：展示单价说明（钥匙=60、砖=100），购买逻辑沿用原接口
const ShopPage = {
  render() {
    return `
    <div class="card">
      <h2>商店</h2>
      <div class="muted">当前价格：钥匙 <b>60</b> 三角币 / 个，砖 <b>100</b> 三角币 / 个</div>
      <div class="grid cols-2">
        <div class="card soft">
          <h3>购买钥匙</h3>
          <div class="input-row">
            <input id="key-count" type="number" min="1" placeholder="数量（≥1）"/>
            <button class="btn" id="buy-keys">购买</button>
          </div>
        </div>
        <div class="card soft">
          <h3>购买未开砖</h3>
          <div class="input-row">
            <input id="brick-count" type="number" min="1" placeholder="数量（≥1）"/>
            <button class="btn" id="buy-bricks">购买</button>
          </div>
        </div>
      </div>
    </div>`;
  },
  bind() {
    byId("buy-keys").onclick = async () => {
      const n = parseInt(byId("key-count").value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        await API.buyKeys(n);
        alert("购买成功");
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };

    byId("buy-bricks").onclick = async () => {
      const n = parseInt(byId("brick-count").value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        await API.buyBricks(n);
        alert("购买成功");
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };
  }
};
