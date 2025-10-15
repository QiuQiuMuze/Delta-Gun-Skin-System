const ShopPage = {
  _state: null,
  _seasonCatalog: [],
  _seasonMap: {},
  _selectedSeason: null,
  async render() {
    const catalog = await API.seasonCatalog().catch(() => ({ seasons: [], latest: null }));
    this._seasonCatalog = Array.isArray(catalog?.seasons) ? catalog.seasons : [];
    this._seasonMap = {};
    this._seasonCatalog.forEach(season => {
      if (!season?.id) return;
      this._seasonMap[season.id] = season;
      this._seasonMap[String(season.id).toUpperCase()] = season;
    });
    if (!this._selectedSeason) {
      this._selectedSeason = catalog?.latest || (this._seasonCatalog[0]?.id ?? "ALL");
    }
    const escName = (typeof escapeHtml === 'function') ? escapeHtml : (v => String(v ?? ""));
    const seasonOptions = ['<option value="ALL">全部赛季</option>']
      .concat(this._seasonCatalog.map(season => {
        const selected = this._selectedSeason === season.id ? 'selected' : '';
        return `<option value="${season.id}" ${selected}>${escName(season.name || season.id)}</option>`;
      }))
      .join("");
    const seasonPanel = this._renderSeasonCatalog(this._selectedSeason);
    const isAdmin = !!(API._me && API._me.is_admin);
    const brickSeasonOptions = ['<option value="">自动匹配（最新赛季）</option>']
      .concat(this._seasonCatalog.map(season => `<option value="${season.id}">${escName(season.name || season.id)}</option>`)).join("");
    const sellSeasonOptions = ['<option value="">请选择赛季</option>']
      .concat(this._seasonCatalog.map(season => `<option value="${season.id}">${escName(season.name || season.id)}</option>`)).join("");
    return `
    <div class="card shop-card">
      <h2>商店</h2>
      <div class="shop-price" id="shop-prices">加载实时价格...</div>
      <div class="shop-season" id="shop-season-board">
        <div class="input-row">
          <label class="input-label" for="shop-season-select">赛季枪皮</label>
          <select id="shop-season-select">${seasonOptions}</select>
        </div>
        <div class="shop-season__catalog" id="shop-season-catalog">${seasonPanel}</div>
      </div>
      <div class="shop-board">
        <div class="shop-board__hist">
          <h3>砖价区间</h3>
          <div class="histogram" id="brick-histogram"><div class="muted">加载中...</div></div>
        </div>
        ${isAdmin ? `
        <div class="shop-board__lists">
          <div class="shop-board__column">
            <h3>玩家在售</h3>
            <div class="order-list" id="player-sell-list"><div class="muted">暂无玩家挂单</div></div>
          </div>
          <div class="shop-board__column">
            <h3>收购委托</h3>
            <div class="order-list" id="player-buy-list"><div class="muted">暂无收购委托</div></div>
          </div>
        </div>` : ``}
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
          <div class="muted small">优先匹配玩家挂单。</div>
          <div class="input-row">
            <input id="brick-count" type="number" min="1" placeholder="数量（≥1）"/>
            <select id="buy-brick-season">${brickSeasonOptions}</select>
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
            <input id="sell-price" type="number" min="40" placeholder="单价（≥40）"/>
            <select id="sell-season">${sellSeasonOptions}</select>
            <button class="btn" id="sell-bricks">上架</button>
          </div>
          <div class="order-list small" id="my-sell-orders"><div class="muted">暂无挂单</div></div>
        </div>
        <div class="shop-box">
          <h3>收购委托</h3>
          <div class="muted small">达到目标价即成交，超出差价会返还。</div>
          <div class="input-row">
            <input id="buyorder-count" type="number" min="1" placeholder="数量（≥1）"/>
            <input id="buyorder-price" type="number" min="40" placeholder="目标单价（≥40）"/>
            <button class="btn" id="place-buyorder">提交</button>
          </div>
          <div class="order-list small" id="my-buy-orders"><div class="muted">暂无委托</div></div>
        </div>
      </div>
    </div>`;
  },
  _renderSeasonCatalog(seasonId) {
    if (!this._seasonCatalog.length) {
      return `<div class="muted">暂无赛季数据。</div>`;
    }
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v => String(v ?? ""));
    if (!seasonId || seasonId === "ALL") {
      const groups = [
        { key: "bricks", title: "砖皮", cls: "hl-orange" },
        { key: "purples", title: "紫皮", cls: "hl-purple" },
        { key: "blues", title: "蓝皮", cls: "hl-blue" },
        { key: "greens", title: "绿皮", cls: "hl-green" }
      ];
      const cards = this._seasonCatalog.map(entry => {
        const chips = groups.map(group => {
          const count = Array.isArray(entry[group.key]) ? entry[group.key].length : 0;
          return `<span class="shop-season__chip ${group.cls}">${group.title}×${count}</span>`;
        }).join("");
        const tagline = entry.tagline ? `<div class="shop-season__card-meta">主题：${esc(entry.tagline)}</div>` : "";
        const desc = entry.description ? `<div class="shop-season__card-desc">${esc(entry.description)}</div>` : "";
        return `<div class="shop-season__card">
          <h4>${esc(entry.name || entry.id)}</h4>
          ${tagline}
          ${desc}
          <div class="shop-season__card-counts">${chips}</div>
        </div>`;
      }).join("");
      return cards ? `<div class="shop-season__grid">${cards}</div>` : `<div class="muted">暂无赛季数据。</div>`;
    }
    const key = String(seasonId);
    let entry = this._seasonMap[key] || this._seasonMap[key.toUpperCase()];
    if (!entry) {
      entry = this._seasonCatalog.find(s => String(s.id) === key || String(s.id).toUpperCase() === key.toUpperCase());
    }
    if (!entry) return `<div class="muted">暂无赛季数据。</div>`;
    const groups = [
      { key: "bricks", title: "砖皮", cls: "hl-orange" },
      { key: "purples", title: "紫皮", cls: "hl-purple" },
      { key: "blues", title: "蓝皮", cls: "hl-blue" },
      { key: "greens", title: "绿皮", cls: "hl-green" }
    ];
    const listHtml = groups.map(group => {
      const list = entry[group.key] || [];
      const items = list.length
        ? list.map(item => `<li class="${group.cls}">${esc(item.name || item.skin_id || '未知皮肤')}</li>`).join("")
        : '<li class="muted">暂无</li>';
      return `<div class="shop-season__group shop-season__group--${group.key}">
        <h4>${group.title}（${list.length}）</h4>
        <ul>${items}</ul>
      </div>`;
    }).join("");
    const tagline = entry.tagline ? `<div class="shop-season__tagline">主题：${esc(entry.tagline)}</div>` : "";
    const desc = entry.description ? `<div class="shop-season__desc">${esc(entry.description)}</div>` : "";
    return `<div class="shop-season__meta">${tagline}${desc}</div><div class="shop-season__groups">${listHtml}</div>`;
  },
  bind() {
    this._state = { price: null, book: null };
    const isAdmin = !!(API._me && API._me.is_admin);
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
      if (Array.isArray(price.season_prices) && price.season_prices.length) {
        const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v => String(v ?? ""));
        const items = price.season_prices.map(sp => `<li>${esc(sp.name || sp.season || '未知赛季')}：<b>${sp.price}</b></li>`).join("");
        html += `<div class="muted small">赛季砖价：<ul class="inline-list">${items}</ul></div>`;
      }
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
        const seasonLabel = item.season_name || item.season;
        const seasonMeta = seasonLabel ? `<span class="order-meta">赛季：${escapeHtml(seasonLabel)}</span>` : "";
        return `
          <div class="order-row">
            <div>
              <span class="price-tag">${item.price}</span>
              <span>${meta}</span>
              ${seller}${seasonMeta}
            </div>
            ${cancelBtn}
          </div>`;
      }).join("");
    };

    const renderOrders = () => {
      const book = this._state.book;
      if (isAdmin) {
        renderOrderSection(sellList, book?.player_sells || [], { empty: "暂无玩家挂单" });
        renderOrderSection(buyList, book?.player_buys || [], { empty: "暂无收购委托", type: "buy" });
      }
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
    const buySeasonSelect = byId("buy-brick-season");
    const sellSeasonSelect = byId("sell-season");
    const seasonSelect = byId("shop-season-select");
    const seasonCatalogBox = byId("shop-season-catalog");
    if (seasonSelect && seasonCatalogBox) {
      seasonSelect.addEventListener('change', () => {
        this._selectedSeason = seasonSelect.value || "ALL";
        seasonCatalogBox.innerHTML = this._renderSeasonCatalog(this._selectedSeason);
      });
    }

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
        const seasonValue = buySeasonSelect ? (buySeasonSelect.value || "") : "";
        const quote = await API.brickQuote(n, seasonValue || null);
        const parts = quote?.segments?.map(seg => {
          const source = seg.source === "player" ? "玩家" : "官方";
          const seasonLabel = seg.season_name || seg.season || "默认";
          return `${source} ${seasonLabel} ${seg.price} ×${seg.quantity}`;
        }) || [];
        const seasonLabel = seasonValue ? (this._seasonMap[seasonValue]?.name || seasonValue) : "自动匹配";
        const msgLines = [`将购入 ${n} 块砖（赛季：${seasonLabel}），预计花费 ${quote?.total_cost || 0} 三角币。`];
        if (parts.length) msgLines.push(`拆分：${parts.join("，")}`);
        msgLines.push("是否继续？");
        if (!confirm(msgLines.join("\n"))) return;
        const res = await API.buyBricks(n, seasonValue || null);
        if (res && typeof res.coins === "number") {
          API._me = {
            ...(API._me || {}),
            coins: res.coins,
            unopened_bricks: res.unopened_bricks,
          };
        } else {
          await API.me();
        }
        const segmentText = res?.segments?.map(seg => {
          const source = seg.source === "player" ? "玩家" : "官方";
          const seasonLabel = seg.season ? (this._seasonMap[seg.season]?.name || seg.season) : (seg.season_name || "默认");
          return `${source} ${seasonLabel} ${seg.price} ×${seg.quantity}`;
        }).join("，");
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
      if (price < 40) return alert("单价必须 ≥ 40");
      const sellSeason = sellSeasonSelect ? (sellSeasonSelect.value || "") : "";
      if (!sellSeason) return alert("请选择上架的赛季");
      try {
        const res = await API.brickSell(qty, price, sellSeason);
        const seasonLabel = this._seasonMap[sellSeason]?.name || sellSeason;
        alert(`已上架 ${qty} 块 ${seasonLabel} 砖（#${res.order_id}）。`);
        sellCount.value = "";
        sellPrice.value = "";
        if (sellSeasonSelect) sellSeasonSelect.value = "";
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
      if (price < 40) return alert("目标单价必须 ≥ 40");
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
