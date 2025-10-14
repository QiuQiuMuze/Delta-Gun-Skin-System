const AuthPage = {
  render() {
    return `
    <div class="card"><h2>登录</h2>
      <div class="input-row">
        <input id="login-u" placeholder="用户名"/>
        <input id="login-p" type="password" placeholder="密码"/>
        <button class="btn" id="login-btn">登录</button>
      </div>
      <div class="input-row" id="login-verify-row" style="display:none;">
        <input id="login-code" placeholder="短信验证码（第二步）"/>
        <button class="btn" id="verify-btn">验证并登录</button>
      </div>
      <div class="kv">
        <div class="k">说明</div>
        <div class="v" id="login-hint"></div>
      </div>
    </div>

    <div class="card"><h2>注册</h2>
      <div class="input-row">
        <input id="reg-u" placeholder="用户名"/>
        <input id="reg-p" type="password" placeholder="密码（强度校验）"/>
      </div>
      <div class="input-row" id="reg-phone-row">
        <input id="reg-phone" placeholder="手机号"/>
        <button class="btn" id="reg-send-code">获取验证码(注册)</button>
      </div>
      <div class="input-row" id="reg-code-row" style="display:none;">
        <input id="reg-code" placeholder="短信验证码"/>
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
      <div class="muted" id="reg-hint"></div>
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

  bind() {
    let regAdminUser = "";
    let authState = { verification_free: true };

    const loginHint = byId("login-hint");
    const loginVerifyRow = byId("login-verify-row");
    const loginBtn = byId("login-btn");
    const verifyBtn = byId("verify-btn");
    const regHint = byId("reg-hint");
    const regPhoneRow = byId("reg-phone-row");
    const regCodeRow = byId("reg-code-row");
    const regSendBtn = byId("reg-send-code");
    const regPhoneInput = byId("reg-phone");

    const applyMode = () => {
      const free = !!authState.verification_free;
      loginBtn.textContent = free ? "登录" : "获取验证码";
      loginVerifyRow.style.display = free ? "none" : "";
      loginHint.textContent = free
        ? "登录现已取消短信验证码，输入账号密码即可完成登录。"
        : "当前模式需短信验证码：先输入账号密码点击“获取验证码”，再在下方输入短信码完成登录。";

      if (free) {
        regPhoneRow.style.display = "none";
        regSendBtn.style.display = "none";
        regCodeRow.style.display = "none";
        regPhoneInput.value = "";
        regPhoneInput.disabled = true;
      } else {
        regPhoneRow.style.display = "";
        regSendBtn.style.display = "";
        regCodeRow.style.display = "";
        regPhoneInput.disabled = false;
        regPhoneInput.placeholder = "手机号（1开头11位）";
      }
      regHint.textContent = free
        ? "注册无需短信验证码且无需填写手机号，新账号将自动获得 20000 法币。若勾选“申请管理员”，注册后会额外发放管理员验证码，需要再验证一次。"
        : "当前模式需手机号 + 注册验证码，注册不再额外赠送法币。请先点击“获取验证码(注册)”获得短信码。";
      if (free) loginUser = "";
    };

    applyMode();
    API.authMode().then((m) => {
      if (m && typeof m.verification_free !== "undefined") authState = m;
      applyMode();
    }).catch(() => applyMode());

    // ===== 登录 =====
    loginBtn.onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      if (!u || !p) return alert("请输入用户名和密码");
      try {
        if (authState.verification_free) {
          const d = await API.loginStart(u, p);
          if (d && d.token) API.setToken(d.token);
          location.hash = "#/me";
        } else {
          await API.loginStart(u, p);
          loginUser = u;
          alert("验证码已发送，请查看后输入");
        }
      } catch (e) { alert(e.message); }
    };

    verifyBtn.onclick = async () => {
      if (authState.verification_free) return alert("当前模式无需验证码登录");
      const code = byId("login-code").value.trim();
      if (!loginUser) return alert("请先执行登录第一步");
      if (!code) return alert("请输入短信验证码");
      try {
        const d = await API.loginVerify(loginUser, code);
        if (d && d.token) API.setToken(d.token);
        location.hash = "#/me";
      } catch (e) { alert(e.message); }
    };

    // ===== 注册 =====
    regSendBtn.onclick = async () => {
      if (authState.verification_free) return alert("当前注册无需短信验证码");
      const ph = regPhoneInput.value.trim();
      if (!/^1\d{10}$/.test(ph)) return alert("请输入正确的手机号（1开头11位）");
      try {
        await API.sendRegisterCode(ph);
        alert("注册验证码已发送");
      } catch (e) { alert(e.message); }
    };

    byId("reg-btn").onclick = async () => {
      const u = byId("reg-u").value.trim();
      const ph = authState.verification_free ? "" : regPhoneInput.value.trim();
      const regCodeInput = byId("reg-code");
      const code = regCodeInput ? regCodeInput.value.trim() : "";
      const pw = byId("reg-p").value;
      const want_admin = !!byId("reg-admin").checked;

      if (!u || !pw)
        return alert("请填写用户名和密码再注册");

      if (!authState.verification_free) {
        if (!/^1\d{10}$/.test(ph))
          return alert("请输入正确的手机号（1开头11位）");
        if (!code)
          return alert("请输入注册验证码");
      }

      try {
        const r = await API.register(
          u,
          pw,
          want_admin,
          ph ? ph : null,
          authState.verification_free ? null : code
        );
        if (want_admin) {
          regAdminUser = u;
          byId("admin-verify-box").style.display = "";
          alert("已申请管理员，请联系作者获取管理员验证码并在下方输入");
        } else {
          alert(authState.verification_free ? "注册成功，已自动发放 20000 法币，请使用该账号登录" : "注册成功，请使用该账号登录");
        }
      } catch (e) { alert(e.message); }
    };

    // ===== 管理员验证码第二步 =====
    byId("admin-verify").onclick = async () => {
      const code = byId("admin-code").value.trim();
      if (!regAdminUser) return alert("请先执行管理员注册");
      if (!code) return alert("请输入管理员验证码");
      try {
        await API.adminVerify(regAdminUser, code);
        alert("管理员开通成功，请使用该账号登录");
      } catch (e) { alert(e.message); }
    };

    // ===== 重置密码（短信）=====
    byId("rp-send").onclick = async () => {
      const ph = byId("rp-phone").value.trim();
      if (!ph) return alert("请输入手机号");
      try {
        await API.sendCode(ph, "reset");
        alert("验证码已发送");
      } catch (e) { alert(e.message); }
    };

    byId("rp-do").onclick = async () => {
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
