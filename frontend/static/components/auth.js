const AuthPage = {
  render() {
    return `
    <div class="card"><h2>登录</h2>
      <div class="input-row">
        <input id="login-u" placeholder="用户名"/>
        <input id="login-p" type="password" placeholder="密码"/>
        <button class="btn" id="login-btn">开始登录</button>
      </div>
      <div class="input-row">
        <input id="login-code" placeholder="短信验证码（第二步）"/>
        <button class="btn" id="verify-btn">验证并登录</button>
      </div>
      <div class="kv">
        <div class="k">说明</div>
        <div class="v">第一步成功后，验证码会写到后端中</div>
      </div>
    </div>

    <div class="card"><h2>注册</h2>
      <div class="input-row">
        <input id="reg-u" placeholder="用户名"/>
        <input id="reg-phone" placeholder="手机号（1开头11位）"/>
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
      <div class="muted">若申请管理员，请联系作者，验证通过后此账号成为管理员。</div>
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
    let loginUser = "";
    let regAdminUser = "";

    byId("login-btn").onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      try {
        await API.loginStart(u,p);
        loginUser = u;
        alert("验证码已发送，请查看后输入");
      } catch(e){ alert(e.message); }
    };

    byId("verify-btn").onclick = async () => {
      const code = byId("login-code").value.trim();
      if (!loginUser) return alert("请先执行登录第一步");
      try {
        const d = await API.loginVerify(loginUser, code);
        // 存 token —— 使用 sessionStorage，互不影响其他标签页
        if (d && d.token) API.setToken(d.token);
        location.hash = "#/me";
      } catch(e){ alert(e.message); }
    };

    byId("reg-btn").onclick = async () => {
      const u = byId("reg-u").value.trim();
      const ph = byId("reg-phone").value.trim();
      const pw = byId("reg-p").value;
      const want_admin = !!byId("reg-admin").checked;
      try{
        const r = await API.register(u,ph,pw,want_admin);
        if (want_admin) {
          regAdminUser = u;
          byId("admin-verify-box").style.display = "";
          alert("已申请管理员，请查看 sms_codes.txt 获取验证码并在下方输入");
        } else {
          alert("注册成功，请去登录");
        }
      }catch(e){ alert(e.message); }
    };

    byId("admin-verify").onclick = async ()=>{
      const code = byId("admin-code").value.trim();
      if (!regAdminUser) return alert("请先执行管理员注册");
      try{
        await API.adminVerify(regAdminUser, code);
        alert("管理员开通成功，请使用该账号登录");
      }catch(e){ alert(e.message); }
    };

    byId("rp-send").onclick = async () => {
      const ph = byId("rp-phone").value.trim();
      try{
        await API.sendCode(ph,"reset");
        alert("验证码已发送");
      }catch(e){ alert(e.message); }
    };

    byId("rp-do").onclick = async () => {
      const ph = byId("rp-phone").value.trim();
      const code = byId("rp-code").value.trim();
      const nw = byId("rp-new").value;
      try{
        await API.resetPassword(ph, code, nw);
        alert("重置成功，请用新密码登录");
      }catch(e){ alert(e.message); }
    };
  }
};
