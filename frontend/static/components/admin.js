const AdminPage = {
  _presenceTimer: null,
  render() {
    return `
    <div class="card"><h2>管理员</h2>
      <div class="muted">
        可做：1）查看/搜索所有用户；2）发放/扣减法币；3）发放/扣减三角币；
        4）查看“充值申请”（玩家申请时的金额+验证码）；5）查看“短信验证码日志”（注册/登录/重置/管理员验证/充值）。<br>
        普通用户无法自助充值法币，需验证码或由管理员发放。
      </div>

      <div class="card">
        <h3>登录/注册模式</h3>
        <div class="input-row">
          <label><input type="checkbox" id="auth-mode-switch"/> 免验证码 & 注册送 20000 法币</label>
        </div>
        <div class="muted" id="auth-mode-desc"></div>
      </div>

      <div class="card">
        <h3>网站维护模式</h3>
        <div class="input-row">
          <label><input type="checkbox" id="maintenance-toggle"/> 启用维护模式（非管理员将被强制下线）</label>
        </div>
        <div class="input-row">
          <input id="maintenance-message" placeholder="维护说明（可选，展示给被维护的玩家）"/>
        </div>
        <div class="input-row" style="gap:8px; flex-wrap:wrap; align-items:center;">
          <input id="maintenance-code" placeholder="维护验证码（admin-maintenance）" style="flex:1 1 220px; min-width:200px;" />
          <button class="btn" id="maintenance-request">获取验证码</button>
          <button class="btn danger" id="maintenance-apply">更新维护状态</button>
        </div>
        <div class="muted" id="maintenance-status">加载中...</div>
      </div>

      <div class="card">
        <h3>全服公告</h3>
        <div class="input-row">
          <textarea id="announcement-message" rows="2" placeholder="公告内容（将在所有玩家界面展示约 1 分钟）"></textarea>
        </div>
        <div class="input-row" style="align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="muted">展示时长（秒）</span>
          <input id="announcement-duration" type="number" min="10" max="60" value="60" style="width:120px" />
          <button class="btn" id="announcement-send">发送公告</button>
          <button class="btn" id="announcement-clear">清除公告</button>
        </div>
        <div class="muted" id="announcement-status">加载中...</div>
      </div>

      <div class="card">
        <h3>下一抽特殊模板保底</h3>
        <div class="muted">
          为指定玩家设置一次性的稀有模板保底：输入玩家 ID 并选择赛季，玩家在该赛季下一次开砖将直接获得该赛季概率最低的特殊模板（如无特殊模板则强制钻石模板）。
        </div>
        <div class="input-row">
          <input id="force-template-user-id" type="number" min="1" placeholder="玩家 ID" />
        </div>
        <div class="input-row">
          <select id="force-template-season">
            <option value="">加载赛季中...</option>
          </select>
        </div>
        <div class="input-row">
          <button class="btn primary" id="force-template-apply">设置下一抽必中稀有模板</button>
        </div>
        <div class="muted" id="force-template-status">等待操作...</div>
      </div>

      <div class="card">
        <h3>饼干工厂小游戏</h3>
        <div class="input-row">
          <label><input type="checkbox" id="cookie-toggle"/> 对玩家开放饼干工厂</label>
        </div>
        <div class="muted" id="cookie-toggle-desc">加载中...</div>
        <div class="input-row" style="margin-top:8px;">
          <label><input type="checkbox" id="cultivation-toggle"/> 开启“模拟修仙”随机剧情玩法</label>
        </div>
        <div class="muted" id="cultivation-toggle-desc">加载中...</div>
        <div class="input-row" style="margin-top:8px;">
          <label><input type="checkbox" id="starfall-toggle"/> 对玩家开放《星际余生》</label>
        </div>
        <div class="muted" id="starfall-toggle-desc">加载中...</div>
      </div>

      <div class="card">
        <h3>古井探险调试</h3>
        <div class="input-row">
          <label><input type="checkbox" id="dungeon-toggle-game"/> 对玩家开放古井探险</label>
        </div>
        <div class="input-row">
          <label><input type="checkbox" id="dungeon-toggle-invincible"/> 启用无敌测试模式</label>
        </div>
        <div class="muted" id="dungeon-toggle-desc">加载中...</div>
      </div>

      <div class="card admin-presence">
        <div class="admin-presence__head">
          <h3>在线玩家概览</h3>
          <div class="admin-presence__meta" id="presence-meta">加载中...</div>
        </div>
        <div class="admin-presence__body" id="presence-list">
          <div class="muted">加载中...</div>
        </div>
      </div>

      <div class="card">
        <h3>所有用户</h3>
        <div class="input-row">
          <input id="q" placeholder="按用户名/手机号搜索"/>
          <button class="btn" id="do-q">搜索</button>
          <button class="btn" id="do-all">全部</button>
        </div>

        <!-- 分页控制：一组 5 个 -->
        <div class="input-row" style="align-items:center;gap:8px;">
          <button class="btn" id="pg-prev">上一组</button>
          <span id="pg-info" class="muted"></span>
          <button class="btn" id="pg-next">下一组</button>
        </div>

        <div id="list"></div>
      </div>

      <div id="inventory-view" style="display:none;"></div>

      <div class="card">
        <h3>余额操作</h3>
        <div class="input-row">
          <input id="op-username" placeholder="用户名"/>
        </div>
        <div class="grid cols-2">
          <div>
            <div class="muted">法币</div>
            <div class="input-row">
              <input id="fiat-amt" type="number" placeholder="金额（法币）"/>
              <button class="btn" id="fiat-grant">发放法币</button>
              <button class="btn danger" id="fiat-deduct">扣除法币</button>
            </div>
          </div>
          <div>
            <div class="muted">三角币</div>
            <div class="input-row">
              <input id="coin-amt" type="number" placeholder="数量（三角币）"/>
              <button class="btn" id="coin-grant">发放三角币</button>
              <button class="btn danger" id="coin-deduct">扣除三角币</button>
            </div>
          </div>
        </div>
        <div class="muted">提示：扣除会先校验余额，不足会失败并提示；不会出现负数。</div>
      </div>

      <div class="card">
        <h3>玩家密码管理</h3>
        <div class="muted">输入玩家 ID 后获取验证码，验证码会写入短信日志（purpose=admin-user-password）。验证通过可查看哈希并可选重置为新密码。</div>
        <div class="input-row">
          <input id="pw-user-id" type="number" min="1" placeholder="玩家ID" />
          <button class="btn" id="pw-request">获取验证码</button>
        </div>
        <div class="input-row">
          <input id="pw-code" placeholder="验证码（admin-user-password）" />
          <input id="pw-new" placeholder="新密码（可选）" />
        </div>
        <div class="input-row">
          <button class="btn primary" id="pw-confirm">验证 / 更新密码</button>
        </div>
        <div class="muted" id="pw-result">等待操作...</div>
      </div>

            <div class="card">
        <h3>删除账号（需验证码）</h3>
        <div class="muted">
          操作流程：1）输入要删除的用户名，点“获取删除验证码”；2）到后台查看验证码";
          3）把验证码填到下框，点“确认删除”。<br>
          <b>危险操作：</b>删除后不可恢复，请谨慎！
        </div>
        <div class="input-row">
          <input id="del-username" placeholder="要删除的用户名"/>
          <button class="btn danger" id="del-req-btn">获取删除验证码</button>
        </div>
        <div class="input-row">
          <input id="del-code" placeholder="删除验证码（admin-deluser）"/>
          <button class="btn danger" id="del-do-btn">确认删除</button>
        </div>
      </div>

      <div class="card">
        <h3>充值申请（未使用/未过期）</h3>
        <div class="input-row">
          <button class="btn" id="req-refresh">刷新</button>
        </div>
        <div id="req-list"></div>
      </div>

      <div class="card">
        <h3>短信验证码日志</h3>
        <div class="input-row">
          <select id="sms-purpose">
            <option value="">全部 purpose</option>
            <option value="register">register（注册）</option>
            <option value="login2">login2（登录第二步）</option>
            <option value="reset">reset（重置密码）</option>
            <option value="wallet-topup">wallet-topup（充值）</option>
          </select>
          <input id="sms-limit" type="number" min="1" max="1000" value="200" style="width:120px" />
          <button class="btn" id="sms-refresh">刷新</button>
        </div>
        <div id="sms-list"></div>
      </div>
    </div>`;
  },

  async bind() {
    if (!API._me?.is_admin) { alert("非管理员"); location.hash="#/home"; return; }
    if (this._presenceTimer) {
      clearInterval(this._presenceTimer);
      this._presenceTimer = null;
    }
    window.PresenceTracker?.updateDetails?.({ activity: 'admin:dashboard' });

    const modeSwitch = byId("auth-mode-switch");
    const modeDesc = byId("auth-mode-desc");
    const cookieSwitch = byId("cookie-toggle");
    const cookieDesc = byId("cookie-toggle-desc");
    const cultivationSwitch = byId("cultivation-toggle");
    const cultivationDesc = byId("cultivation-toggle-desc");
    const starfallSwitch = byId("starfall-toggle");
    const starfallDesc = byId("starfall-toggle-desc");
    const dungeonGameToggle = byId('dungeon-toggle-game');
    const dungeonInvToggle = byId('dungeon-toggle-invincible');
    const dungeonToggleDesc = byId('dungeon-toggle-desc');
    const maintenanceToggle = byId('maintenance-toggle');
    const maintenanceMessage = byId('maintenance-message');
    const maintenanceStatus = byId('maintenance-status');
    const maintenanceCode = byId('maintenance-code');
    const maintenanceRequest = byId('maintenance-request');
    const maintenanceApply = byId('maintenance-apply');
    const announcementMessage = byId('announcement-message');
    const announcementDuration = byId('announcement-duration');
    const announcementStatus = byId('announcement-status');
    const announcementSend = byId('announcement-send');
    const announcementClear = byId('announcement-clear');
    const forceTemplateUserId = byId('force-template-user-id');
    const forceTemplateSeason = byId('force-template-season');
    const forceTemplateApply = byId('force-template-apply');
    const forceTemplateStatus = byId('force-template-status');
    modeDesc.textContent = "加载中...";
    if (cookieDesc) cookieDesc.textContent = "加载中...";

    const renderModeDesc = (free) => {
      modeDesc.textContent = free
        ? "当前为免验证码模式：登录无需短信验证，注册时不强制手机且赠送 20000 法币。"
        : "当前为短信验证模式：登录/注册均需短信验证码，新注册不再赠送法币。";
    };

    const loadAuthMode = async () => {
      try {
        const data = await API.adminAuthModeGet();
        const free = !!(data && data.verification_free);
        modeSwitch.checked = free;
        renderModeDesc(free);
      } catch (e) {
        modeDesc.textContent = `加载失败：${e.message || e}`;
      }
    };

    modeSwitch.onchange = async () => {
      const desired = !!modeSwitch.checked;
      modeSwitch.disabled = true;
      try {
        await API.adminAuthModeSet(desired);
        await loadAuthMode();
        alert("登录/注册模式已更新");
      } catch (e) {
        alert(e.message);
        await loadAuthMode();
      } finally {
        modeSwitch.disabled = false;
      }
    };

    await loadAuthMode();

    const loadMaintenance = async () => {
      if (maintenanceStatus) maintenanceStatus.textContent = '加载中...';
      try {
        const state = await API.adminMaintenanceStatus();
        const active = !!(state && state.active);
        if (maintenanceToggle) maintenanceToggle.checked = active;
        if (maintenanceMessage) {
          maintenanceMessage.value = active && typeof state?.message === 'string' ? state.message : '';
        }
        if (!active && maintenanceMessage) {
          maintenanceMessage.value = '';
        }
        if (maintenanceCode) maintenanceCode.value = '';
        if (maintenanceStatus) {
          maintenanceStatus.textContent = active
            ? `维护模式已开启${state?.message ? `：${state.message}` : ''}`
            : '维护模式未开启。操作前请点击“获取验证码”并在短信日志查看验证码。';
        }
      } catch (err) {
        if (maintenanceStatus) maintenanceStatus.textContent = `加载失败：${err.message || err}`;
      }
    };

    if (maintenanceApply) {
      maintenanceApply.addEventListener('click', async () => {
        if (!maintenanceToggle) return;
        const active = !!maintenanceToggle.checked;
        const message = maintenanceMessage ? maintenanceMessage.value.trim() : '';
        const code = maintenanceCode ? maintenanceCode.value.trim() : '';
        if (!code) {
          if (maintenanceStatus) maintenanceStatus.textContent = '请先输入维护验证码';
          return;
        }
        if (maintenanceStatus) maintenanceStatus.textContent = '提交中...';
        try {
          const state = await API.adminMaintenanceSet(active, message, code);
          if (maintenanceStatus) {
            maintenanceStatus.textContent = state.active
              ? `维护模式已开启${state?.message ? `：${state.message}` : ''}`
              : '维护模式未开启';
          }
          if (!state.active && maintenanceMessage) maintenanceMessage.value = '';
          if (maintenanceCode) maintenanceCode.value = '';
          alert(state.active ? '维护模式已开启，非管理员将无法登录。' : '维护模式已关闭。');
          await loadMaintenance();
        } catch (err) {
          if (maintenanceStatus) maintenanceStatus.textContent = `操作失败：${err.message || err}`;
        }
      });
    }

    if (maintenanceRequest) {
      maintenanceRequest.addEventListener('click', async () => {
        if (maintenanceStatus) maintenanceStatus.textContent = '申请验证码中...';
        try {
          const info = await API.adminMaintenanceRequestCode();
          const expireTs = Number(info?.expire_at || 0);
          if (maintenanceStatus) {
            if (expireTs) {
              const expireTime = new Date(expireTs * 1000).toLocaleTimeString('zh-CN', { hour12: false });
              maintenanceStatus.textContent = `验证码已生成，请在短信日志查看（有效至 ${expireTime}）。`;
            } else {
              maintenanceStatus.textContent = '验证码已生成，请在短信日志查看。';
            }
          }
          if (maintenanceCode) {
            maintenanceCode.value = '';
            maintenanceCode.focus();
          }
        } catch (err) {
          if (maintenanceStatus) maintenanceStatus.textContent = `申请失败：${err.message || err}`;
        }
      });
    }

    const loadAnnouncement = async () => {
      if (announcementStatus) announcementStatus.textContent = '加载中...';
      try {
        const state = await API.adminAnnouncementStatus();
        if (state && state.active) {
          const seconds = Math.max(10, Math.min(Number(state.duration || 60), 60));
          const time = state.created_at ? new Date(state.created_at * 1000).toLocaleString('zh-CN', { hour12: false }) : '-';
          if (announcementStatus) {
            announcementStatus.textContent = `最近公告：${state.message || ''}（约展示 ${seconds} 秒，可被玩家手动关闭 · 创建于 ${time}）`;
          }
        } else if (announcementStatus) {
          announcementStatus.textContent = '当前暂无公告';
        }
      } catch (err) {
        if (announcementStatus) announcementStatus.textContent = `加载失败：${err.message || err}`;
      }
    };

    if (announcementSend) {
      announcementSend.addEventListener('click', async () => {
        const text = announcementMessage ? announcementMessage.value.trim() : '';
        if (!text) {
          alert('请输入公告内容');
          return;
        }
        const raw = announcementDuration ? Number(announcementDuration.value) : 60;
        const seconds = Math.max(10, Math.min(Number.isFinite(raw) ? raw : 60, 60));
        if (announcementStatus) announcementStatus.textContent = '发送中...';
        try {
          const state = await API.adminAnnouncementSend(text, seconds);
          if (announcementMessage) announcementMessage.value = '';
          if (announcementStatus) {
            const duration = Number(state?.duration || seconds);
            announcementStatus.textContent = `公告已发送，将展示约 ${duration} 秒。`;
          }
        } catch (err) {
          if (announcementStatus) announcementStatus.textContent = `发送失败：${err.message || err}`;
        }
        loadAnnouncement();
      });
    }

    if (announcementClear) {
      announcementClear.addEventListener('click', async () => {
        if (announcementStatus) announcementStatus.textContent = '清除中...';
        try {
          await API.adminAnnouncementSend('', 0);
          if (announcementMessage) announcementMessage.value = '';
          if (announcementStatus) announcementStatus.textContent = '当前暂无公告';
        } catch (err) {
          if (announcementStatus) announcementStatus.textContent = `清除失败：${err.message || err}`;
        }
      });
    }

    loadMaintenance();
    loadAnnouncement();

    const loadForceTemplateSeasons = async () => {
      if (!forceTemplateSeason) return;
      forceTemplateSeason.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '默认赛季（当前最新）';
      forceTemplateSeason.appendChild(defaultOption);
      try {
        const catalog = await API.seasonCatalog();
        const seasons = Array.isArray(catalog?.seasons) ? catalog.seasons : [];
        seasons.forEach((season) => {
          const sid = (season?.id || '').trim();
          if (!sid) return;
          const option = document.createElement('option');
          option.value = sid;
          const name = season?.name && season.name !== sid ? `${sid} ${season.name}` : sid;
          option.textContent = name;
          forceTemplateSeason.appendChild(option);
        });
        const latest = (catalog?.latest || '').trim();
        if (latest && forceTemplateSeason.querySelector(`option[value="${latest}"]`)) {
          forceTemplateSeason.value = latest;
        }
      } catch (err) {
        if (forceTemplateStatus) {
          forceTemplateStatus.textContent = `赛季列表加载失败：${err.message || err}`;
        }
      }
    };

    loadForceTemplateSeasons();

    if (forceTemplateApply) {
      forceTemplateApply.addEventListener('click', async () => {
        if (!forceTemplateUserId) return;
        const raw = String(forceTemplateUserId.value || '').trim();
        const userId = Number(raw);
        if (!raw || !Number.isInteger(userId) || userId <= 0) {
          alert('请输入有效的玩家 ID');
          forceTemplateUserId.focus();
          return;
        }
        const seasonValue = forceTemplateSeason ? (forceTemplateSeason.value || '') : '';
        forceTemplateApply.disabled = true;
        if (forceTemplateStatus) forceTemplateStatus.textContent = '提交中...';
        try {
          const resp = await API.adminForceTemplate(userId, seasonValue);
          const seasonLabel = resp?.season_label || resp?.season || (seasonValue ? seasonValue : '默认赛季');
          const templateLabel = resp?.template_label || resp?.template || '特殊模板';
          if (forceTemplateStatus) {
            forceTemplateStatus.innerHTML = `已设置：玩家 <b>${userId}</b> 在 <b>${seasonLabel}</b> 的下一次开砖将获得 <b>${templateLabel}</b>（一次性生效）`;
          }
          forceTemplateUserId.value = '';
          const returnedSeason = resp?.season || '';
          if (forceTemplateSeason && returnedSeason) {
            forceTemplateSeason.value = returnedSeason;
          }
        } catch (err) {
          if (forceTemplateStatus) forceTemplateStatus.textContent = `设置失败：${err.message || err}`;
        } finally {
          forceTemplateApply.disabled = false;
        }
      });
    }

    const updateCookieDesc = (info = {}) => {
      if (!cookieDesc) return;
      const enabled = !!info.enabled;
      const profiles = info.profiles != null ? info.profiles : "-";
      const total = info.total_bricks != null ? info.total_bricks : "-";
      cookieDesc.innerHTML = enabled
        ? `当前已向玩家开放。参与玩家：<b>${profiles}</b> · 累计产出砖：<b>${total}</b>`
        : `当前为关闭状态，普通玩家无法看到该页面。`;
    };

    const updateCultivationDesc = (info = {}) => {
      if (!cultivationDesc) return;
      const enabled = !!info.cultivation_enabled;
      const runs = info.cultivation_runs != null ? info.cultivation_runs : "-";
      const best = info.cultivation_best != null ? info.cultivation_best : "-";
      cultivationDesc.innerHTML = enabled
        ? `模拟修仙已开启，累计开局 <b>${runs}</b> 次 · 服务器最高得分 <b>${best}</b>`
        : `关闭状态，玩家将看不到修仙小游戏入口。`;
    };

    const updateStarfallDesc = (info = {}) => {
      if (!starfallDesc) return;
      const enabled = !!info.starfall_enabled;
      const players = info.starfall_players != null ? info.starfall_players : "-";
      const bestScore = info.starfall_best_score != null ? info.starfall_best_score : "-";
      const bestDay = info.starfall_best_day != null ? info.starfall_best_day : "-";
      starfallDesc.innerHTML = enabled
        ? `星际余生已开放，记录玩家 <b>${players}</b> 位 · 最高分 <b>${bestScore}</b> · 最长旅程 Day <b>${bestDay}</b>`
        : `关闭状态，普通玩家无法进入星际余生页面。`;
    };

    const loadDungeonSettings = () => {
      const stored = DungeonStorage.loadAdminSettings();
      const gameEnabled = stored.gameEnabled !== false;
      const invincible = !!stored.invincible;
      if (dungeonGameToggle) dungeonGameToggle.checked = gameEnabled;
      if (dungeonInvToggle) dungeonInvToggle.checked = invincible;
      if (dungeonToggleDesc) {
        dungeonToggleDesc.textContent = `${gameEnabled ? '入口开放' : '入口关闭'} ｜ ${invincible ? '无敌模式' : '正常模式'}`;
      }
    };

    const persistDungeonSettings = () => {
      if (!dungeonGameToggle || !dungeonInvToggle) return;
      const payload = {
        gameEnabled: !!dungeonGameToggle.checked,
        invincible: !!dungeonInvToggle.checked,
      };
      DungeonStorage.saveAdminSettings(payload);
      API._features = {
        ...(API._features || {}),
        dungeon: {
          available: payload.gameEnabled,
          enabled: payload.gameEnabled,
        },
      };
      if (typeof renderNav === 'function') renderNav();
      loadDungeonSettings();
    };

    const loadCookie = async () => {
      if (!cookieSwitch) return;
      cookieSwitch.disabled = true;
      try {
        const info = await API.cookieAdminStatus();
        cookieSwitch.checked = !!info.enabled;
        updateCookieDesc(info);
        if (cultivationSwitch) cultivationSwitch.checked = !!info.cultivation_enabled;
        updateCultivationDesc(info);
        if (starfallSwitch) starfallSwitch.checked = !!info.starfall_enabled;
        updateStarfallDesc(info);
        API._features = {
          ...(API._features || {}),
          cookie_factory: {
            enabled: !!info.enabled,
            available: !!info.enabled || !!API._me?.is_admin,
          },
          cultivation: {
            enabled: !!info.cultivation_enabled,
            available: !!info.cultivation_enabled || !!API._me?.is_admin,
          },
          starfall: {
            enabled: !!info.starfall_enabled,
            available: !!info.starfall_enabled || !!API._me?.is_admin,
          },
        };
        if (typeof renderNav === 'function') renderNav();
      } catch (e) {
        if (cookieDesc) cookieDesc.textContent = `加载失败：${e.message || e}`;
      } finally {
        cookieSwitch.disabled = false;
      }
    };

    if (cookieSwitch) {
      cookieSwitch.onchange = async () => {
        const desired = !!cookieSwitch.checked;
        cookieSwitch.disabled = true;
        try {
          await API.cookieAdminToggle(desired);
          await loadCookie();
          if (CookieFactoryPage && typeof CookieFactoryPage.refresh === 'function') {
            await CookieFactoryPage.refresh();
          }
        } catch (e) {
          alert(e.message || '更新失败');
          await loadCookie();
        } finally {
          cookieSwitch.disabled = false;
        }
      };
    }

    if (cultivationSwitch) {
      cultivationSwitch.onchange = async () => {
        const desired = !!cultivationSwitch.checked;
        cultivationSwitch.disabled = true;
        try {
          await API.cookieCultivationToggle(desired);
          await loadCookie();
        } catch (e) {
          alert(e.message || '更新失败');
          await loadCookie();
        } finally {
          cultivationSwitch.disabled = false;
        }
      };
    }

    if (starfallSwitch) {
      starfallSwitch.onchange = async () => {
        const desired = !!starfallSwitch.checked;
        starfallSwitch.disabled = true;
        try {
          await API.starfallAdminToggle(desired);
          await loadCookie();
        } catch (e) {
          alert(e.message || '更新失败');
          await loadCookie();
        } finally {
          starfallSwitch.disabled = false;
        }
      };
    }

    await loadCookie();
    loadDungeonSettings();
    if (dungeonGameToggle) dungeonGameToggle.onchange = persistDungeonSettings;
    if (dungeonInvToggle) dungeonInvToggle.onchange = persistDungeonSettings;

    const presenceBox = byId("presence-list");
    const presenceMeta = byId("presence-meta");
    const pageLabels = {
      home: "主页",
      auth: "登录/注册",
      me: "我的信息",
      wallet: "钱包",
      shop: "商店",
      gacha: "开砖",
      cookie: "饼干工厂",
      cultivation: "修仙历练",
      inventory: "背包",
      craft: "合成",
      market: "交易行",
      admin: "管理员",
    };
    const formatAgo = (seconds) => {
      const value = Number(seconds || 0);
      if (!Number.isFinite(value) || value <= 0) return "刚刚";
      if (value < 60) return `${Math.round(value)} 秒前`;
      if (value < 3600) return `${Math.floor(value / 60)} 分钟前`;
      if (value < 86400) return `${Math.floor(value / 3600)} 小时前`;
      return `${Math.floor(value / 86400)} 天前`;
    };
    const describeActivity = (item) => {
      const details = item?.details || {};
      const fmtInt = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        try { return Math.round(num).toLocaleString(); }
        catch (_) { return String(Math.round(num)); }
      };
      const fmtFloat = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return num.toFixed(1);
      };
      switch (item?.activity) {
        case 'cultivation:run': {
          const parts = [];
          if (details.stage) parts.push(String(details.stage));
          const age = fmtInt(details.age);
          if (age) parts.push(`${age} 岁`);
          const score = fmtInt(details.score);
          if (score) parts.push(`${score} 分`);
          const text = parts.length ? parts.join(' · ') : '历练中';
          return escapeHtml(`修仙历练 · ${text}`);
        }
        case 'cultivation:lobby':
          return escapeHtml('修仙历练 · 筹备中');
        case 'cultivation:locked':
          return escapeHtml('修仙历练（入口未开放）');
        case 'cookie:factory': {
          const pieces = [];
          const cookies = fmtInt(details.cookies);
          if (cookies) pieces.push(`🍪 ${cookies}`);
          const cps = fmtFloat(details.cps);
          if (cps) pieces.push(`⚡ ${cps} CPS`);
          const suffix = pieces.length ? ` · ${pieces.join(' · ')}` : '';
          return escapeHtml(`饼干工厂${suffix}`);
        }
        case 'cookie:locked':
          return escapeHtml('饼干工厂（入口未开放）');
        default:
          return escapeHtml(item?.activity || '浏览页面');
      }
    };
    const renderPresence = (items = []) => {
      if (!presenceBox) return;
      if (!items.length) {
        presenceBox.innerHTML = '<div class="muted">当前暂无在线玩家。</div>';
        return;
      }
      const rows = items.map((entry) => {
        const username = escapeHtml(entry.username || '');
        const pageKey = String(entry.page || '').trim();
        const pageLabel = escapeHtml(pageLabels[pageKey] || pageKey || '-');
        const activity = describeActivity(entry);
        const lastSeen = escapeHtml(formatAgo(entry.seconds_ago));
        return `
          <tr>
            <td>${username}</td>
            <td>${pageLabel}</td>
            <td>${activity}</td>
            <td>${lastSeen}</td>
          </tr>`;
      }).join('');
      presenceBox.innerHTML = `
        <table class="table admin-presence__table">
          <thead><tr><th>玩家</th><th>所在页面</th><th>当前活动</th><th>最后上报</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };
    const loadPresence = async () => {
      if (!presenceBox) return;
      try {
        const resp = await API.adminPresence();
        const list = Array.isArray(resp?.online) ? resp.online : [];
        renderPresence(list);
        if (presenceMeta) {
          const ts = resp?.now ? new Date(resp.now * 1000) : new Date();
          const timeLabel = ts.toLocaleTimeString('zh-CN', { hour12: false });
          presenceMeta.textContent = `在线 ${list.length} 人 · 更新于 ${timeLabel}`;
        }
      } catch (e) {
        if (presenceBox) {
          presenceBox.innerHTML = `<div class="error">加载失败：${escapeHtml(e.message || e)}</div>`;
        }
        if (presenceMeta) presenceMeta.textContent = '刷新失败';
      }
    };
    try { await loadPresence(); } catch (_) {}
    if (presenceBox) {
      this._presenceTimer = setInterval(() => {
        loadPresence().catch(() => {});
      }, 10000);
      const stopPresence = () => {
        if (AdminPage._presenceTimer) {
          clearInterval(AdminPage._presenceTimer);
          AdminPage._presenceTimer = null;
        }
      };
      window.addEventListener('hashchange', stopPresence, { once: true });
      window.addEventListener('beforeunload', stopPresence, { once: true });
    }


    // —— 渲染函数们 —— //
    const formatLastLogin = (ts) => {
      const value = Number(ts || 0);
      if (!Number.isFinite(value) || value <= 0) {
        return '—';
      }
      const date = new Date(value * 1000);
      const now = Date.now();
      const diffMs = now - date.getTime();
      let relative = '';
      if (diffMs >= 0) {
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes <= 1) {
          relative = '刚刚';
        } else if (diffMinutes < 60) {
          relative = `${diffMinutes} 分钟前`;
        } else {
          const diffHours = Math.floor(diffMinutes / 60);
          if (diffHours < 24) {
            relative = `${diffHours} 小时前`;
          } else {
            const diffDays = Math.floor(diffHours / 24);
            relative = `${diffDays} 天前`;
          }
        }
      }
      const absolute = date.toLocaleString('zh-CN', { hour12: false });
      return relative ? `${absolute} · ${relative}` : absolute;
    };

    const renderUsers = (items=[])=>{
      const rows = items.map(u=>{
        const userId = (u && typeof u.id !== 'undefined' && u.id !== null) ? u.id : '';
        const encoded = encodeURIComponent(u.username || "");
        const lastLoginText = formatLastLogin(u.last_login_ts);
        return `
        <tr>
          <td>${userId}</td>
          <td>${escapeHtml(u.username||"")}</td>
          <td>${escapeHtml(u.phone||"")}</td>
          <td>${u.fiat}</td>
          <td>${u.coins}</td>
          <td>${u.is_admin?'是':'否'}</td>
          <td>${escapeHtml(lastLoginText)}</td>
          <td>
            <div class="admin-note-box">
              <textarea class="admin-note" data-username="${encoded}" rows="2" maxlength="500" placeholder="为该用户添加备注" style="width:100%;min-height:48px;">${escapeHtml(u.admin_note || "")}</textarea>
              <div class="admin-note__actions"><button class="btn btn-mini" data-action="save-note" data-username="${encoded}">保存备注</button></div>
            </div>
          </td>
          <td><button class="btn btn-mini" data-action="view-inventory" data-username="${encoded}">查看仓库</button></td>
        </tr>`;
      }).join("");
      byId("list").innerHTML = `
        <table class="table">
          <thead><tr><th>ID</th><th>用户名</th><th>手机号</th><th>法币</th><th>三角币</th><th>管理员</th><th>最近登录</th><th>备注</th><th>操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const renderReqs = (items=[])=>{
      const rows = items.map(r=>`
        <tr>
          <td>${escapeHtml(r.username||"")}</td>
          <td>${r.amount_fiat}</td>
          <td>${escapeHtml(r.code)}</td>
          <td>${new Date(r.expire_at*1000).toLocaleString()}</td>
        </tr>`).join("");
      byId("req-list").innerHTML = `
        <table class="table">
          <thead><tr><th>用户名</th><th>申请金额</th><th>验证码</th><th>过期时间</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const renderSms = (items=[])=>{
      const rows = items.map(x=>{
        const ts = /^\d+$/.test(x.ts) ? new Date(parseInt(x.ts,10)*1000).toLocaleString() : (x.ts||"");
        return `
          <tr>
            <td>${escapeHtml(ts)}</td>
            <td>${escapeHtml(x.purpose||"")}</td>
            <td>${escapeHtml(x.tag||"")}</td>
            <td>${escapeHtml(x.code||"")}</td>
            <td>${x.amount!=null ? x.amount : ""}</td>
          </tr>`;
      }).join("");
      byId("sms-list").innerHTML = `
        <table class="table">
          <thead><tr><th>时间</th><th>purpose</th><th>账号/手机号</th><th>验证码</th><th>金额</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const inventoryBox = byId("inventory-view");
    const hideInventory = () => {
      if (!inventoryBox) return;
      inventoryBox.innerHTML = "";
      inventoryBox.style.display = "none";
    };
    const showInventoryLoading = (username="") => {
      if (!inventoryBox) return;
      const label = escapeHtml(username || "");
      const suffix = label ? `${label} 的仓库` : "仓库";
      inventoryBox.innerHTML = `<div class="card admin-inventory"><div class="muted">正在加载 ${suffix}...</div></div>`;
      inventoryBox.style.display = "block";
    };
    const renderInventory = (payload) => {
      if (!inventoryBox) return;
      if (!payload) {
        hideInventory();
        return;
      }
      const items = payload.items || [];
      const rows = items.map(item => {
        const wearVal = typeof item.wear === "number" ? item.wear : parseFloat(item.wear);
        const wearText = Number.isFinite(wearVal) ? wearVal.toFixed(3) : escapeHtml(item.wear ?? "-");
        const isExq = !!item.exquisite;
        const status = isExq ? '<span class="badge badge-exq">极品</span>' : '<span class="badge badge-prem">优品</span>';
        const visual = item.visual || { body: [], attachments: [], template: item.template, hidden_template: false, effects: item.effects || [] };
        let templateLabel = item.template_label || "";
        let effectsLabel = (item.effects || []).join("、") || "无特效";
        let previewHtml = `模板：${escapeHtml(templateLabel || "-")} · 特效：${escapeHtml(effectsLabel || "无特效")}`;
        if (window.SkinVisuals) {
          const info = SkinVisuals.describe(visual);
          templateLabel = info.templateLabel || templateLabel;
          effectsLabel = info.effectsLabel || effectsLabel;
          const meta = SkinVisuals.formatMeta(visual);
          previewHtml = SkinVisuals.render(visual, { compact: true, meta });
        }
        return `
          <tr>
            <td>${escapeHtml(item.name || "")}</td>
            <td>${previewHtml}</td>
            <td>${status}</td>
            <td>${wearText}</td>
            <td>${escapeHtml(templateLabel || "-")}</td>
            <td>${escapeHtml(effectsLabel || "无特效")}</td>
            <td>${escapeHtml(item.grade || "-")}</td>
            <td>${escapeHtml(item.serial || "")}</td>
          </tr>`;
      }).join("");
      const summary = `砖皮 ${payload.brick_total || 0} 件 · 极品 ${payload.exquisite_count || 0} · 优品 ${payload.premium_count || 0}`;
      const table = items.length
        ? `<table class="table"><thead><tr><th>名称</th><th>外观</th><th>极品/优品</th><th>磨损</th><th>模板</th><th>特效</th><th>品质</th><th>编号</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<div class="muted">该用户暂无砖皮。</div>`;
      inventoryBox.innerHTML = `
        <div class="card admin-inventory">
          <div class="input-row" style="justify-content:space-between;align-items:center;">
            <h3>${escapeHtml(payload.username || "")} 的仓库</h3>
            <button class="btn btn-mini" id="close-inventory">关闭</button>
          </div>
          <div class="muted">${summary}</div>
          ${table}
        </div>`;
      inventoryBox.style.display = "block";
    };
    hideInventory();

    const listBox = byId("list");
    if (listBox) {
      listBox.addEventListener("click", async (evt) => {
        const btn = evt.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;
        const username = decodeURIComponent(btn.dataset.username || "").trim();
        if (!username) {
          alert("未找到用户名");
          return;
        }
        if (action === "view-inventory") {
          showInventoryLoading(username);
          try {
            const data = await API.adminUserInventory(username);
            renderInventory(data);
          } catch (e) {
            inventoryBox.innerHTML = `<div class="card admin-inventory"><div class="muted">加载失败：${escapeHtml(e.message || e)}</div></div>`;
            inventoryBox.style.display = "block";
          }
          return;
        }
        if (action === "save-note") {
          const selector = `textarea[data-username="${btn.dataset.username}"]`;
          const textarea = listBox.querySelector(selector);
          if (!textarea) {
            alert("找不到备注输入框");
            return;
          }
          const note = textarea.value || "";
          btn.disabled = true;
          const original = btn.textContent;
          let revertNeeded = false;
          try {
            await API.adminSetUserNote(username, note);
            textarea.value = note.trim();
            btn.textContent = "已保存";
            revertNeeded = true;
          } catch (e) {
            alert(e.message || e);
          } finally {
            btn.disabled = false;
            if (revertNeeded) {
              setTimeout(() => { btn.textContent = original; }, 1500);
            } else {
              btn.textContent = original;
            }
          }
        }
      });
    }

    if (inventoryBox) {
      inventoryBox.addEventListener("click", (evt) => {
        if (evt.target && evt.target.id === "close-inventory") {
          hideInventory();
        }
      });
    }

    // —— 充值申请首屏 & 短信日志加载 —— //
    try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ /* 忽略 */ }

    const loadSms = async ()=>{
      const limit = parseInt(byId("sms-limit").value, 10) || 200;
      try {
        const data = await API.adminSmsLog(limit);
        const all = data.items || [];
        const purpose = byId("sms-purpose").value;
        const filtered = purpose ? all.filter(x=> String(x.purpose)===purpose) : all;
        renderSms(filtered);
      } catch(e){ alert(e.message); }
    };
    try { await loadSms(); } catch(e){ /* 忽略 */ }

    // —— 分页状态 & 加载函数（每组 5 个） —— //
    let page = 1;
    const pageSize = 5;
    let lastCount = 0;
    let curQuery = "";

    async function loadUsers() {
      try {
        const d = await API.adminUsers(curQuery, page, pageSize);
        const items = d.items || [];
        lastCount = items.length;
        renderUsers(items);

        byId("pg-info").textContent = `第 ${page} 组（每组 ${pageSize} 人）`;
        byId("pg-prev").disabled = page <= 1;
        byId("pg-next").disabled = lastCount < pageSize;
      } catch (e) {
        alert(e.message);
      }
    }

    // 首屏：第一页
    await loadUsers();

    // 分页按钮
    byId("pg-prev").onclick = () => { if (page > 1) { page -= 1; loadUsers(); } };
    byId("pg-next").onclick = () => { if (lastCount === pageSize) { page += 1; loadUsers(); } };

    // —— 搜索/全部 —— //
    byId("do-q").onclick = () => {
      curQuery = byId("q").value.trim();
      page = 1;
      loadUsers();
    };
    byId("do-all").onclick = () => {
      byId("q").value = "";
      curQuery = "";
      page = 1;
      loadUsers();
    };

    // —— 余额操作 —— //
    const getUserAndNum = (idUser, idAmt) => {
      const u = byId(idUser).value.trim();
      const n = parseInt(byId(idAmt).value, 10) || 0;
      return {u, n};
    };

    byId("fiat-grant").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "fiat-amt");
      if (!u || n<=0) return alert("请填写用户名与金额（法币）");
      try { await API.adminGrantFiat(u, n); alert("已发放"); await loadUsers(); } catch(e){ alert(e.message); }
    };

    byId("fiat-deduct").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "fiat-amt");
      if (!u || n<=0) return alert("请填写用户名与金额（法币）");
      try { await API.adminDeductFiat(u, n); alert("已扣除"); await loadUsers(); } catch(e){ alert(e.message); }
    };

    byId("coin-grant").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "coin-amt");
      if (!u || n<=0) return alert("请填写用户名与数量（三角币）");
      try { await API.adminGrantCoins(u, n); alert("已发放"); await loadUsers(); } catch(e){ alert(e.message); }
    };

    byId("coin-deduct").onclick = async ()=>{
      const {u, n} = getUserAndNum("op-username", "coin-amt");
      if (!u || n<=0) return alert("请填写用户名与数量（三角币）");
      try { await API.adminDeductCoins(u, n); alert("已扣除"); await loadUsers(); } catch(e){ alert(e.message); }
    };

    const pwResult = byId("pw-result");
    const updatePwResult = (msg) => { if (pwResult) pwResult.textContent = msg; };
    byId("pw-request").onclick = async () => {
      const id = parseInt(byId("pw-user-id").value || "0", 10) || 0;
      if (id <= 0) { alert("请输入有效的玩家ID"); return; }
      try {
        updatePwResult("正在发送验证码...");
        const resp = await API.adminPasswordRequest(id);
        const target = resp?.target || {};
        const labelId = (target.user_id !== undefined && target.user_id !== null) ? target.user_id : id;
        updatePwResult(`验证码已下发，请查看短信日志（目标用户：${target.username || labelId}，ID：${labelId}）`);
        try { await loadSms(); } catch (_) {}
      } catch (e) {
        updatePwResult(e.message || String(e));
      }
    };
    byId("pw-confirm").onclick = async () => {
      const id = parseInt(byId("pw-user-id").value || "0", 10) || 0;
      const code = byId("pw-code").value.trim();
      const newPwd = byId("pw-new").value.trim();
      if (id <= 0 || !code) { alert("请填写玩家ID与验证码"); return; }
      try {
        updatePwResult("正在校验...");
        const resp = await API.adminPasswordConfirm(id, code, newPwd ? newPwd : null);
        const user = resp?.user || {};
        const hash = user.password_hash || '未知';
        const plain = (user.password_plain !== undefined && user.password_plain !== null && user.password_plain !== '')
          ? user.password_plain
          : '（未记录）';
        const matchesHash = resp?.password_matches_hash !== false;
        const mismatchNote = matchesHash ? '' : [
          '（警告：记录的明文与哈希不一致，可能为历史密码，',
          '请考虑让玩家重新登录或直接重置。）',
        ].join('');
        const userIdLabel = (user.user_id !== undefined && user.user_id !== null) ? user.user_id : id;
        let statusText;
        if (resp?.password_updated) {
          statusText = '密码已更新，验证码已失效。';
        } else if (resp?.code_consumed) {
          statusText = '验证码已失效。';
        } else {
          statusText = '验证码仍在有效期，如需重置请填写新密码后再次提交。';
        }
        const extraNote = resp?.note ? ` ${resp.note}` : '';
        updatePwResult(`用户 ID ${userIdLabel}（${user.username || '未知用户'}）的密码：${plain}；哈希：${hash}。${statusText}${extraNote}${mismatchNote}`);
        if (resp?.password_updated) {
          alert('密码已更新');
          byId("pw-code").value = "";
          byId("pw-new").value = "";
        }
      } catch (e) {
        updatePwResult(e.message || String(e));
      }
    };

    // —— 充值申请刷新 —— //
    byId("req-refresh").onclick = async ()=>{
      try { const r = await API.adminTopupRequests(); renderReqs(r.items||[]); } catch(e){ alert(e.message); }
    };

    // —— 短信日志刷新 + 目的筛选 —— //
    byId("sms-refresh").onclick = loadSms;
    byId("sms-purpose").onchange = loadSms;
        // ===== 删号：请求验证码 =====
    byId("del-req-btn").onclick = async () => {
      const u = byId("del-username").value.trim();
      if (!u) return alert("请输入要删除的用户名");
      try {
        await API.adminDeleteUserRequest(u);
        alert("删除验证码已下发，请到后台查看 purpose=admin-deluser 的验证码");
        try { await loadSms(); } catch (_) {}
      } catch (e) { alert(e.message); }
    };

    // ===== 删号：携带验证码确认 =====
    byId("del-do-btn").onclick = async () => {
      const u = byId("del-username").value.trim();
      const code = byId("del-code").value.trim();
      if (!u || !code) return alert("请填写用户名和验证码");
      if (!confirm(`确认删除用户「${u}」？此操作不可恢复！`)) return;
      try {
        await API.adminDeleteUserConfirm(u, code);
        alert("已删除该账号");
        // 删除成功后刷新用户列表
        try { const d = await API.adminUsers("",1,50); renderUsers(d.items||[]); } catch (_) {}
        try { await loadSms(); } catch (_) {}
      } catch (e) { alert(e.message); }
    };

  }
};
