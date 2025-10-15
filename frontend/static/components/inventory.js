const InventoryPage = {
  _cache: {},
  _activePreviewBtn: null,
  _filters: { season: 'ALL', quality: 'ALL', wear: 'ALL' },
  _pages: { BRICK: 1, PURPLE: 1, BLUE: 1, GREEN: 1 },
  _pageSize: 10,
  _seasonOptions: [],
  _brickCounts: [],
  _raw: { BRICK: [], PURPLE: [], BLUE: [], GREEN: [] },

  async render() {
    const blocks = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <h2>背包</h2>
          <div>
            <button class="btn" id="inv-refresh">刷新</button>
          </div>
        </div>
        <div id="inv-filters" class="inv-filter-bar"></div>
      </div>
      <div id="inv-panels">${this._skeleton()}</div>
    `;
    setTimeout(() => this._loadAndRender(), 0);
    return blocks;
  },

  bind() {
    const ref = document.getElementById('inv-refresh');
    if (ref) ref.onclick = () => this._loadAndRender(true);
  },

  _skeleton() {
    const sec = (title) => `
      <div class="card">
        <h3>${title}（0）</h3>
        <table class="table">
          <thead><tr><th>inv_id</th><th>名称</th><th>赛季</th><th>稀有度</th><th>极品</th><th>磨损</th><th>品质</th><th>编号</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    return `${sec('砖皮')}${sec('紫')}${sec('蓝')}${sec('绿')}`;
  },

  async _loadAndRender(forceFetch = false) {
    const host = document.getElementById('inv-panels');
    if (!host) return;
    this._activePreviewBtn = null;

    await this._ensureSeasons(forceFetch);
    if (!API._me) {
      try { await API.me(); } catch (_) { /* 忽略 */ }
    }
    this._brickCounts = Array.isArray(API._me?.brick_season_counts)
      ? API._me.brick_season_counts.slice()
      : [];

    const seasonValue = this._filters.season;
    const seasonParam = seasonValue === 'ALL' ? null : Number(seasonValue);

    let grouped = await this._tryByColor(seasonParam).catch(() => null);
    if (!grouped || this._allEmpty(grouped)) {
      const flat = await API.inventory({ season: seasonParam }).catch(() => ({ items: [] }));
      const list = flat.items || flat || [];
      grouped = this._groupClientSide(list);
    }

    this._resetPages();
    this._renderFilterBar();
    this._renderPanels(grouped);
  },

  async _ensureSeasons(force = false) {
    if (!force && this._seasonOptions.length) return;
    try {
      const data = await API.seasons();
      const arr = Array.isArray(data?.seasons) ? data.seasons : [];
      this._seasonOptions = arr
        .map(info => ({
          season: Number(info?.season || 0),
          code: info?.code || '',
          name: info?.name || '',
        }))
        .filter(item => item.season > 0)
        .sort((a, b) => a.season - b.season)
        .map(item => ({
          season: item.season,
          label: `${item.code || `S${item.season}`}${item.name ? ` ${item.name}` : ''}`.trim() || `S${item.season}`,
        }));
    } catch (_) {
      if (force) this._seasonOptions = [];
    }
  },

  async _tryByColor(season) {
    const params = {};
    if (season) params.season = season;
    const d = await API.inventoryByColor(params);
    const buckets = d?.buckets && typeof d.buckets === 'object' ? d.buckets : d;
    const map = (k) => buckets?.[k] || buckets?.[k?.toUpperCase?.()] || buckets?.[k?.toLowerCase?.()] || [];
    return {
      BRICK: map('BRICK'),
      PURPLE: map('PURPLE'),
      BLUE: map('BLUE'),
      GREEN: map('GREEN'),
    };
  },

  _allEmpty(g) {
    return ['BRICK', 'PURPLE', 'BLUE', 'GREEN'].every(k => !g[k] || g[k].length === 0);
  },

  _groupClientSide(list) {
    const g = { BRICK: [], PURPLE: [], BLUE: [], GREEN: [] };
    for (const it of list) {
      const r = (it.rarity || it.color || '').toUpperCase();
      if (g[r]) g[r].push(it);
    }
    return g;
  },

  _resetPages() {
    this._pages = { BRICK: 1, PURPLE: 1, BLUE: 1, GREEN: 1 };
  },

  _renderPanels(grouped = null) {
    const host = document.getElementById('inv-panels');
    if (!host) return;
    if (grouped) {
      host.innerHTML = this._renderGroups(grouped);
    } else if (this._raw) {
      host.innerHTML = this._renderGroups(this._raw);
    } else {
      host.innerHTML = this._skeleton();
    }
    this._bindPreviewEvents();
    this._bindPaginationEvents();
  },

  _renderFilterBar() {
    const host = document.getElementById('inv-filters');
    if (!host) return;
    const seasonOptions = this._seasonOptions.map(opt =>
      `<option value="${opt.season}">${escapeHtml(opt.label)}</option>`
    ).join('');
    const seasonValue = this._filters.season === 'ALL' ? 'ALL' : String(this._filters.season);
    const qualityValue = this._filters.quality;
    const wearValue = this._filters.wear;
    const summary = (this._brickCounts || []).length
      ? `<div class="muted small">砖皮赛季分布：${this._brickCounts.map(item => {
          const label = item.label || `S${item.season}`;
          return `<span class="badge">${escapeHtml(label)} ×${item.count}</span>`;
        }).join(' ')}</div>`
      : '';
    host.innerHTML = `
      <div class="input-row">
        <select id="inv-filter-season">
          <option value="ALL">赛季（全部）</option>
          ${seasonOptions}
        </select>
        <select id="inv-filter-quality">
          <option value="ALL">极品/优品（全部）</option>
          <option value="EXQUISITE">只看极品</option>
          <option value="PREMIUM">只看优品</option>
        </select>
        <select id="inv-filter-wear">
          <option value="ALL">磨损（全部）</option>
          <option value="LOW">磨损≤1.00</option>
          <option value="HIGH">磨损＞1.00</option>
        </select>
        <button class="btn" id="inv-filter-reset">重置</button>
      </div>
      ${summary}
    `;
    const seasonSel = host.querySelector('#inv-filter-season');
    if (seasonSel) seasonSel.value = seasonValue;
    const qualitySel = host.querySelector('#inv-filter-quality');
    if (qualitySel) qualitySel.value = qualityValue;
    const wearSel = host.querySelector('#inv-filter-wear');
    if (wearSel) wearSel.value = wearValue;
    this._bindFilterEvents();
  },

  _bindFilterEvents() {
    const seasonSel = document.getElementById('inv-filter-season');
    if (seasonSel) {
      seasonSel.onchange = () => {
        const v = seasonSel.value;
        this._filters.season = v === 'ALL' ? 'ALL' : Number(v);
        this._resetPages();
        this._loadAndRender(true);
      };
    }
    const qualitySel = document.getElementById('inv-filter-quality');
    if (qualitySel) {
      qualitySel.onchange = () => {
        this._filters.quality = qualitySel.value;
        this._resetPages();
        this._renderPanels();
      };
    }
    const wearSel = document.getElementById('inv-filter-wear');
    if (wearSel) {
      wearSel.onchange = () => {
        this._filters.wear = wearSel.value;
        this._resetPages();
        this._renderPanels();
      };
    }
    const resetBtn = document.getElementById('inv-filter-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this._filters = { season: 'ALL', quality: 'ALL', wear: 'ALL' };
        this._resetPages();
        this._loadAndRender(true);
      };
    }
  },

  _bindPaginationEvents() {
    const host = document.getElementById('inv-panels');
    if (!host) return;
    host.querySelectorAll('[data-page-prev]').forEach(btn => {
      btn.onclick = () => {
        if (btn.disabled) return;
        const key = btn.getAttribute('data-page-prev');
        if (!key) return;
        this._pages[key] = Math.max(1, (this._pages[key] || 1) - 1);
        this._renderPanels();
      };
    });
    host.querySelectorAll('[data-page-next]').forEach(btn => {
      btn.onclick = () => {
        if (btn.disabled) return;
        const key = btn.getAttribute('data-page-next');
        if (!key) return;
        this._pages[key] = (this._pages[key] || 1) + 1;
        this._renderPanels();
      };
    });
  },

  _applyFilters(rarity, list) {
    let filtered = Array.isArray(list) ? list.slice() : [];
    if (rarity === 'BRICK') {
      if (this._filters.quality === 'EXQUISITE') {
        filtered = filtered.filter(item => item.exquisite === true);
      } else if (this._filters.quality === 'PREMIUM') {
        filtered = filtered.filter(item => item.exquisite === false);
      }
    }
    if (this._filters.wear === 'LOW') {
      filtered = filtered.filter(item => Number.isNaN(item.wear_value) ? true : item.wear_value <= 1.0);
    } else if (this._filters.wear === 'HIGH') {
      filtered = filtered.filter(item => Number.isNaN(item.wear_value) ? true : item.wear_value > 1.0);
    }
    return filtered;
  },

  _rarityClass(r) {
    if (r === 'BRICK') return 'hl-orange';
    if (r === 'PURPLE') return 'hl-purple';
    if (r === 'BLUE') return 'hl-blue';
    return 'hl-green';
  },

  _normalizeRow(x) {
    const inv_id = x.inv_id ?? x.id ?? x.inventory_id ?? '';
    const name = x.name ?? x.skin_name ?? '';
    const rarity = (x.rarity ?? x.color ?? '').toUpperCase();
    let wear_value = Number.NaN;
    if (typeof x.wear === 'number' && Number.isFinite(x.wear)) {
      wear_value = x.wear;
    } else if (typeof x.wear_bp === 'number' && Number.isFinite(x.wear_bp)) {
      wear_value = x.wear_bp / 100;
    } else if (x.wear != null) {
      const parsed = parseFloat(String(x.wear));
      if (!Number.isNaN(parsed)) wear_value = parsed;
    }
    const wear_text = !Number.isNaN(wear_value)
      ? wear_value.toFixed(2)
      : (x.wear != null ? x.wear : (typeof x.wear_bp === 'number' ? (x.wear_bp / 100).toFixed(2) : '-'));
    const grade = x.grade ?? x.quality ?? '';
    const serial = x.serial ?? x.sn ?? '';
    let season = null;
    if (typeof x.season === 'number' && Number.isFinite(x.season)) {
      season = x.season;
    } else if (typeof x.season === 'string' && x.season.trim()) {
      const parsed = parseInt(x.season, 10);
      if (!Number.isNaN(parsed)) season = parsed;
    }
    const season_label = x.season_label || (season ? `S${season}` : '-');
    const exquisite = x.exquisite === true;
    const template = x.template ?? (x.visual?.template);
    const hidden_template = x.hidden_template ?? x.visual?.hidden_template ?? false;
    const effects = x.effects ?? x.visual?.effects ?? [];
    const visual = x.visual || {
      body: [], attachments: [], template, hidden_template, effects
    };
    const locked = !!(x.sell_locked);
    const lock_reason = x.lock_reason || '';
    return {
      inv_id,
      name,
      rarity,
      wear: wear_text,
      wear_value,
      grade,
      serial,
      exquisite,
      template,
      hidden_template,
      effects,
      visual,
      locked,
      lock_reason,
      season,
      season_label,
    };
  },

  _renderGroups(g) {
    this._cache = {};
    this._raw = g;
    const sec = (title, key) => {
      const source = (g[key] || []).map(x => this._normalizeRow(x));
      source.forEach(item => { if (item.inv_id) this._cache[item.inv_id] = item; });
      const filtered = this._applyFilters(key, source);
      const total = filtered.length;
      const pageSize = this._pageSize;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = this._pages[key] = Math.min(Math.max(1, this._pages[key] || 1), totalPages);
      const start = (currentPage - 1) * pageSize;
      const pageItems = filtered.slice(start, start + pageSize);

      const rows = pageItems.map(x => {
        const rc = this._rarityClass(x.rarity);
        const ex = (x.rarity === 'BRICK')
          ? (x.exquisite ? `<span class="badge badge-exq">极品</span>` : `<span class="badge badge-prem">优品</span>`)
          : '-';
        const btn = `<button class="btn btn-mini" data-preview="${x.inv_id}">查看</button>`;
        const lockInfo = x.locked ? `<span class="badge badge-lock" title="${escapeHtml(x.lock_reason || '暂不可交易')}">锁定</span>` : '';
        return `<tr>
          <td>${x.inv_id}</td>
          <td class="${rc}">${escapeHtml(x.name)}${lockInfo}</td>
          <td>${escapeHtml(x.season_label || '-')}</td>
          <td class="${rc}">${x.rarity}</td>
          <td>${ex}</td>
          <td>${x.wear}</td>
          <td>${x.grade}</td>
          <td>${x.serial}</td>
          <td>${btn}</td>
        </tr>`;
      }).join('');

      const tableRows = rows || `<tr><td colspan="9" class="muted">暂无物品</td></tr>`;
      const pager = totalPages > 1
        ? `<div class="pager"><button class="btn btn-mini" data-page-prev="${key}" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button><span>第 ${currentPage} / ${totalPages} 页（共 ${total} 件）</span><button class="btn btn-mini" data-page-next="${key}" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button></div>`
        : `<div class="pager muted">共 ${total} 件</div>`;

      return `
      <div class="card">
        <h3>${title}（${total}）</h3>
        <table class="table">
          <thead><tr><th>inv_id</th><th>名称</th><th>赛季</th><th>稀有度</th><th>极品</th><th>磨损</th><th>品质</th><th>编号</th><th>操作</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${pager}
      </div>`;
    };

    return [
      sec('砖皮', 'BRICK'),
      sec('紫', 'PURPLE'),
      sec('蓝', 'BLUE'),
      sec('绿', 'GREEN'),
    ].join('');
  },

  _bindPreviewEvents() {
    const host = document.getElementById('inv-panels');
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
    detailRow.innerHTML = `<td colspan="9">${previewHtml}${detail ? `<div class="preview-info">${detail}</div>` : ''}</td>`;
    tr.after(detailRow);
    btn.textContent = '收起';
    this._activePreviewBtn = btn;
  }
};
