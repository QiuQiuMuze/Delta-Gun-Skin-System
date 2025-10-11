const Nav = {
  render() {
    const authed = !!API.token;
    const isAdmin = !!API._me?.is_admin;
    const links = [
      ["home","主页"],
      ...(authed ? [
        ["me","我的信息"], ["wallet","钱包"], ["shop","商店"], ["gacha","开砖"],
        ["inventory","背包"], ["craft","合成"], ["market","交易行"]
      ] : [["auth","登录/注册"]]),
      ...(isAdmin ? [["admin-mode","登录/注册模式"], ["admin","管理员面板"]] : []),
      ...(authed ? [["logout","退出登录"]] : [])
    ];
    return `<div class="nav">${links.map(([k,t]) => `<a href="#/${k}" data-route="${k}">${t}</a>`).join("")}</div>`;
  },
  bind() {
    // 修正：你的容器是 <div class="nav">，不能选 'nav a'
    const r = location.hash.replace(/^#\//,"") || "home";
    document.querySelectorAll('.nav a').forEach(a => {
      if (a.dataset.route === r) a.classList.add("active");
      else a.classList.remove("active");
    });
  }
};
