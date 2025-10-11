const GachaPage = {
  _timer: null,
  _skip: false,

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

      <div class="input-row">
        <input id="open-c" type="number" placeholder="开多少抽" value="10"/>
        <button class="btn" id="do-open">开！</button>
        <button class="btn" id="skip" style="display:none;">跳过动画</button>
      </div>

      <div id="open-stage"></div>
      <div id="open-result"></div>
    </div>`;
  },

  bind() {
    byId("do-open").onclick = () => this._open();
    byId("skip").onclick    = () => this._doSkip();
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

  async _open() {
    const c = +byId("open-c").value || 1;
    this._skip = false;
    byId("do-open").disabled = true;
    byId("skip").style.display = "none";
    byId("open-result").innerHTML = "";

    // ① “开砖中...”动画
    this._showStage(`<div class="glow fade-in"><span class="spinner"></span>开砖中...</div>`);

    // ② 调用后端
    let data;
    try { data = await API.open(c); }
    catch (e) {
      alert(e.message);
      byId("do-open").disabled = false;
      this._showStage("");
      return;
    }
    const list = data.results || [];
    const maxR = this._maxRarity(list);
    const glowCls = this._glowClass(maxR);
    const glowCN  = this._glowCN(maxR);

    // ③ 先显示“中文光芒提示”
    await this._sleep(1200);
    if (this._skip) return this._revealAll(list);
    this._showStage(`<div class="glow ${glowCls} fade-in">砖的颜色是...：<span class="hl-${glowCls}">${glowCN}</span></div>`);
    byId("skip").style.display = "inline-block";

    // ④ 800ms 后进入“砖皮优先鉴定”或直接逐条翻牌
    await this._sleep(800);
    if (this._skip) return this._revealAll(list);

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
      if (this._skip) return this._revealAll([...bricks, ...others]);

      const b = bricks[i];
      const item = document.createElement("div");
      item.className = "glow orange fade-in";
      item.style.marginBottom = "10px";
      item.innerHTML = `<div class="row-reveal"><span class="spinner"></span>发现砖皮 #${i+1}</div>`;
      box.appendChild(item);

      // 名称
      await this._sleep(400); if (this._skip) return this._revealAll([...bricks, ...others]);
      item.innerHTML = `<div class="row-reveal">名称：<span class="hl-orange">${b.name}</span></div>`;

      // 磨损
      await this._sleep(500); if (this._skip) return this._revealAll([...bricks, ...others]);
      item.innerHTML += `<div class="row-reveal">磨损：${b.wear}</div>`;

      // 极品/优品
      await this._sleep(600); if (this._skip) return this._revealAll([...bricks, ...others]);
      const badge = b.exquisite
        ? `<span class="badge badge-exq">极品</span>`
        : `<span class="badge badge-prem">优品</span>`;
      item.innerHTML += `<div class="row-reveal">鉴定：${badge}</div>`;

      if (window.SkinVisuals) {
        const meta = this._visualMeta(b);
        item.innerHTML += `<div class="row-reveal">${SkinVisuals.render(b.visual, { label: b.name, meta: meta })}</div>`;
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
      if (this._skip) return this._revealAll(list); // 随时可跳过
      if (i >= list.length) {
        byId("do-open").disabled = false;
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

    const rows = list.map(x=>{
      return `<tr>${this._rowHTML(x)}</tr>`;
    }).join("");

    byId("open-stage").innerHTML = "";
    byId("open-result").innerHTML = `
      <div class="card fade-in">
        <table class="table">
          ${this._tableHead()}
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    byId("do-open").disabled = false;
    this._refreshStats(); // 跳过路径也要刷新
  },

  _doSkip() { this._skip = true; },
  _sleep(ms) { return new Promise(r=>setTimeout(r, ms)); }
};
