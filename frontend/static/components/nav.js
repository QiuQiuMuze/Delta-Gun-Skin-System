const Nav = {
  render() {
    const authed = !!API.token;
    const links = [
      ["home","主页"],
      ...(authed ? [
        ["me","我的信息"], ["wallet","钱包"], ["shop","商店"], ["gacha","开砖"],
        ["inventory","背包"], ["craft","合成"], ["market","交易行"] // ← 已移除 ["odds","概率"]
      ] : [["auth","登录/注册"]]),
      ["admin","管理员"],
      ...(authed ? [["logout","退出登录"]] : [])
    ];
    return `<div class="nav">${links.map(([k,t]) => `<a href="#/${k}" data-route="${k}">${t}</a>`).join("")}</div>`;
  },
  bind() {
    // 高亮当前路由（保持你原本写法）
    document.querySelectorAll('nav a').forEach(a => {
      const r = location.hash.replace(/^#\//,"") || "home";
      if (a.dataset.route === r) a.classList.add("active");
    });
  }
}
