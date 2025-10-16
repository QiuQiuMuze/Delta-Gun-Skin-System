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
    const fmtInt = (v) => this.fmtInt(v);
    const bestScore = fmtInt(state.best_score || 0);
    const playCount = fmtInt(state.play_count || 0);
    const last = state.last_result || {};
    const lastSummary = last && last.score != null
      ? `<div class="cultivation-summary__last">最近一次：得分 ${fmtInt(last.score || 0)} · ${escapeHtml(last.ending || '')}</div>`
      : '<div class="cultivation-summary__last">尚未完成任何历练。</div>';
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
    const logEntries = Array.isArray(run.log) && run.log.length
      ? run.log.slice(-24).reverse().map(entry => {
        const item = (entry && typeof entry === 'object') ? entry : { text: entry, tone: 'info' };
        return `<li class="log-entry ${this.logToneClass(item.tone)}">${escapeHtml(item.text || '')}</li>`;
      }).join('')
      : '<li class="muted">暂无历练记录。</li>';
    const outcome = this._state?.lastOutcome;
    const outcomeBlock = outcome ? `
      <div class="cultivation-outcome log-entry ${this.logToneClass(outcome.tone)}">
        <div class="cultivation-outcome__title">${outcome.success ? '✨ 圆满收获' : '⚡ 遭遇挫折'}</div>
        <div class="cultivation-outcome__text">${escapeHtml(outcome.narration || '')}</div>
        <div class="cultivation-outcome__stats">修为 ${outcome.progress_gain >= 0 ? '+' : ''}${fmtInt(Math.round(outcome.progress_gain || 0))} · 体魄变化 ${Number(outcome.health_delta || 0).toFixed(1)}</div>
      </div>
    ` : '';
    return `
      <div class="cultivation-section">
        <div class="cultivation-run__header">
          <div>
            <div class="cultivation-run__stage">当前境界：<span class="tone-stage">${escapeHtml(run.stage || '')}</span></div>
            <div class="cultivation-run__meta"><span class="meta-chip">${fmtInt(run.age || 0)} 岁</span><span class="meta-chip">寿元 ${fmtInt(run.lifespan || 0)}</span><span class="meta-chip meta-chip--score">积分 ${fmtInt(run.score || 0)}</span></div>
          </div>
          <div class="cultivation-run__health" title="生命值 ${run.health} / ${run.max_health}">
            <span>生命值</span>
            <div class="progress-bar"><div class="progress-bar__fill" style="width:${healthPct}%"></div></div>
            <span class="progress-bar__value">${Number(run.health || 0).toFixed(1)} / ${Number(run.max_health || 0).toFixed(1)}</span>
          </div>
        </div>
        ${outcomeBlock}
        <div class="cultivation-run__stats">
          ${Object.entries(run.stats || {}).map(([key, value]) => `<div class="stat stat--${escapeHtml(key)}"><span>${escapeHtml(this.statLabel(key))}</span><strong>${fmtInt(value)}</strong></div>`).join('')}
        </div>
        <div class="cultivation-run__talents">
          ${talents.length ? talents.map(t => `<span class="talent-chip" title="${escapeHtml(t.desc || '')}">${escapeHtml(t.name || '')}</span>`).join('') : '<span class="muted">未选择天赋</span>'}
        </div>
        ${event ? this.renderEvent(event) : '<div class="muted">即将触发下一段奇遇...</div>'}
        <div class="cultivation-log">
          <div class="cultivation-log__title">历练轨迹</div>
          <ul>${logEntries}</ul>
        </div>
      </div>
    `;
  },
  renderEvent(event) {
    const hint = event.hint ? `<div class="cultivation-event__hint">${escapeHtml(event.hint)}</div>` : '';
    const kindLabel = this.eventKindLabel(event.kind);
    const kindClass = this.eventKindClass(event.kind);
    const options = (event.options || []).map(opt => {
      const riskText = this.riskLabel(opt.risk);
      const riskClass = this.riskClass(opt.risk);
      const focus = opt.focus ? `<span class="option-focus">主修 ${escapeHtml(this.statLabel(opt.focus))}</span>` : '';
      const riskBadge = riskText ? `<span class="option-risk ${riskClass}">${escapeHtml(riskText)}</span>` : '';
      return `
        <button class="btn" data-choice="${escapeHtml(opt.id || '')}">
          <div class="btn-title">${escapeHtml(opt.label || '')}</div>
          <div class="btn-desc">${escapeHtml(opt.detail || '')}</div>
          <div class="btn-meta">${focus}${riskBadge}</div>
        </button>
      `;
    }).join('');
    return `
      <div class="cultivation-event">
        <div class="cultivation-event__title">${escapeHtml(event.title || '遭遇')}${kindLabel ? `<span class="cultivation-event__tag ${kindClass}">${escapeHtml(kindLabel)}</span>` : ''}</div>
        <div class="cultivation-event__desc">${escapeHtml(event.description || '')}</div>
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
            await this.refresh();
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
  logToneClass(tone) {
    switch (tone) {
      case 'success': return 'log-entry--success';
      case 'danger': return 'log-entry--danger';
      case 'fortune': return 'log-entry--fortune';
      case 'breakthrough': return 'log-entry--breakthrough';
      default: return 'log-entry--info';
    }
  },
  eventKindLabel(kind) {
    switch (kind) {
      case 'meditation': return '静修';
      case 'adventure': return '历练';
      case 'opportunity': return '奇遇';
      case 'training': return '试炼';
      case 'tribulation': return '渡劫';
      default: return '';
    }
  },
  eventKindClass(kind) {
    switch (kind) {
      case 'meditation': return 'tag-meditation';
      case 'adventure': return 'tag-adventure';
      case 'opportunity': return 'tag-opportunity';
      case 'training': return 'tag-training';
      case 'tribulation': return 'tag-tribulation';
      default: return 'tag-generic';
    }
  },
  riskLabel(risk) {
    const value = Number(risk);
    if (!Number.isFinite(value)) return '';
    if (value <= 0.22) return '风险：低';
    if (value <= 0.35) return '风险：中';
    return '风险：高';
  },
  riskClass(risk) {
    const value = Number(risk);
    if (!Number.isFinite(value)) return 'risk-mid';
    if (value <= 0.22) return 'risk-low';
    if (value <= 0.35) return 'risk-mid';
    return 'risk-high';
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

