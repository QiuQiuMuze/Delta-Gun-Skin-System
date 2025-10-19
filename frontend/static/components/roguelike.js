const RoguelikePage = {
  presence() {
    return {
      activity: "roguelike:design",
      details: { module: "slime-well", focus: "design-doc" },
    };
  },
  render() {
    const sections = [
      { id: "interaction", title: "基础交互与可视化", body: this.renderInteraction() },
      { id: "professions", title: "职业与开局差异", body: this.renderProfessions() },
      { id: "statuses", title: "状态词典", body: this.renderStatuses() },
      { id: "ecology", title: "敌人生态与词缀", body: this.renderEcology() },
      { id: "loot", title: "战利品与装备", body: this.renderLoot() },
      { id: "rooms", title: "房间类型与事件", body: this.renderRooms() },
      { id: "clocks", title: "资源张力与外部时钟", body: this.renderClocks() },
      { id: "meta", title: "评分、称号与元进度", body: this.renderMeta() },
      { id: "volume", title: "首发卷：史莱姆古井", body: this.renderVolume() },
      { id: "facilities", title: "商人·祭坛·营地细化", body: this.renderFacilities() },
      { id: "texts", title: "文本套件与情绪基调", body: this.renderTexts() },
      { id: "modes", title: "模式与难度", body: this.renderModes() },
      { id: "link", title: "站点联动与社区玩法", body: this.renderLinkage() },
      { id: "tuning", title: "可玩性关键旋钮", body: this.renderTuning() },
      { id: "checklist", title: "首发内容清单", body: this.renderChecklist() },
      { id: "run", title: "教学流程示例", body: this.renderSampleRun() },
      { id: "roadmap", title: "版本路线与落地建议", body: this.renderRoadmap() },
    ];
    const quickLinks = sections.map(section => `
      <a class="rogue-anchor__link" href="#rogue-${section.id}" data-rogue-anchor>${section.title}</a>
    `).join("");
    const sectionHtml = sections.map(section => this.renderSection(section)).join("");
    return `
      <div class="rogue-page">
        <div class="card rogue-hero" id="rogue-hero">
          <div class="rogue-hero__header">
            <div class="rogue-hero__title">三分钟一战 · 古井远征设计稿</div>
            <div class="rogue-hero__subtitle">纯文字高策略：路线、读条、词缀与资源博弈全拉满</div>
          </div>
          <div class="rogue-hero__body">
            <p class="rogue-hero__goal">设计目标：<strong>三分钟一战、十分钟一层、三十分钟一卷</strong>。保持刷刷乐趣，连战不停。</p>
            <ul class="rogue-hero__highlights">
              <li>战斗指令分区、半透明提示、状态读条全部标准化。</li>
              <li>职业风格差异 + 首件掉落制造“我变强了”瞬间。</li>
              <li>词缀生态、祭坛交易、评分称号与每周种子驱动循环。</li>
            </ul>
          </div>
          <div class="rogue-anchor" id="rogue-anchor">${quickLinks}</div>
        </div>
        ${sectionHtml}
      </div>
    `;
  },
  renderSection(section) {
    return `
      <section class="rogue-section" id="rogue-${section.id}">
        <div class="card">
          <h2 class="rogue-section__title">${section.title}</h2>
          <div class="rogue-section__body">${section.body}</div>
        </div>
      </section>
    `;
  },
  renderInteraction() {
    const battleCommands = [
      { cmd: "attack", desc: "基础攻击" },
      { cmd: "defend", desc: "格挡，触发护甲/守备" },
      { cmd: "heal", desc: "战中治疗" },
      { cmd: "run", desc: "尝试撤离" },
      { cmd: "skill [名]", desc: "释放指定技能" },
      { cmd: "item [名]", desc: "使用背包消耗品" },
      { cmd: "inspect", desc: "侦查弱点与词缀" },
      { cmd: "mark", desc: "盗贼/猎人专用标记" },
      { cmd: "taunt", desc: "神官/骑士系嘲讽" },
    ];
    const exploreCommands = [
      { cmd: "go [方向|下层]", desc: "移动或下楼" },
      { cmd: "rest", desc: "轻度恢复（涨腐蚀条）" },
      { cmd: "camp", desc: "营地专属强恢复" },
      { cmd: "inventory", desc: "查看背包" },
      { cmd: "equip [物品]", desc: "切换装备" },
      { cmd: "use [物品]", desc: "战外使用" },
      { cmd: "map", desc: "查看小地图/房间信息" },
      { cmd: "leave", desc: "传送阵撤离" },
    ];
    const queryCommands = [
      { cmd: "status", desc: "自身面板与状态" },
      { cmd: "bestiary", desc: "怪物图鉴" },
      { cmd: "relics", desc: "遗物列表" },
      { cmd: "log", desc: "战斗记录" },
    ];
    const renderCommandList = (title, list) => `
      <div class="rogue-command">
        <div class="rogue-command__title">${title}</div>
        <ul class="rogue-command__list">
          ${list.map(item => `<li><code>${item.cmd}</code><span>${item.desc}</span></li>`).join("")}
        </ul>
      </div>
    `;
    const uiSamples = `
      <div class="rogue-ui">
        <div class="rogue-ui__line"><span class="rogue-ui__label">面板行：</span><code>【等级】5 【HP】<span class="rogue-number hp">34/40</span> 【能量】<span class="rogue-number energy">3/5</span> 【背包】药草x2、粗短剑+1</code></div>
        <div class="rogue-ui__line"><span class="rogue-ui__label">战斗条：</span><code>[你 <span class="rogue-number hp">18/20</span> | 怪 <span class="rogue-number danger">6/10</span> | 能量 <span class="rogue-number energy">2/3</span> | 冷却: 盾击<span class="rogue-cooldown">(1)</span>]</code></div>
        <div class="rogue-ui__line"><span class="rogue-ui__label">事件标题：</span><code>〈潮湿的石室〉</code></div>
        <div class="rogue-ui__line"><span class="rogue-ui__label">提示：</span><code class="rogue-hint">（提示：史莱姆怕火。你可用“火花”。）</code></div>
        <div class="rogue-ui__line"><span class="rogue-ui__label">判定文字：</span>
          <span class="rogue-judge rogue-judge--success">成功</span>
          <span class="rogue-judge rogue-judge--fail">失败</span>
          <span class="rogue-judge rogue-judge--crit">暴击</span>
          <span class="rogue-judge rogue-judge--deflect">偏斜</span>
          <span class="rogue-judge rogue-judge--interrupt">打断</span>
        </div>
      </div>
    `;
    return `
      <div class="rogue-section-block">
        <p>操作一律以按钮或指令输入呈现，按钮标签直接展示指令原文，方便学习与记忆。战斗条采用左右对比布局，所有数值均使用霓虹色标记，读条技能以<span class="rogue-judge rogue-judge--interrupt">打断</span>颜色闪烁。</p>
        <div class="rogue-command-grid">
          ${renderCommandList("战斗内指令", battleCommands)}
          ${renderCommandList("战斗外指令", exploreCommands)}
          ${renderCommandList("查询类指令", queryCommands)}
        </div>
        ${uiSamples}
      </div>
    `;
  },
  renderProfessions() {
    const classes = [
      {
        name: "剑士",
        passive: "稳固：defend 会获得 1 层【护甲】",
        skill: "盾击（眩晕 1 回合，冷却 2）",
        start: "小治疗药水×1、粗短剑+1",
      },
      {
        name: "盗贼",
        passive: "背刺：攻击【标记】目标时 +25% 伤害",
        skill: "标记（使目标被标记 2 回合）",
        start: "毒刃涂抹×1、烟雾弹×1",
      },
      {
        name: "法师",
        passive: "回流：击杀返还 1 点能量",
        skill: "火花（小伤 + 易点燃，冷却 1）",
        start: "弱效法术卷×1、蓝药草×1",
      },
      {
        name: "神官",
        passive: "安魂：战后 20% 概率移除 1 负面",
        skill: "祷言（小治疗 + 可驱散 1 个，冷却 2）",
        start: "小治疗药水×1、驱散卷×1",
      },
      {
        name: "猎人",
        passive: "追踪：inspect 揭示额外 1 词缀",
        skill: "猎网（困缚 2 回合，冷却 3）",
        start: "爆裂瓶×1、游侠披风（信息+）",
      },
    ];
    const cards = classes.map(info => `
      <div class="rogue-class">
        <div class="rogue-class__name">${info.name}</div>
        <div class="rogue-class__line"><span>被动</span><span>${info.passive}</span></div>
        <div class="rogue-class__line"><span>起始技能</span><span>${info.skill}</span></div>
        <div class="rogue-class__line"><span>开局物品</span><span>${info.start}</span></div>
      </div>
    `).join("");
    return `
      <div class="rogue-section-block">
        <p>职业设计强调“首战就能感到差异”。战斗指令保持一致，但职业被动、技能冷却、开局道具塑造不同节奏。首层确保掉落一件职业相关装备，让玩家在 5 分钟内体验“数值跳跃”。</p>
        <div class="rogue-class-grid">${cards}</div>
        <p class="rogue-note">首层保证两场战斗内必掉一件职业定制小装备，触发成长反馈。</p>
      </div>
    `;
  },
  renderStatuses() {
    const statuses = [
      { name: "流血", tone: "bleed", effect: "回合末受伤，最高叠 3。" },
      { name: "中毒", tone: "poison", effect: "回合末受伤，治疗效果 -30%。" },
      { name: "燃烧", tone: "burn", effect: "回合末受伤，防御 -10%。" },
      { name: "护甲", tone: "armor", effect: "按层数减免伤害，受击 -1 层。" },
      { name: "守备", tone: "guard", effect: "本回合受伤 -40%，技能冷却 -1。" },
      { name: "眩晕", tone: "stun", effect: "跳过行动 1 回合。" },
      { name: "缓速", tone: "slow", effect: "行动顺序靠后，命中 -10%。" },
      { name: "潮湿", tone: "damp", effect: "被雷/冰克制，火伤 -20%。" },
      { name: "腐化", tone: "corrupt", effect: "受神圣系额外 +25% 伤害。" },
      { name: "标记", tone: "mark", effect: "被猎人/盗贼针对，命中时 +15% 伤害。" },
      { name: "破甲", tone: "sunder", effect: "护甲立即 -2 层或下次受击无护甲。" },
      { name: "激励", tone: "inspire", effect: "击杀后返还能量或微量治疗。" },
    ];
    const statusHtml = statuses.map(state => `
      <div class="rogue-state-card">
        <div class="rogue-state-card__name rogue-state--${state.tone}">${state.name}</div>
        <div class="rogue-state-card__desc">${state.effect}</div>
      </div>
    `).join("");
    return `
      <div class="rogue-section-block">
        <p>每次状态变化即时播报：例如“你对骷髅施加了【破甲】，它的护甲碎裂！”。颜色体系对齐 UI：负面偏红紫，正面偏蓝绿。</p>
        <div class="rogue-state-grid">${statusHtml}</div>
        <div class="rogue-state-log">
          <span>示例回显：</span>
          <code>你挥出战锤，附加了<span class="rogue-state--sunder">【破甲】</span>，骸骨队长护甲崩裂！</code>
          <code>暮光女祭司对你施加了<span class="rogue-state--corrupt">【腐化】</span>，你感觉伤口在发光。</code>
        </div>
      </div>
    `;
  },
  renderEcology() {
    const common = ["史莱姆", "洞鼠", "骷髅兵", "毒蛛", "石像鬼", "邪教徒"];
    const elite = ["吟咒者", "掠食影", "骸骨队长", "蛛后", "石甲魔像"];
    const bosses = ["淤泥巨兽", "暮光女祭司", "无面公爵"];
    const affixes = [
      { name: "狂暴", desc: "50% 血以下伤害 +30%" },
      { name: "铁躯", desc: "受击伤害 -20%，怕破甲" },
      { name: "灵巧", desc: "回避 +15%，易被标记/困缚" },
      { name: "献祭", desc: "死亡时爆裂，对你造成固定伤害" },
      { name: "充能", desc: "每 2 回合释放强技（读条可打断）" },
      { name: "腐蚀", desc: "攻击附带【腐化】 1 回合" },
    ];
    const listBlock = (title, arr) => `
      <div class="rogue-ecology__block">
        <div class="rogue-ecology__title">${title}</div>
        <div class="rogue-ecology__chips">${arr.map(name => `<span class="rogue-chip">${name}</span>`).join("")}</div>
      </div>
    `;
    const affixHtml = affixes.map(item => `
      <div class="rogue-affix">
        <div class="rogue-affix__name">${item.name}</div>
        <div class="rogue-affix__desc">${item.desc}</div>
      </div>
    `).join("");
    return `
      <div class="rogue-section-block">
        <p>敌人池按卷层逐渐开放。inspect 至少显示一个关键词缀与一条弱点提示（如“潮湿体质”）。词缀让普通怪也有重玩价值。</p>
        <div class="rogue-ecology">${listBlock("普通", common)}${listBlock("精英", elite)}${listBlock("层主", bosses)}</div>
        <div class="rogue-affix-grid">${affixHtml}</div>
        <p class="rogue-note">词缀与弱点将直接影响战斗节奏：例如“充能”读条出现时，系统用<span class="rogue-judge rogue-judge--interrupt">打断</span>色提醒。</p>
      </div>
    `;
  },
  renderLoot() {
    const consumables = [
      "小治疗药水：恢复少量 HP",
      "爆裂瓶：投掷，范围小伤 +【燃烧】",
      "烟雾弹：run 必定成功并免惩罚",
      "驱散卷：移除 1 个负面并获得 1 回合【守备】",
      "蓝药草：恢复少量能量",
    ];
    const equipments = [
      "粗短剑+1：攻击 +1",
      "破甲战锤：20% 几率附【破甲】",
      "游侠披风：回避 +5%，inspect 额外显示 1 词缀",
      "红玉戒：对【燃烧】目标 +15% 伤害",
      "净辉护符：对【腐化】目标 +20% 伤害",
      "潮汐法杖：施法使敌【潮湿】 1 回合",
    ];
    const relics = [
      "时停沙漏：第一次致死伤害改为 1 HP 并获得【守备】",
      "古书《潮汐》：水系强化，【潮湿】 +1 回合",
      "面纱：run 成功时恢复少量 HP 与能量",
      "祭司吊坠：每战终 20% 净化 1 负面（与神官被动叠加）",
    ];
    return `
      <div class="rogue-section-block">
        <p>掉落分三层：消耗品提供即时策略，基础装备用于堆叠词缀，唯一遗物带来核心玩法转折。文字道具同样能令人上头。</p>
        <div class="rogue-list-grid">
          <div>
            <div class="rogue-list__title">消耗品</div>
            <ul class="rogue-list">${consumables.map(item => `<li>${item}</li>`).join("")}</ul>
          </div>
          <div>
            <div class="rogue-list__title">基础装备 <span class="hl-green">白/绿</span> · <span class="hl-blue">蓝</span> · <span class="hl-purple">紫</span></div>
            <ul class="rogue-list">${equipments.map(item => `<li>${item}</li>`).join("")}</ul>
          </div>
          <div>
            <div class="rogue-list__title">遗物（唯一）</div>
            <ul class="rogue-list">${relics.map(item => `<li>${item}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
    `;
  },
  renderRooms() {
    const roomTypes = [
      "普通战（最常见）",
      "精英战（难高、掉落好）",
      "宝箱（锁/陷阱判定，inspect 可获提示）",
      "商人（随机库存、回收垃圾装备）",
      "祭坛（献祭 HP/上限/物品换祝福）",
      "营地（强恢复，次数稀缺）",
      "机关室（单回合环境伤害或小谜题）",
      "传送阵/楼梯间（撤离/下层）",
    ];
    const events = [
      {
        name: "〈血字誓约〉",
        desc: "“你在石台上看到一行古旧誓文：献出体与力，换得刀锋饮血的许可。”",
        effect: "失去上限 HP 5，获得被动【嗜血】（击杀回 10% HP，至本层结束）",
      },
      {
        name: "〈碎裂镜面〉",
        desc: "“镜面映出你的轮廓，又像在嘲笑。你伸手触摸，裂痕像花绽放。”",
        effect: "随机重掷 1 个负面：50% 变正面，50% 更糟",
      },
      {
        name: "〈旧书页〉",
        desc: "“纸页泛黄，却仍散发墨香。几行注记像某种基础式。”",
        effect: "从三条基础技能指令中选 1 条学会",
      },
    ];
    const eventHtml = events.map(item => `
      <div class="rogue-event">
        <div class="rogue-event__name">${item.name}</div>
        <div class="rogue-event__desc">${item.desc}</div>
        <div class="rogue-event__effect">效果：${item.effect}</div>
      </div>
    `).join("");
    return `
      <div class="rogue-section-block">
        <p>房间组合强调“权衡”而非纯剧情选择。每 2~3 间房提供一次明确收益，保持节奏。</p>
        <div class="rogue-room-grid">
          ${roomTypes.map(type => `<span class="rogue-chip">${type}</span>`).join("")}
        </div>
        <div class="rogue-events">${eventHtml}</div>
      </div>
    `;
  },
  renderClocks() {
    const bullets = [
      "腐蚀条/追猎者：rest、camp、拖延都会提升，满条触发追猎者伏击或全层 debuff。",
      "连胜与勇气：连续不休息通过房间提升评分与掉落，但提升风险。",
      "撤离决策：传送阵/楼梯间可 leave，保留战利品但放弃更深奖励。",
    ];
    return `
      <div class="rogue-section-block">
        <p>资源张力来自三个外部时钟，促使玩家权衡推进速度与存活率。</p>
        <ul class="rogue-list">${bullets.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderMeta() {
    const scoring = [
      "指标：清层数、精英/词缀怪击杀、受伤次数、用时、是否铁人模式。",
      "称号示例：<span class=\"hl-blue\">迅刃</span>（最快通过）、<span class=\"hl-purple\">殉道者</span>（受伤多但坚持到 Boss）、<span class=\"hl-orange\">净火</span>（燃烧伤害占比高）。",
      "战后文案：你以【迅刃】之名被记载：12 分 47 秒清三层，精英斩于刀下；刀锋尚温。",
    ];
    const meta = [
      "天赋树：点数换被动（+1 背包格、开局随机遗物、商人折扣、额外营地次数）。",
      "图鉴：敌人/词缀/遗物/事件收集；完成度奖励称号或边框。",
      "每周种子：固定随机种子，排行榜比拼“最少受伤通关 / 最速层主”。",
    ];
    return `
      <div class="rogue-section-block">
        <div class="rogue-list__title">战后评分</div>
        <ul class="rogue-list">${scoring.map(item => `<li>${item}</li>`).join("")}</ul>
        <div class="rogue-list__title">元进度循环</div>
        <ul class="rogue-list">${meta.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderVolume() {
    const layer1 = `
      <div class="rogue-layer">
        <div class="rogue-layer__header">第一层：苔痕石室（12~16 房）</div>
        <ul class="rogue-list">
          <li>氛围：潮湿、苔藓、积水，火把昏黄。</li>
          <li>普通怪：史莱姆（弱火，偶分裂）、洞鼠（攻击频繁，偶“偷窃”）、骷髅兵（斩抗高，怕破甲）。</li>
          <li>精英：骸骨队长（护甲+怒吼）、蛙形黏体（潮湿体质，雷/冰克）。</li>
          <li>房型：普通战 ×8~10、精英 ×1~2、宝箱 ×2（毒针/矢箭/酸液陷阱）、祭坛 ×1、营地 ×1、商人 ×1。</li>
          <li>层主【淤泥巨兽】：读条【吞噬】需打断；召唤小史莱姆时防御+；潮湿体质，火持续可触发“翻滚”自净。</li>
          <li>策略提示：（提示：读条现“口腔扩张”即将吞噬；打断/眩晕能阻止）。</li>
        </ul>
      </div>
    `;
    const layer2 = `
      <div class="rogue-layer">
        <div class="rogue-layer__header">第二层：腐潮洞廊（14~18 房）</div>
        <ul class="rogue-list">
          <li>氛围：水汽更重，暗潮与骨粉混杂。</li>
          <li>普通怪：毒蛛（普攻附【中毒】）、邪教徒（施【腐化】、招小怪）、石像鬼（高防，偶【反震】）。</li>
          <li>精英：吟咒者（恐惧/虚弱读条）、蛛后（召唤蛛幼、织网）。</li>
          <li>房型：普通战 ×9~11、精英 ×2、机关室 ×1（潮水突涨）、祭坛 ×1（潮汐选民）、宝箱 ×2（水锁谜题“开-退-开”）、营地或商人二选一。</li>
          <li>层主【暮光女祭司】：循环“净化光束/腐化祈祷”，召“暮光护灵”（在场时受伤 -30%），读条【祈月】（不打断则 3 回合治疗 -50%）。</li>
          <li>策略提示：用 defend/驱散卷撑线，利用猎网/眩晕打断关键读条。</li>
        </ul>
      </div>
    `;
    const layer3 = `
      <div class="rogue-layer">
        <div class="rogue-layer__header">第三层：无面之厅（16~20 房）</div>
        <ul class="rogue-list">
          <li>氛围：镜面墙、回声长廊，低语缠绕。</li>
          <li>普通怪：掠食影（高回避+暴击）、石甲魔像（极高防，怕【破甲】、雷震）、邪教执事（群体【腐化】）。</li>
          <li>精英：双影刺客（协同出手需拆分）、镜像守卫（复制你的 buff）。</li>
          <li>房型：普通战 ×10~12、精英 ×2~3、机关室 ×2（镜像迷障）、宝箱 ×2（剪影锁需 mark → attack 顺序）、祭坛 ×1（无面誓印）、商人 ×1。</li>
          <li>层主【无面公爵】：镜面复制你的被动/增益、【剥夺】偷 buff、召虚相（在场时命中 -20%）。</li>
          <li>策略提示：别堆太多 buff；趁镜像不在场爆发；标记/困缚提高命中。</li>
        </ul>
      </div>
    `;
    const sampleBattle = `
      <div class="rogue-sample-battle">
        <div class="rogue-sample-battle__title">样例战斗片段 · 〈潮湿的石室〉</div>
        <pre>
出现：史莱姆(HP 10/10)。弱点：火焰、雷系过载。
回合1
> inspect
你注意到它的表面在缓慢鼓动，似乎能分裂。
> skill 火花
你释放火花 → 造成 5 伤，附着<span class="rogue-state--burn">【燃烧】</span>。
史莱姆扑击失手（地面湿滑）。
[你 18/20 | 怪 4/10 | 能 2/3 | 火花(1)]
        </pre>
      </div>
    `;
    const bossSample = `
      <div class="rogue-sample-battle">
        <div class="rogue-sample-battle__title">暮光女祭司 · 读条示例</div>
        <pre>
暮光女祭司举起手杖，光芒聚拢——
读条【祈月】（1 回合后生效）：你的治疗 -50%，持续 3 回合。
> 你使用 盾击
打断成功！她的吟唱中止，短暂失衡。
        </pre>
      </div>
    `;
    const outro = `
      <div class="rogue-outro">
        公爵的面皮如薄纸般破裂，露出空洞的无相。回声消散，你听见井水终于落下的声音。<br/>
        【卷一：史莱姆古井】完结。你带着召唤阵的碎片离开——但碎片仍在轻轻颤动。
      </div>
    `;
    return `
      <div class="rogue-section-block">
        <p>故事线：古城外枯井重开，湿气滋生史莱姆与邪教徒。你需三层深入，破坏召唤仪式。</p>
        ${layer1}
        ${layer2}
        ${layer3}
        ${sampleBattle}
        ${bossSample}
        ${outro}
      </div>
    `;
  },
  renderFacilities() {
    const merchantLines = [
      "潮气坏了我的算盘，但价格从不含水。",
      "你需要的不是廉价货，你需要能活下去的东西。",
      "灵魂碎片不找零。",
      "带水气的纸币不收。哦，你是说‘灵魂’？那另当别论。",
      "想活着下去，就把包里没用的东西卖给我。",
    ];
    const altarDeals = [
      "血字誓约：-5 上限 HP → 获得【嗜血】至本层结束。",
      "潮汐选民：每次施法使敌【潮湿】 1 回合，但你受雷伤 +10%。",
      "无面誓印：获得【镜像反噬】，但普通怪战中初始随机 -1 层护甲。",
    ];
    const campOptions = [
      "休息：大量恢复 HP（腐蚀条 +2）。",
      "整备：刷新技能冷却与部分装备耐久。",
      "祷告：净化 1 个负面并小幅恢复能量。",
    ];
    return `
      <div class="rogue-section-block">
        <div class="rogue-list__title">商人轮换</div>
        <ul class="rogue-list">
          <li>普通层商人：药水、爆裂瓶、基础武器、防具、驱散卷。</li>
          <li>稀有商人（低概率）：遗物 / 特殊词条装备，溢价出售。</li>
          <li>回收：卖出白/绿装备换金币或碎片。</li>
        </ul>
        <div class="rogue-quote-grid">${merchantLines.map(line => `<blockquote>${line}</blockquote>`).join("")}</div>
        <div class="rogue-list__title">祭坛交易</div>
        <ul class="rogue-list">${altarDeals.map(item => `<li>${item}</li>`).join("")}</ul>
        <div class="rogue-list__title">营地（每层一次）</div>
        <ul class="rogue-list">${campOptions.map(item => `<li>${item}</li>`).join("")}</ul>
        <p class="rogue-note">营地文案：“火光驱散了潮湿与寒意。你知道不能久留，但此刻你只需睡上片刻。” 使用营地会让腐蚀条 +2。</p>
      </div>
    `;
  },
  renderTexts() {
    const battleTone = [
      "你挥剑斩击 → 造成 X 伤。",
      "敌人反击 → 你受 X 伤。",
      "你格挡成功 → 减免 X 伤。",
      "你施加了【流血】(2)。",
      "读条【吞噬】即将释放（1 回合后生效）。",
      "你用“盾击”打断了技能！",
    ];
    const defeat = "潮湿渗入伤口，火把在倒下前发出最后一声噼啪。古井继续吞下回声。";
    const retreat = "你转身离开。不是认输，只是将胜利延后到呼吸更稳的时刻。";
    const achievements = [
      "迅刃：你的脚步没有停顿，刀锋没有犹疑。",
      "净火：你以火清洗潮湿，以光驱散阴影。",
      "殉道者：痛楚写在你的行进里，却没人能在终殿前挡住你。",
    ];
    return `
      <div class="rogue-section-block">
        <div class="rogue-list__title">战斗回放语气（硬朗简洁）</div>
        <ul class="rogue-list">${battleTone.map(line => `<li>${line}</li>`).join("")}</ul>
        <div class="rogue-list__title">失败与撤离文案</div>
        <p class="rogue-paragraph"><span class="rogue-label">战败：</span>${defeat}</p>
        <p class="rogue-paragraph"><span class="rogue-label">撤离：</span>${retreat}</p>
        <div class="rogue-list__title">成就称号味文</div>
        <ul class="rogue-list">${achievements.map(line => `<li>${line}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderModes() {
    const modes = [
      "新手：怪少词缀、商人便宜、营地 +1。",
      "冒险：标准体验。",
      "铁人：死亡即终，掉落评分更高。",
      "每周挑战：固定规则（如“全层燃烧 -10% 治疗”“敌人 +1 词缀”）+ 排行榜。",
    ];
    return `
      <div class="rogue-section-block">
        <p>四档难度满足入门到硬核。每周挑战与排行榜直连社区竞争。</p>
        <ul class="rogue-list">${modes.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderLinkage() {
    const bullets = [
      "砖皮/积分：每层通关给“灵魂碎片”，可在商城兑抽奖券或称号框。",
      "Cookie Factory / 修仙：跨游戏增益（开局随机遗物 / +1 营地次数）。",
      "个人页：展示“本周最快 / 最稳 / 最狠”榜单 + 图鉴完成度。",
    ];
    return `
      <div class="rogue-section-block">
        <p>与站点深度联动，保持玩家在线循环。</p>
        <ul class="rogue-list">${bullets.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderTuning() {
    const knobs = [
      "普通战出率 / 精英战出率 / 祭坛出率",
      "药水掉落率 / 装备词条强度 / 遗物出现概率",
      "腐蚀条增长速度 / 追猎者强度",
      "Boss 读条频率 / 打断窗口长度",
      "商人价格系数 / 回收率 / 稀有商人刷新率",
    ];
    return `
      <div class="rogue-section-block">
        <p>运营常调旋钮：保持每 2~3 个房间有一次明确收益、每层至少一次强力决定（精英/祭坛/豪购）。</p>
        <ul class="rogue-list">${knobs.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  renderChecklist() {
    const skills = "盾击、回旋斩、火花、冰环、猎网、标记、祷言、惩戒、影遁、毒刃";
    const enemies = "史莱姆、洞鼠、骷髅兵、蛙形黏体、骸骨队长、吟咒者、蛛后、石像鬼、掠食影、石甲魔像、邪教徒、邪教执事、双影刺客、镜像守卫、淤泥巨兽、暮光女祭司、无面公爵";
    const events = "血字誓约、旧书页、碎裂镜面、潮汐选民、无面誓印、潮水突涨、剪影锁、镜像迷障、蛀书堆、潮湿火把、枯井回声、祭坛阴影";
    return `
      <div class="rogue-section-block">
        <p>首发素材一次备齐，文字就能上线。</p>
        <ul class="rogue-list">
          <li>技能（基础包）：${skills}（每个附带味文）。</li>
          <li>敌人档案：${enemies}（各 1 条弱点提示 + 1 条风味）。</li>
          <li>事件库 ≥12 条：${events}（补 2~3 句描写即可）。</li>
          <li>装备 ≥20 件（白/绿/蓝/紫），遗物 ≥8 件（火/水/净化/逃生/信息主题）。</li>
          <li>商人台词 ≥12 句轮换。</li>
        </ul>
      </div>
    `;
  },
  renderSampleRun() {
    return `
      <div class="rogue-section-block">
        <p>教学跑法：从入层到击杀层主的完整流程。</p>
        <div class="rogue-sample-run">
<pre>
【第一层：苔痕石室】
空气潮腥，石缝里慢慢渗出水。你握紧武器，火光在指间跳动。

房1：普通战（史莱姆）
回合1：你 inspect → 发现它惧火与雷。
回合1：你 火花 → 5 伤 +【燃烧】。敌方失手。
回合2：你 attack → 4 伤；燃烧结算 → 1 伤；敌倒地。
掉落：小治疗药水 x1、史莱姆凝胶 x1。

房2：宝箱（毒针陷阱）
你察看锁针：细小孔洞露出金属光。
> inspect → 提示“毒针”
> 你尝试用布包裹手指按下 → 成功。获得：粗短剑+1。

房3：精英（骸骨队长）
读条【奋勇怒吼】（1 回合后：敌群攻+）
> 你 盾击 → 打断成功；它短暂失衡。
> 你 回旋斩 → 多段伤，触发【破甲】。
胜利：获得“破甲战锤”（可替换粗短剑+1）。

房7：祭坛（血字誓约）
你以血为墨，签下誓文。上限 HP-5，获得【嗜血】至本层。

房12：层主（淤泥巨兽）
阶段1：召小史莱姆；你用爆裂瓶+火花清场。
阶段2：读条【吞噬】；你 盾击 打断。
阶段3：潮湿+雷法过载；抓破绽猛攻。
Boss 倒下：获得“古书《潮汐》”。楼梯间开启。

层结算：
你在石阶上回望；潮水声似乎更急促了。
是否 go 下层？（或 leave 撤离保留战利品）
</pre>
        </div>
      </div>
    `;
  },
  renderRoadmap() {
    const roadmap = [
      "卷二：骨粉地窖（骨系、毒系、净化对腐化）。",
      "卷三：镜影回廊（命中/复制/偷取机制扩展）。",
      "周常：炼狱燃潮（全局燃烧、治疗衰减、火系遗物掉落率 ↑）。",
    ];
    const landing = [
      "优先完成首卷第一层（12~16 房 + Boss），打磨战斗回放手感。",
      "上线图鉴与称号，立即提升复玩动力。",
      "开放每周种子 + 小排行榜，结合砖皮经济。",
      "与砖皮经济打通：每层给“碎片 → 抽奖券/称号框”。",
    ];
    return `
      <div class="rogue-section-block">
        <div class="rogue-list__title">下一卷预告</div>
        <ul class="rogue-list">${roadmap.map(item => `<li>${item}</li>`).join("")}</ul>
        <div class="rogue-list__title">快速落地建议</div>
        <ul class="rogue-list">${landing.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  },
  bind() {
    this.setupAnchors();
    window.PresenceTracker?.updateDetails?.(this.presence());
  },
  setupAnchors() {
    const anchorLinks = document.querySelectorAll('[data-rogue-anchor]');
    anchorLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', link.getAttribute('href'));
      });
    });
  }
};
