const AdminAuthModePage = {
  render() {
    return `
    <div class="card">
      <h2>登录/注册模式开关</h2>
      <p class="muted">切换管理员模式时，登录与注册流程会实时生效。</p>
      <div class="input-row">
        <label><input id="admin-mode-toggle" type="checkbox" /> 启用管理员模式</label>
      </div>
      <div class="muted" id="admin-mode-hint">管理员模式开启后，注册/登录需要手机号与短信验证码。</div>
      <div class="muted" style="margin-top:12px;">
        管理员模式关闭时，可无需手机号直接注册并免验证码登录；通过该方式注册的新账号会自动获得 20000 法币，并会在管理员用户列表中以“★”标记区分。
      </div>
    </div>`;
  },

  async bind() {
    if (!API._me?.is_admin) { alert("非管理员"); location.hash = "#/home"; return; }

    const modeToggle = byId("admin-mode-toggle");
    const modeHint = byId("admin-mode-hint");
    let currentAdminMode = true;

    const broadcastMode = (enabled) => {
      try {
        window.dispatchEvent(new CustomEvent("auth-mode-changed", { detail: { adminMode: !!enabled } }));
      } catch (_) {
        /* 忽略广播失败 */
      }
    };

    const renderModeToggle = (enabled, broadcast = false) => {
      const next = !!enabled;
      const changed = currentAdminMode !== next;
      currentAdminMode = next;
      if (modeToggle) modeToggle.checked = currentAdminMode;
      if (modeHint) {
        modeHint.textContent = currentAdminMode
          ? "管理员模式开启：注册/登录需要手机号与短信验证码。"
          : "管理员模式关闭：注册/登录无需验证码，新注册账号自动获得 20000 法币。";
      }
      if (broadcast && changed) broadcastMode(currentAdminMode);
    };

    renderModeToggle(true);
    try {
      const status = await API.adminAuthMode();
      renderModeToggle(!!(status && status.admin_mode), true);
    } catch (e) {
      renderModeToggle(true);
      if (modeHint) {
        modeHint.textContent += `（读取失败：${e?.message || e}）`;
      }
    }

    if (modeToggle) {
      modeToggle.onchange = async () => {
        const next = !!modeToggle.checked;
        const prev = currentAdminMode;
        modeToggle.disabled = true;
        try {
          await API.adminSetAuthMode(next);
          renderModeToggle(next, true);
          alert(next ? "已开启管理员模式" : "已关闭管理员模式");
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
