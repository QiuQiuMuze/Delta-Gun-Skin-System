const AuthPage = {
  _adminMode: true,

  async render() {
    try {
      const cfg = await API.authMode();
      this._adminMode = !!cfg.admin_mode;
    } catch (err) {
      console.warn("authMode fetch failed, fallback to 管理员模式", err);
      this._adminMode = true;
    }
    return this._adminMode ? this.renderStrict() : this.renderRelaxed();
  },

  renderStrict() {
    return `
    <div class="card"><h2>登录 <small class="badge">管理员模式开启：需短信验证</small></h2>
      <div class="input-row">
        <input id="login-u" placeholder="用户名"/>
        <input id="login-p" type="password" placeholder="密码"/>
        <button class="btn" id="login-btn">获取验证码</button>
      </div>
      <div class="input-row">
        <input id="login-code" placeholder="短信验证码（第二步）"/>
        <button class="btn" id="verify-btn">验证并登录</button>
      </div>
      <div class="kv">
        <div class="k">说明</div>
        <div class="v">点击开始登录后，验证码请联系作者获取。若账号为快速注册用户，将自动跳过验证码。</div>
      </div>
    </div>

    <div class="card"><h2>注册</h2>
      <div class="input-row">
        <input id="reg-u" placeholder="用户名"/>
        <input id="reg-phone" placeholder="手机号（1开头11位）"/>
        <button class="btn" id="reg-send-code">获取验证码(注册)</button>
      </div>
      <div class="input-row">
        <input id="reg-code" placeholder="短信验证码"/>
        <input id="reg-p" type="password" placeholder="密码（强度校验）"/>
      </div>
      <div class="input-row">
        <label><input id="reg-admin" type="checkbox"/> 申请管理员</label>
      </div>
      <div class="input-row">
        <button class="btn" id="reg-btn">注册</button>
      </div>
      <div id="admin-verify-box" class="input-row" style="display:none">
        <input id="admin-code" placeholder="管理员验证码（注册第二步）"/>
        <button class="btn" id="admin-verify">提交验证码成为管理员</button>
      </div>
      <div class="muted">先点“获取验证码(注册)”收到短信，再填写验证码完成注册。若勾选“申请管理员”，注册后会再下发一个管理员验证码，需要额外验证。</div>
    </div>

    <div class="card"><h2>重置密码</h2>
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

  renderRelaxed() {
    return `
    <div class="card"><h2>登录 <small class="badge">管理员模式关闭：免短信</small></h2>
      <div class="input-row"><input id="login-u" placeholder="用户名"/></div>
      <div class="input-row"><input id="login-p" type="password" placeholder="密码"/></div>
      <div class="input-row">
        <button class="btn" id="login-direct">直接登录</button>
      </div>
      <div class="muted">当前无需短信验证码，使用用户名 + 密码即可登录。</div>
    </div>

    <div class="card"><h2>快速注册</h2>
      <div class="input-row"><input id="reg-u" placeholder="用户名"/></div>
      <div class="input-row"><input id="reg-p" type="password" placeholder="密码（强度校验）"/></div>
      <div class="input-row"><input id="reg-phone" placeholder="可选：手机号（留空则系统分配虚拟号码）"/></div>
      <div class="input-row">
        <button class="btn" id="reg-direct">立即注册并领取 20000 法币</button>
      </div>
      <div class="muted">通过此方式注册的账号会自动拥有 20000 法币，并在管理员界面以 ✦ 标记，方便区分。</div>
    </div>`;
  },

  bind() {
    if (this._adminMode) {
      this.bindStrict();
    } else {
      this.bindRelaxed();
    }
  },

  bindStrict() {
    let loginUser = "";
    let regAdminUser = "";

    const loginBtn = byId("login-btn");
    const verifyBtn = byId("verify-btn");
    const adminVerifyBtn = byId("admin-verify");
    const regSendBtn = byId("reg-send-code");
    const regBtn = byId("reg-btn");
    const rpSendBtn = byId("rp-send");
    const rpDoBtn = byId("rp-do");

    if (loginBtn) loginBtn.onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      if (!u || !p) return alert("请输入用户名和密码");
      try {
        const res = await API.loginStart(u, p);
        if (res && res.token) {
          API.setToken(res.token);
          location.hash = "#/me";
          return;
        }
        loginUser = u;
        alert("验证码已发送，请查看后输入");
      } catch (e) { alert(e.message); }
    };

    if (verifyBtn) verifyBtn.onclick = async () => {
      const code = byId("login-code").value.trim();
      if (!loginUser) return alert("请先执行登录第一步");
      if (!code) return alert("请输入短信验证码");
      try {
        const d = await API.loginVerify(loginUser, code);
        if (d && d.token) API.setToken(d.token);
        location.hash = "#/me";
      } catch (e) { alert(e.message); }
    };

    if (regSendBtn) regSendBtn.onclick = async () => {
      const ph = byId("reg-phone").value.trim();
      if (!ph) return alert("请输入手机号");
      try {
        await API.sendRegisterCode(ph);
        alert("注册验证码已发送");
      } catch (e) { alert(e.message); }
    };

    if (regBtn) regBtn.onclick = async () => {
      const u = byId("reg-u").value.trim();
      const ph = byId("reg-phone").value.trim();
      const code = byId("reg-code").value.trim();
      const pw = byId("reg-p").value;
      const want_admin = !!byId("reg-admin").checked;

      if (!u || !ph || !code || !pw)
        return alert("请填写完整信息再注册");

      try {
        const r = await API.register(u, ph, code, pw, want_admin);
        if (want_admin) {
          regAdminUser = u;
          byId("admin-verify-box").style.display = "";
          alert("已申请管理员，请联系作者获取管理员验证码并在下方输入");
        } else {
          alert(r?.msg || "注册成功，请去登录");
        }
      } catch (e) { alert(e.message); }
    };

    if (adminVerifyBtn) adminVerifyBtn.onclick = async () => {
      const code = byId("admin-code").value.trim();
      if (!regAdminUser) return alert("请先执行管理员注册");
      if (!code) return alert("请输入管理员验证码");
      try {
        await API.adminVerify(regAdminUser, code);
        alert("管理员开通成功，请使用该账号登录");
      } catch (e) { alert(e.message); }
    };

    if (rpSendBtn) rpSendBtn.onclick = async () => {
      const ph = byId("rp-phone").value.trim();
      if (!ph) return alert("请输入手机号");
      try {
        await API.sendCode(ph, "reset");
        alert("验证码已发送");
      } catch (e) { alert(e.message); }
    };

    if (rpDoBtn) rpDoBtn.onclick = async () => {
      const ph = byId("rp-phone").value.trim();
      const code = byId("rp-code").value.trim();
      const nw = byId("rp-new").value;
      if (!ph || !code || !nw) return alert("请完整填写重置信息");
      try {
        await API.resetPassword(ph, code, nw);
        alert("重置成功，请用新密码登录");
      } catch (e) { alert(e.message); }
    };
  },

  bindRelaxed() {
    const loginBtn = byId("login-direct");
    const regBtn = byId("reg-direct");

    if (loginBtn) loginBtn.onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      if (!u || !p) return alert("请输入用户名和密码");
      try {
        const res = await API.loginStart(u, p);
        if (res && res.token) {
          API.setToken(res.token);
          location.hash = "#/me";
        } else if (res?.otp_required) {
          alert("管理员模式已重新开启，请刷新页面后使用验证码登录");
        } else {
          alert(res?.msg || "登录成功");
        }
      } catch (e) { alert(e.message); }
    };

    if (regBtn) regBtn.onclick = async () => {
      const u = byId("reg-u").value.trim();
      const pw = byId("reg-p").value;
      const ph = byId("reg-phone").value.trim();
      if (!u || !pw) return alert("请填写用户名和密码");
      try {
        const r = await API.register(u, ph || "", "", pw, false);
        alert(r?.msg || "注册成功，20000 法币已到账");
      } catch (e) { alert(e.message); }
    };
  }
};
