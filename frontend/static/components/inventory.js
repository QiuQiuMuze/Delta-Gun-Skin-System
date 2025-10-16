const InventoryPage = {
  _cache: {},
  _activePreviewBtn: null,
  _seasonCatalog: [],
  _seasonMap: {},
  _filters: { season: "ALL", rarity: "ALL", quality: "ANY", wear: "ALL", sort: "TIME_DESC" },
  _pages: { BRICK: 1, PURPLE: 1, BLUE: 1, GREEN: 1 },
  _grouped: { BRICK: [], PURPLE: [], BLUE: [], GREEN: [] },
  async render() {
    const catalog = await API.seasonCatalog().catch(() => ({ seasons: [], latest: null }));
    const seasons = Array.isArray(catalog?.seasons) ? catalog.seasons : [];
    this._seasonCatalog = seasons;
    this._seasonMap = {};
    seasons.forEach(season => {
      if (!season?.id) return;
      this._seasonMap[season.id] = season;
      this._seasonMap[String(season.id).toUpperCase()] = season;
    });
    const seasonOptions = [`<option value="ALL">全部赛季</option>`]
      .concat(seasons.map(season => `<option value="${season.id}" ${this._filters.season===season.id?"selected":""}>${season.name}</option>`))
      .join("");
    const rarityOptions = [
      { value: "ALL", label: "全部稀有度" },
      { value: "BRICK", label: "砖皮" },
      { value: "PURPLE", label: "紫皮" },
      { value: "BLUE", label: "蓝皮" },
      { value: "GREEN", label: "绿皮" },
    ].map(opt => `<option value="${opt.value}" ${this._filters.rarity===opt.value?"selected":""}>${opt.label}</option>`).join("");
    const qualityOptions = [
      { value: "ANY", label: "极品/优品(全部)" },
      { value: "EXQ", label: "只看极品" },
      { value: "PREM", label: "只看优品" }
    ].map(opt => `<option value="${opt.value}" ${this._filters.quality===opt.value?"selected":""}>${opt.label}</option>`).join("");
    const wearOptions = [
      { value: "ALL", label: "磨损(全部)" },
      { value: "LOW", label: "≤ 1.00" },
      { value: "MID", label: "1.01 ~ 2.00" },
      { value: "HIGH", label: "≥ 2.01" }
    ].map(opt => `<option value="${opt.value}" ${this._filters.wear===opt.value?"selected":""}>${opt.label}</option>`).join("");
    const sortOptions = [
      { value: "TIME_DESC", label: "最新获得" },
      { value: "TIME_ASC", label: "最早获得" },
      { value: "WEAR_ASC", label: "磨损从低到高" },
      { value: "WEAR_DESC", label: "磨损从高到低" }
    ].map(opt => `<option value="${opt.value}" ${this._filters.sort===opt.value?"selected":""}>${opt.label}</option>`).join("");

    const blocks = `
      <div class="card inventory-card">
        <div class="inventory-card__header">
          <h2>背包</h2>
          <div class="inventory-card__actions">
            <button class="btn" id="inv-refresh">刷新</button>
          </div>
        </div>
        <div id="inv-season-summary" class="inventory-summary muted">加载赛季统计中...</div>
        <div class="input-row inventory-filters">
          <select id="inv-filter-season">${seasonOptions}</select>
          <select id="inv-filter-rarity">${rarityOptions}</select>
          <select id="inv-filter-quality">${qualityOptions}</select>
          <select id="inv-filter-wear">${wearOptions}</select>
          <select id="inv-filter-sort">${sortOptions}</select>
        </div>
      </div>
      <div id="inv-panels">${this._skeleton()}</div>
    `;
    setTimeout(()=>this._loadAndRender(), 0);
    return blocks;
  },
  bind() {
    const ref = document.getElementById("inv-refresh");
    if (ref) ref.onclick = () => this._loadAndRender(true);
    const seasonSel = document.getElementById("inv-filter-season");
    const raritySel = document.getElementById("inv-filter-rarity");
    const qualitySel = document.getElementById("inv-filter-quality");
    const wearSel = document.getElementById("inv-filter-wear");
    const sortSel = document.getElementById("inv-filter-sort");
    const applyFilters = () => {
      this._filters = {
        season: seasonSel ? seasonSel.value : this._filters.season,
        rarity: raritySel ? raritySel.value : this._filters.rarity,
        quality: qualitySel ? qualitySel.value : this._filters.quality,
        wear: wearSel ? wearSel.value : this._filters.wear,
        sort: sortSel ? sortSel.value : this._filters.sort,
      };
      this._resetPages();
      this._loadAndRender(true);
    };
    [seasonSel, raritySel, qualitySel, wearSel, sortSel].forEach(sel => {
      if (sel) sel.addEventListener("change", applyFilters);
    });
  },

  _skeleton() {
    const sec = (title) => `
      <div class="card">
        <h3>${title}（0）</h3>
        <table class="table">
          <thead><tr><th>inv_id</th><th>名称</th><th>赛季</th><th>类型</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th><th>获取时间</th><th>外观</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="inventory-pagination muted">暂无数据</div>
      </div>
    `;
    return `${sec("砖皮")}${sec("紫")}${sec("蓝")}${sec("绿")}`;
  },

  _resetPages() {
    this._pages = { BRICK: 1, PURPLE: 1, BLUE: 1, GREEN: 1 };
  },

  async _loadAndRender(force=false) {
    const host = document.getElementById("inv-panels");
    if (!host) return;
    this._activePreviewBtn = null;

    if (force && this._grouped && Object.values(this._grouped).some(arr => Array.isArray(arr) && arr.length)) {
      this._renderSeasonSummary();
      host.innerHTML = this._renderGroups();
      this._bindPreviewEvents();
      return;
    }

    // ① 优先尝试 by-color
    let grouped = await this._tryByColor().catch(()=>null);

    // ② 如果拿不到有效分组，则退回 /inventory 并前端分组
    if (!grouped || this._allEmpty(grouped)) {
      const flat = await API.inventory().catch(()=>({items:[]}));
      grouped = this._groupClientSide(flat.items || flat || []);
    }

    const normalized = { BRICK: [], PURPLE: [], BLUE: [], GREEN: [] };
    ["BRICK", "PURPLE", "BLUE", "GREEN"].forEach(key => {
      normalized[key] = (grouped[key] || []).map(x => this._normalizeRow(x));
    });
    this._grouped = normalized;
    this._renderSeasonSummary();

    host.innerHTML = this._renderGroups();
    this._bindPreviewEvents();
  },

  async _tryByColor() {
    const d = await API.inventoryByColor();
    const buckets = (d && typeof d === "object" && d.buckets) ? d.buckets : d;
    const map = (k) => (buckets?.[k]
      || buckets?.[String(k).toUpperCase()]
      || buckets?.[String(k).toLowerCase()]
      || []);
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

  _renderSeasonSummary() {
    const box = document.getElementById("inv-season-summary");
    if (!box) return;
    const dataset = this._grouped || {};
    const totals = {};
    ["BRICK", "PURPLE", "BLUE", "GREEN"].forEach(rarity => {
      (dataset[rarity] || []).forEach(item => {
        const season = item.season || "";
        if (!totals[season]) {
          totals[season] = { total: 0, BRICK: 0, PURPLE: 0, BLUE: 0, GREEN: 0 };
        }
        totals[season].total += 1;
        totals[season][rarity] = (totals[season][rarity] || 0) + 1;
      });
    });
    const entries = Object.entries(totals);
    if (!entries.length) {
      box.innerHTML = `<div class="muted">背包为空。</div>`;
      return;
    }
    const order = [];
    this._seasonCatalog.forEach(season => {
      const key = season.id;
      if (key in totals) order.push(key);
    });
    entries.forEach(([key]) => {
      if (!order.includes(key)) order.push(key);
    });
    const rarityMeta = [
      { key: "BRICK", label: "砖", cls: "hl-orange" },
      { key: "PURPLE", label: "紫", cls: "hl-purple" },
      { key: "BLUE", label: "蓝", cls: "hl-blue" },
      { key: "GREEN", label: "绿", cls: "hl-green" }
    ];
    const chips = order.map(key => {
      const data = totals[key];
      const label = this._seasonLabel(key);
      const safeLabel = typeof escapeHtml === 'function' ? escapeHtml(label) : label;
      const rarityHtml = rarityMeta
        .filter(meta => data[meta.key] > 0)
        .map(meta => `<span class="inventory-season__rar ${meta.cls}">${meta.label}×${data[meta.key]}</span>`)
        .join(" ");
      return `<div class="inventory-season-chip">
        <div class="inventory-season-chip__title">${safeLabel}</div>
        <div class="inventory-season-chip__count">共 ${data.total}</div>
        <div class="inventory-season-chip__rarities">${rarityHtml || '<span class="muted">暂无皮肤</span>'}</div>
      </div>`;
    }).join("");
    box.innerHTML = `<div class="inventory-season-grid">${chips}</div>`;
  },

  _rarityClass(r) {
    if (r === "BRICK") return "hl-orange";
    if (r === "PURPLE") return "hl-purple";
    if (r === "BLUE")   return "hl-blue";
    return "hl-green";
  },
  _seasonLabel(id) {
    const key = String(id == null ? "" : id).toUpperCase();
    if (!key || key === "UNASSIGNED") {
      if (this._seasonCatalog && this._seasonCatalog.length) {
        const latest = this._seasonCatalog[this._seasonCatalog.length - 1];
        return latest?.name || latest?.id || "最新赛季";
      }
      return "最新赛季";
    }
    const entry = this._seasonMap[key] || this._seasonMap[key.toUpperCase()] || null;
    if (entry?.name) return entry.name;
    const fallback = this._seasonCatalog.find(s => String(s.id).toUpperCase() === key);
    return fallback?.name || key;
  },
  _modelLabel(model) {
    const key = String(model || "").toLowerCase();
    const map = {
      assault: "突击步枪",
      battle: "战斗步枪",
      vector: "冲锋枪",
      bullpup: "无托步枪",
      futuristic: "能量武器"
    };
    if (!key) return "-";
    return map[key] || model || key;
  },
  _formatTime(ts) {
    if (!ts) return "-";
    const date = new Date(ts * 1000);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", { hour12: false });
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
    const model = (x.model ?? visual.model ?? "").toString();
    const seasonRaw = (x.season ?? "").toString();
    const acquired_at = Number(x.acquired_at ?? x.acquired ?? 0) || 0;
    const wearValue = typeof x.wear === "number"
      ? x.wear
      : (typeof x.wear_bp === "number" ? x.wear_bp / 100 : parseFloat(wear));

    const locked = !!(x.sell_locked);
    const lock_reason = x.lock_reason || "";

    return {
      inv_id,
      name,
      rarity,
      wear,
      wear_value: isFinite(wearValue) ? Number(wearValue) : NaN,
      grade,
      serial,
      exquisite,
      template,
      hidden_template,
      effects,
      visual,
      locked,
      lock_reason,
      model,
      season: seasonRaw,
      acquired_at,
    };
  },

  _renderGroups() {
    this._cache = {};
    const filters = this._filters || { season: "ALL", rarity: "ALL", quality: "ANY", wear: "ALL", sort: "TIME_DESC" };
    const sections = [];
    const pageSize = 10;
    const rarities = [
      { key: "BRICK", title: "砖皮" },
      { key: "PURPLE", title: "紫皮" },
      { key: "BLUE", title: "蓝皮" },
      { key: "GREEN", title: "绿皮" }
    ];

    const applyWearFilter = (item) => {
      const val = item.wear_value;
      if (filters.wear === "LOW") return isFinite(val) ? val <= 1.0 : false;
      if (filters.wear === "MID") return isFinite(val) ? val > 1.0 && val <= 2.0 : false;
      if (filters.wear === "HIGH") return isFinite(val) ? val >= 2.01 : false;
      return true;
    };

    const sortList = (list) => {
      const arr = list.slice();
      if (filters.sort === "TIME_ASC" || filters.sort === "TIME_DESC") {
        const dir = filters.sort === "TIME_ASC" ? 1 : -1;
        arr.sort((a, b) => ((a.acquired_at || 0) - (b.acquired_at || 0)) * dir);
      } else if (filters.sort === "WEAR_ASC" || filters.sort === "WEAR_DESC") {
        const dir = filters.sort === "WEAR_ASC" ? 1 : -1;
        arr.sort((a, b) => {
          const va = isFinite(a.wear_value) ? a.wear_value : (filters.sort === "WEAR_ASC" ? Infinity : -Infinity);
          const vb = isFinite(b.wear_value) ? b.wear_value : (filters.sort === "WEAR_ASC" ? Infinity : -Infinity);
          if (va === vb) return ((b.acquired_at || 0) - (a.acquired_at || 0));
          return (va - vb) * dir;
        });
      } else {
        arr.sort((a, b) => (b.acquired_at || 0) - (a.acquired_at || 0));
      }
      return arr;
    };

    const shouldShowSection = (key) => filters.rarity === "ALL" || filters.rarity === key;

    rarities.forEach(({ key, title }) => {
      if (!shouldShowSection(key)) {
        this._pages[key] = 1;
        return;
      }
      const baseList = (this._grouped[key] || []).slice();
      let list = baseList.filter(item => {
        if (filters.season !== "ALL" && String(item.season || "") !== filters.season) return false;
        if (filters.quality === "EXQ" && key === "BRICK" && !item.exquisite) return false;
        if (filters.quality === "PREM" && key === "BRICK" && item.exquisite) return false;
        if (!applyWearFilter(item)) return false;
        return true;
      });

      const total = list.length;
      list = sortList(list);

      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(Math.max(1, this._pages[key] || 1), totalPages);
      this._pages[key] = currentPage;
      const start = (currentPage - 1) * pageSize;
      const pageItems = list.slice(start, start + pageSize);

      const rows = pageItems.map(item => {
        const cached = {
          ...item,
          season_label: this._seasonLabel(item.season),
          model_label: this._modelLabel(item.model),
          acquired_text: this._formatTime(item.acquired_at)
        };
        if (item.inv_id) this._cache[item.inv_id] = cached;
        const rc = this._rarityClass(item.rarity);
        const ex = key === "BRICK"
          ? (item.exquisite ? `<span class="badge badge-exq">极品</span>` : `<span class="badge badge-prem">优品</span>`)
          : "-";
        const lockInfo = item.locked ? `<span class="badge badge-lock" title="${escapeHtml(item.lock_reason || "暂不可交易")}">锁定</span>` : "";
        const btn = `<button class="btn btn-mini" data-preview="${item.inv_id}">查看</button>`;
        return `<tr>
          <td>${item.inv_id}</td>
          <td class="${rc}">${item.name}${lockInfo}</td>
          <td>${cached.season_label}</td>
          <td>${cached.model_label}</td>
          <td class="${rc}">${item.rarity}</td>
          <td>${ex}</td>
          <td>${item.wear}</td>
          <td>${item.grade || "-"}</td>
          <td>${item.serial || "-"}</td>
          <td>${cached.acquired_text}</td>
          <td>${btn}</td>
        </tr>`;
      }).join("");

      const pagination = this._renderPagination(key, currentPage, totalPages, total);
      sections.push(`
        <div class="card inventory-section">
          <h3>${title}（${total}）</h3>
          <table class="table">
            <thead><tr><th>inv_id</th><th>名称</th><th>赛季</th><th>类型</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th><th>获取时间</th><th>外观</th></tr></thead>
            <tbody>${rows || ""}</tbody>
          </table>
          ${pagination}
        </div>
      `);
    });

    if (!sections.length) {
      return `<div class="card"><div class="muted">当前筛选无结果。</div></div>`;
    }
    return sections.join("");
  },

  _bindPreviewEvents() {
    const host = document.getElementById("inv-panels");
    if (!host) return;
    host.querySelectorAll('[data-preview]').forEach(btn => {
      btn.onclick = () => this._togglePreview(btn);
    });
    host.querySelectorAll('[data-page]').forEach(btn => {
      btn.onclick = () => {
        const rarity = btn.getAttribute('data-page');
        const dir = parseInt(btn.getAttribute('data-dir') || "0", 10);
        if (!rarity || !dir) return;
        this._changePage(rarity, dir);
      };
    });
  },

  _renderPagination(rarity, page, totalPages, totalItems) {
    if (totalPages <= 1) {
      return `<div class="inventory-pagination muted">共 ${totalItems} 件</div>`;
    }
    const prevDisabled = page <= 1 ? "disabled" : "";
    const nextDisabled = page >= totalPages ? "disabled" : "";
    return `<div class="inventory-pagination">
      <button class="btn btn-mini" data-page="${rarity}" data-dir="-1" ${prevDisabled}>上一页</button>
      <span>第 ${page} / ${totalPages} 页 · 共 ${totalItems} 件</span>
      <button class="btn btn-mini" data-page="${rarity}" data-dir="1" ${nextDisabled}>下一页</button>
    </div>`;
  },

  _changePage(rarity, dir) {
    const key = String(rarity || "").toUpperCase();
    if (!this._pages[key]) this._pages[key] = 1;
    this._pages[key] = Math.max(1, this._pages[key] + dir);
    const host = document.getElementById("inv-panels");
    if (!host) return;
    host.innerHTML = this._renderGroups();
    this._bindPreviewEvents();
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
      const extras = [
        `主体：${info.bodyText}`,
        `配件：${info.attachmentText}`,
        meta
      ];
      if (data.season) extras.push(`赛季：${this._seasonLabel(data.season)}`);
      if (data.model) extras.push(`类型：${this._modelLabel(data.model)}`);
      detail = extras.join(' · ');
    }

    const detailRow = document.createElement('tr');
    detailRow.className = 'preview-row';
    detailRow.dataset.for = invId;
    detailRow.innerHTML = `<td colspan="11">${previewHtml}${detail ? `<div class="preview-info">${detail}</div>` : ''}</td>`;
    tr.after(detailRow);
    btn.textContent = '收起';
    this._activePreviewBtn = btn;
  }
};
