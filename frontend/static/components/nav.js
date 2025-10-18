const Nav = {
  render() {
    const authed = !!API.token;
    const isAdmin = !!API._me?.is_admin;
    const hasCookie = !!API._features?.cookie_factory?.available;
    const hasCultivation = !!API._features?.cultivation?.available;
    const links = [
      ["home","主页"],
      ...(authed ? [
        ["me","我的信息"], ["wallet","钱包"], ["shop","商店"], ["gacha","开砖"],
        ...(hasCookie ? [["cookie","饼干工厂"]] : []),
        ["starfall","星际余生"],
        ...(hasCultivation ? [["cultivation","修仙历练"]] : []),
        ["friends","好友"],
        ["inventory","背包"], ["craft","合成"], ["market","交易行"]
      ] : [["auth","登录/注册"]]),
      ...(isAdmin ? [["admin","管理员"]] : []),
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
