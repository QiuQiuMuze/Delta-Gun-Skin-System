const AdminAuthModePage = {
  render() {
    return `
    <div class="card">
      <h2>登录/注册模式开关</h2>
      <p class="muted">切换快速模式后，所有新用户注册与登录会立即应用新的流程。</p>
      <div class="input-row">
        <label><input id="admin-mode-toggle" type="checkbox" /> 启用快速模式（免手机号）</label>
      </div>
      <div class="muted" id="admin-mode-hint">快速模式关闭时，注册/登录需要手机号与短信验证码。</div>
      <div class="muted" style="margin-top:12px;">
        快速模式开启后，所有玩家可直接使用“用户名 + 密码”注册与登录，系统会自动赠送 20000 法币；通过该方式注册的新账号会在管理员用户列表中以“★”标记区分。
      </div>
    </div>`;
  },

  async bind() {
    if (!API._me?.is_admin) { alert("非管理员"); location.hash = "#/home"; return; }

    const modeToggle = byId("admin-mode-toggle");
    const modeHint = byId("admin-mode-hint");
    let currentFastMode = false;

    const broadcastMode = (enabled) => {
      try {
        window.dispatchEvent(new CustomEvent("auth-mode-changed", { detail: { fastMode: !!enabled, adminMode: !enabled } }));
      } catch (_) {
        /* 忽略广播失败 */
      }
    };

    const renderModeToggle = (enabled, broadcast = false) => {
      const next = !!enabled;
      const changed = currentFastMode !== next;
      currentFastMode = next;
      if (modeToggle) modeToggle.checked = currentFastMode;
      if (modeHint) {
        modeHint.textContent = currentFastMode
          ? "快速模式开启：注册/登录无需手机号验证码，新注册账号自动获得 20000 法币。"
          : "快速模式关闭：注册/登录需要手机号与短信验证码。";
      }
      if (broadcast && changed) broadcastMode(currentFastMode);
    };

    renderModeToggle(false);
    try {
      const status = await API.adminFastMode();
      const fast = !!(status && (typeof status.fast_mode !== "undefined" ? status.fast_mode : !(status.admin_mode ?? true)));
      renderModeToggle(fast, true);
    } catch (e) {
      renderModeToggle(false);
      if (modeHint) {
        modeHint.textContent += `（读取失败：${e?.message || e}）`;
      }
    }

    if (modeToggle) {
      modeToggle.onchange = async () => {
        const next = !!modeToggle.checked;
        const prev = currentFastMode;
        modeToggle.disabled = true;
        try {
          await API.adminSetFastMode(next);
          renderModeToggle(next, true);
          alert(next ? "已开启快速模式" : "已关闭快速模式");
        } catch (e) {
          alert(e.message);
          renderModeToggle(prev);
        } finally {
          modeToggle.disabled = false;
        }
      };
    }
  }
};
