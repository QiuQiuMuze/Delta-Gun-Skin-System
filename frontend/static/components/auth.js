const AuthPage = {
  render() {
    return `
    <div class="card"><h2>登录</h2>
      <div class="input-row">
        <input id="login-u" placeholder="用户名"/>
        <input id="login-p" type="password" placeholder="密码"/>
        <button class="btn" id="login-btn">登录</button>
      </div>
      <div class="kv">
        <div class="k">说明</div>
        <div class="v">登录现已取消短信验证码，输入账号密码即可完成登录。</div>
      </div>
    </div>

    <div class="card"><h2>注册</h2>
      <div class="input-row">
        <input id="reg-u" placeholder="用户名"/>
        <input id="reg-p" type="password" placeholder="密码（强度校验）"/>
      </div>
      <div class="input-row">
        <input id="reg-phone" placeholder="手机号（可选）"/>
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
      <div class="muted">注册无需验证码，新账号将自动获得 20000 法币。若勾选“申请管理员”，注册后会再下发一个管理员验证码，需要额外验证。</div>
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

    // ===== 登录 =====
    byId("login-btn").onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      if (!u || !p) return alert("请输入用户名和密码");
      try {
        const d = await API.login(u, p);
        if (d && d.token) API.setToken(d.token);  // 存 token —— 使用 sessionStorage，互不影响其他标签页
        location.hash = "#/me";
      } catch (e) { alert(e.message); }
    };

    // ===== 注册提交 =====
    byId("reg-btn").onclick = async () => {
      const u = byId("reg-u").value.trim();
      const ph = byId("reg-phone").value.trim();
      const pw = byId("reg-p").value;
      const want_admin = !!byId("reg-admin").checked;

      if (!u || !pw)
        return alert("请填写用户名和密码再注册");

      if (ph && !/^1\d{10}$/.test(ph))
        return alert("手机号需为1开头的11位数字（可留空）");

      try {
        const r = await API.register(u, pw, want_admin, ph || null);
        if (want_admin) {
          regAdminUser = u;
          byId("admin-verify-box").style.display = "";
          alert("已申请管理员，请联系作者获取管理员验证码并在下方输入");
        } else {
          alert("注册成功，已自动发放 20000 法币，请使用该账号登录");
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
