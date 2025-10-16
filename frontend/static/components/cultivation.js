const CultivationPage = {
  _root: null,
  _state: null,
  _selection: { talents: new Set(), allocations: {} },
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
  renderLineage(lineage) {
    const info = lineage || {};
    const sect = info.sect || {};
    const master = info.master || {};
    const sectName = sect.name ? escapeHtml(sect.name) : '散修';
    const sectMotto = sect.motto ? `<div class="meta">${escapeHtml(sect.motto)}</div>` : '';
    const masterName = master.name ? escapeHtml(master.name) : '无名前辈';
    const masterTitle = master.title ? ` · ${escapeHtml(master.title)}` : '';
    const masterMotto = master.motto ? `<div class="meta">${escapeHtml(master.motto)}</div>` : '';
    return `
      <div class="cultivation-lineage">
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
    const talents = Array.isArray(last.talents) && last.talents.length
      ? `<div class="cultivation-summary__talents">天赋：${last.talents.map(name => `<span class="cultivation-chip"><span class="cultivation-chip__label">${escapeHtml(name || '')}</span></span>`).join('')}</div>`
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
    const talents = Array.isArray(result.talents) && result.talents.length
      ? `<div class="cultivation-ending__talents">天赋：${result.talents.map(name => `<span class="cultivation-chip"><span class="cultivation-chip__label">${escapeHtml(name || '')}</span></span>`).join('')}</div>`
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
    this._selection = { talents: new Set(), allocations: {} };
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
    this._selection = { talents: new Set(), allocations: {} };
    const lobby = this._state?.lobby;
    if (lobby && lobby.base_stats) {
      Object.keys(lobby.base_stats).forEach(key => {
        this._selection.allocations[key] = 0;
      });
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
          ${talents.length ? talents.map(t => `<span class="talent-chip" title="${escapeHtml(t.desc || '')}">${escapeHtml(t.name || '')}</span>`).join('') : '<span class="muted">未选择天赋</span>'}
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
    const options = (event.options || []).map(opt => `
      <button class="btn" data-choice="${escapeHtml(opt.id || '')}">
        <div class="btn-title">${escapeHtml(opt.label || '')}</div>
        <div class="btn-desc">${escapeHtml(opt.detail || '')}</div>
      </button>
    `).join('');
    return `
      <div class="cultivation-event">
        <div class="cultivation-event__title">${escapeHtml(event.title || '遭遇')}</div>
        <div class="cultivation-event__desc">${escapeHtml(event.description || '')}</div>
        ${theme}
        ${hint}
        <div class="cultivation-event__options">${options}</div>
      </div>
    `;
  },
  bindRun(run) {
    const buttons = this._root.querySelectorAll('[data-choice]');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (this._loading) return;
        const choice = btn.dataset.choice;
        try {
          this._loading = true;
          btn.classList.add('is-loading');
          const resp = await API.cultivationAdvance({ choice });
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
    const talentCards = talents.map(t => {
      const effectText = Array.isArray(t.effects) && t.effects.length
        ? t.effects.map(e => `${escapeHtml(e.label || '')} +${fmtInt(e.value || 0)}`).join('、')
        : '无额外加成';
      return `
        <div class="cultivation-talent" data-talent="${escapeHtml(t.id || '')}">
          <div class="cultivation-talent__name">${escapeHtml(t.name || '')}</div>
          <div class="cultivation-talent__desc">${escapeHtml(t.desc || '')}</div>
          <div class="cultivation-talent__effects">${effectText}</div>
        </div>
      `;
    }).join('') || '<div class="muted">暂未生成天赋，请稍候刷新。</div>';
    const statsInputs = Object.entries(baseStats).map(([key, value]) => `
      <div class="cultivation-attr" data-stat="${escapeHtml(key)}">
        <label>${escapeHtml(this.statLabel(key))}</label>
        <div class="cultivation-attr__value">基础 ${fmtInt(value)} + <input type="number" min="0" value="0" data-alloc="${escapeHtml(key)}" /></div>
      </div>
    `).join('');
    return `
      <div class="cultivation-section">
        <div class="cultivation-lobby__meta">可分配属性点：<span id="cultivation-points-left">${points}</span> · 最多选择 ${fmtInt(lobby.max_talents || 0)} 个天赋</div>
        <div class="cultivation-lobby__actions">
          <button class="btn" id="cultivation-refresh">刷新天赋</button>
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
      refreshBtn.addEventListener('click', async () => {
        if (this._loading) return;
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
          const resp = await API.cultivationBegin({ talents: selected, attributes: this._selection.allocations });
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
    startBtn.disabled = (total !== points);
    startBtn.classList.toggle('is-disabled', total !== points);
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

