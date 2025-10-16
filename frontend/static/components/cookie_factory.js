const CookieFactoryPage = {
  _data: null,
  _loading: false,
  _tickTimer: null,
  _tickState: null,
  _lastError: null,
  _errorTimer: null,
  _guideKey: "click",
  funFacts: [
    { icon: "🥠", title: "幸运签", text: "今天的烤炉特别顺手，别忘了摸摸黄金饼干。" },
    { icon: "🚀", title: "增产计划", text: "科技加持！升级工厂可以显著提升每秒产量。" },
    { icon: "🎵", title: "工厂节奏", text: "跟着节拍点击大饼干，连击会带来额外活跃积分。" },
    { icon: "🧪", title: "神秘试验", text: "试试小游戏的组合效果，说不定能触发隐藏加成。" },
    { icon: "🌙", title: "夜班小贴士", text: "睡前收获糖块，第二天上线就有甜蜜惊喜。" },
    { icon: "💼", title: "三角洲联动", text: "把赚到的砖拿去抽砖或交易，下一周还能获得额外 5% 产量。" },
  ],
  presence() {
    if (!this._data || !this._data.enabled) {
      return { activity: 'cookie:locked' };
    }
    const profile = this._data.profile || {};
    const toNumber = (value) => {
      const num = Number(value || 0);
      return Number.isFinite(num) ? num : 0;
    };
    return {
      activity: 'cookie:factory',
      details: {
        cookies: toNumber(profile.cookies || profile.total_cookies),
        cps: toNumber(profile.effective_cps || profile.cps),
      },
    };
  },
  formatNumber(num) {
    const value = Number(num || 0);
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
    if (abs >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
    if (abs >= 1_000) return (value / 1_000).toFixed(2) + "K";
    return value.toFixed(2);
  },
  formatInt(num) {
    const value = Number(num || 0);
    if (!Number.isFinite(value)) return "0";
    try {
      return Math.round(value).toLocaleString();
    } catch (_) {
      return String(Math.round(value));
    }
  },
  calculateBaseBricks(totalCookies) {
    const total = Number(totalCookies || 0);
    if (total <= 0) return 0;
    const scale = total / 100_000_000;
    if (scale < 1) return 0;
    const raw = Math.pow(scale, 0.92);
    const bricks = Math.floor(raw);
    return Math.max(1, bricks);
  },
  calculateProjectedBricks(weekly) {
    if (!weekly) return 0;
    const base = Number(weekly.base_bricks || 0);
    const active = Number(weekly.active_bricks || 0);
    const login = Number(weekly.login_bricks || 0);
    const streak = Number(weekly.streak_bonus || 0);
    const cap = Number(weekly.cap || 0) || 0;
    const projected = base + active + login + streak;
    if (cap <= 0) return projected;
    return Math.min(cap, projected);
  },
  fortuneMessage(profile) {
    const total = Number(profile?.total_cookies || 0);
    const prestige = Number(profile?.prestige || 0);
    const golden = Number(profile?.golden_cookies || 0);
    if (prestige > 0) {
      return `升天次数 ${this.formatInt(prestige)}，声望的香味让饼干更酥脆！`;
    }
    if (golden > 0) {
      return `你已经捕捉到 ${this.formatInt(golden)} 枚黄金饼干，继续保持手速。`;
    }
    if (total > 5_000_000) {
      return `累计 ${this.formatNumber(total)} 枚饼干，工厂已经日夜运转。`;
    }
    return "新鲜出炉的饼干飘香四溢，点击和投资都能带来好运气。";
  },
  challengeMessage(profile, challenge) {
    const target = Number(challenge?.target || 120);
    const today = Number(challenge?.today ?? profile?.manual_clicks ?? 0);
    const remaining = Math.max(0, target - today);
    if (challenge?.completed) {
      return `今日挑战完成！已累计点击 ${this.formatInt(today)} 下，额外活跃积分正在路上。`;
    }
    return `今日挑战：已点击 ${this.formatInt(today)} / ${this.formatInt(target)} 下，还差 ${this.formatInt(remaining)} 下就能拿到奖励。`;
  },
  vibeMessage(profile) {
    const cps = Number(profile?.effective_cps || profile?.cps || 0);
    if (cps <= 0) {
      return "还没有自动化产能？先买一个光标或奶奶试试吧。";
    }
    if (cps < 10) {
      return "节拍刚刚好，升级奶奶或工厂可以让节奏更快。";
    }
    if (cps < 100) {
      return "机器声哒哒作响，考虑建造矿井或传送门冲一波。";
    }
    return "轰鸣的时光机让饼干像瀑布一样涌出，别忘了顺手收糖块。";
  },
  funCards(profile, challenge) {
    const cards = [
      { icon: "🥠", title: "幸运签", text: this.fortuneMessage(profile) },
      { icon: "🎯", title: "今日挑战", text: this.challengeMessage(profile, challenge) },
      { icon: "🎵", title: "工厂节奏", text: this.vibeMessage(profile) },
    ];
    const extra = this.randomFunFact();
    if (extra) {
      cards.push(extra);
    }
    return cards.map(card => `
      <div class="cookie-fun__item">
        <div class="cookie-fun__icon">${escapeHtml(card.icon)}</div>
        <div class="cookie-fun__body">
          <div class="cookie-fun__title">${escapeHtml(card.title)}</div>
          <div class="cookie-fun__text">${escapeHtml(card.text)}</div>
        </div>
      </div>
    `).join("");
  },
  randomFunFact() {
    if (!Array.isArray(this.funFacts) || !this.funFacts.length) return null;
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const idx = hourBucket % this.funFacts.length;
    return this.funFacts[idx];
  },
  stopTicker() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    this._tickState = null;
  },
  startTicker() {
    this.stopTicker();
    if (!this._data || !this._data.enabled) return;
    const profile = this._data.profile || {};
    this._tickState = {
      last: Date.now(),
      cookies: Number(profile.cookies || 0),
      total: Number(profile.total_cookies || 0),
      week: Number(profile.cookies_this_week || 0),
      cps: Number(profile.effective_cps || profile.cps || 0),
    };
    // 立即刷新显示，避免首次延迟
    this.updateTickerUI();
    this._tickTimer = setInterval(() => this.runTicker(), 1000);
  },
  runTicker() {
    if (!this._tickState || !this._data || !this._data.enabled) return;
    const now = Date.now();
    const elapsed = Math.max(0, (now - this._tickState.last) / 1000);
    this._tickState.last = now;
    if (elapsed <= 0) {
      return;
    }
    const gain = this._tickState.cps * elapsed;
    if (gain <= 0) {
      this.updateTickerUI();
      return;
    }
    this._tickState.cookies += gain;
    this._tickState.total += gain;
    this._tickState.week += gain;
    const profile = this._data.profile || {};
    profile.cookies = parseFloat(this._tickState.cookies.toFixed(2));
    profile.total_cookies = parseFloat(this._tickState.total.toFixed(2));
    profile.cookies_this_week = parseFloat(this._tickState.week.toFixed(2));
    const weekly = this._data.weekly || {};
    weekly.base_bricks = this.calculateBaseBricks(profile.cookies_this_week);
    weekly.projected_bricks = this.calculateProjectedBricks(weekly);
    const claimed = Number(weekly.claimed_bricks || 0);
    weekly.cap_remaining = Math.max(0, (Number(weekly.cap || 0) || 0) - (weekly.projected_bricks || 0));
    weekly.claimable_bricks = Math.max(0, (weekly.projected_bricks || 0) - Math.max(0, claimed));
    this.updateTickerUI();
  },
  updateTickerUI() {
    const profile = this._data?.profile || {};
    const weekly = this._data?.weekly || {};
    const fmt = (num) => this.formatNumber(num);
    const fmtInt = (num) => this.formatInt(num);
    const countEl = document.getElementById("cookie-count");
    if (countEl) countEl.textContent = fmt(profile.cookies);
    const totalLabel = document.getElementById("cookie-total-label");
    if (totalLabel) totalLabel.textContent = `点击饼干生产 · 累计 ${fmt(profile.total_cookies)}`;
    const weeklyHead = document.getElementById("cookie-weekly-head");
    if (weeklyHead) {
      weeklyHead.textContent = `🎯 本周预计 ${fmtInt(weekly.projected_bricks || 0)} / ${fmtInt(weekly.cap || 100)} 块砖`;
    }
    const progressFill = document.getElementById("cookie-weekly-progress");
    if (progressFill) {
      const pct = (weekly.cap ? Math.min(100, Math.round((weekly.projected_bricks || 0) / weekly.cap * 100)) : 0);
      progressFill.style.width = `${pct}%`;
      progressFill.setAttribute("aria-valuenow", String(pct));
    }
    const baseEl = document.getElementById("cookie-weekly-base");
    if (baseEl) baseEl.textContent = `🍪 基础 ${fmtInt(weekly.base_bricks || 0)}`;
    const activeEl = document.getElementById("cookie-weekly-active");
    if (activeEl) activeEl.textContent = `⚡ 活跃 ${fmtInt(weekly.active_bricks || 0)}`;
    const loginEl = document.getElementById("cookie-weekly-login");
    if (loginEl) loginEl.textContent = `📬 签到 ${fmtInt(weekly.login_bricks || 0)}`;
    const streakEl = document.getElementById("cookie-weekly-streak");
    if (streakEl) streakEl.textContent = `🔥 连击 ${fmtInt(weekly.streak_bonus || 0)}`;
    const claimedEl = document.getElementById("cookie-weekly-claimed");
    if (claimedEl) claimedEl.textContent = `📦 已领取 ${fmtInt(weekly.claimed_bricks || 0)} 块`;
    const claimableHint = document.getElementById("cookie-weekly-claimable");
    if (claimableHint) {
      if (Number(weekly.claimable_bricks || 0) > 0) {
        claimableHint.textContent = `可领取 ${fmtInt(weekly.claimable_bricks)} 块，立即转入背包。`;
      } else {
        claimableHint.textContent = `暂无可领取砖，继续点击、建造或签到来累积奖励。`;
      }
    }
    const claimBtn = document.getElementById("cookie-claim");
    if (claimBtn) {
      const claimable = Math.max(0, Number(weekly.claimable_bricks || 0));
      claimBtn.setAttribute("data-claimable", String(claimable));
      claimBtn.setAttribute("aria-disabled", claimable > 0 ? "false" : "true");
      claimBtn.innerHTML = claimable > 0
        ? `📦 领取 ${fmtInt(claimable)} 块砖`
        : "📦 暂无可领取";
      claimBtn.classList.toggle("is-disabled", claimable <= 0);
    }
    const funWrap = document.getElementById("cookie-fun");
    if (funWrap) {
      funWrap.innerHTML = this.funCards(profile, this._data?.challenge);
    }
  },
  clearError() {
    this._lastError = null;
    if (this._errorTimer) {
      clearTimeout(this._errorTimer);
      this._errorTimer = null;
    }
  },
  showError(msg) {
    this._lastError = msg;
    if (this._errorTimer) {
      clearTimeout(this._errorTimer);
      this._errorTimer = null;
    }
    this.updateView();
    this._errorTimer = setTimeout(() => {
      if (this._lastError === msg) {
        this.clearError();
        this.updateView();
      }
    }, 4000);
  },
  async fetchStatus() {
    try {
      this._data = await API.cookieStatus();
      this.clearError();
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
    this.stopTicker();
    this.bindInner();
    this.startTicker();
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
    const sugarLumps = Number(profile.sugar_lumps || 0);
    const challenge = this._data.challenge || {};
    const fmt = (num) => this.formatNumber(num);
    const fmtInt = (num) => this.formatInt(num);
    const buildingMap = {};
    buildings.forEach(item => { buildingMap[item.key] = item; });
    const miniMap = {};
    miniGames.forEach(item => { miniMap[item.key] = item; });
    const claimable = Math.max(0, Number(weekly.claimable_bricks || 0));
    const claimed = Math.max(0, Number(weekly.claimed_bricks || 0));
    const capRemaining = Math.max(0, Number(weekly.cap_remaining || 0));
    const claimBtnDisabled = claimable <= 0;
    const claimBtnClass = `btn btn-claim${claimBtnDisabled ? " is-disabled" : ""}`;
    const claimBtnTitle = claimBtnDisabled
      ? "暂无可领取砖，继续产出或活跃即可累积奖励。"
      : `领取后将立即把 ${fmtInt(claimable)} 块砖放入背包。`;
    const claimableText = claimable > 0
      ? `可领取 ${fmtInt(claimable)} 块，立即转入背包。`
      : "暂无可领取砖，继续点击、建造或签到来累积奖励。";

    const notices = [];
    if (this._lastError) {
      notices.push(`<div class="cookie-alert cookie-alert--error">⚠️ ${escapeHtml(this._lastError)}</div>`);
    }
    const infoMessages = [];
    if (actionResult) {
      if (actionResult.claimed != null) {
        infoMessages.push(`📦 成功领取 ${fmtInt(actionResult.claimed)} 块砖，背包未开砖共 ${fmtInt(actionResult.inventory_total || 0)} 块`);
      } else if (actionResult.building) {
        const building = buildingMap[actionResult.building];
        const name = building ? building.name : actionResult.building;
        infoMessages.push(`🏗️ 成功建造 ${escapeHtml(name)}，累计 ${fmtInt(actionResult.count)} 座`);
      } else if (actionResult.bonus != null) {
        infoMessages.push(`✨ 黄金饼干爆发，额外产出 ${fmt(actionResult.bonus)} 饼干`);
      } else if (actionResult.leveled) {
        const mini = miniMap[actionResult.mini];
        const name = mini ? mini.name : actionResult.mini;
        infoMessages.push(`🎮 ${escapeHtml(name)} 等级提升至 ${fmtInt(actionResult.level)} 级！`);
      } else if (actionResult.points_gained) {
        infoMessages.push(`🌟 升天成功，获得 ${fmtInt(actionResult.points_gained)} 声望点`);
      } else if (actionResult.sugar_lumps != null && actionResult.mini == null) {
        infoMessages.push(`🍭 收获糖块，总数 ${fmtInt(actionResult.sugar_lumps)}`);
      } else if (actionResult.gained != null) {
        infoMessages.push(`🍪 手动点击收获 ${fmt(actionResult.gained)} 饼干`);
      }
      if (actionResult.challenge_completed) {
        infoMessages.push(`🎯 今日挑战完成！奖励已锁定，继续点击可冲更高产量。`);
      } else if (actionResult.challenge_today != null) {
        const remaining = Math.max(0, Number(challenge.target || 120) - Number(actionResult.challenge_today || 0));
        infoMessages.push(`🎯 今日挑战进度 ${fmtInt(actionResult.challenge_today)} / ${fmtInt(challenge.target || 120)}，还差 ${fmtInt(remaining)} 下。`);
      }
      if (actionResult.sugar_lumps != null && actionResult.mini) {
        infoMessages.push(`🍭 剩余糖块 ${fmtInt(actionResult.sugar_lumps)}，合理安排小游戏升级。`);
      }
    }
    if (loginResult && loginResult.message) {
      infoMessages.push(`📬 ${escapeHtml(loginResult.message)}${loginResult.daily_reward ? `，奖励额度 +${fmtInt(loginResult.daily_reward)}` : ""}`);
    }
    infoMessages.forEach(msg => {
      notices.push(`<div class="cookie-alert cookie-alert--info">${msg}</div>`);
    });
    const noticeStack = notices.length ? `<div class="cookie-notice-stack">${notices.join("")}</div>` : "";

    const renderBuildings = () => {
      if (!buildings.length) {
        return `<div class="muted">暂无可购买建筑</div>`;
      }
      return buildings.map(item => {
        const canAfford = bankedCookies >= item.next_cost;
        const shortage = Math.max(0, item.next_cost - bankedCookies);
        const cardTitle = item.desc || `投入 ${fmtInt(item.next_cost)} 饼干即可增加 ${item.base_cps} / 秒产量`;
        const buttonTitle = canAfford ? "立即建造，提升自动产能" : `还需 ${fmt(shortage)} 饼干才能购入`;
        const buttonClass = `btn btn-mini${canAfford ? "" : " is-disabled"}`;
        return `
          <div class="cookie-building" title="${escapeHtml(cardTitle)}">
            <div class="cookie-building__icon">${escapeHtml(item.icon || "🏠")}</div>
            <div class="cookie-building__info">
              <div class="cookie-building__name">${escapeHtml(item.name)} <span class="count">×${fmtInt(item.count)}</span></div>
              <div class="cookie-building__desc">${escapeHtml(item.desc || "")}</div>
              <div class="cookie-building__meta" title="基础产能 ${item.base_cps} / 秒">基础 ${item.base_cps} / 秒 · 下一级花费 ${fmtInt(item.next_cost)} 🍪</div>
            </div>
            <button class="${buttonClass}" data-build="${item.key}" data-can="${canAfford ? "1" : "0"}" data-cost="${item.next_cost}" aria-disabled="${canAfford ? "false" : "true"}" title="${escapeHtml(buttonTitle)}">购入</button>
          </div>`;
      }).join("");
    };

    const renderMini = () => {
      if (!miniGames.length) return `<div class="muted">暂无小游戏</div>`;
      return miniGames.map(item => {
        const progress = Number(item.progress || 0);
        const threshold = Math.max(1, Number(item.threshold || 1));
        const pct = Math.min(100, Math.round(progress / threshold * 100));
        const progressTip = `推进 ${fmtInt(progress)} / ${fmtInt(threshold)} 次即可升级`;
        const sugarCost = Number(item.sugar_cost || 0);
        const hasSugar = sugarCost <= 0 || sugarLumps >= sugarCost;
        const sugarHint = sugarCost > 0 ? `（每次消耗 ${sugarCost} 🍭，当前剩余 ${fmtInt(sugarLumps)}）` : "";
        const points = Number(item.points || 0);
        const cpPercentRaw = Number(item.cps_bonus || 0) * 100;
        const cpPercent = cpPercentRaw >= 1 ? cpPercentRaw.toFixed(1) : cpPercentRaw.toFixed(2);
        const baseDesc = item.desc || "推进小游戏可获得活跃积分和产量加成。";
        const miniTitle = `${baseDesc}；每次开展 +${fmtInt(points)} 活跃积分；累计 ${fmtInt(threshold)} 次升级；升级后产能约 +${cpPercent}%${sugarHint}`;
        const buttonClass = `btn btn-mini${hasSugar ? "" : " is-disabled"}`;
        const buttonTitle = hasSugar ? `投入${sugarCost > 0 ? ` ${sugarCost} 颗糖块` : ""}推进小游戏进度` : `至少需要 ${fmtInt(sugarCost)} 颗糖块（当前 ${fmtInt(sugarLumps)}）`;
        return `
          <div class="cookie-mini" title="${escapeHtml(miniTitle)}">
            <div class="cookie-mini__icon">${escapeHtml(item.icon || "🎯")}</div>
            <div class="cookie-mini__body">
              <div class="cookie-mini__head">${escapeHtml(item.name)} · 等级 ${fmtInt(item.level || 0)}</div>
              <div class="cookie-mini__desc">${escapeHtml(baseDesc)}${escapeHtml(sugarHint)}</div>
              <div class="cookie-mini__stats"><span>⚡ +${fmtInt(points)} 活跃</span><span>⬆️ ${fmtInt(threshold)} 次升级</span><span>📈 +${cpPercent}% 产能</span></div>
              <div class="cookie-mini__progress">
                <div class="progress-bar" title="${escapeHtml(progressTip)}"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
                <div class="cookie-mini__progress-label">${escapeHtml(progressTip)}</div>
              </div>
            </div>
            <button class="${buttonClass}" data-mini="${item.key}" data-sugar="${sugarCost}" aria-disabled="${hasSugar ? "false" : "true"}" title="${escapeHtml(buttonTitle)}">开展</button>
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
        <div class="progress-card" title="产量、活跃与签到奖励随时可通过下方按钮领取成砖">
          <div class="progress-card__head" id="cookie-weekly-head">🎯 本周预计 ${fmtInt(weekly.projected_bricks || 0)} / ${fmtInt(weekly.cap || 100)} 块砖</div>
          <div class="progress-bar big" title="进度条显示当前距离每周上限的完成度">
            <div class="progress-bar__fill" id="cookie-weekly-progress" style="width:${projectedPct}%"></div>
          </div>
          <div class="cookie-breakdown">
            <span id="cookie-weekly-base" title="纯靠饼干产量获得的砖">🍪 基础 ${fmtInt(weekly.base_bricks || 0)}</span>
            <span id="cookie-weekly-active" title="点击、小游戏等活跃行为兑换的砖">⚡ 活跃 ${fmtInt(weekly.active_bricks || 0)}</span>
            <span id="cookie-weekly-login" title="每日登录的额外奖励">📬 签到 ${fmtInt(weekly.login_bricks || 0)}</span>
            <span id="cookie-weekly-streak" title="连续登录 7 天的连击奖励">🔥 连击 ${fmtInt(weekly.streak_bonus || 0)}</span>
          </div>
          <div class="cookie-claim">
            <div class="cookie-claim__info">
              <div id="cookie-weekly-claimed">📦 已领取 ${fmtInt(claimed)} 块</div>
              <div id="cookie-weekly-claimable" class="cookie-claim__hint">${escapeHtml(claimableText)}</div>
            </div>
            <button type="button" class="${claimBtnClass}" id="cookie-claim" data-claimable="${claimable}" aria-disabled="${claimBtnDisabled ? "true" : "false"}" title="${escapeHtml(claimBtnTitle)}">📦 ${claimBtnDisabled ? "暂无可领取" : `领取 ${fmtInt(claimable)} 块砖`}</button>
          </div>
          <div class="muted small">今日签到：${weekly.daily_login_claimed ? "✅ 已完成" : "⌛ 待签到"} · 连续登录 ${fmtInt(weekly.login_streak || 0)} 天 · 本周剩余额度 ${fmtInt(capRemaining)} 块</div>
        </div>
      </div>`;

    const goldenCooldown = Math.max(0, Math.ceil((golden.ready_in || 0) / 60));
    const sugarCooldown = Math.max(0, Math.ceil((sugar.ready_in || 0) / 3600));
    const goldenTitle = golden.available ? "黄金饼干出现啦！点击触发爆发收益。" : `黄金饼干正在酝酿，还需约 ${goldenCooldown} 分钟。`;
    const sugarTitle = sugar.available ? "收获一块糖块，用于升级建筑或小游戏。" : `糖块尚未成熟，大约 ${sugarCooldown} 小时后再来收获。`;
    const loginTitle = weekly.daily_login_claimed ? `今日签到奖励已领取，连续 ${fmtInt(weekly.login_streak || 0)} 天` : "每日首次进入饼干工厂可获得 2 块砖兑换额度。";
    const prestigeTitle = totalCookies < 1_000_000
      ? "需要至少 100 万枚饼干才能升天。升天后将重置饼干、建筑和小游戏进度，请继续冲刺产量。"
      : "升天会重置饼干、建筑与小游戏，但能获得声望点并提升下一轮的产量加成。";
    const goldenClass = `btn${golden.available ? "" : " is-disabled"}`;
    const loginClass = weekly.daily_login_claimed ? "btn ghost" : "btn";
    const sugarClass = `btn${sugar.available ? "" : " is-disabled"}`;

    const hintBar = `<div class="cookie-hint">💡 小贴士：点击大饼干获取即时产量，合理消耗糖块开展小游戏，黄金饼干冷却结束后别忘了触发爆发！</div>`;
    const funSection = `<div class="cookie-fun" id="cookie-fun">${this.funCards(profile, challenge)}</div>`;
    const challengeTarget = Number(challenge.target || 120);
    const todayClicks = Number(challenge.today ?? profile.manual_clicks ?? 0);
    const challengeRemain = Math.max(0, challengeTarget - todayClicks);
    const totalBuildings = buildings.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const miniLines = miniGames.length
      ? miniGames.map(item => {
          const cpPercent = Number(item.cps_bonus || 0) * 100;
          const cpText = cpPercent >= 1 ? cpPercent.toFixed(1) : cpPercent.toFixed(2);
          return `${item.icon || "🎮"} ${item.name}：每次开展 +${fmtInt(item.points || 0)} 活跃，${fmtInt(item.threshold || 0)} 次升级，产能 +${cpText}%`;
        })
      : ["解锁更多建筑后将出现小游戏，带来活跃积分与产量加成。"];
    const bonusMultiplier = Number(profile.bonus_multiplier || 1);
    const bonusPercentRaw = (bonusMultiplier - 1) * 100;
    const bonusPercent = bonusPercentRaw > 0 ? bonusPercentRaw.toFixed(1) : "0";
    const prestigeRequirement = 1_000_000;
    const prestigeShortfall = Math.max(0, prestigeRequirement - totalCookies);
    const prestigeLines = [
      `当前声望 ${fmtInt(profile.prestige || 0)} 次，声望点 ${fmtInt(profile.prestige_points || 0)}`,
      prestigeShortfall > 0
        ? `还需 ${fmt(prestigeShortfall)} 枚饼干即可升天`
        : "已满足升天条件，点击可立刻获得声望点",
      `升天会重置饼干、建筑与小游戏，并额外提升联动加成（当前 +${bonusPercent}%）`,
    ];
    const guideEntries = [
      {
        key: "click",
        icon: "👆",
        title: "点击饼干",
        lines: [
          `今日已点击 ${fmtInt(todayClicks)} 次，距离挑战还差 ${fmtInt(challengeRemain)} 次`,
          `实时有效产量约 ${fmt(profile.effective_cps || 0)} 饼干/秒，可随点击即时累积`,
          "黄金饼干与小游戏也能提供活跃积分，助力获取砖",
        ],
      },
      {
        key: "build",
        icon: "🏭",
        title: "建筑产线",
        lines: [
          `已建造 ${fmtInt(totalBuildings)} 座建筑，基础产能 ${fmt(profile.cps || 0)} / 秒`,
          `有效产能（含加成）约 ${fmt(profile.effective_cps || 0)} / 秒，自动生产不停歇`,
          "购入建筑会增加活跃积分并提高点击收益",
        ],
      },
      {
        key: "mini",
        icon: "🎮",
        title: "小游戏",
        lines: miniLines,
      },
      {
        key: "prestige",
        icon: "🌟",
        title: "声望升天",
        lines: prestigeLines,
      },
    ];
    if (!guideEntries.some(entry => entry.key === this._guideKey)) {
      this._guideKey = guideEntries[0].key;
    }
    const activeGuide = guideEntries.find(entry => entry.key === this._guideKey) || guideEntries[0];
    const guideTabs = guideEntries.map(entry => `
      <button type="button" class="cookie-guide__tab${entry.key === activeGuide.key ? " is-active" : ""}" data-guide="${entry.key}">
        ${escapeHtml(entry.icon)} <span>${escapeHtml(entry.title)}</span>
      </button>
    `).join("");
    const guideDetail = activeGuide
      ? `<ul class="cookie-guide__list">${activeGuide.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : '<div class="muted small">暂无提示</div>';
    const guideSection = `<div class="cookie-guide"><div class="cookie-guide__tabs">${guideTabs}</div><div class="cookie-guide__detail">${guideDetail}</div></div>`;

    return `
      ${noticeStack}
      ${hintBar}
      <div class="cookie-hero">
        <div class="cookie-big" id="cookie-big" title="点击饼干即可实时生产，越快越赚">
          <div class="cookie-big__icon">🍪</div>
          <div class="cookie-big__count" id="cookie-count">${fmt(bankedCookies)}</div>
          <div class="cookie-big__label" id="cookie-total-label">点击饼干生产 · 累计 ${fmt(totalCookies)}</div>
        </div>
        <div class="cookie-stats">
          <div class="stat-chip" title="基础每秒产量 / 套用加成后的有效产量">⚙️ 每秒 ${fmt(profile.cps)} / 有效 ${fmt(profile.effective_cps)}</div>
          <div class="stat-chip" title="升天次数越多，重置后产量越快">🌟 声望 ${fmtInt(profile.prestige || 0)} · 点数 ${fmtInt(profile.prestige_points || 0)}</div>
          <div class="stat-chip" title="糖块用于升级建筑和开展小游戏，留意冷却时间">🍭 糖块 ${fmtInt(profile.sugar_lumps || 0)}</div>
          <div class="stat-chip" title="三角洲联动加成，每周消费砖可提高该倍数">📈 加成 ×${profile.bonus_multiplier?.toFixed(2) || "1.00"}</div>
        </div>
      </div>
      ${guideSection}
      ${funSection}
      <div class="cookie-actions">
        <button class="${goldenClass}" id="cookie-golden" aria-disabled="${golden.available ? "false" : "true"}" title="${escapeHtml(goldenTitle)}">✨ 黄金饼干${golden.ready_in > 0 ? `（${Math.ceil(golden.ready_in / 60)} 分钟后）` : ""}</button>
        <button class="${loginClass}" id="cookie-login" aria-disabled="false" title="${escapeHtml(loginTitle)}">📬 每日签到</button>
        <button class="${sugarClass}" id="cookie-sugar" aria-disabled="${sugar.available ? "false" : "true"}" title="${escapeHtml(sugarTitle)}">🍭 收获糖块${sugar.ready_in > 0 ? `（${Math.ceil(sugar.ready_in / 3600)} 小时后）` : ""}</button>
        <button class="btn${totalCookies < 1_000_000 ? " is-disabled" : ""}" id="cookie-prestige" ${totalCookies < 1_000_000 ? "disabled" : ""} title="${escapeHtml(prestigeTitle)}">🌟 升天重置</button>
      </div>
      <div class="cookie-section">
        <h3>🏭 建筑</h3>
        <div class="cookie-section__hint">🔧 建筑会自动生产饼干，越高级的建筑提升越多。</div>
        <div class="cookie-buildings">${renderBuildings()}</div>
      </div>
      <div class="cookie-section">
        <h3>🎮 小游戏</h3>
        <div class="cookie-section__hint">🧩 小游戏带来活跃积分与额外加成，别忘了常来巡逻。</div>
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
      goldenBtn.onclick = () => {
        if (!this._data?.golden?.available) {
          const mins = Math.max(1, Math.ceil((this._data?.golden?.ready_in || 0) / 60));
          this.showError(`黄金饼干还在酝酿，大约 ${mins} 分钟后再来试试。`);
          return;
        }
        this.handleAction({ type: "golden" });
      };
    }
    const loginBtn = document.getElementById("cookie-login");
    if (loginBtn) {
      loginBtn.onclick = () => this.handleLogin();
    }
    const sugarBtn = document.getElementById("cookie-sugar");
    if (sugarBtn) {
      sugarBtn.onclick = () => {
        if (!this._data?.sugar?.available) {
          const hours = Math.max(1, Math.ceil((this._data?.sugar?.ready_in || 0) / 3600));
          this.showError(`糖块尚未成熟，还需约 ${hours} 小时。`);
          return;
        }
        this.handleAction({ type: "sugar" });
      };
    }
    const prestigeBtn = document.getElementById("cookie-prestige");
    if (prestigeBtn) {
      prestigeBtn.onclick = () => this.handleAction({ type: "prestige" });
    }
    root.querySelectorAll('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-build');
        if (!key) return;
        const can = btn.getAttribute('data-can') === '1';
        const cost = Number(btn.getAttribute('data-cost') || '0');
        const banked = Number(this._data?.profile?.cookies || 0);
        if (!can && banked < cost) {
          const shortage = Math.max(0, cost - banked);
          this.showError(`饼干不足，还差 ${this.formatNumber(shortage)} 枚才能购入该建筑。`);
          return;
        }
        this.handleAction({ type: 'buy_building', building: key });
      });
    });
    root.querySelectorAll('[data-mini]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mini');
        if (!key) return;
        const sugarCost = Number(btn.getAttribute('data-sugar') || '0');
        const sugarHave = Number(this._data?.profile?.sugar_lumps || 0);
        if (sugarCost > 0 && sugarHave < sugarCost) {
          this.showError(`糖块不足，需要 ${sugarCost} 颗糖块才能开展该小游戏。`);
          return;
        }
        this.handleAction({ type: 'mini', mini: key });
      });
    });
    const claimBtn = document.getElementById('cookie-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const claimableAmount = Number(claimBtn.getAttribute('data-claimable') || '0');
        if (claimableAmount <= 0) {
          this.showError('暂无可领取的砖奖励，继续生产或签到即可累积。');
          return;
        }
        this.handleAction({ type: 'claim' });
      });
    }
    root.querySelectorAll('[data-guide]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const key = btn.getAttribute('data-guide');
        if (!key || key === this._guideKey) return;
        this._guideKey = key;
        this.updateView();
      });
    });
  },
  async handleLogin() {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await API.cookieLogin();
      this.clearError();
      this.updateView();
    } catch (e) {
      this.showError(e.message || '签到失败');
    } finally {
      this._loading = false;
    }
  },
  async handleAction(payload) {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await API.cookieAct(payload);
      this.clearError();
      this.updateView();
    } catch (e) {
      this.showError(e.message || '操作失败');
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
    this.stopTicker();
    root.innerHTML = this.renderInner();
    this.bindInner();
    this.startTicker();
    window.PresenceTracker?.updateDetails?.(this.presence());
  }
};
