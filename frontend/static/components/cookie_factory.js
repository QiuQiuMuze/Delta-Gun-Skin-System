const CookieFactoryPage = {
  _data: null,
  _loading: false,
  async fetchStatus() {
    try {
      this._data = await API.cookieStatus();
      const enabled = !!this._data?.enabled;
      const available = enabled || !!API._me?.is_admin;
      API._features = {
        ...(API._features || {}),
        cookie_factory: { enabled, available }
      };
      if (typeof renderNav === "function") {
        renderNav();
      }
    } catch (e) {
      this._data = { error: e.message || String(e) };
    }
    return this._data;
  },
  async render() {
    await this.fetchStatus();
    return `<div class="card cookie-card"><div id="cookie-factory-root">${this.renderInner()}</div></div>`;
  },
  bind() {
    this.bindInner();
  },
  renderInner() {
    if (!this._data) {
      return `<div class="muted">加载中...</div>`;
    }
    if (this._data.error) {
      return `<div class="error">加载失败：${escapeHtml(this._data.error)}</div>`;
    }
    if (!this._data.enabled) {
      if (this._data.admin_preview) {
        return `<div class="cookie-disabled">小游戏当前未开放，对普通玩家隐藏。<br>管理员仍可预览和调试。</div>`;
      }
      return `<div class="cookie-disabled">饼干工厂小游戏暂未开放，请等待管理员开启。</div>`;
    }
    const profile = this._data.profile || {};
    const weekly = this._data.weekly || {};
    const golden = this._data.golden || {};
    const sugar = this._data.sugar || {};
    const buildings = this._data.buildings || [];
    const miniGames = this._data.mini_games || [];
    const settlement = this._data.settlement || this._data.last_report;
    const actionResult = this._data.action_result;
    const loginResult = this._data.login_result;
    const bankedCookies = Number(profile.cookies || 0);
    const totalCookies = Number(profile.total_cookies || 0);

    const fmt = (num) => {
      if (num == null || Number.isNaN(num)) return "0";
      if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
      if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
      if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(2) + "K";
      return Number(num).toFixed(2);
    };
    const fmtInt = (num) => Number(num || 0).toLocaleString();

    const notice = (() => {
      if (actionResult) {
        if (actionResult.building) {
          return `🏗️ 成功购买 ${escapeHtml(actionResult.building)}，累计 ${fmtInt(actionResult.count)} 座`;
        }
        if (actionResult.bonus != null) {
          return `✨ 黄金饼干爆发，额外产出 ${fmt(actionResult.bonus)} 饼干`;
        }
        if (actionResult.leveled) {
          return `🎮 ${escapeHtml(actionResult.mini)} 等级提升至 ${fmtInt(actionResult.level)} 级！`;
        }
        if (actionResult.points_gained) {
          return `🌟 升天成功，获得 ${fmtInt(actionResult.points_gained)} 声望点`;
        }
        if (actionResult.sugar_lumps != null) {
          return `🍭 收获糖块，总数 ${fmtInt(actionResult.sugar_lumps)}`;
        }
        if (actionResult.gained != null) {
          return `🍪 手动点击收获 ${fmt(actionResult.gained)} 饼干`;
        }
      }
      if (loginResult && loginResult.added) {
        return `📬 今日签到成功，获得 ${fmtInt(loginResult.daily_reward)} 砖收益额度`;
      }
      return "";
    })();

    const renderBuildings = () => {
      if (!buildings.length) {
        return `<div class="muted">暂无可购买建筑</div>`;
      }
      return buildings.map(item => {
        const disabled = bankedCookies < item.next_cost ? "disabled" : "";
        return `
          <div class="cookie-building">
            <div class="cookie-building__icon">${escapeHtml(item.icon || "🏠")}</div>
            <div class="cookie-building__info">
              <div class="cookie-building__name">${escapeHtml(item.name)} <span class="count">×${fmtInt(item.count)}</span></div>
              <div class="cookie-building__desc">${escapeHtml(item.desc || "")}</div>
              <div class="cookie-building__meta">基础 ${item.base_cps} / 秒 · 下一级花费 ${fmtInt(item.next_cost)} 🍪</div>
            </div>
            <button class="btn btn-mini" data-build="${item.key}" ${disabled}>购入</button>
          </div>`;
      }).join("");
    };

    const renderMini = () => {
      if (!miniGames.length) return `<div class="muted">暂无小游戏</div>`;
      return miniGames.map(item => {
        const pct = Math.min(100, Math.round((item.progress || 0) / (item.threshold || 1) * 100));
        return `
          <div class="cookie-mini">
            <div class="cookie-mini__icon">${escapeHtml(item.icon || "🎯")}</div>
            <div class="cookie-mini__body">
              <div class="cookie-mini__head">${escapeHtml(item.name)} · 等级 ${fmtInt(item.level || 0)}</div>
              <div class="cookie-mini__desc">${escapeHtml(item.desc || "")}</div>
              <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
            </div>
            <button class="btn btn-mini" data-mini="${item.key}">开展</button>
          </div>`;
      }).join("");
    };

    const projectedPct = weekly.cap ? Math.min(100, Math.round((weekly.projected_bricks || 0) / weekly.cap * 100)) : 0;
    const settlementCard = settlement ? `
      <div class="cookie-report">
        <h4>上周结算</h4>
        <div class="report-line">📦 发放砖：<b>${fmtInt(settlement.awarded || 0)}</b></div>
        <div class="report-grid">
          <span>🍪 基础：${fmtInt(settlement.base_bricks || 0)}</span>
          <span>⚡ 活跃：${fmtInt(settlement.active_bricks || 0)}</span>
          <span>📬 签到：${fmtInt(settlement.login_bricks || 0)}</span>
          <span>🔥 连击：${fmtInt(settlement.streak_bonus || 0)}</span>
        </div>
        <div class="muted small">结算时间：${settlement.timestamp ? new Date(settlement.timestamp * 1000).toLocaleString() : "--"}</div>
      </div>` : "";

    const weeklyTable = `
      <div class="cookie-weekly">
        <div class="progress-card">
          <div class="progress-card__head">🎯 本周预计 ${fmtInt(weekly.projected_bricks || 0)} / ${fmtInt(weekly.cap || 100)} 块砖</div>
          <div class="progress-bar big"><div class="progress-bar__fill" style="width:${projectedPct}%"></div></div>
          <div class="cookie-breakdown">
            <span>🍪 基础 ${fmtInt(weekly.base_bricks || 0)}</span>
            <span>⚡ 活跃 ${fmtInt(weekly.active_bricks || 0)}</span>
            <span>📬 签到 ${fmtInt(weekly.login_bricks || 0)}</span>
            <span>🔥 连击 ${fmtInt(weekly.streak_bonus || 0)}</span>
          </div>
          <div class="muted small">今日签到：${weekly.daily_login_claimed ? "✅ 已完成" : "⌛ 待签到"} · 连续登录 ${fmtInt(weekly.login_streak || 0)} 天</div>
        </div>
      </div>`;

    const actionNotice = notice ? `<div class="cookie-notice">${notice}</div>` : "";

    return `
      ${actionNotice}
      <div class="cookie-hero">
        <div class="cookie-big" id="cookie-big" title="点击生产饼干">
          <div class="cookie-big__icon">🍪</div>
          <div class="cookie-big__count">${fmt(bankedCookies)}</div>
          <div class="cookie-big__label">点击饼干生产 · 累计 ${fmt(totalCookies)}</div>
        </div>
        <div class="cookie-stats">
          <div class="stat-chip">⚙️ 每秒 ${fmt(profile.cps)} / 有效 ${fmt(profile.effective_cps)}</div>
          <div class="stat-chip">🌟 声望 ${fmtInt(profile.prestige || 0)} · 点数 ${fmtInt(profile.prestige_points || 0)}</div>
          <div class="stat-chip">🍭 糖块 ${fmtInt(profile.sugar_lumps || 0)}</div>
          <div class="stat-chip">📈 加成 ×${profile.bonus_multiplier?.toFixed(2) || "1.00"}</div>
        </div>
      </div>
      <div class="cookie-actions">
        <button class="btn" id="cookie-golden" ${golden.available ? "" : "disabled"}>✨ 黄金饼干${golden.ready_in > 0 ? `（${Math.ceil(golden.ready_in / 60)} 分钟后）` : ""}</button>
        <button class="btn" id="cookie-login" ${weekly.daily_login_claimed ? "disabled" : ""}>📬 每日签到</button>
        <button class="btn" id="cookie-sugar" ${sugar.available ? "" : "disabled"}>🍭 收获糖块${sugar.ready_in > 0 ? `（${Math.ceil(sugar.ready_in / 3600)} 小时后）` : ""}</button>
        <button class="btn" id="cookie-prestige" ${totalCookies < 1_000_000 ? "disabled" : ""}>🌟 升天重置</button>
      </div>
      <div class="cookie-section">
        <h3>🏭 建筑</h3>
        <div class="cookie-buildings">${renderBuildings()}</div>
      </div>
      <div class="cookie-section">
        <h3>🎮 小游戏</h3>
        <div class="cookie-minis">${renderMini()}</div>
      </div>
      ${weeklyTable}
      ${settlementCard}
    `;
  },
  bindInner() {
    const root = document.getElementById("cookie-factory-root");
    if (!root) return;
    const big = document.getElementById("cookie-big");
    if (big) {
      big.onclick = () => this.handleAction({ type: "click", amount: 1 });
    }
    const goldenBtn = document.getElementById("cookie-golden");
    if (goldenBtn) {
      goldenBtn.onclick = () => this.handleAction({ type: "golden" });
    }
    const loginBtn = document.getElementById("cookie-login");
    if (loginBtn) {
      loginBtn.onclick = () => this.handleLogin();
    }
    const sugarBtn = document.getElementById("cookie-sugar");
    if (sugarBtn) {
      sugarBtn.onclick = () => this.handleAction({ type: "sugar" });
    }
    const prestigeBtn = document.getElementById("cookie-prestige");
    if (prestigeBtn) {
      prestigeBtn.onclick = () => this.handleAction({ type: "prestige" });
    }
    root.querySelectorAll('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-build');
        this.handleAction({ type: 'buy_building', building: key });
      });
    });
    root.querySelectorAll('[data-mini]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mini');
        this.handleAction({ type: 'mini', mini: key });
      });
    });
  },
  async handleLogin() {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await API.cookieLogin();
      this.updateView();
    } catch (e) {
      alert(e.message || '签到失败');
    } finally {
      this._loading = false;
    }
  },
  async handleAction(payload) {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await API.cookieAct(payload);
      this.updateView();
    } catch (e) {
      alert(e.message || '操作失败');
    } finally {
      this._loading = false;
    }
  },
  async refresh() {
    await this.fetchStatus();
    this.updateView();
  },
  updateView() {
    const root = document.getElementById('cookie-factory-root');
    if (!root) return;
    root.innerHTML = this.renderInner();
    this.bindInner();
  }
};
