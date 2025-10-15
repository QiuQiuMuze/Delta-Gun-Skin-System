const InventoryPage = {
  _cache: {},
  _activePreviewBtn: null,
  async render() {
    const blocks = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2>背包</h2>
          <div>
            <button class="btn" id="inv-refresh">刷新</button>
          </div>
        </div>
      </div>
      <div id="inv-panels">${this._skeleton()}</div>
    `;
    // 先渲染骨架，再拉数据
    setTimeout(()=>this._loadAndRender(), 0);
    return blocks;
  },
  bind() {
    const ref = document.getElementById("inv-refresh");
    if (ref) ref.onclick = () => this._loadAndRender(true);
  },

  _skeleton() {
    const sec = (title) => `
      <div class="card">
        <h3>${title}（0）</h3>
        <table class="table">
          <thead><tr><th>inv_id</th><th>名称</th><th>稀有度</th><th>极品</th><th>磨损</th><th>品质</th><th>编号</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    return `${sec("砖皮")}${sec("紫")}${sec("蓝")}${sec("绿")}`;
  },

  async _loadAndRender(force=false) {
    const host = document.getElementById("inv-panels");
    if (!host) return;
    this._activePreviewBtn = null;

    // ① 优先尝试 by-color
    let grouped = await this._tryByColor().catch(()=>null);

    // ② 如果拿不到有效分组，则退回 /inventory 并前端分组
    if (!grouped || this._allEmpty(grouped)) {
      const flat = await API.inventory().catch(()=>({items:[]}));
      grouped = this._groupClientSide(flat.items || flat || []);
    }

    // 渲染
    host.innerHTML = this._renderGroups(grouped);
    this._bindPreviewEvents();
  },

  async _tryByColor() {
    const d = await API.inventoryByColor(); // 期望结构：{ BRICK:[], PURPLE:[], BLUE:[], GREEN:[] }
    // 某些实现可能把键写成小写或混合
    const map = (k) => (d[k] || d[k?.toUpperCase?.()] || d[k?.toLowerCase?.()] || []);
    return {
      BRICK: map("BRICK"),
      PURPLE: map("PURPLE"),
      BLUE: map("BLUE"),
      GREEN: map("GREEN"),
    };
  },

  _allEmpty(g) {
    return ["BRICK","PURPLE","BLUE","GREEN"].every(k => !g[k] || g[k].length === 0);
  },

  _groupClientSide(list) {
    const g = { BRICK:[], PURPLE:[], BLUE:[], GREEN:[] };
    for (const it of list) {
      const r = (it.rarity || it.color || "").toUpperCase();
      if (g[r]) g[r].push(it);
    }
    return g;
  },

  _rarityClass(r) {
    if (r === "BRICK") return "hl-orange";
    if (r === "PURPLE") return "hl-purple";
    if (r === "BLUE")   return "hl-blue";
    return "hl-green";
  },

  _normalizeRow(x) {
    // 兼容不同字段命名
    const inv_id  = x.inv_id ?? x.id ?? x.inventory_id ?? "";
    const name    = x.name ?? x.skin_name ?? "";
    const rarity  = (x.rarity ?? x.color ?? "").toUpperCase();
    const wear    = (x.wear ?? (typeof x.wear_bp === "number" ? (x.wear_bp/100).toFixed(2) : undefined)) ?? "";
    const grade   = x.grade ?? x.quality ?? "";
    const serial  = x.serial ?? x.sn ?? "";
    // 砖皮才有 exquisite（有些后端也可能给所有稀有度一个布尔）
    const exquisite = x.exquisite === true;
    const template = x.template ?? (x.visual?.template);
    const hidden_template = x.hidden_template ?? x.visual?.hidden_template ?? false;
    const effects = x.effects ?? x.visual?.effects ?? [];
    const visual = x.visual || {
      body: [], attachments: [], template, hidden_template, effects
    };

    const locked = !!(x.sell_locked);
    const lock_reason = x.lock_reason || "";

    return { inv_id, name, rarity, wear, grade, serial, exquisite, template, hidden_template, effects, visual, locked, lock_reason };
  },

  _renderGroups(g) {
    this._cache = {};
    const sec = (title, key) => {
      const arr = (g[key] || []).map(x => this._normalizeRow(x));
      for (const item of arr) {
        if (item.inv_id) this._cache[item.inv_id] = item;
      }
      const rows = arr.map(x => {
        const rc = this._rarityClass(x.rarity);
        const ex = (x.rarity === "BRICK")
          ? (x.exquisite ? `<span class="badge badge-exq">极品</span>` : `<span class="badge badge-prem">优品</span>`)
          : "-";
        const btn = `<button class="btn btn-mini" data-preview="${x.inv_id}">查看</button>`;
        const lockInfo = x.locked ? `<span class="badge badge-lock" title="${escapeHtml(x.lock_reason || "暂不可交易")}">锁定</span>` : "";
        return `<tr>
          <td>${x.inv_id}</td>
          <td class="${rc}">${x.name}${lockInfo}</td>
          <td class="${rc}">${x.rarity}</td>
          <td>${ex}</td>
          <td>${x.wear}</td>
          <td>${x.grade}</td>
          <td>${x.serial}</td>
          <td>${btn}</td>
        </tr>`;
      }).join("");

      return `
      <div class="card">
        <h3>${title}（${arr.length}）</h3>
        <table class="table">
          <thead><tr><th>inv_id</th><th>名称</th><th>稀有度</th><th>极品</th><th>磨损</th><th>品质</th><th>编号</th><th>外观</th></tr></thead>
          <tbody>${rows || ""}</tbody>
        </table>
      </div>`;
    };

    return [
      sec("砖皮", "BRICK"),
      sec("紫",   "PURPLE"),
      sec("蓝",   "BLUE"),
      sec("绿",   "GREEN"),
    ].join("");
  },

  _bindPreviewEvents() {
    const host = document.getElementById("inv-panels");
    if (!host) return;
    host.querySelectorAll('[data-preview]').forEach(btn => {
      btn.onclick = () => this._togglePreview(btn);
    });
  },

  _togglePreview(btn) {
    const invId = btn.getAttribute('data-preview');
    const tr = btn.closest('tr');
    if (!invId || !tr) return;

    if (this._activePreviewBtn && this._activePreviewBtn !== btn) {
      const prevRow = this._activePreviewBtn.closest('tr')?.nextElementSibling;
      if (prevRow && prevRow.classList.contains('preview-row')) prevRow.remove();
      this._activePreviewBtn.textContent = '查看';
      this._activePreviewBtn = null;
    }

    const existing = tr.nextElementSibling;
    if (existing && existing.classList.contains('preview-row') && existing.dataset.for === invId) {
      existing.remove();
      btn.textContent = '查看';
      this._activePreviewBtn = null;
      return;
    }
    if (existing && existing.classList.contains('preview-row')) existing.remove();

    const data = this._cache[invId];
    if (!data) return;
    const visual = data.visual || { body: [], attachments: [], template: data.template, hidden_template: data.hidden_template, effects: data.effects };
    let previewHtml = '-';
    let detail = '';
    if (window.SkinVisuals) {
      const info = SkinVisuals.describe(visual);
      const meta = SkinVisuals.formatMeta(visual);
      previewHtml = SkinVisuals.render(visual, { label: data.name, meta });
      detail = `主体：${info.bodyText} · 配件：${info.attachmentText}`;
    }

    const detailRow = document.createElement('tr');
    detailRow.className = 'preview-row';
    detailRow.dataset.for = invId;
    detailRow.innerHTML = `<td colspan="8">${previewHtml}${detail ? `<div class="preview-info">${detail}</div>` : ''}</td>`;
    tr.after(detailRow);
    btn.textContent = '收起';
    this._activePreviewBtn = btn;
  }
};
