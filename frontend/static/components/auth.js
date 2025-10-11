const AuthPage = {
  render() {
    return `
    <div class="card"><h2>当前模式</h2>
      <div class="muted" id="mode-hint">正在获取当前模式...</div>
    </div>

    <div class="card"><h2>登录</h2>
      <div class="input-row">
        <input id="login-u" placeholder="用户名"/>
        <input id="login-p" type="password" placeholder="密码"/>
        <button class="btn" id="login-btn">获取验证码</button>
      </div>
      <div class="input-row mode-admin" id="login-step2">
        <input id="login-code" placeholder="短信验证码（第二步）"/>
        <button class="btn" id="verify-btn">验证并登录</button>
      </div>
      <div class="kv">
        <div class="k">说明</div>
        <div class="v" id="login-hint">点击开始登录后，验证码请联系作者获取。</div>
      </div>
    </div>

    <div class="card"><h2>注册</h2>
      <div class="input-row">
        <input id="reg-u" placeholder="用户名"/>
      </div>
      <div class="input-row mode-admin" id="reg-row-phone">
        <input id="reg-phone" placeholder="手机号（1开头11位）"/>
        <button class="btn" id="reg-send-code">获取验证码(注册)</button>
      </div>
      <div class="input-row mode-admin" id="reg-row-code">
        <input id="reg-code" placeholder="短信验证码"/>
      </div>
      <div class="input-row">
        <input id="reg-p" type="password" placeholder="密码（强度校验）"/>
      </div>
      <div class="input-row mode-admin" id="reg-admin-row">
        <label><input id="reg-admin" type="checkbox"/> 申请管理员</label>
      </div>
      <div class="input-row">
        <button class="btn" id="reg-btn">注册</button>
      </div>
      <div id="admin-verify-box" class="input-row mode-admin" style="display:none">
        <input id="admin-code" placeholder="管理员验证码（注册第二步）"/>
        <button class="btn" id="admin-verify">提交验证码成为管理员</button>
      </div>
      <div class="muted" id="reg-hint">先点“获取验证码(注册)”收到短信，再填写验证码完成注册。若勾选“申请管理员”，注册后会再下发一个管理员验证码，需要额外验证。</div>
    </div>

    <div class="card mode-admin" id="reset-card"><h2>重置密码</h2>
      <div class="input-row">
        <input id="rp-phone" placeholder="绑定手机号"/>
        <button class="btn" id="rp-send">发送验证码</button>
      </div>
      <div class="input-row">
        <input id="rp-code" placeholder="验证码"/>
        <input id="rp-new" type="password" placeholder="新密码"/>
        <button class="btn" id="rp-do">重置</button>
      </div>
    </div>`;
  },

  bind() {
    let loginUser = "";
    let regAdminUser = "";
    let fastMode = false;
    let modeReady = false;

    const adminVerifyBox = byId("admin-verify-box");
    const phoneSections = Array.from(document.querySelectorAll(".mode-admin")).filter(el => el.id !== "admin-verify-box");
    phoneSections.forEach(el => { el.style.display = "none"; });
    adminVerifyBox.style.display = "none";

    const applyMode = (isFastMode) => {
      fastMode = !!isFastMode;
      phoneSections.forEach(el => { el.style.display = fastMode ? "none" : ""; });
      if (!fastMode && regAdminUser) {
        adminVerifyBox.style.display = "";
      } else {
        adminVerifyBox.style.display = "none";
      }

      byId("login-btn").textContent = fastMode ? "登录" : "获取验证码";
      const modeHint = byId("mode-hint");
      if (modeHint) {
        modeHint.textContent = fastMode
          ? "快速模式：仅凭用户名和密码即可注册登录，新账号自动获得 20000 法币。"
          : "管理员模式：使用手机号 + 短信验证码进行注册和登录。";
      }
      byId("login-hint").textContent = fastMode
        ? "免验证码，直接输入用户名和密码即可完成登录。"
        : "点击开始登录后，验证码请联系作者获取。";
      byId("reg-hint").textContent = fastMode
        ? "无需手机号，仅填写用户名与密码即可注册，系统会自动赠送 20000 法币。"
        : "先点“获取验证码(注册)”收到短信，再填写验证码完成注册。若勾选“申请管理员”，注册后会再下发一个管理员验证码，需要额外验证。";

      const resetCard = byId("reset-card");
      if (resetCard) resetCard.style.display = fastMode ? "none" : "";

      if (fastMode) {
        loginUser = "";
        regAdminUser = "";
        byId("login-code").value = "";
        byId("reg-code").value = "";
        byId("reg-phone").value = "";
        const regAdminChk = byId("reg-admin");
        if (regAdminChk) regAdminChk.checked = false;
      }
    };

    const ensureModeReady = () => {
      if (!modeReady) {
        alert("正在获取当前登录/注册模式，请稍候重试");
        return false;
      }
      return true;
    };

    const loadMode = async () => {
      try {
        const resp = await API.authMode();
        modeReady = true;
        let respFast = false;
        if (resp && typeof resp.fast_mode !== "undefined") {
          respFast = !!resp.fast_mode;
        } else if (resp && typeof resp.admin_mode !== "undefined") {
          respFast = !resp.admin_mode;
        }
        applyMode(respFast);
      } catch (e) {
        modeReady = true;
        applyMode(false);
        const modeHint = byId("mode-hint");
        if (modeHint) {
          modeHint.textContent += `（获取模式失败：${e?.message || e}，已默认开启管理员模式）`;
        }
      }
    };

    loadMode();
    const getFastMode = () => fastMode;

    const handleModeChanged = (ev) => {
      if (!ev || !ev.detail) return;
      if (typeof ev.detail.fastMode !== "undefined") {
        modeReady = true;
        applyMode(!!ev.detail.fastMode);
        return;
      }
      if (typeof ev.detail.adminMode !== "undefined") {
        modeReady = true;
        applyMode(!ev.detail.adminMode);
      }
    };

    if (window.__authModeHandler) {
      window.removeEventListener("auth-mode-changed", window.__authModeHandler);
    }
    window.__authModeHandler = handleModeChanged;
    window.addEventListener("auth-mode-changed", handleModeChanged);

    // ===== 登录 =====
    byId("login-btn").onclick = async () => {
      if (!ensureModeReady()) return;
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      if (!u || !p) return alert("请输入用户名和密码");
      const fast = getFastMode();
      try {
        const resp = await API.loginStart(u, p, fast);
        if (!fast) {
          loginUser = u;
          alert("验证码已发送，请查看后输入");
        } else {
          if (resp && resp.token) API.setToken(resp.token);
          alert("登录成功");
          location.hash = "#/me";
        }
      } catch (e) { alert(e.message); }
    };

    byId("verify-btn").onclick = async () => {
      if (!ensureModeReady()) return;
      if (getFastMode()) return;
      const code = byId("login-code").value.trim();
      if (!loginUser) return alert("请先执行登录第一步");
      if (!code) return alert("请输入短信验证码");
      try {
        const d = await API.loginVerify(loginUser, code);
        if (d && d.token) API.setToken(d.token);
        location.hash = "#/me";
      } catch (e) { alert(e.message); }
    };

    // ===== 注册：发送注册验证码 =====
    byId("reg-send-code").onclick = async () => {
      if (!ensureModeReady()) return;
      if (getFastMode()) return;
      const ph = byId("reg-phone").value.trim();
      if (!ph) return alert("请输入手机号");
      try {
        await API.sendRegisterCode(ph);
        alert("注册验证码已发送");
      } catch (e) { alert(e.message); }
    };

    // ===== 注册提交 =====
    byId("reg-btn").onclick = async () => {
      if (!ensureModeReady()) return;
      const fast = getFastMode();
      const u = byId("reg-u").value.trim();
      const pw = byId("reg-p").value;
      if (!u || !pw) return alert("请填写用户名和密码");

      if (!fast) {
        const ph = byId("reg-phone").value.trim();
        const code = byId("reg-code").value.trim();
        const want_admin = !!byId("reg-admin").checked;
        if (!ph || !code) return alert("请填写手机号和验证码");
        try {
          const r = await API.register(u, ph, code, pw, want_admin, false);
          if (want_admin) {
            regAdminUser = u;
            applyMode(false);
            alert("已申请管理员，请联系作者获取管理员验证码并在下方输入");
          } else {
            alert("注册成功，请去登录");
          }
        } catch (e) { alert(e.message); }
      } else {
        try {
          await API.register(u, "", "", pw, false, true);
          alert("注册成功，系统已赠送 20000 法币，请直接登录");
        } catch (e) { alert(e.message); }
      }
    };

    // ===== 管理员验证码第二步 =====
    byId("admin-verify").onclick = async () => {
      if (!ensureModeReady()) return;
      if (getFastMode()) return;
      const code = byId("admin-code").value.trim();
      if (!regAdminUser) return alert("请先执行管理员注册");
      if (!code) return alert("请输入管理员验证码");
      try {
        await API.adminVerify(regAdminUser, code);
        alert("管理员开通成功，请使用该账号登录");
        regAdminUser = "";
        applyMode(false);
      } catch (e) { alert(e.message); }
    };

    // ===== 重置密码（短信）=====
    byId("rp-send").onclick = async () => {
      if (!ensureModeReady()) return;
      if (getFastMode()) return;
      const ph = byId("rp-phone").value.trim();
      if (!ph) return alert("请输入手机号");
      try {
        await API.sendCode(ph, "reset");
        alert("验证码已发送");
      } catch (e) { alert(e.message); }
    };

    byId("rp-do").onclick = async () => {
      if (!ensureModeReady()) return;
      if (getFastMode()) return;
      const ph = byId("rp-phone").value.trim();
      const code = byId("rp-code").value.trim();
      const nw = byId("rp-new").value;
      if (!ph || !code || !nw) return alert("请完整填写重置信息");
      try {
        await API.resetPassword(ph, code, nw);
        alert("重置成功，请用新密码登录");
      } catch (e) { alert(e.message); }
    };
  }
};
