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
      ...(isAdmin ? [["admin","管理员"]] : []),
      ...(authed ? [["logout","退出登录"]] : [])
    ];
    return `<div class="nav">${links.map(([k,t]) => `<a href="#/${k}" data-route="${k}">${t}</a>`).join("")}</div>`;
  },
  bind() {
    document.querySelectorAll('nav a').forEach(a => {
      const r = location.hash.replace(/^#\//,"") || "home";
      if (a.dataset.route === r) a.classList.add("active");
    });
  }
}
