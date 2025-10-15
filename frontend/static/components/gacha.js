const GachaPage = {
  _timer: null,
  _skip: false,
  _currentResults: null,
  _drawButtons: null,
  _opening: false,

  async render() {
    const me = await API.me();
    const od = await API.odds();
    const odds = od.odds || od;
    const lim = od.limits || { brick_pity_max:75, purple_pity_max:20 };
    const left_brick  = Math.max(0, lim.brick_pity_max  - (odds.pity_brick  + 1));
    const left_purple = Math.max(0, lim.purple_pity_max - (odds.pity_purple + 1));

    return `
    <div class="card"><h2>开砖</h2>
      <div class="grid cols-3">
        <div class="kv"><div class="k">钥匙</div><div class="v" id="stat-keys">${me.keys}</div></div>
        <div class="kv"><div class="k">未开砖</div><div class="v" id="stat-bricks">${me.unopened_bricks}</div></div>
        <div class="kv"><div class="k">三角币</div><div class="v" id="stat-coins">${me.coins}</div></div>
      </div>

      <div class="kv"><div class="k">当前概率</div>
        <div class="v">
          <span class="hl-orange">砖 <span id="od-brick">${odds.brick}</span>%</span> · 
          <span class="hl-purple">紫 <span id="od-purple">${odds.purple}</span>%</span> ·
          <span class="hl-blue">蓝 <span id="od-blue">${odds.blue}</span>%</span> ·
          <span class="hl-green">绿 <span id="od-green">${odds.green}</span>%</span>
        </div>
      </div>

      <div class="kv"><div class="k">保底计数</div><div class="v">
        未出砖：<span id="pity-brick">${odds.pity_brick}</span>（还差 <span id="left-brick">${left_brick}</span> 抽必出）；
        未出紫：<span id="pity-purple">${odds.pity_purple}</span>（还差 <span id="left-purple">${left_purple}</span> 抽保底）
      </div></div>

      <div id="open-stage" class="open-stage"></div>
      <div id="open-result"></div>
      <div class="draw-actions">
        <div class="draw-panels">
          <button class="draw-panel draw-btn draw-btn-single" data-count="1">
            <span class="draw-panel__title">单抽</span>
            <span class="draw-panel__desc">消耗 1 把钥匙 + 1 块未开砖</span>
          </button>
          <button class="draw-panel draw-btn draw-btn-ten" data-count="10">
            <span class="draw-panel__title">十连</span>
            <span class="draw-panel__desc">消耗 10 把钥匙 + 10 块未开砖</span>
          </button>
        </div>
        <div class="draw-helper">
          <button class="btn ghost" id="skip" style="display:none;">跳过动画</button>
        </div>
      </div>
    </div>`;
  },

  bind() {
    byId("skip").onclick    = () => this._doSkip();
    this._drawButtons = Array.from(document.querySelectorAll(".draw-btn[data-count]"));
    this._drawButtons.forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (this._opening) return;
        const val = parseInt(btn.dataset.count || "0", 10);
        if (val === 1 || val === 10) {
          this._open(val);
        }
      });
    });
  },

  // —— 抽完后刷新顶部 & 概率/保底 —— //
  async _refreshStats() {
    try {
      const [me, od] = await Promise.all([API.me(), API.odds()]);
      // 钱包/库存
      byId("stat-keys").textContent   = me.keys;
      byId("stat-bricks").textContent = me.unopened_bricks;
      byId("stat-coins").textContent  = me.coins;
      // 概率
      const odds = od.odds || od;
      byId("od-brick").textContent  = odds.brick;
      byId("od-purple").textContent = odds.purple;
      byId("od-blue").textContent   = odds.blue;
      byId("od-green").textContent  = odds.green;
      // 保底计数与“还差X抽”
      const lim = od.limits || { brick_pity_max:75, purple_pity_max:20 };
      const left_brick  = Math.max(0, lim.brick_pity_max  - (odds.pity_brick  + 1));
      const left_purple = Math.max(0, lim.purple_pity_max - (odds.pity_purple + 1));
      byId("pity-brick").textContent  = odds.pity_brick;
      byId("pity-purple").textContent = odds.pity_purple;
      byId("left-brick").textContent  = left_brick;
      byId("left-purple").textContent = left_purple;
    } catch (_) {}
  },

  _rarityClass(r) {
    if (r === "BRICK") return "hl-orange";
    if (r === "PURPLE") return "hl-purple";
    if (r === "BLUE") return "hl-blue";
    return "hl-green";
  },
  _gradeClass(g) { return { "S":"grade-s", "A":"grade-a", "B":"grade-b", "C":"grade-c" }[g] || ""; },
  _glowClass(maxR) { return maxR==="BRICK" ? "orange" : maxR==="PURPLE" ? "purple" : maxR==="BLUE" ? "blue" : "green"; },
  _glowCN(maxR)    { return maxR==="BRICK" ? "橙色"  : maxR==="PURPLE" ? "紫色"   : maxR==="BLUE" ? "蓝色"   : "绿色"; },
  _maxRarity(list) {
    if (list.some(x=>x.rarity==="BRICK")) return "BRICK";
    if (list.some(x=>x.rarity==="PURPLE")) return "PURPLE";
    if (list.some(x=>x.rarity==="BLUE")) return "BLUE";
    return "GREEN";
  },
  _tableHead() {
    return `<thead><tr><th>名称</th><th>外观</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th></tr></thead>`;
  },
  _renderPreviewCell(x, opts = {}) {
    if (!window.SkinVisuals) return "-";
    const visual = x.visual || {
      body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects
    };
    const html = SkinVisuals.render(visual, { compact: true, meta: opts.metaText ?? false });
    return `<div class="market-preview-cell">${html}</div>`;
  },
  _visualMeta(x) {
    if (!window.SkinVisuals) return "";
    const info = SkinVisuals.describe(x.visual || {
      body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects
    });
    const parts = [
      `主体：${info.bodyText}`,
      `配件：${info.attachmentText}`
    ];
    const meta = SkinVisuals.formatMeta(x.visual || {
      body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects
    });
    parts.push(meta);
    return parts.join(" · ");
  },
  _rowHTML(x) {
    const rc = this._rarityClass(x.rarity);
    const gc = this._gradeClass(x.grade);
    const exBadge = x.rarity==="BRICK"
      ? (x.exquisite ? `<span class="badge badge-exq">极品</span>`
                     : `<span class="badge badge-prem">优品</span>` )
      : "-";
    const previewMeta = this._visualMeta(x);
    const preview = this._renderPreviewCell(x, { metaText: previewMeta });
    return `
      <td class="${rc}">${x.name}</td>
      <td>${preview}</td>
      <td class="${rc}">${x.rarity}</td>
      <td>${exBadge}</td>
      <td>${x.wear}</td>
      <td class="${gc}">${x.grade}</td>
      <td>${x.serial}</td>
    `;
  },
  _showStage(html) { byId("open-stage").innerHTML = html; },

  _setDrawDisabled(disabled) {
    (this._drawButtons || []).forEach(btn => {
      btn.disabled = !!disabled;
    });
  },

  async _ensureResources(count) {
    if (!count) return;
    let me;
    try {
      me = await API.me();
    } catch (_) {
      return;
    }
    const needs = {
      keys: Math.max(0, count - (me.keys ?? 0)),
      bricks: Math.max(0, count - (me.unopened_bricks ?? 0))
    };
    if (needs.keys <= 0 && needs.bricks <= 0) return;

    let keyCost = 0;
    let keyUnit = 0;
    let brickQuote = null;
    if (needs.keys > 0) {
      try {
        const prices = await API.shopPrices();
        const price = Number(prices?.key_price || 0);
        keyUnit = price;
        keyCost = price * needs.keys;
      } catch (e) {
        throw new Error(e?.message || "无法获取钥匙价格");
      }
    }
    if (needs.bricks > 0) {
      brickQuote = await API.brickQuote(needs.bricks);
    }

    const parts = [];
    if (needs.keys > 0) {
      const unit = keyUnit ? `（单价 ${keyUnit} 三角币，共 ${keyCost}）` : "";
      parts.push(`钥匙 ×${needs.keys}${unit}`);
    }
    if (needs.bricks > 0) {
      const brickCost = brickQuote?.total_cost || 0;
      const unit = needs.bricks > 0 ? `（预计 ${brickCost} 三角币）` : "";
      parts.push(`未开砖 ×${needs.bricks}${unit}`);
    }
    const detail = [];
    if (brickQuote?.segments?.length) {
      brickQuote.segments.forEach(seg => {
        const label = seg.source === "player" ? "玩家" : "官方";
        detail.push(`${label} ${seg.price} ×${seg.quantity}`);
      });
    }
    const totalCost = keyCost + (brickQuote?.total_cost || 0);
    const intro = totalCost > 0
      ? `当前钥匙/砖不足，将自动购入所需资源，预计额外花费 ${totalCost} 三角币：`
      : "当前钥匙/砖不足，将自动购买：";
    const lines = [intro, ...parts];
    if (detail.length) {
      lines.push(`预计拆分：${detail.join("，")}`);
    }
    lines.push("是否继续？");
    if (!confirm(lines.join("\n"))) {
      throw { message: "" };
    }
    if (needs.keys > 0) {
      await API.buyKeys(needs.keys);
    }
    if (needs.bricks > 0) {
      await API.buyBricks(needs.bricks);
    }
    await this._refreshStats();
  },

  async _open(count = 1) {
    const c = [1, 10].includes(count) ? count : 1;
    this._skip = false;
    this._opening = true;
    this._setDrawDisabled(true);
    byId("skip").style.display = "none";
    byId("open-result").innerHTML = "";

    // 自动补购所需钥匙/砖
    try {
      await this._ensureResources(c);
    } catch (err) {
      this._opening = false;
      this._setDrawDisabled(false);
      if (err?.message) alert(err.message);
      return;
    }

    // ① “开砖中...”动画
    this._showStage(`<div class="glow fade-in"><span class="spinner"></span>开砖中...</div>`);

    // ② 调用后端
    let data;
    try { data = await API.open(c); }
    catch (e) {
      alert(e.message);
      this._setDrawDisabled(false);
      this._opening = false;
      this._showStage("");
      return;
    }
    const list = data.results || [];
    this._currentResults = list.slice();
    this._notifyDiamonds(list);
    const maxR = this._maxRarity(list);
    const glowCls = this._glowClass(maxR);
    const glowCN  = this._glowCN(maxR);

    // ③ 先显示“中文光芒提示”
    await this._sleep(1200);
    if (this._skip) return this._revealAll();
    this._showStage(`<div class="glow ${glowCls} fade-in">砖的颜色是...：<span class="hl-${glowCls}">${glowCN}</span></div>`);
    byId("skip").style.display = "inline-block";

    // ④ 800ms 后进入“砖皮优先鉴定”或直接逐条翻牌
    await this._sleep(800);
    if (this._skip) return this._revealAll();

    const bricks = list.filter(x=>x.rarity==="BRICK");
    const others = list.filter(x=>x.rarity!=="BRICK");
    if (bricks.length) {
      await this._revealBricksThenOthers(bricks, others);
    } else {
      this._revealSequential(others, /*done*/true); // 只有非砖皮
    }
  },

  // —— 砖皮优先鉴定 —— //
  async _revealBricksThenOthers(bricks, others) {
    // 鉴定面板
    this._showStage(`
      <div class="card fade-in">
        <h3 class="hl-orange">砖皮鉴定</h3>
        <div id="brick-inspect"></div>
      </div>
    `);

    const box = byId("brick-inspect");

    // 逐把展示：名称 → 磨损 → 极品/优品
    for (let i = 0; i < bricks.length; i++) {
      if (this._skip) return this._revealAll();

      const b = bricks[i];
      const item = document.createElement("div");
      item.className = "glow orange fade-in";
      item.style.marginBottom = "10px";
      box.appendChild(item);

      const titleRow = document.createElement("div");
      titleRow.className = "row-reveal";
      titleRow.innerHTML = `<span class="spinner"></span>发现砖皮 #${i+1}`;
      item.appendChild(titleRow);

      await this._sleep(400); if (this._skip) return this._revealAll();
      titleRow.innerHTML = `名称：<span class="hl-orange">${b.name}</span>`;

      await this._sleep(500); if (this._skip) return this._revealAll();
      const wearRow = document.createElement("div");
      wearRow.className = "row-reveal";
      wearRow.innerHTML = `磨损：<span class="wear-value">0.000</span>`;
      item.appendChild(wearRow);
      const wearValue = wearRow.querySelector(".wear-value");
      this._animateWear(wearValue, b.wear);

      await this._sleep(600); if (this._skip) return this._revealAll();
      let suspenseNode = null;
      if (b.exquisite || b.exquisite === false) {
        const isDiamond = this._isDiamondTemplate(b.template) || this._isDiamondTemplate(b.hidden_template);
        const suspenseMs = isDiamond ? 8000 : (b.exquisite ? 4000 : 2500);
        const message = isDiamond ? "钻石覆盖中..." : (b.exquisite ? "极品鉴定中..." : "优品鉴定中...");
        suspenseNode = this._buildSuspenseRow(message, { diamond: isDiamond });
        item.appendChild(suspenseNode);
        await this._sleep(suspenseMs);
        if (this._skip) return this._revealAll();
        suspenseNode.remove();
      }

      const badge = b.exquisite
        ? `<span class="badge badge-exq">极品</span>`
        : `<span class="badge badge-prem">优品</span>`;
      const judgeRow = document.createElement("div");
      judgeRow.className = "row-reveal";
      judgeRow.innerHTML = `鉴定：${badge}`;
      item.appendChild(judgeRow);

      if (window.SkinVisuals) {
        await this._sleep(300); if (this._skip) return this._revealAll();
        const meta = this._visualMeta(b);
        const visual = b.visual || {
          body: [], attachments: [], template: b.template, hidden_template: b.hidden_template, effects: b.effects
        };
        const previewRow = document.createElement("div");
        previewRow.className = "row-reveal";
        previewRow.innerHTML = SkinVisuals.render(visual, { label: b.name, meta: meta });
        item.appendChild(previewRow);
      }
    }

    // 结束砖皮鉴定，展示汇总表：先列砖皮，再逐条翻其它
    const tblHead = `
      <div class="card fade-in">
        <table class="table">
          ${this._tableHead()}
          <tbody id="rev-body"></tbody>
        </table>
      </div>`;
    byId("open-result").innerHTML = tblHead;

    // 先把砖皮全部落表（已揭晓过）
    const body = byId("rev-body");
    for (const b of bricks) {
      const tr = document.createElement("tr");
      tr.className = "row-reveal";
      tr.innerHTML = this._rowHTML(b);
      body.appendChild(tr);
      await this._sleep(120); // 轻微间隔
    }

    // 再逐条翻其它
    this._revealSequential(others, /*done*/true);
  },

  // —— 逐条翻牌：list 可以是“其它”或者“全部” —— //
  _revealSequential(list, doneAfter = false) {
    // 如果表格未建，则建表
    if (!byId("rev-body")) {
      byId("open-result").innerHTML = `
        <div class="card fade-in">
          <table class="table">
            ${this._tableHead()}
            <tbody id="rev-body"></tbody>
          </table>
        </div>`;
    }
    const body = byId("rev-body");

    let i = 0;
    const step = () => {
      if (this._skip) return this._revealAll(); // 随时可跳过
      if (i >= list.length) {
        this._setDrawDisabled(false);
        this._opening = false;
        this._showStage("");      // 清掉上方阶段区
        this._refreshStats();     // 抽完刷新保底/概率/库存
        return;
      }
      const x = list[i++];
      const tr = document.createElement("tr");
      tr.className = "row-reveal";
      tr.innerHTML = this._rowHTML(x);
      body.appendChild(tr);
      this._timer = setTimeout(step, Math.min(650, 250 + i*25));
    };
    step();
  },

  _revealAll(list) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    byId("skip").style.display = "none";

    const source = list ?? this._currentResults ?? [];
    const bricks = [];
    const others = [];
    for (const item of source) {
      const rarity = String(item.rarity || "").toUpperCase();
      if (rarity === "BRICK") bricks.push(item);
      else others.push(item);
    }
    const ordered = [...bricks, ...others];
    const rows = ordered.map(x=>`<tr>${this._rowHTML(x)}</tr>`).join("");
    const brickNote = bricks.length
      ? `<div class="muted">跳过动画模式下已直接展示砖皮详情，并置顶本次的 ${bricks.length} 件砖皮。</div>`
      : "";
    const tableHTML = ordered.length
      ? `<table class="table">${this._tableHead()}<tbody>${rows}</tbody></table>`
      : `<div class="muted">本次未获得物品。</div>`;

    byId("open-stage").innerHTML = "";
    byId("open-result").innerHTML = `
      <div class="card fade-in">
        ${brickNote}
        ${tableHTML}
      </div>`;
    this._setDrawDisabled(false);
    this._opening = false;
    this._refreshStats(); // 跳过路径也要刷新
    this._currentResults = null;
  },

  _buildSuspenseRow(message = "鉴定中...", opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = "row-reveal suspense-wrap";
    const diamondCls = opts.diamond ? " diamond" : "";
    wrap.innerHTML = `<div class="suspense-glow${diamondCls}"><span class="spinner"></span>${message}</div>`;
    return wrap;
  },

  _isDiamondTemplate(name) {
    if (!name) return false;
    const key = String(name).toLowerCase();
    return key.includes("white_diamond") || key.includes("yellow_diamond") || key.includes("pink_diamond");
  },

  _notifyDiamonds(list) {
    if (!Array.isArray(list) || !window.Notifier || typeof window.Notifier.pushDiamond !== "function") return;
    const diamonds = list.filter(item => this._isDiamondTemplate(item?.template) || this._isDiamondTemplate(item?.hidden_template));
    if (!diamonds.length) return;
    const username = (API._me && API._me.username) ? API._me.username : "你";
    diamonds.forEach(item => {
      try {
        window.Notifier.pushDiamond({ username, item });
      } catch (_) {}
    });
  },

  _animateWear(el, value, duration = 1200) {
    if (!el) return;
    const final = typeof value === "number" ? value : parseFloat(value);
    if (!isFinite(final)) {
      el.textContent = value ?? "-";
      return;
    }
    el.textContent = "0.000";
    const start = performance.now();
    const total = Math.max(400, duration);
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    const self = this;
    const finalText = typeof value === "string" ? value : final.toFixed(3);
    const tick = (now) => {
      if (self._skip) {
        el.textContent = finalText;
        return;
      }
      const progress = Math.min(1, (now - start) / total);
      const eased = ease(progress);
      el.textContent = (final * eased).toFixed(3);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
  },

  _doSkip() { this._skip = true; },
  _sleep(ms) { return new Promise(r=>setTimeout(r, ms)); }
};
