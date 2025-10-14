// 商店：展示单价说明（钥匙=60、砖=100），购买逻辑沿用原接口
const ShopPage = {
  render() {
    return `
    <div class="card">
      <h2>商店</h2>
      <div class="muted" id="shop-prices">加载实时价格...</div>
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
    const priceLine = byId("shop-prices");

    const renderPrice = (data) => {
      if (!data) {
        priceLine.textContent = "无法获取价格";
        return;
      }
      const keyPrice = Number(data.key_price || 0);
      const brickUnit = Number(data.brick_price || 0);
      const brickRaw = typeof data.brick_price_raw === "number"
        ? data.brick_price_raw.toFixed(2)
        : Number(data.brick_price_raw || brickUnit).toFixed(2);
      priceLine.innerHTML = `当前价格：钥匙 <b>${keyPrice}</b> 三角币 / 个，砖 <b>${brickUnit}</b> 三角币 / 个（实时 ${brickRaw}）`;
    };

    const loadPrices = async () => {
      try {
        const data = await API.shopPrices();
        renderPrice(data);
      } catch (e) {
        priceLine.textContent = `加载价格失败：${e.message || e}`;
      }
    };

    loadPrices();

    byId("buy-keys").onclick = async () => {
      const n = parseInt(byId("key-count").value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        await API.buyKeys(n);
        alert("购买成功");
        await loadPrices();
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };

    byId("buy-bricks").onclick = async () => {
      const n = parseInt(byId("brick-count").value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        const res = await API.buyBricks(n);
        const priceInfo = res?.brick_price ? ` 当前砖价 ${res.brick_price} 三角币 / 个。` : "";
        alert(`购买成功。${priceInfo}`.trim());
        await loadPrices();
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };
  }
};
