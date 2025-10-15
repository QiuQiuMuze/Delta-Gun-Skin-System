const ShopPage = {
  _state: null,
  render() {
    return `
    <div class="card shop-card">
      <h2>商店</h2>
      <div class="shop-price" id="shop-prices">加载实时价格...</div>
      <div class="shop-board">
        <div class="shop-board__hist">
          <h3>砖价区间</h3>
          <div class="histogram" id="brick-histogram"><div class="muted">加载中...</div></div>
        </div>
        <div class="shop-board__lists">
          <div class="shop-board__column">
            <h3>玩家在售</h3>
            <div class="order-list" id="player-sell-list"><div class="muted">玩家挂单信息现已不对外公开展示。</div></div>
          </div>
          <div class="shop-board__column">
            <h3>收购委托</h3>
            <div class="order-list" id="player-buy-list"><div class="muted">收购委托列表对外不可见。</div></div>
          </div>
        </div>
      </div>
      <div class="shop-actions">
        <div class="shop-box">
          <h3>购买钥匙</h3>
          <div class="input-row">
            <input id="key-count" type="number" min="1" placeholder="数量（≥1）"/>
            <button class="btn" id="buy-keys">购买</button>
          </div>
        </div>
        <div class="shop-box">
          <h3>快速购砖</h3>
          <div class="muted small">优先匹配玩家挂单，剩余由官方供给。</div>
          <div class="input-row">
            <input id="brick-count" type="number" min="1" placeholder="数量（≥1）"/>
            <button class="btn" id="buy-bricks">购买</button>
          </div>
        </div>
      </div>
      <div class="shop-actions">
        <div class="shop-box">
          <h3>上架未开砖</h3>
          <div class="muted small">赠送资金购得的砖不可售卖。</div>
          <div class="input-row">
            <input id="sell-count" type="number" min="1" placeholder="数量（≥1）"/>
            <input id="sell-price" type="number" min="41" placeholder="单价（>40）"/>
            <button class="btn" id="sell-bricks">上架</button>
          </div>
          <div class="order-list small" id="my-sell-orders"><div class="muted">暂无挂单</div></div>
        </div>
        <div class="shop-box">
          <h3>收购委托</h3>
          <div class="muted small">达到目标价即成交，超出差价会返还。</div>
          <div class="input-row">
            <input id="buyorder-count" type="number" min="1" placeholder="数量（≥1）"/>
            <input id="buyorder-price" type="number" min="41" placeholder="目标单价（>40）"/>
            <button class="btn" id="place-buyorder">提交</button>
          </div>
          <div class="order-list small" id="my-buy-orders"><div class="muted">暂无委托</div></div>
        </div>
      </div>
    </div>`;
  },
  bind() {
    this._state = { price: null, book: null };
    const priceLine = byId("shop-prices");
    const histBox = byId("brick-histogram");
    const sellList = byId("player-sell-list");
    const buyList = byId("player-buy-list");
    const mySellList = byId("my-sell-orders");
    const myBuyList = byId("my-buy-orders");

    const renderPrice = () => {
      if (!priceLine) return;
      const price = this._state.price;
      const book = this._state.book;
      if (!price) {
        priceLine.textContent = "加载实时价格...";
        return;
      }
      const brickUnit = price.brick_price ?? "-";
      const brickRaw = typeof price.brick_price_raw === "number" ? price.brick_price_raw.toFixed(2) : price.brick_price_raw ?? "-";
      const keyPrice = price.key_price ?? "-";
      let html = `当前价格：钥匙 <b>${keyPrice}</b> 三角币 / 个，砖 <b>${brickUnit}</b> 三角币 / 个（实时 ${brickRaw}）`;
      if (book?.official_layers?.length) {
        const total = book.official_layers.reduce((acc, layer) => acc + (layer.quantity || 0), 0);
        html += ` · 官方挂单 ${total} 块`;
      }
      if (price.buy_orders_filled?.length) {
        const summary = price.buy_orders_filled.map(f => `#${f.order_id} ×${f.filled}`).join("，");
        html += `<div class="muted small">撮合完成：${summary}</div>`;
      }
      priceLine.innerHTML = html;
    };

    const renderHistogram = () => {
      if (!histBox) return;
      const hist = this._state.book?.histogram;
      if (!hist || !hist.length) {
        histBox.innerHTML = `<div class="muted">暂无数据</div>`;
        return;
      }
      const maxCount = Math.max(...hist.map(h => h.count || 0), 1);
      const rows = hist.map(bucket => {
        const pct = Math.max(6, Math.min(100, Math.round((bucket.count || 0) / maxCount * 100)));
        return `
          <div class="hist-row">
            <div class="hist-label">${bucket.min} ~ ${bucket.max}</div>
            <div class="hist-bar">
              <div class="hist-bar__fill" style="width:${pct}%"></div>
              <span class="hist-bar__count">${bucket.count}</span>
            </div>
          </div>`;
      }).join("");
      histBox.innerHTML = rows;
    };

    const renderOrderSection = (el, items, opts = {}) => {
      if (!el) return;
      if (!items || !items.length) {
        el.innerHTML = `<div class="muted">${opts.empty || "暂无数据"}</div>`;
        return;
      }
      el.innerHTML = items.map(item => {
        const cancelBtn = opts.allowCancel ? `<button class="btn btn-mini" data-action="${opts.cancelAction}" data-id="${item.id}">撤销</button>` : "";
        const meta = opts.type === "buy"
          ? `目标 ${item.price} · 剩余 ${item.remaining}`
          : `${item.price} / 剩余 ${item.remaining}`;
        const seller = item.seller ? `<span class="order-meta">${escapeHtml(item.seller)}</span>` : "";
        return `
          <div class="order-row">
            <div>
              <span class="price-tag">${item.price}</span>
              <span>${meta}</span>
              ${seller}
            </div>
            ${cancelBtn}
          </div>`;
      }).join("");
    };

    const renderOrders = () => {
      const book = this._state.book;
      renderOrderSection(mySellList, book?.my_sells || [], { empty: "暂无挂单", allowCancel: true, cancelAction: "cancel-sell" });
      renderOrderSection(myBuyList, book?.my_buys || [], { empty: "暂无委托", allowCancel: true, cancelAction: "cancel-buy", type: "buy" });
    };

    const loadPrices = async () => {
      try {
        this._state.price = await API.shopPrices();
        renderPrice();
      } catch (e) {
        if (priceLine) priceLine.textContent = `加载价格失败：${e.message || e}`;
      }
    };

    const loadBook = async () => {
      try {
        this._state.book = await API.brickBook();
        renderPrice();
        renderHistogram();
        renderOrders();
      } catch (e) {
        if (sellList) sellList.innerHTML = `<div class="muted">加载失败：${e.message || e}</div>`;
        if (buyList) buyList.innerHTML = `<div class="muted">加载失败：${e.message || e}</div>`;
      }
    };

    const keyInput = byId("key-count");
    const brickInput = byId("brick-count");
    const sellCount = byId("sell-count");
    const sellPrice = byId("sell-price");
    const buyCount = byId("buyorder-count");
    const buyPrice = byId("buyorder-price");

    byId("buy-keys").onclick = async () => {
      const n = parseInt(keyInput.value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        const ret = await API.buyKeys(n);
        if (ret && typeof ret.coins === "number") {
          API._me = { ...(API._me || {}), coins: ret.coins, keys: ret.keys };
        } else {
          await API.me();
        }
        alert("购买成功");
        await loadPrices();
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };

    byId("buy-bricks").onclick = async () => {
      const n = parseInt(brickInput.value, 10) || 0;
      if (n <= 0) return alert("数量必须 ≥ 1");
      try {
        const quote = await API.brickQuote(n);
        const parts = quote?.segments?.map(seg => `${seg.source === "player" ? "玩家" : "官方"} ${seg.price} ×${seg.quantity}`) || [];
        const msgLines = [`将购入 ${n} 块砖，预计花费 ${quote?.total_cost || 0} 三角币。`];
        if (parts.length) msgLines.push(`拆分：${parts.join("，")}`);
        msgLines.push("是否继续？");
        if (!confirm(msgLines.join("\n"))) return;
        const res = await API.buyBricks(n);
        if (res && typeof res.coins === "number") {
          API._me = {
            ...(API._me || {}),
            coins: res.coins,
            unopened_bricks: res.unopened_bricks,
          };
        } else {
          await API.me();
        }
        const segmentText = res?.segments?.map(seg => `${seg.source === "player" ? "玩家" : "官方"} ${seg.price} ×${seg.quantity}`).join("，");
        const extra = segmentText ? `成交明细：${segmentText}` : "";
        alert([`购砖成功，花费 ${res?.spent ?? quote?.total_cost ?? 0} 三角币。`, extra].filter(Boolean).join("\n"));
        await Promise.all([loadPrices(), loadBook()]);
      } catch (e) {
        alert(e.message || "购买失败");
      }
    };

    byId("sell-bricks").onclick = async () => {
      const qty = parseInt(sellCount.value, 10) || 0;
      const price = parseInt(sellPrice.value, 10) || 0;
      if (qty <= 0) return alert("数量必须 ≥ 1");
      if (price <= 40) return alert("单价必须大于 40");
      try {
        const res = await API.brickSell(qty, price);
        alert(`已上架 ${qty} 块砖（#${res.order_id}）。`);
        sellCount.value = "";
        sellPrice.value = "";
        if (API._me) {
          API._me = { ...API._me, unopened_bricks: Math.max(0, (API._me.unopened_bricks || 0) - qty) };
        } else {
          await API.me();
        }
        await loadBook();
      } catch (e) {
        alert(e.message || "上架失败");
      }
    };

    byId("place-buyorder").onclick = async () => {
      const qty = parseInt(buyCount.value, 10) || 0;
      const price = parseInt(buyPrice.value, 10) || 0;
      if (qty <= 0) return alert("数量必须 ≥ 1");
      if (price <= 40) return alert("目标单价必须大于 40");
      try {
        const res = await API.brickBuyOrder(qty, price);
        let msg;
        if (res.filled) {
          const filledQty = res.filled.filled || 0;
          const avgPrice = res.filled.avg_price ? Number(res.filled.avg_price).toFixed(2) : null;
          const refund = res.filled.refund || 0;
          const parts = [`已成交 ${filledQty} 块`];
          if (avgPrice) parts.push(`成交均价 ${avgPrice}`);
          if (refund > 0) parts.push(`由于以更低价格成交，返还 ${refund} 三角币`);
          msg = parts.join("，") + "。";
        } else {
          msg = "委托已锁定，待价格满足后成交。";
        }
        alert(`委托创建成功（#${res.order_id}）。${msg}`);
        buyCount.value = "";
        buyPrice.value = "";
        await Promise.all([loadPrices(), loadBook(), API.me()]);
      } catch (e) {
        alert(e.message || "提交失败");
      }
    };

    const handleCancel = async (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10) || 0;
      if (!id) return;
      try {
        if (btn.dataset.action === "cancel-sell") {
          await API.brickCancelSell(id);
        } else if (btn.dataset.action === "cancel-buy") {
          await API.brickCancelBuyOrder(id);
        }
        await Promise.all([loadPrices(), loadBook(), API.me()]);
      } catch (e) {
        alert(e.message || "撤销失败");
      }
    };

    [sellList, mySellList, buyList, myBuyList].forEach(el => {
      if (el) el.addEventListener("click", handleCancel);
    });

    loadPrices();
    loadBook();
  }
};
