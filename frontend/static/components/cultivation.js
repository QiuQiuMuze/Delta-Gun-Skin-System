const CultivationPage = {
  _root: null,
  _state: null,
  _selection: { talents: new Set(), allocations: {}, originId: null, sectId: null, masterId: null },
  _loading: false,
  fmtInt(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    try {
      return Math.round(n).toLocaleString();
    } catch (e) {
      return String(Math.round(n));
    }
  },
  toneClass(tone) {
    if (!tone) return '';
    const safe = String(tone).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return safe ? `tone-${safe}` : '';
  },
  getOrigin(lobby, id) {
    const list = Array.isArray(lobby?.origins) ? lobby.origins : [];
    return list.find(item => item && item.id === id) || null;
  },
  getSect(lobby, id) {
    const list = Array.isArray(lobby?.sects) ? lobby.sects : [];
    return list.find(item => item && item.id === id) || null;
  },
  getMaster(lobby, id) {
    const list = Array.isArray(lobby?.masters) ? lobby.masters : [];
    return list.find(item => item && item.id === id) || null;
  },
  calcStartingCoins(lobby) {
    const origin = this.getOrigin(lobby, this._selection.originId);
    const sect = this.getSect(lobby, this._selection.sectId);
    const master = this.getMaster(lobby, this._selection.masterId);
    let total = 0;
    if (origin && Number.isFinite(Number(origin.coins))) total += Number(origin.coins);
    if (sect && Number.isFinite(Number(sect.coins))) total += Number(sect.coins);
    if (master && Number.isFinite(Number(master.coins))) total += Number(master.coins);
    return total;
  },
  renderEffectPills(effects) {
    if (!Array.isArray(effects) || !effects.length) {
      return '<span class="cultivation-effect-pill muted">无额外加成</span>';
    }
    return effects.map(effect => {
      if (!effect || effect.value == null) return '';
      const label = escapeHtml(effect.label || effect.stat || '属性');
      const value = this.fmtInt(effect.value || 0);
      return `<span class="cultivation-effect-pill">${label} +${value}</span>`;
    }).filter(Boolean).join('');
  },
  renderLineage(lineage) {
    const info = lineage || {};
    const origin = info.origin || {};
    const sect = info.sect || {};
    const master = info.master || {};
    const originName = origin.name ? escapeHtml(origin.name) : '未知出身';
    const originLabel = origin.status_label ? `<span class="tag">${escapeHtml(origin.status_label)}</span>` : '';
    const originDesc = origin.desc ? `<div class="meta">${escapeHtml(origin.desc)}</div>` : '';
    const sectName = sect.name ? escapeHtml(sect.name) : '散修';
    const sectMotto = sect.motto ? `<div class="meta">${escapeHtml(sect.motto)}</div>` : '';
    const masterName = master.name ? escapeHtml(master.name) : '无名前辈';
    const masterTitle = master.title ? ` · ${escapeHtml(master.title)}` : '';
    const masterMotto = master.motto ? `<div class="meta">${escapeHtml(master.motto)}</div>` : '';
    return `
      <div class="cultivation-lineage">
        <div class="cultivation-lineage__item">
          <span class="label">出身</span>
          <strong>${originName}</strong>
          ${originLabel}
          ${originDesc}
        </div>
        <div class="cultivation-lineage__item">
          <span class="label">宗门</span>
          <strong>${sectName}</strong>
          ${sectMotto}
        </div>
        <div class="cultivation-lineage__item">
          <span class="label">师承</span>
          <strong>${masterName}${masterTitle}</strong>
          ${masterMotto}
        </div>
      </div>
    `;
  },
  renderCollection(title, items, emptyText = '暂无收获') {
    const list = Array.isArray(items) ? items : [];
    const chips = list
      .map(item => {
        if (!item) return '';
        const name = escapeHtml(item.name || '');
        const note = item.note ? `<span class="cultivation-chip__note">${escapeHtml(item.note)}</span>` : '';
        const titleAttr = item.desc ? ` title="${escapeHtml(item.desc)}"` : '';
        if (!name) return '';
        return `<span class="cultivation-chip"${titleAttr}><span class="cultivation-chip__label">${name}</span>${note}</span>`;
      })
      .filter(Boolean)
      .join('');
    const body = chips
      ? `<div class="cultivation-collection__list">${chips}</div>`
      : `<div class="cultivation-collection__empty">${escapeHtml(emptyText)}</div>`;
    return `
      <div class="cultivation-collection">
        <div class="cultivation-collection__title">${escapeHtml(title)}</div>
        ${body}
      </div>
    `;
  },
  renderTalentChips(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return '';
    const chips = list.map(item => {
      if (!item) return '';
      const name = escapeHtml((item.name != null ? item.name : item) || '');
      if (!name) return '';
      const tone = item.rarity_tone ? ` rarity-${escapeHtml(item.rarity_tone)}` : '';
      const rarityLabel = item.rarity_label ? `<span class="cultivation-talent-chip__rarity">${escapeHtml(item.rarity_label)}</span>` : '';
      const descAttr = item.desc ? ` title="${escapeHtml(item.desc)}"` : '';
      return `<span class="cultivation-chip talent${tone}"${descAttr}>${rarityLabel}<span class="cultivation-chip__label">${name}</span></span>`;
    }).filter(Boolean).join('');
    if (!chips) return '';
    return `<div class="cultivation-talent-chips">${chips}</div>`;
  },
  renderStatsGrid(stats) {
    if (!stats || typeof stats !== 'object') return '';
    const entries = Object.entries(stats)
      .map(([key, value]) => `<div class="cultivation-stat-pill"><span>${escapeHtml(this.statLabel(key))}</span><strong>${this.fmtInt(value)}</strong></div>`)
      .join('');
    if (!entries) return '';
    return `<div class="cultivation-stats-grid">${entries}</div>`;
  },
  renderLastSummary(last, fmtInt) {
    if (!last || last.score == null) {
      return '<div class="cultivation-summary__last">尚未完成任何历练。</div>';
    }
    const lineage = this.renderLineage(last.lineage);
    const statsBlock = this.renderStatsGrid(last.stats);
    const coins = fmtInt(last.coins || 0);
    const coinsLine = `<div class="cultivation-summary__coins">起始铜钱 ${coins}</div>`;
    const talentData = Array.isArray(last.talent_details) && last.talent_details.length
      ? last.talent_details
      : Array.isArray(last.talents) ? last.talents.map(name => ({ name })) : [];
    const talents = talentData.length
      ? `<div class="cultivation-summary__talents"><span class="label">天赋</span>${this.renderTalentChips(talentData)}</div>`
      : '';
    const collections = `
      <div class="cultivation-summary__collections">
        ${this.renderCollection('法宝', last.artifacts, '暂无法宝')}
        ${this.renderCollection('道友', last.companions, '暂无道友')}
        ${this.renderCollection('传承', last.techniques, '暂无传承')}
      </div>
    `;
    const statsSection = statsBlock ? `<div class="cultivation-summary__stats-grid">${statsBlock}</div>` : '';
    return `
      <div class="cultivation-summary__last">
        <div class="cultivation-summary__headline">最近一次：得分 ${fmtInt(last.score || 0)} · ${escapeHtml(last.ending || '')}</div>
        ${coinsLine}
        ${lineage}
        ${statsSection}
        ${talents}
        ${collections}
      </div>
    `;
  },
  renderEndingScreen(screen) {
    const result = screen?.result || {};
    const fmtInt = (v) => this.fmtInt(v);
    const endingText = escapeHtml(result.ending || '历练结束');
    const stage = escapeHtml(result.stage || '');
    const age = fmtInt(result.age || 0);
    const score = fmtInt(result.score || 0);
    const best = fmtInt((result.best != null ? result.best : screen?.bestScore) || 0);
    const icon = result.ending_type === 'fallen' ? '☠️' : '✨';
    const lineage = this.renderLineage(result.lineage);
    const statsBlock = this.renderStatsGrid(result.stats);
    const statsSection = statsBlock ? `<div class="cultivation-ending__stats">${statsBlock}</div>` : '';
    const coins = fmtInt(result.coins || 0);
    const coinsLine = `<div class="cultivation-ending__coins">携带铜钱 ${coins}</div>`;
    const talentData = Array.isArray(result.talent_details) && result.talent_details.length
      ? result.talent_details
      : Array.isArray(result.talents) ? result.talents.map(name => ({ name })) : [];
    const talents = talentData.length
      ? `<div class="cultivation-ending__talents"><span class="label">天赋</span>${this.renderTalentChips(talentData)}</div>`
      : '';
    const reward = result.reward && Number(result.reward.bricks) > 0
      ? `<div class="cultivation-ending__reward">🎁 获得 ${fmtInt(result.reward.bricks)} 块砖</div>`
      : '';
    const collections = `
      <div class="cultivation-ending__collections">
        ${this.renderCollection('法宝', result.artifacts, '暂无法宝')}
        ${this.renderCollection('道友', result.companions, '暂无道友')}
        ${this.renderCollection('传承', result.techniques, '暂无传承')}
      </div>
    `;
    const logItems = Array.isArray(result.events) ? result.events.slice(-12).reverse().map(ev => {
      let text = '';
      let tone = '';
      if (ev && typeof ev === 'object') {
        text = ev.text || '';
        tone = ev.tone || '';
      } else {
        text = ev != null ? String(ev) : '';
      }
      const cls = this.toneClass(tone);
      return `<li${cls ? ` class="${cls}"` : ''}>${escapeHtml(text)}</li>`;
    }).join('') : '';
    const logSection = logItems
      ? `<div class="cultivation-ending__log-wrap"><div class="label">历练轨迹</div><ul class="cultivation-ending__log">${logItems}</ul></div>`
      : '';
    return `
      <div class="cultivation-ending">
        <div class="cultivation-ending__card">
          <div class="cultivation-ending__header">
            <div class="cultivation-ending__title">${icon} ${endingText}</div>
            <div class="cultivation-ending__meta">境界 ${stage || '未知'} · ${age} 岁 · 得分 ${score}</div>
            <div class="cultivation-ending__best">历史最佳 ${best} 分</div>
          </div>
          ${coinsLine}
          ${reward}
          ${lineage}
          ${statsSection}
          ${talents}
          ${collections}
          ${logSection}
          <div class="cultivation-ending__actions">
            <button class="btn primary" id="cultivation-ending-confirm">确认返回</button>
          </div>
        </div>
      </div>
    `;
  },
  bindEndingScreen() {
    const confirm = this._root?.querySelector('#cultivation-ending-confirm');
    if (!confirm) return;
    confirm.addEventListener('click', async () => {
      if (this._loading) return;
      try {
        this._loading = true;
        confirm.classList.add('is-loading');
        this._state.endingScreen = null;
        await this.refresh();
      } catch (e) {
        alert(e.message || e);
      } finally {
        this._loading = false;
        confirm.classList.remove('is-loading');
      }
    });
  },
  render() {
    return `<div class="card" id="cultivation-root"><div class="muted">加载中...</div></div>`;
  },
  async bind() {
    this._root = document.getElementById('cultivation-root');
    this._selection = { talents: new Set(), allocations: {}, originId: null, sectId: null, masterId: null };
    await this.refresh();
  },
  presence() {
    if (!this._state || this._state.enabled === false) {
      return { activity: 'cultivation:locked' };
    }
    if (this._state.endingScreen) {
      return { activity: 'cultivation:ending' };
    }
    if (this._state && this._state.run && !this._state.run.finished) {
      return {
        activity: 'cultivation:run',
        details: {
          stage: this._state.run.stage,
          age: this._state.run.age,
          score: this._state.run.score,
        },
      };
    }
    return { activity: 'cultivation:lobby' };
  },
  async refresh() {
    if (!this._root) return;
    this._loading = true;
    try {
      const data = await API.cultivationStatus();
      this._state = data || {};
      this.resetSelection();
      this.renderStatus();
      window.PresenceTracker?.updateDetails?.(this.presence());
    } catch (e) {
      this._root.innerHTML = `<div class="error">加载失败：${escapeHtml(e.message || e)}</div>`;
    } finally {
      this._loading = false;
    }
  },
  resetSelection() {
    this._selection = { talents: new Set(), allocations: {}, originId: null, sectId: null, masterId: null };
    const lobby = this._state?.lobby;
    if (lobby && lobby.base_stats) {
      Object.keys(lobby.base_stats).forEach(key => {
        this._selection.allocations[key] = 0;
      });
    }
  },
  updateStartingCoins(lobby) {
    const coinsNode = this._root?.querySelector('#cultivation-start-coins');
    if (coinsNode) {
      coinsNode.textContent = this.fmtInt(this.calcStartingCoins(lobby));
    }
  },
  updateLineageAvailability(lobby) {
    const origin = this.getOrigin(lobby, this._selection.originId);
    const hasOrigin = !!origin;
    const originStatus = hasOrigin
      ? Number(origin.status || origin.min_status || origin.minStatus || origin.required_status || 0)
      : 0;
    const originCards = this._root?.querySelectorAll('.cultivation-origin');
    originCards?.forEach(card => {
      const id = card.dataset.id;
      card.classList.toggle('selected', !!id && id === this._selection.originId);
    });
    const sectCards = this._root?.querySelectorAll('.cultivation-sect');
    let selectionChanged = false;
    sectCards?.forEach(card => {
      const required = Number(card.dataset.minStatus || 1);
      const allowed = hasOrigin && originStatus >= required;
      const id = card.dataset.id;
      const isSelected = !!id && id === this._selection.sectId;
      card.classList.toggle('is-locked', !allowed);
      card.classList.toggle('selected', isSelected);
      if (isSelected && !allowed) {
        this._selection.sectId = null;
        this._selection.masterId = null;
        selectionChanged = true;
      }
    });
    const activeSectId = this._selection.sectId;
    const hasSect = !!this.getSect(lobby, activeSectId);
    const masterCards = this._root?.querySelectorAll('.cultivation-master');
    masterCards?.forEach(card => {
      const cardSect = card.dataset.sect;
      const required = Number(card.dataset.minStatus || 1);
      const allowedOrigin = hasOrigin && originStatus >= required;
      const matchesSect = hasSect && (!cardSect || cardSect === activeSectId);
      const allowed = allowedOrigin && matchesSect;
      const id = card.dataset.id;
      const isSelected = !!id && id === this._selection.masterId;
      card.classList.toggle('is-hidden', hasSect && cardSect && cardSect !== activeSectId);
      card.classList.toggle('is-locked', !allowed);
      card.classList.toggle('selected', isSelected);
      if (isSelected && !allowed) {
        this._selection.masterId = null;
        selectionChanged = true;
      }
    });
    this.updateStartingCoins(lobby);
    if (selectionChanged) {
      this.updateStartButton();
    }
  },
  renderStatus() {
    if (!this._root) return;
    const state = this._state || {};
    if (!state.enabled && !state.admin_preview) {
      this._root.innerHTML = `<div class="cultivation-empty">修仙玩法尚未开启，请等待管理员放行。</div>`;
      return;
    }
    if (state.endingScreen) {
      this._root.innerHTML = `<div class="cultivation-container">${this.renderEndingScreen(state.endingScreen)}</div>`;
      this.bindEndingScreen();
      return;
    }
    const fmtInt = (v) => this.fmtInt(v);
    const bestScore = fmtInt(state.best_score || 0);
    const playCount = fmtInt(state.play_count || 0);
    const last = state.last_result || {};
    const lastSummary = this.renderLastSummary(last, fmtInt);
    const rewardInfo = last && last.reward && Number(last.reward.bricks) > 0
      ? `<div class="cultivation-summary__reward">🎁 获得 ${fmtInt(last.reward.bricks)} 块砖</div>`
      : '';
    const historyList = Array.isArray(state.history) && state.history.length
      ? state.history.slice().reverse().map(item => `<li><span class="label">${escapeHtml(item.stage || '')}</span><span class="meta">${fmtInt(item.score || 0)} 分 · ${fmtInt(item.age || 0)} 岁</span></li>`).join('')
      : '<li class="muted">暂无历史记录</li>';
    let body = `
      <div class="cultivation-summary">
        <div class="cultivation-summary__header">
          <div class="cultivation-summary__title">修仙历练</div>
          <div class="cultivation-summary__stats">🏆 最高 ${bestScore} 分 · 累计 ${playCount} 次</div>
        </div>
        ${lastSummary}
        ${rewardInfo}
        <div class="cultivation-summary__history">
          <div class="label">历史记录</div>
          <ul>${historyList}</ul>
        </div>
      </div>
    `;
    if (state.run && !state.run.finished) {
      body += this.renderRun(state.run);
    } else if (state.lobby) {
      body += this.renderLobby(state.lobby);
    } else {
      body += '<div class="cultivation-empty">暂无可用内容。</div>';
    }
    this._root.innerHTML = `<div class="cultivation-container">${body}</div>`;
    if (state.run && !state.run.finished) {
      this.bindRun(state.run);
    } else if (state.lobby) {
      this.bindLobby(state.lobby);
    }
  },
  renderRun(run) {
    const healthPct = Math.max(0, Math.min(100, Math.round((run.health / Math.max(run.max_health || 1, 1)) * 100)));
    const talents = Array.isArray(run.talents) ? run.talents : [];
    const event = run.pending_event || null;
    const fmtInt = (v) => this.fmtInt(v);
    const coins = fmtInt(run.coins || 0);
    const logs = Array.isArray(run.log) ? run.log.slice(-20).reverse() : [];
    const logEntries = logs.length
      ? logs.map(entry => {
          let text = '';
          let tone = 'info';
          if (entry && typeof entry === 'object') {
            text = entry.text || '';
            tone = entry.tone || 'info';
          } else {
            text = String(entry || '');
          }
          const cls = this.toneClass(tone);
          return `<li${cls ? ` class="${cls}"` : ''}>${escapeHtml(text)}</li>`;
        }).join('')
      : '<li class="muted">暂无历练记录。</li>';
    const outcome = this._state?.lastOutcome;
    const fmtSigned = (value, digits = 1) => {
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return '0';
      const fixed = digits === 0 ? Math.round(num).toString() : num.toFixed(digits);
      if (num > 0) return `+${fixed}`;
      if (num < 0) return fixed;
      return digits === 0 ? '0' : Number(0).toFixed(digits);
    };
    const outcomeBlock = outcome ? (() => {
      const cls = this.toneClass(outcome.tone);
      const narrative = outcome.narrative ? `<div class="cultivation-outcome__narrative">${escapeHtml(outcome.narrative)}</div>` : '';
      const progress = fmtSigned(outcome.progress_gain || 0, 1);
      const score = fmtSigned(outcome.score_gain || 0, 1);
      const health = fmtSigned(outcome.health_delta || 0, 1);
      return `<div class="cultivation-outcome ${cls}">${narrative}<div class="cultivation-outcome__stats">修为 ${progress} · 积分 ${score} · 体魄 ${health}</div></div>`;
    })() : '';
    const eventBlock = event ? this.renderEvent(event) : '<div class="muted">即将触发下一段奇遇...</div>';
    const lineageBlock = this.renderLineage(run.lineage);
    const talentChips = this.renderTalentChips(talents);
    const collectionsBlock = `
      <div class="cultivation-run__collections">
        ${this.renderCollection('法宝', run.artifacts, '暂无法宝')}
        ${this.renderCollection('道友', run.companions, '暂无道友')}
        ${this.renderCollection('传承', run.techniques, '暂无传承')}
      </div>
    `;
    return `
      <div class="cultivation-section">
        <div class="cultivation-run__header">
          <div>
            <div class="cultivation-run__stage">当前境界：${escapeHtml(run.stage || '')}</div>
            <div class="cultivation-run__meta">${fmtInt(run.age || 0)} 岁 · 寿元 ${fmtInt(run.lifespan || 0)} · 积分 ${fmtInt(run.score || 0)}</div>
            <div class="cultivation-run__coins">铜钱 ${coins}</div>
          </div>
          <div class="cultivation-run__health" title="生命值 ${run.health} / ${run.max_health}">
            <span>生命值</span>
            <div class="progress-bar"><div class="progress-bar__fill" style="width:${healthPct}%"></div></div>
          </div>
        </div>
        <div class="cultivation-run__stats">
          ${Object.entries(run.stats || {}).map(([key, value]) => `<div class="stat"><span>${escapeHtml(this.statLabel(key))}</span><strong>${fmtInt(value)}</strong></div>`).join('')}
        </div>
        ${lineageBlock}
        <div class="cultivation-run__talents">
          ${talentChips || '<span class="muted">未选择天赋</span>'}
        </div>
        ${collectionsBlock}
        ${outcomeBlock}
        ${eventBlock}
        <div class="cultivation-log">
          <div class="cultivation-log__title">历练轨迹</div>
          <ul>${logEntries}</ul>
        </div>
      </div>
    `;
  },
  renderEvent(event) {
    const hint = event.hint ? `<div class="cultivation-event__hint">${escapeHtml(event.hint)}</div>` : '';
    const theme = event.theme_label ? `<div class="cultivation-event__tag">✨ ${escapeHtml(event.theme_label)}机缘</div>` : '';
    const trial = event.trial || null;
    const trialStatLabel = trial?.stat_label || (trial?.stat ? this.statLabel(trial.stat) : '');
    const trialDifficulty = trial ? this.fmtInt(trial.difficulty || 0) : '';
    const trialDelay = trial ? Math.max(0, Number(trial.delay_ms || 5000)) : 0;
    const trialBlock = trial
      ? `<div class="cultivation-event__trial"><div class="headline">⚡ 特殊考验</div><div class="meta">判定属性：<span>${escapeHtml(trialStatLabel)}</span> · 难度 ${trialDifficulty}</div><div class="note">需等待天命裁决，判定时长约 ${this.fmtInt(Math.round(trialDelay / 1000))} 秒。</div></div>`
      : '';
    const options = (event.options || []).map(opt => {
      const id = escapeHtml(opt.id || '');
      const title = escapeHtml(opt.label || '');
      const detail = escapeHtml(opt.detail || '');
      let metaLine = '';
      const meta = opt.meta || {};
      const tags = [];
      if (meta.cost) {
        const cost = this.fmtInt(meta.cost);
        tags.push(`<span class="cultivation-option-pill negative">-${cost} 铜钱</span>`);
      }
      if (meta.gain_coins) {
        const gain = this.fmtInt(meta.gain_coins);
        tags.push(`<span class="cultivation-option-pill positive">+${gain} 铜钱</span>`);
      }
      if (Array.isArray(meta.sacrifice) && meta.sacrifice.length) {
        const parts = meta.sacrifice
          .map(item => {
            if (!item || !item.stat) return '';
            const label = this.statLabel(item.stat);
            const amount = this.fmtInt(item.amount || 0);
            return `${label}-${amount}`;
          })
          .filter(Boolean)
          .join('、');
        if (parts) tags.push(`<span class="cultivation-option-pill warning">献祭 ${escapeHtml(parts)}</span>`);
      }
      if (meta.loot_name) {
        tags.push(`<span class="cultivation-option-pill highlight">${escapeHtml(meta.loot_name)}</span>`);
      }
      if (meta.note) {
        tags.push(`<span class="cultivation-option-pill note">${escapeHtml(meta.note)}</span>`);
      }
      if (tags.length) {
        metaLine = `<div class="btn-meta">${tags.join('')}</div>`;
      }
      return `
        <button class="btn" data-choice="${id}">
          <div class="btn-title">${title}</div>
          <div class="btn-desc">${detail}</div>
          ${metaLine}
        </button>
      `;
    }).join('');
    const spinner = trial ? `<div class="cultivation-trial-spinner" id="cultivation-trial-spinner" data-delay="${trialDelay}"><div class="cultivation-trial-spinner__inner"><div class="spinner"></div><div class="label">天命判定中...</div></div></div>` : '';
    return `
      <div class="cultivation-event">
        <div class="cultivation-event__title">${escapeHtml(event.title || '遭遇')}</div>
        <div class="cultivation-event__desc">${escapeHtml(event.description || '')}</div>
        ${theme}
        ${hint}
        ${trialBlock}
        <div class="cultivation-event__options">${options}</div>
        ${spinner}
      </div>
    `;
  },
  showTrialSpinner(info) {
    const container = this._root?.querySelector('#cultivation-trial-spinner');
    if (!container) {
      return { wait: Promise.resolve(), apply: () => {}, abort: () => {} };
    }
    const delayAttr = Number(container.dataset.delay || info?.delay_ms || 0);
    const delay = Math.max(0, delayAttr);
    container.classList.add('is-active');
    container.innerHTML = `<div class="cultivation-trial-spinner__inner"><div class="spinner"></div><div class="label">天命判定中...</div></div>`;
    let timer = null;
    const wait = new Promise(resolve => {
      timer = setTimeout(() => {
        timer = null;
        resolve();
      }, delay);
    });
    return {
      wait,
      apply: (outcome) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        const fortune = outcome?.fortune || (outcome?.passed ? '吉' : '凶');
        const toneClass = outcome?.fortune_tone ? this.toneClass(outcome.fortune_tone) : outcome?.passed ? 'tone-highlight' : 'tone-danger';
        const effective = this.fmtInt(outcome?.effective || 0);
        const difficulty = this.fmtInt(outcome?.difficulty || info?.difficulty || 0);
        container.innerHTML = `<div class="cultivation-trial-spinner__inner result ${toneClass}"><div class="label">${escapeHtml(fortune)} · 判定 ${effective} / ${difficulty}</div></div>`;
        setTimeout(() => {
          container.classList.remove('is-active');
        }, 1400);
      },
      abort: () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        container.classList.remove('is-active');
        container.innerHTML = '';
      },
    };
  },
  bindRun(run) {
    const event = run.pending_event || {};
    const trialInfo = event.trial || null;
    const buttons = this._root.querySelectorAll('[data-choice]');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (this._loading) return;
        const choice = btn.dataset.choice;
        const needsTrial = !!trialInfo && choice && choice.startsWith('trial-');
        let spinnerCtrl = null;
        try {
          this._loading = true;
          btn.classList.add('is-loading');
          const advancePromise = API.cultivationAdvance({ choice });
          if (needsTrial) {
            spinnerCtrl = this.showTrialSpinner(trialInfo);
          }
          let resp;
          if (spinnerCtrl) {
            const results = await Promise.all([advancePromise, spinnerCtrl.wait]);
            resp = results[0];
          } else {
            resp = await advancePromise;
          }
          if (spinnerCtrl) {
            spinnerCtrl.apply(resp?.outcome?.trial || resp?.result?.trial);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          if (resp.finished) {
            this._state.lastOutcome = null;
            this._state.run = null;
            if (typeof resp.best_score === 'number') {
              this._state.best_score = resp.best_score;
            }
            if (resp.last_result) {
              this._state.last_result = resp.last_result;
            }
            const endingResult = resp.result || resp.last_result || this._state.last_result || {};
            this._state.endingScreen = {
              result: endingResult,
              bestScore: typeof resp.best_score === 'number' ? resp.best_score : this._state.best_score,
            };
            this.renderStatus();
            window.PresenceTracker?.updateDetails?.(this.presence());
          } else {
            this._state.run = resp.run;
            this._state.lastOutcome = resp.outcome;
            this.renderStatus();
            window.PresenceTracker?.updateDetails?.(this.presence());
          }
        } catch (e) {
          if (spinnerCtrl) {
            spinnerCtrl.abort();
          }
          alert(e.message || e);
        } finally {
          this._loading = false;
          btn.classList.remove('is-loading');
        }
      });
    });
  },
  renderLobby(lobby) {
    const fmtInt = (v) => this.fmtInt(v);
    const points = fmtInt(lobby.points || 0);
    const talents = Array.isArray(lobby.talents) ? lobby.talents : [];
    const baseStats = lobby.base_stats || {};
    const coinsPreview = fmtInt(this.calcStartingCoins(lobby));
    const rarityLegend = lobby.talent_rarities || {};
    const refreshLeft = Number(lobby.refreshes_left || 0);
    const talentCards = talents.map(t => {
      const effectText = Array.isArray(t.effects) && t.effects.length
        ? t.effects.map(e => `${escapeHtml(e.label || '')} +${fmtInt(e.value || 0)}`).join('、')
        : '无额外加成';
      const rarityTone = t.rarity_tone ? ` rarity-${escapeHtml(t.rarity_tone)}` : '';
      const rarityLabel = t.rarity_label ? `<span class="cultivation-talent__rarity${rarityTone}">${escapeHtml(t.rarity_label)}</span>` : '';
      return `
        <div class="cultivation-talent" data-talent="${escapeHtml(t.id || '')}">
          <div class="cultivation-talent__head">
            <div class="cultivation-talent__name">${escapeHtml(t.name || '')}</div>
            ${rarityLabel}
          </div>
          <div class="cultivation-talent__desc">${escapeHtml(t.desc || '')}</div>
          <div class="cultivation-talent__effects">${effectText}</div>
        </div>
      `;
    }).join('') || '<div class="muted">暂未生成天赋，请稍候刷新。</div>';
    const rarityLegendHtml = Object.entries(rarityLegend).map(([key, info]) => {
      const tone = info && info.tone ? ` rarity-${escapeHtml(info.tone)}` : '';
      const label = info && info.label ? escapeHtml(info.label) : escapeHtml(key);
      return `<span class="cultivation-rarity-pill${tone}">${label}</span>`;
    }).join('');
    const statsInputs = Object.entries(baseStats).map(([key, value]) => `
      <div class="cultivation-attr" data-stat="${escapeHtml(key)}">
        <label>${escapeHtml(this.statLabel(key))}</label>
        <div class="cultivation-attr__value">基础 ${fmtInt(value)} + <input type="number" min="0" value="0" data-alloc="${escapeHtml(key)}" /></div>
      </div>
    `).join('');
    const originsList = Array.isArray(lobby.origins) ? lobby.origins : [];
    const sectsList = Array.isArray(lobby.sects) ? lobby.sects : [];
    const mastersList = Array.isArray(lobby.masters) ? lobby.masters : [];
    const originCards = originsList.map(origin => {
      const id = escapeHtml(origin.id || '');
      const selected = origin.id === this._selection.originId ? ' selected' : '';
      const tag = origin.status_label ? `<span class="cultivation-lineage-card__tag">${escapeHtml(origin.status_label)}</span>` : '';
      const desc = origin.desc ? `<div class="cultivation-lineage-card__desc">${escapeHtml(origin.desc)}</div>` : '';
      const effects = this.renderEffectPills(origin.effects);
      const coins = fmtInt(origin.coins || 0);
      return `
        <div class="cultivation-lineage-card cultivation-origin${selected}" data-id="${id}" data-min-status="${escapeHtml(String(origin.status || 0))}">
          <div class="cultivation-lineage-card__title">${escapeHtml(origin.name || '')}</div>
          ${tag}
          ${desc}
          <div class="cultivation-lineage-card__effects">${effects}</div>
          <div class="cultivation-lineage-card__coins">铜钱 +${coins}</div>
        </div>
      `;
    }).join('') || '<div class="muted">暂无出身选项</div>';
    const sectCards = sectsList.map(sect => {
      const id = escapeHtml(sect.id || '');
      const selected = sect.id === this._selection.sectId ? ' selected' : '';
      const effects = this.renderEffectPills(sect.effects);
      const coins = fmtInt(sect.coins || 0);
      const motto = sect.motto ? `<div class="cultivation-lineage-card__desc">${escapeHtml(sect.motto)}</div>` : '';
      return `
        <div class="cultivation-lineage-card cultivation-sect${selected}" data-id="${id}" data-min-status="${escapeHtml(String(sect.min_status || 0))}">
          <div class="cultivation-lineage-card__title">${escapeHtml(sect.name || '')}</div>
          ${motto}
          <div class="cultivation-lineage-card__effects">${effects}</div>
          <div class="cultivation-lineage-card__coins">铜钱 +${coins}</div>
        </div>
      `;
    }).join('') || '<div class="muted">暂无宗门选项</div>';
    const masterCards = mastersList.map(master => {
      const id = escapeHtml(master.id || '');
      const selected = master.id === this._selection.masterId ? ' selected' : '';
      const title = master.title ? ` · ${escapeHtml(master.title)}` : '';
      const motto = master.motto ? `<div class="cultivation-lineage-card__desc">${escapeHtml(master.motto)}</div>` : '';
      const effects = this.renderEffectPills(master.effects);
      const coins = fmtInt(master.coins || 0);
      const traits = Array.isArray(master.traits) && master.traits.length
        ? `<div class="cultivation-lineage-card__traits">${master.traits.map(t => `<span>${escapeHtml(t || '')}</span>`).join('')}</div>`
        : '';
      return `
        <div class="cultivation-lineage-card cultivation-master${selected}" data-id="${id}" data-sect="${escapeHtml(master.sect || '')}" data-min-status="${escapeHtml(String(master.min_status || 0))}">
          <div class="cultivation-lineage-card__title">${escapeHtml(master.name || '')}${title}</div>
          ${motto}
          ${traits}
          <div class="cultivation-lineage-card__effects">${effects}</div>
          <div class="cultivation-lineage-card__coins">铜钱 +${coins}</div>
        </div>
      `;
    }).join('') || '<div class="muted">暂无师承选项</div>';
    const rarityLegendBlock = rarityLegendHtml
      ? `<div class="cultivation-rarity-legend">稀有度：${rarityLegendHtml}</div>`
      : '';
    return `
      <div class="cultivation-section">
        <div class="cultivation-lobby__meta">可分配属性点：<span id="cultivation-points-left">${points}</span> · 最多选择 ${fmtInt(lobby.max_talents || 0)} 个天赋 · 预计起始铜钱 <span id="cultivation-start-coins">${coinsPreview}</span></div>
        <div class="cultivation-refresh__info">剩余刷新 <span class="cultivation-refresh__count">${fmtInt(refreshLeft)}</span> 次</div>
        <div class="cultivation-lobby__actions">
          <button class="btn" id="cultivation-refresh">刷新天赋</button>
        </div>
        ${rarityLegendBlock}
        <div class="cultivation-lineage-select">
          <div class="cultivation-lineage-select__group">
            <div class="group-title">选择出身</div>
            <div class="group-body">${originCards}</div>
          </div>
          <div class="cultivation-lineage-select__group">
            <div class="group-title">选择宗门</div>
            <div class="group-body">${sectCards}</div>
          </div>
          <div class="cultivation-lineage-select__group">
            <div class="group-title">选择师承</div>
            <div class="group-body">${masterCards}</div>
          </div>
        </div>
        <div class="cultivation-talent-list">${talentCards}</div>
        <div class="cultivation-attr-list">${statsInputs}</div>
        <div class="cultivation-start">
          <button class="btn primary" id="cultivation-start">开始历练</button>
        </div>
      </div>
    `;
  },
  bindLobby(lobby) {
    const refreshBtn = this._root.querySelector('#cultivation-refresh');
    if (refreshBtn) {
      const refreshLeft = Number(lobby.refreshes_left || 0);
      if (refreshLeft <= 0) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-disabled');
      }
      refreshBtn.addEventListener('click', async () => {
        if (this._loading || refreshBtn.disabled) return;
        try {
          this._loading = true;
          refreshBtn.classList.add('is-loading');
          const data = await API.cultivationRefresh();
          if (data && data.lobby) {
            this._state.lobby = data.lobby;
            this.resetSelection();
            this.renderStatus();
            window.PresenceTracker?.updateDetails?.(this.presence());
          }
        } catch (e) {
          alert(e.message || e);
        } finally {
          this._loading = false;
          refreshBtn.classList.remove('is-loading');
        }
      });
    }
    const talentNodes = this._root.querySelectorAll('.cultivation-talent');
    talentNodes.forEach(node => {
      node.addEventListener('click', () => {
        const id = node.dataset.talent;
        if (!id) return;
        const max = Number(lobby.max_talents || 0);
        if (node.classList.contains('selected')) {
          node.classList.remove('selected');
          this._selection.talents.delete(id);
        } else {
          if (this._selection.talents.size >= max) {
            alert(`最多可选择 ${max} 个天赋`);
            return;
          }
          this._selection.talents.add(id);
          node.classList.add('selected');
        }
        this.updateStartButton();
      });
    });
    const originCards = this._root.querySelectorAll('.cultivation-origin');
    originCards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('is-locked')) return;
        const id = card.dataset.id;
        if (!id) return;
        if (this._selection.originId !== id) {
          this._selection.originId = id;
          this._selection.sectId = null;
          this._selection.masterId = null;
        }
        this.updateLineageAvailability(lobby);
        this.updateStartButton();
      });
    });
    const sectCards = this._root.querySelectorAll('.cultivation-sect');
    sectCards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('is-locked')) return;
        const id = card.dataset.id;
        if (!id) return;
        if (this._selection.sectId !== id) {
          this._selection.sectId = id;
          this._selection.masterId = null;
        }
        this.updateLineageAvailability(lobby);
        this.updateStartButton();
      });
    });
    const masterCards = this._root.querySelectorAll('.cultivation-master');
    masterCards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('is-locked') || card.classList.contains('is-hidden')) return;
        const id = card.dataset.id;
        if (!id) return;
        this._selection.masterId = id;
        this.updateLineageAvailability(lobby);
        this.updateStartButton();
      });
    });
    const inputs = this._root.querySelectorAll('input[data-alloc]');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const stat = input.dataset.alloc;
        let value = parseInt(input.value, 10);
        if (!Number.isFinite(value) || value < 0) value = 0;
        const points = Number(lobby.points || 0);
        const otherSum = Object.entries(this._selection.allocations).reduce((sum, [k, v]) => {
          if (k === stat) return sum;
          return sum + Number(v || 0);
        }, 0);
        if (value + otherSum > points) {
          value = Math.max(0, points - otherSum);
        }
        this._selection.allocations[stat] = value;
        input.value = value;
        this.updatePointsRemaining(points);
        this.updateStartButton();
      });
    });
    const startBtn = this._root.querySelector('#cultivation-start');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        if (this._loading) return;
        const points = Number(lobby.points || 0);
        const totalAlloc = Object.values(this._selection.allocations).reduce((sum, v) => sum + Number(v || 0), 0);
        if (totalAlloc !== points) {
          alert(`请分配完 ${points} 点属性（当前 ${totalAlloc} 点）`);
          return;
        }
        const selected = Array.from(this._selection.talents);
        if (selected.length > Number(lobby.max_talents || 0)) {
          alert(`最多选择 ${lobby.max_talents} 个天赋`);
          return;
        }
        try {
          this._loading = true;
          startBtn.classList.add('is-loading');
          const payload = {
            talents: selected,
            attributes: this._selection.allocations,
            origin: this._selection.originId,
            sect: this._selection.sectId,
            master: this._selection.masterId,
          };
          const resp = await API.cultivationBegin(payload);
          if (resp && resp.run) {
            this._state.run = resp.run;
            this._state.lobby = null;
            this._state.lastOutcome = null;
            this.renderStatus();
            window.PresenceTracker?.updateDetails?.(this.presence());
          } else {
            await this.refresh();
          }
        } catch (e) {
          alert(e.message || e);
        } finally {
          this._loading = false;
          startBtn.classList.remove('is-loading');
        }
      });
    }
    this.updatePointsRemaining(Number(lobby.points || 0));
    this.updateStartButton();
    this.updateLineageAvailability(lobby);
  },
  updatePointsRemaining(points) {
    const total = Object.values(this._selection.allocations).reduce((sum, v) => sum + Number(v || 0), 0);
    const left = Math.max(0, points - total);
    const label = this._root.querySelector('#cultivation-points-left');
    if (label) {
      label.textContent = this.fmtInt(left);
    }
  },
  updateStartButton() {
    const startBtn = this._root.querySelector('#cultivation-start');
    if (!startBtn) return;
    const lobby = this._state?.lobby;
    if (!lobby) return;
    const points = Number(lobby.points || 0);
    const total = Object.values(this._selection.allocations).reduce((sum, v) => sum + Number(v || 0), 0);
    const talents = this._selection.talents.size;
    const lineageReady = !!(this._selection.originId && this._selection.sectId && this._selection.masterId);
    const ready = (total === points) && lineageReady;
    startBtn.disabled = !ready;
    startBtn.classList.toggle('is-disabled', !ready);
    const info = this._root.querySelector('.cultivation-lobby__meta');
    if (info) {
      info.dataset.selectedTalents = talents;
    }
  },
  statLabel(key) {
    switch (key) {
      case 'body': return '体魄';
      case 'mind': return '悟性';
      case 'spirit': return '心性';
      case 'luck': return '气运';
      default: return key;
    }
  },
};

window.CultivationPage = CultivationPage;

