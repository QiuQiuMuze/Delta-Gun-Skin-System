const AuthPage = {
  render() {
    return `
    <div class="card"><h2>登录</h2>
      <div class="input-row"><input id="login-u" placeholder="用户名"/><input id="login-p" type="password" placeholder="密码"/><button class="btn" id="login-btn">开始登录</button></div>
      <div class="input-row"><input id="login-code" placeholder="短信验证码（第二步）"/><button class="btn" id="verify-btn">验证并登录</button></div>
      <div class="kv"><div class="k">说明</div><div class="v">第一步成功后，验证码会写到 <code>sms_codes.txt</code>（后端根目录）</div></div>
    </div>
    <div class="card"><h2>注册</h2>
      <div class="input-row"><input id="reg-u" placeholder="用户名"/><input id="reg-phone" placeholder="手机号（1开头11位）"/><input id="reg-p" type="password" placeholder="密码（强度校验）"/><button class="btn" id="reg-btn">注册</button></div>
    </div>
    <div class="card"><h2>重置密码</h2>
      <div class="input-row"><input id="rp-phone" placeholder="绑定手机号"/><button class="btn" id="rp-send">发送验证码</button></div>
      <div class="input-row"><input id="rp-code" placeholder="验证码"/><input id="rp-new" type="password" placeholder="新密码"/><button class="btn" id="rp-do">重置</button></div>
    </div>`;
  },
  bind() {
    let loginUser = "";
    byId("login-btn").onclick = async () => {
      const u = byId("login-u").value.trim();
      const p = byId("login-p").value;
      try { await API.loginStart(u,p); loginUser = u; alert("验证码已发送，请查看后输入"); } catch(e){ alert(e.message); }
    };
    byId("verify-btn").onclick = async () => {
      const code = byId("login-code").value.trim(); if (!loginUser) return alert("请先执行登录第一步");
      try { const d = await API.loginVerify(loginUser, code); API.setToken(d.token); location.hash = "#/me"; } catch(e){ alert(e.message); }
    };
    byId("reg-btn").onclick = async () => {
      const u = byId("reg-u").value.trim(), ph = byId("reg-phone").value.trim(), pw = byId("reg-p").value;
      try{ await API.register(u,ph,pw); alert("注册成功，请去登录"); }catch(e){ alert(e.message); }
    };
    byId("rp-send").onclick = async () => {
      const ph = byId("rp-phone").value.trim(); try{ await API.sendCode(ph,"reset"); alert("验证码已发送"); }catch(e){ alert(e.message); }
    };
    byId("rp-do").onclick = async () => {
      const ph = byId("rp-phone").value.trim(), code = byId("rp-code").value.trim(), nw = byId("rp-new").value;
      try{ await API.resetPassword(ph, code, nw); alert("重置成功，请用新密码登录"); }catch(e){ alert(e.message); }
    };
  }
}
