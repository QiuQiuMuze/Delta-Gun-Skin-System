/* eslint-disable */
const DungeonData = (() => {
  const statuses = {
    bleed: { id: "bleed", name: "流血", type: "debuff", maxStacks: 3, icon: "🩸", description: "回合末受伤，最高叠3。" },
    poison: { id: "poison", name: "中毒", type: "debuff", maxStacks: 5, icon: "☠️", description: "回合末受伤，治疗效果-30%。" },
    burn: { id: "burn", name: "燃烧", type: "debuff", maxStacks: 3, icon: "🔥", description: "回合末受伤，防御-10%。" },
    armor: { id: "armor", name: "护甲", type: "buff", maxStacks: 10, icon: "🛡️", description: "按层数减免伤害，受击-1层。" },
    guard: { id: "guard", name: "守备", type: "buff", maxStacks: 1, icon: "🌀", description: "本回合受伤-40%，技能冷却-1。" },
    stun: { id: "stun", name: "眩晕", type: "debuff", maxStacks: 1, icon: "💫", description: "跳过行动1回合。" },
    slow: { id: "slow", name: "缓速", type: "debuff", maxStacks: 3, icon: "🪤", description: "行动顺序靠后，命中-10%。" },
    wet: { id: "wet", name: "潮湿", type: "debuff", maxStacks: 3, icon: "💧", description: "被雷/冰克制，火伤-20%。" },
    corrupt: { id: "corrupt", name: "腐化", type: "debuff", maxStacks: 5, icon: "☀️", description: "受神圣系额外+25%伤害。" },
    mark: { id: "mark", name: "标记", type: "debuff", maxStacks: 1, icon: "🎯", description: "命中敌人时额外+15%伤害。" },
    shattered: { id: "shattered", name: "破甲", type: "debuff", maxStacks: 3, icon: "🪓", description: "护甲立即-2层或下次受击无护甲。" },
    inspire: { id: "inspire", name: "激励", type: "buff", maxStacks: 3, icon: "✨", description: "击杀后返还能量或微量治疗。" },
  };

  const skills = {
    shield_bash: { id: "shield_bash", name: "盾击", cooldown: 2, cost: 1, type: "physical", tags: ["打断", "眩晕"], description: "挥盾猛击使目标眩晕1回合。", flavor: "盾面轰鸣，打断敌人的节奏。" },
    whirlwind: { id: "whirlwind", name: "回旋斩", cooldown: 3, cost: 2, type: "physical", tags: ["群体", "破甲"], description: "旋转的刀锋，撕裂护甲。", flavor: "铁刃甩出银色弧线。" },
    spark: { id: "spark", name: "火花", cooldown: 1, cost: 1, type: "arcane", tags: ["燃烧", "易点燃"], description: "小火球，附着燃烧。", flavor: "火星沿着湿墙滑落。" },
    frost_ring: { id: "frost_ring", name: "冰环", cooldown: 2, cost: 2, type: "arcane", tags: ["缓速", "潮湿"], description: "结出冰霜环绕敌人，令其缓速。", flavor: "寒雾覆盖石板。" },
    hunter_net: { id: "hunter_net", name: "猎网", cooldown: 3, cost: 1, type: "control", tags: ["困缚", "减速"], description: "掷出猎网，困缚目标2回合。", flavor: "麻绳啪地摊开。" },
    skill_mark: { id: "skill_mark", name: "标记", cooldown: 2, cost: 1, type: "tactic", tags: ["标记", "易伤"], description: "标记目标，2回合内额外受伤。", flavor: "眼神锁定猎物。" },
    prayer: { id: "prayer", name: "祷言", cooldown: 2, cost: 1, type: "support", tags: ["治疗", "驱散"], description: "祈祷之光，治疗并可驱散。", flavor: "光芒自指尖流出。" },
    smite: { id: "smite", name: "惩戒", cooldown: 2, cost: 1, type: "holy", tags: ["神圣", "腐化克制"], description: "圣光斩击，对腐化目标更痛。", flavor: "银白轨迹掠过空气。" },
    shadowstep: { id: "shadowstep", name: "影遁", cooldown: 3, cost: 1, type: "trick", tags: ["回避", "激励"], description: "隐入阴影，提升回避并激励。", flavor: "呼吸与黑暗合而为一。" },
    poison_edge: { id: "poison_edge", name: "毒刃", cooldown: 2, cost: 1, type: "trick", tags: ["中毒", "持续伤害"], description: "短刃涂毒，使目标中毒。", flavor: "绿色液滴沿刃滴落。" },
  };

  const consumables = {
    small_heal: { id: "small_heal", name: "小治疗药水", type: "potion", description: "恢复少量HP。", effect: { heal: 12 } },
    bomb: { id: "bomb", name: "爆裂瓶", type: "bomb", description: "投掷小伤并附燃烧。", effect: { damage: 8, burn: 2 } },
    smoke: { id: "smoke", name: "烟雾弹", type: "escape", description: "run必定成功并免惩罚。", effect: { escape: true } },
    dispel: { id: "dispel", name: "驱散卷", type: "scroll", description: "移除1个负面并获得1回合守备。", effect: { dispel: 1, guard: 1 } },
    ether: { id: "ether", name: "蓝药草", type: "potion", description: "恢复少量能量。", effect: { energy: 3 } },
    poison_coat: { id: "poison_coat", name: "毒刃涂抹", type: "buff", description: "下一次攻击附中毒。", effect: { imbue: "poison" } },
    ember_oil: { id: "ember_oil", name: "余烬油瓶", type: "buff", description: "下一次攻击附燃烧并激励。", effect: { imbue: "ember", inspire: 1 } },
    guard_tonic: { id: "guard_tonic", name: "守护药剂", type: "potion", description: "获得护甲与守备。", effect: { armor: 2, guard: 1 } },
    thunder_scroll: { id: "thunder_scroll", name: "雷霆卷轴", type: "scroll", description: "对潮湿目标额外造成雷鸣打击。", effect: { damage: 10, stun: 1, bonusVsWet: 6 } },
    valor_banner: { id: "valor_banner", name: "勇气旌旗", type: "tactic", description: "鼓舞士气，立即获得勇气并恢复能量。", effect: { heroism: 1, energy: 2 } },
    mending_salve: { id: "mending_salve", name: "愈合膏", type: "salve", description: "缓缓愈合，解除一个流血或中毒。", effect: { heal: 6, cleanse: ["bleed", "poison"] } },
    iron_biscuit: { id: "iron_biscuit", name: "铁味干粮", type: "food", description: "咬起来如钉，能补充体力。", effect: { heal: 8, armor: 1 } },
    celerity_draught: { id: "celerity_draught", name: "灵迅药剂", type: "potion", description: "饮下后精神振奋。", effect: { energy: 1, inspire: 1 } },
    purge_charm: { id: "purge_charm", name: "净澈符石", type: "charm", description: "驱散腐蚀并留下一层守备。", effect: { cleanse: ["corrupt"], guard: 1 } },
  };

  const equipments = {
    short_sword: { id: "short_sword", name: "粗短剑+1", slot: "weapon", rarity: "green", modifiers: { attack: 2 }, description: "攻击+1。" },
    breaker_hammer: { id: "breaker_hammer", name: "破甲战锤", slot: "weapon", rarity: "blue", modifiers: { attack: 1, shatterChance: 0.2 }, description: "20%几率附破甲。" },
    ranger_cloak: { id: "ranger_cloak", name: "游侠披风", slot: "armor", rarity: "blue", modifiers: { evade: 5, extraInspect: true }, description: "回避+5%，inspect额外显示1词缀。" },
    ruby_ring: { id: "ruby_ring", name: "红玉戒", slot: "ring", rarity: "blue", modifiers: { burnBonus: 0.15 }, description: "对燃烧目标+15%伤害。" },
    holy_charm: { id: "holy_charm", name: "净辉护符", slot: "amulet", rarity: "purple", modifiers: { corruptBonus: 0.2 }, description: "对腐化目标+20%伤害。" },
    tide_staff: { id: "tide_staff", name: "潮汐法杖", slot: "weapon", rarity: "purple", modifiers: { spellPower: 2, applyWet: 1 }, description: "施法使敌潮湿1回合。" },
    storm_gloves: { id: "storm_gloves", name: "风暴手套", slot: "glove", rarity: "blue", modifiers: { spellPower: 1, bonusVsWet: 0.1 }, description: "对潮湿目标额外+10%伤害。" },
    dusk_boots: { id: "dusk_boots", name: "暮靴", slot: "boots", rarity: "green", modifiers: { speed: 2 }, description: "行动更迅捷。" },
    guardian_plate: { id: "guardian_plate", name: "守卫胸甲", slot: "armor", rarity: "purple", modifiers: { defense: 2, armor: 2 }, description: "提供额外护甲与防御。" },
    ember_ring: { id: "ember_ring", name: "烬辉指环", slot: "ring", rarity: "purple", modifiers: { emberBoost: 0.2 }, description: "余烬油效果提升，燃烧伤害+20%。" },
    moon_talisman: { id: "moon_talisman", name: "祈月挂坠", slot: "amulet", rarity: "blue", modifiers: { healBonus: 0.15 }, description: "治疗效果提升15%。" },
    storm_cape: { id: "storm_cape", name: "风暴斗篷", slot: "armor", rarity: "blue", modifiers: { extraInspect: true, speed: 1 }, description: "披风捕捉风声，侦察更敏锐。" },
    spirit_blade: { id: "spirit_blade", name: "灵火长刃", slot: "weapon", rarity: "purple", modifiers: { attack: 3, emberBoost: 0.1 }, description: "刀锋映出灵火，伤害更炽烈。" },
    luminous_ward: { id: "luminous_ward", name: "流光护盾", slot: "shield", rarity: "purple", modifiers: { defense: 3, healBonus: 0.1 }, description: "护盾散发微光，稳固心神。" },
  };

  const relics = {
    time_hourglass: { id: "time_hourglass", name: "时停沙漏", effect: "第一次致死伤害改为1HP并获得守备。", type: "survival" },
    tide_codex: { id: "tide_codex", name: "古书《潮汐》", effect: "水系强化，潮湿+1回合。", type: "water" },
    veil: { id: "veil", name: "面纱", effect: "run成功时恢复少量HP与能量。", type: "escape" },
    cleric_pendant: { id: "cleric_pendant", name: "祭司吊坠", effect: "每战终20%净化1负面。", type: "purify" },
    bloodlust: { id: "bloodlust", name: "嗜血", effect: "造成击杀时恢复当前HP10%，至本层结束。", type: "temp" },
    mirror_sigil: { id: "mirror_sigil", name: "无面誓印", effect: "你每次受到暴击，反射5点真实伤害。", type: "mirror" },
    echo_lantern: { id: "echo_lantern", name: "回声灯笼", effect: "事件成功时额外获得20积分。", type: "explore" },
    hunter_totem: { id: "hunter_totem", name: "追迹图腾", effect: "首次进入房间时自动获得勇气1层。", type: "hunt" },
  };

  const classes = {
    swordsman: {
      id: "swordsman",
      name: "剑士",
      passive: "稳固：defend会获得1层护甲",
      passiveId: "steadfast",
      baseStats: { maxHP: 42, maxEnergy: 5, attack: 6, defense: 2 },
      startingSkill: "shield_bash",
      startingItems: [consumables.small_heal, equipments.short_sword],
    },
    rogue: {
      id: "rogue",
      name: "盗贼",
      passive: "背刺：攻击标记目标时+25%伤害",
      passiveId: "backstab",
      baseStats: { maxHP: 36, maxEnergy: 6, attack: 5, defense: 1 },
      startingSkill: "skill_mark",
      startingItems: [consumables.poison_coat, consumables.smoke],
    },
    mage: {
      id: "mage",
      name: "法师",
      passive: "回流：击杀返还1点能量",
      passiveId: "manareturn",
      baseStats: { maxHP: 34, maxEnergy: 7, attack: 5, defense: 1 },
      startingSkill: "spark",
      startingItems: [consumables.ether, consumables.small_heal],
    },
    cleric: {
      id: "cleric",
      name: "神官",
      passive: "安魂：战后20%移除1负面",
      passiveId: "sanctify",
      baseStats: { maxHP: 44, maxEnergy: 5, attack: 4, defense: 2 },
      startingSkill: "prayer",
      startingItems: [consumables.small_heal, consumables.dispel],
    },
    hunter: {
      id: "hunter",
      name: "猎人",
      passive: "追踪：inspect揭示额外1词缀",
      passiveId: "tracker",
      baseStats: { maxHP: 40, maxEnergy: 6, attack: 5, defense: 2 },
      startingSkill: "hunter_net",
      startingItems: [consumables.bomb, equipments.ranger_cloak],
    },
  };

  const enemies = {
    slime: { id: "slime", name: "史莱姆", tier: "normal", hp: 24, attack: 5, defense: 1, speed: 5, weakness: ["火焰", "雷系过载"], flavor: "半透明的软体不断抽动，似乎随时会分裂。", tags: ["潮湿体质"] },
    rat: { id: "rat", name: "洞鼠", tier: "normal", hp: 22, attack: 6, defense: 0, speed: 8, weakness: ["恐惧", "群攻"], flavor: "鼠群在石缝间穿梭，偷袭你的行囊。", tags: ["轻巧", "偷窃"] },
    skeleton: { id: "skeleton", name: "骷髅兵", tier: "normal", hp: 28, attack: 6, defense: 2, speed: 4, weakness: ["钝击", "破甲"], flavor: "骨骼的碰撞声在井壁回响，眼眶微微发光。", tags: ["不死", "顽固"] },
    bone_captain: { id: "bone_captain", name: "骸骨队长", tier: "elite", hp: 48, attack: 8, defense: 4, speed: 5, weakness: ["破甲", "打断怒吼"], flavor: "骨盔刻着古旧军徽，怒吼震得火把摇晃。", tags: ["护甲", "怒吼"] },
    muck_beast: { id: "muck_beast", name: "淤泥巨兽", tier: "boss", hp: 130, attack: 10, defense: 4, speed: 4, weakness: ["雷震", "持续燃烧"], flavor: "巨大的泥团包裹着骨片，张开的巨口要吞下光亮。", tags: ["读条吞噬", "召唤小史莱姆"] },
    spider: { id: "spider", name: "毒蛛", tier: "normal", hp: 24, attack: 6, defense: 1, speed: 7, weakness: ["火", "净化"], flavor: "毒液滴在地面冒泡，蛛丝拉成了网。", tags: ["中毒", "织网"] },
    cultist: { id: "cultist", name: "邪教徒", tier: "normal", hp: 30, attack: 7, defense: 1, speed: 5, weakness: ["打断祈祷", "神圣"], flavor: "低语声在耳边缠绕，他举起骨刃划出符文。", tags: ["腐化", "召唤"] },
    gargoyle: { id: "gargoyle", name: "石像鬼", tier: "normal", hp: 32, attack: 8, defense: 5, speed: 3, weakness: ["破甲", "雷震"], flavor: "粗糙的石翼展开，碎屑不断落下。", tags: ["高防", "反震"] },
    chanter: { id: "chanter", name: "吟咒者", tier: "elite", hp: 55, attack: 7, defense: 2, speed: 6, weakness: ["打断", "静默"], flavor: "吟咏如潮，令空气震颤。", tags: ["控场", "恐惧"] },
    spider_queen: { id: "spider_queen", name: "蛛后", tier: "elite", hp: 66, attack: 8, defense: 3, speed: 5, weakness: ["火焰", "猎网"], flavor: "巨大的腹部悬着蛋囊，蛛足踏在蛛丝上发出滴答声。", tags: ["召唤幼蛛", "织网覆盖"] },
    twilight_priestess: { id: "twilight_priestess", name: "暮光女祭司", tier: "boss", hp: 150, attack: 11, defense: 4, speed: 6, weakness: ["打断祈月", "驱散腐化"], flavor: "她背对火盆祈祷，暮光在指间凝成利刃。", tags: ["净化光束", "腐化祈祷"] },
    shadow: { id: "shadow", name: "掠食影", tier: "normal", hp: 28, attack: 9, defense: 1, speed: 9, weakness: ["标记", "群控"], flavor: "影子拉长又断裂，尖笑声像刀刮玻璃。", tags: ["高回避", "暴击"] },
    stone_colossus: { id: "stone_colossus", name: "石甲魔像", tier: "normal", hp: 46, attack: 9, defense: 6, speed: 2, weakness: ["破甲", "雷震"], flavor: "巨石缝隙闪烁蓝光。", tags: ["极高防御"] },
    cult_deacon: { id: "cult_deacon", name: "邪教执事", tier: "normal", hp: 38, attack: 8, defense: 2, speed: 5, weakness: ["驱散", "打断祝祷"], flavor: "执事的面具无口，却能发出刺耳吟唱。", tags: ["群体腐化"] },
    twin_assassins: { id: "twin_assassins", name: "双影刺客", tier: "elite", hp: 64, attack: 10, defense: 2, speed: 8, weakness: ["拆分击杀", "控场"], flavor: "影与影交错，刀光成双。", tags: ["协同出手"] },
    mirror_guard: { id: "mirror_guard", name: "镜像守卫", tier: "elite", hp: 72, attack: 9, defense: 4, speed: 5, weakness: ["破除增益", "标记"], flavor: "它复制你的姿态，甚至模仿呼吸。", tags: ["复制buff"] },
    faceless_duke: { id: "faceless_duke", name: "无面公爵", tier: "boss", hp: 170, attack: 12, defense: 5, speed: 7, weakness: ["破镜", "控制镜像"], flavor: "面皮如蜡，声音像多个人同时说话。", tags: ["镜像", "偷取增益"] },
  };

  const events = {
    blood_oath: { id: "blood_oath", name: "血字誓约", description: "你在石台上看到一行古旧誓文：献出体与力，换得刀锋饮血的许可。", effect: "失去上限HP 5，获得嗜血到本层结束" },
    cracked_mirror: { id: "cracked_mirror", name: "碎裂镜面", description: "镜面映出你的轮廓，又像在嘲笑。你伸手触摸，裂痕像花绽放。", effect: "随机重掷一个负面状态，有概率转正或恶化" },
    old_page: { id: "old_page", name: "旧书页", description: "纸页泛黄，却仍散发墨香。几行注记似是基础式。", effect: "从三条基础技能指令中学会一条" },
    tide_chosen: { id: "tide_chosen", name: "潮汐选民", description: "潮水符纹绕着石台流动。呼吸中有咸味。", effect: "施法使敌潮湿，但你受雷伤+10%" },
    mirror_sigil: { id: "mirror_sigil", name: "无面誓印", description: "冰冷的符印贴上皮肤，你听见另一张嗓音在耳边低语。", effect: "获得镜像反噬，但普通战初始-1层护甲" },
    tide_surge: { id: "tide_surge", name: "潮水突涨", description: "潮水猛然倒灌，几乎淹过脚踝。", effect: "本房内每回合后额外受潮汐伤害" },
    silhouette_lock: { id: "silhouette_lock", name: "剪影锁", description: "锁孔如剪影，需按顺序敲击才能开启。", effect: "mark后attack次序即可打开" },
    mirror_maze: { id: "mirror_maze", name: "镜像迷障", description: "镜面反射无数条路，错指令会被反噬。", effect: "在此房inspect可获正确口令提示" },
    moth_eaten: { id: "moth_eaten", name: "蛀书堆", description: "残卷堆成小山，虫蛀的洞还残留湿迹。", effect: "翻找或许能找到技能线索" },
    damp_torch: { id: "damp_torch", name: "潮湿火把", description: "火把忽明忽暗，空气湿到让火星发愁。", effect: "晾干可换少量能量或火焰加成" },
    dry_well_echo: { id: "dry_well_echo", name: "枯井回声", description: "低沉的回声告诉你，召唤阵就在更深处。", effect: "增强勇气，连胜加成" },
    altar_shadow: { id: "altar_shadow", name: "祭坛阴影", description: "祭坛阴影里潜伏着另一双眼睛。", effect: "献祭换祝福或承受诅咒" },
  };

  const floors = [
    { id: "floor1", name: "苔痕石室", ambience: "潮湿、苔藓、积水，火把昏黄。", rooms: { normal: ["slime", "rat", "skeleton"], elite: ["bone_captain"], boss: "muck_beast", events: ["blood_oath", "old_page", "cracked_mirror", "damp_torch"], merchants: true, camp: 1 } },
    { id: "floor2", name: "腐潮洞廊", ambience: "水汽更重，暗潮与骨粉混杂。", rooms: { normal: ["spider", "cultist", "gargoyle"], elite: ["chanter", "spider_queen"], boss: "twilight_priestess", events: ["tide_chosen", "tide_surge", "altar_shadow", "moth_eaten"], merchants: true, camp: 1 } },
    { id: "floor3", name: "无面之厅", ambience: "镜面墙、回声长廊，偶有低语。", rooms: { normal: ["shadow", "stone_colossus", "cult_deacon"], elite: ["twin_assassins", "mirror_guard"], boss: "faceless_duke", events: ["mirror_sigil", "silhouette_lock", "mirror_maze", "dry_well_echo"], merchants: true, camp: 1 } },
  ];

  return { statuses, skills, consumables, equipments, relics, classes, enemies, events, floors };
})();

const DungeonStorage = {
  loadScores() {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('dungeon-scores');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  },
  saveScores(scores) {
    if (typeof window === 'undefined') return;
    try {
      const payload = Array.isArray(scores) ? scores.slice(0, 40) : [];
      window.localStorage.setItem('dungeon-scores', JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  },
};

class DungeonRng {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    this.seed = this.seed * 16807 % 2147483647;
    return this.seed;
  }
  random() {
    return (this.next() - 1) / 2147483646;
  }
  pick(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const idx = Math.floor(this.random() * list.length);
    return list[idx];
  }
  shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

class DungeonGame {
  constructor(root) {
    this.root = root;
    this.state = { phase: "intro" };
    this.logEntries = [];
    this.admin = { gameEnabled: true, invincible: false };
    this.scores = DungeonStorage.loadScores();
    this.renderIntro();
  }

  destroy() {
    this.root.innerHTML = "";
  }

  renderIntro() {
    const classes = Object.values(DungeonData.classes);
    const cards = classes.map(cls => `
      <div class="dungeon-class" data-class="${cls.id}">
        <div class="dungeon-class__title">${cls.name}</div>
        <div class="dungeon-class__passive">${cls.passive}</div>
        <div class="dungeon-class__skill"><span class="label">起始技能</span>${DungeonData.skills[cls.startingSkill]?.name || "-"}</div>
        <div class="dungeon-class__items"><span class="label">开局物品</span>${cls.startingItems.map(item => item.name).join("、")}</div>
      </div>
    `).join("");
    this.root.innerHTML = `
      <div class="dungeon-intro">
        <div class="dungeon-intro__head">
          <h2>〈史莱姆古井〉探险</h2>
          <p>三分钟一战、十分钟一层、三十分钟一卷。选择一个职业，准备下井。</p>
        </div>
        <div class="dungeon-class-list">${cards}</div>
        <div class="dungeon-intro__meta">
          <div>提示：首层前两场战斗必掉职业相关装备。</div>
          <div class="dungeon-seed">本周种子：<span id="dungeon-seed"></span></div>
        </div>
      </div>
    `;
    const seed = Math.abs(Math.floor(Date.now() / 604800000));
    const seedNode = this.root.querySelector('#dungeon-seed');
    if (seedNode) seedNode.textContent = seed;
    this.root.querySelectorAll('.dungeon-class').forEach(node => {
      node.addEventListener('click', () => {
        const clsId = node.dataset.class;
        this.startRun(clsId, seed);
      });
    });
  }

  startRun(classId, seed) {
    const cls = DungeonData.classes[classId];
    if (!cls) return;
    this.rng = new DungeonRng(seed + classId.length * 17);
    this._finished = false;
    this.logEntries = [];
    const player = {
      classId,
      name: cls.name,
      passiveId: cls.passiveId,
      level: 5,
      hp: cls.baseStats.maxHP,
      maxHP: cls.baseStats.maxHP,
      energy: cls.baseStats.maxEnergy,
      maxEnergy: cls.baseStats.maxEnergy,
      attack: cls.baseStats.attack,
      defense: cls.baseStats.defense,
      statuses: [],
      armor: 0,
      guard: 0,
      cooldowns: {},
      imbue: null,
      inventory: [],
      equipment: {},
      relics: [],
      bestiary: new Set(),
      codex: new Set(),
      streak: 0,
      heroism: 0,
      flags: {},
    };
    cls.startingItems.forEach(item => {
      player.inventory.push({ ...item, charges: item.effect?.charges || 1 });
      if (item.slot) player.equipment[item.slot] = item;
    });

    this.run = {
      player,
      floorIndex: 0,
      floors: this.generateFloors(),
      corruption: 0,
      maxCorruption: 10,
      campUsed: {},
      history: [],
      heroicPromise: 0,
      score: 0,
      startTime: Date.now(),
      timeHourglassUsed: false,
    };
    this.tutorial = { stage: 'explore', seen: new Set() };
    this.state.phase = "explore";
    this.renderLayout();
    this.enterFloor(0);
    this.addLog(`你选择了${cls.name}，握紧武器，火光在指间跳动。`, "info");
    this.addLog('【教学】右侧“新手指引”会根据阶段给出建议，可随时查看。', 'announce');
  }

  generateFloors() {
    return DungeonData.floors.map((floor, depth) => {
      const map = this.createFloorMap(floor, depth);
      return {
        ...floor,
        map,
        position: { ...map.start },
        cleared: false,
      };
    });
  }

  createFloorMap(floor, depth) {
    const size = floor.size || (depth === 2 ? 5 : 4);
    const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
    const start = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
    const totalSlots = size * size - 1;

    const pool = [];
    const events = this.rng.shuffle(floor.rooms.events.slice());
    const eventSource = events.length ? events : Object.keys(DungeonData.events);
    const eventCount = Math.max(3, Math.min(totalSlots, Math.ceil(totalSlots * 0.3)));
    for (let i = 0; i < eventCount; i += 1) {
      const pick = eventSource[i % eventSource.length];
      pool.push({ type: 'event', eventId: pick, id: `event-${depth}-${i}` });
    }

    const elites = this.rng.shuffle(floor.rooms.elite.slice());
    const eliteSource = elites.length ? elites : floor.rooms.normal.slice();
    const eliteCount = Math.max(1, Math.min((eliteSource.length || 1), Math.floor(totalSlots * 0.15) || 1));
    for (let i = 0; i < eliteCount; i += 1) {
      const pick = eliteSource[i % eliteSource.length];
      pool.push({ type: 'elite', enemyId: pick, id: `elite-${depth}-${i}` });
    }

    if (floor.rooms.merchants) {
      pool.push({ type: 'merchant', id: `merchant-${depth}` });
    }

    const campCount = floor.rooms.camp || 0;
    for (let i = 0; i < campCount; i += 1) {
      pool.push({ type: 'camp', id: `camp-${depth}-${i}` });
    }

    const treasureCount = Math.max(2, Math.floor(totalSlots * 0.2));
    for (let i = 0; i < treasureCount; i += 1) {
      pool.push({ type: 'treasure', id: `treasure-${depth}-${i}` });
    }

    pool.push({ type: 'boss', enemyId: floor.rooms.boss, id: `boss-${depth}` });

    const normals = this.rng.shuffle(floor.rooms.normal.slice());
    const normalSource = normals.length ? normals : ['slime'];
    const remaining = Math.max(0, totalSlots - pool.length);
    for (let i = 0; i < remaining; i += 1) {
      const pick = normalSource[i % normalSource.length];
      pool.push({ type: 'normal', enemyId: pick, id: `normal-${depth}-${i}` });
    }

    const shuffled = this.rng.shuffle(pool);
    let idx = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x === start.x && y === start.y) {
          cells[y][x] = { type: 'start', id: `start-${depth}`, coords: { x, y }, visited: true, revealed: true, resolved: true };
        } else {
          const base = shuffled[idx] || { type: 'normal', enemyId: normalSource[idx % normalSource.length], id: `normal-${depth}-extra-${idx}` };
          cells[y][x] = { ...base, coords: { x, y }, visited: false, revealed: false, resolved: false };
          idx += 1;
        }
      }
    }
    return { size, cells, start };
  }

  renderLayout() {
    this.root.innerHTML = `
      <div class="dungeon-layout">
        <div class="dungeon-left">
          <div class="dungeon-panel" id="dungeon-panel-status"></div>
          <div class="dungeon-panel" id="dungeon-panel-room"></div>
          <div class="dungeon-commands" id="dungeon-commands"></div>
          <div class="dungeon-panel dungeon-guide" id="dungeon-panel-guide"></div>
          <div class="dungeon-log" id="dungeon-log"></div>
        </div>
        <div class="dungeon-right">
          <div class="dungeon-panel dungeon-admin" id="dungeon-panel-admin"></div>
          <div class="dungeon-panel dungeon-progress" id="dungeon-panel-progress"></div>
          <div class="dungeon-panel" id="dungeon-panel-score"></div>
          <div class="dungeon-panel" id="dungeon-panel-inventory"></div>
          <div class="dungeon-panel" id="dungeon-panel-bestiary"></div>
          <div class="dungeon-panel" id="dungeon-panel-relics"></div>
        </div>
      </div>
    `;
    this.updateAll();
  }

  updateAll() {
    this.renderStatus();
    this.renderRoom();
    this.renderCommands();
    this.renderInventory();
    this.renderBestiary();
    this.renderRelics();
    this.renderGuide();
    this.renderAdminPanel();
    this.renderProgress();
    this.renderScoreboard();
    this.renderLog();
  }

  get currentFloor() {
    return this.run?.floors?.[this.run.floorIndex] || null;
  }

  get currentCell() {
    const floor = this.currentFloor;
    if (!floor?.map) return null;
    const pos = floor.position || floor.map.start;
    return floor.map.cells?.[pos.y]?.[pos.x] || null;
  }

  enterFloor(index) {
    this.run.floorIndex = index;
    const floor = this.currentFloor;
    const startPos = { ...floor.map.start };
    floor.position = startPos;
    const startCell = floor.map.cells[startPos.y][startPos.x];
    startCell.visited = true;
    startCell.revealed = true;
    startCell.resolved = true;
    this.run.currentRoom = startCell;
    this.addLog(`【第${index + 1}层：${floor.name}】${floor.ambience}`, "announce");
    this.state.phase = 'explore';
    this.tutorial.stage = 'explore';
    if (this.hasRelic('hunter_totem')) {
      this.run.player.heroism += 1;
      this.addLog('追迹图腾低鸣，勇气+1。', 'goal');
    }
    this.addLog('潮湿的石阶在脚下延伸，四周暗影环绕。', 'info');
    this.updateAll();
  }

  handleCellArrival(cell, options = {}) {
    if (!cell) return;
    this.run.currentRoom = cell;
    if (!cell.revealed) {
      cell.revealed = true;
      cell.visited = true;
      this.addScore(15, '探索');
      if (this.hasRelic('hunter_totem') && !['start', 'camp', 'merchant', 'treasure'].includes(cell.type)) {
        this.run.player.heroism += 1;
        this.addLog('追迹图腾引导你向前，勇气+1。', 'goal');
      }
    } else {
      cell.visited = true;
    }
    if (options.initial) {
      this.updateAll();
      return;
    }
    const floor = this.currentFloor;
    if (!floor.path) floor.path = [];
    floor.path.push(cell.id);
    if (["normal", "elite", "boss"].includes(cell.type)) {
      const enemy = DungeonData.enemies[cell.enemyId];
      this.addLog(`〈${this.randomRoomTitle(enemy)}〉`, "title");
      this.startCombat(cell);
      return;
    }
    if (cell.type === "event") {
      this.addLog(`〈${DungeonData.events[cell.eventId]?.name || "未知事件"}〉`, "title");
      this.state.phase = 'event';
      this.tutorial.stage = 'event';
      this.updateAll();
      return;
    }
    if (cell.type === 'merchant') {
      this.addLog(`〈行商的帐篷〉潮湿的纸币不收——灵魂碎片另当别论。`, 'title');
      this.state.phase = 'merchant';
      this.tutorial.stage = 'merchant';
      this.updateAll();
      return;
    }
    if (cell.type === 'camp') {
      this.addLog(`〈潮湿营地〉火光驱散了寒意，但腐蚀条在抖动。`, 'title');
      this.state.phase = 'camp';
      this.tutorial.stage = 'camp';
      this.updateAll();
      return;
    }
    if (cell.type === 'treasure') {
      this.resolveTreasure(cell);
      return;
    }
    this.updateAll();
  }

  resolveTreasure(cell) {
    if (!cell) return;
    const player = this.run.player;
    this.addLog('〈秘藏石匣〉你拨开青苔，石匣缝隙露出幽光。', 'title');
    let scoreGain = 75;
    const rewards = [];
    const primaryRoll = this.rng.random();
    if (primaryRoll < 0.25) {
      const relicId = this.rng.pick(Object.keys(DungeonData.relics));
      if (!player.relics.includes(relicId)) player.relics.push(relicId);
      const relic = DungeonData.relics[relicId];
      rewards.push(`遗物【${relic?.name || relicId}】`);
      scoreGain += 90;
    } else if (primaryRoll < 0.65) {
      const equipId = this.rng.pick(Object.keys(DungeonData.equipments));
      const equip = DungeonData.equipments[equipId];
      player.inventory.push({ ...equip, charges: 1 });
      rewards.push(`装备【${equip?.name || equipId}】`);
      scoreGain += 60;
    } else {
      const itemId = this.rng.pick(Object.keys(DungeonData.consumables));
      const item = DungeonData.consumables[itemId];
      player.inventory.push({ ...item, charges: item.effect?.charges || 1 });
      rewards.push(`${item?.name || itemId}`);
      scoreGain += 40;
    }
    if (this.rng.random() < 0.45) {
      const extraId = this.rng.pick(Object.keys(DungeonData.consumables));
      const extra = DungeonData.consumables[extraId];
      player.inventory.push({ ...extra, charges: extra.effect?.charges || 1 });
      rewards.push(`${extra?.name || extraId}`);
      scoreGain += 25;
    }
    player.heroism += 1;
    this.addLog(`秘藏赐予勇气，勇气提升至 ${player.heroism}。`, 'goal');
    scoreGain += 50;
    rewards.forEach(text => this.addLog(`获得：${text}`, 'good'));
    cell.resolved = true;
    cell.revealed = true;
    this.state.phase = 'explore';
    this.tutorial.stage = 'explore';
    this.addScore(scoreGain, '秘藏奖励', { log: true });
    this.updateAll();
  }

  randomRoomTitle(enemy) {
    if (!enemy) return "潮湿的石室";
    if (enemy.tier === "elite") return "紧绷的斗场";
    if (enemy.tier === "boss") return "终殿";
    const list = ["潮湿的石室", "滴水的洞窟", "苔痕回廊", "雾气石阶"];
    return this.rng.pick(list) || list[0];
  }
  startCombat(room) {
    const enemyDef = DungeonData.enemies[room.enemyId];
    const enemy = {
      ...enemyDef,
      hp: enemyDef.hp,
      maxHP: enemyDef.hp,
      statuses: [],
      armor: enemyDef.defense || 0,
      guard: 0,
      cooldowns: {},
      channel: null,
      enraged: false,
      inspected: false,
    };
    this.run.combat = { room, enemy, turn: 1, playerActed: false };
    if (this.run.heroicPromise > 0 && enemy.tier !== 'boss') {
      this.run.combat.dropsGuaranteed = true;
      this.run.heroicPromise -= 1;
    }
    this.state.phase = "combat";
    this.tutorial.stage = 'combat';
    if (enemy.tier === 'normal' && this.run.player.flags?.mirrorPenalty && this.rng.random() < 0.5) {
      this.run.player.armor = Math.max(0, this.run.player.armor - 1);
      this.addLog('无面誓印嗡鸣，你的护甲被抽走一层。', 'warn');
    }
    this.addLog(`出现：${enemy.name}(HP ${enemy.hp}/${enemy.maxHP})。弱点：${enemy.weakness.join("、")}。`, "info");
  }

  renderStatus() {
    const node = this.root.querySelector('#dungeon-panel-status');
    if (!node) return;
    const p = this.run.player;
    const floor = this.currentFloor;
    const cell = this.currentCell;
    const coord = floor?.position ? `${floor.position.x + 1},${floor.position.y + 1}` : '-';
    const cellLabel = cell ? this.cellTypeLabel(cell, { reveal: true }) : '未知';
    node.innerHTML = `
      <div class="dungeon-status-line">【等级】${p.level} 【HP】<span class="hl-hp">${p.hp}/${p.maxHP}</span> 【能量】<span class="hl-energy">${p.energy}/${p.maxEnergy}</span> 【腐蚀】<span class="hl-corrupt">${this.run.corruption}/${this.run.maxCorruption}</span></div>
      <div class="dungeon-status-line">【职业】${p.name} 【被动】${this.describePassive()} 【背包】${p.inventory.map(item => `${item.name}${item.charges > 1 ? `x${item.charges}` : ""}`).join("、") || "无"}</div>
      <div class="dungeon-status-line">【所在】${floor?.name || "未知"} · ${cellLabel} ｜ 坐标 (${coord}) 【连胜】${p.streak} 【勇气】<span class="hl-heroism">${p.heroism}</span> 【积分】<span class="hl-score">${this.run.score || 0}</span></div>
    `;
  }

  describePassive() {
    const map = {
      steadfast: "稳固",
      backstab: "背刺",
      manareturn: "回流",
      sanctify: "安魂",
      tracker: "追踪",
    };
    return map[this.run.player.passiveId] || "未知";
  }

  renderRoom() {
    const node = this.root.querySelector('#dungeon-panel-room');
    if (!node) return;
    const room = this.run.currentRoom;
    if (!room) {
      node.innerHTML = `<div class="dungeon-room">尚未探索。</div>`;
      return;
    }
    if (this.state.phase === "combat") {
      node.innerHTML = this.renderCombatPanel();
      return;
    }
    if (this.state.phase === "event") {
      const event = DungeonData.events[room.eventId];
      node.innerHTML = `
        <div class="dungeon-room">
          <div class="dungeon-room__title">〈${event?.name || "未知事件"}〉</div>
          <p>${event?.description || "未知"}</p>
          <p class="muted">效果：${event?.effect || "-"}</p>
        </div>
      `;
      return;
    }
    if (this.state.phase === "merchant") {
      node.innerHTML = `
        <div class="dungeon-room">
          <div class="dungeon-room__title">〈行商〉</div>
          <p>“带水气的纸币不收。哦，你是说‘灵魂’？那另当别论。”</p>
          <p class="muted">可用碎片换取补给或遗物。</p>
        </div>
      `;
      return;
    }
    if (this.state.phase === "camp") {
      node.innerHTML = `
        <div class="dungeon-room">
          <div class="dungeon-room__title">〈潮湿营地〉</div>
          <p>火光驱散了潮湿与寒意。你知道不能久留，但此刻你只需睡上片刻。</p>
          <p class="muted">选项：“扎营休息”“整理装备”“祷告净化”（腐蚀+2）。</p>
        </div>
      `;
      return;
    }
    if (this.state.phase === "transition") {
      node.innerHTML = `
        <div class="dungeon-room">
          <div class="dungeon-room__title">〈楼梯间〉</div>
          <p>石阶向下，潮水声更急。是否继续？</p>
          <p class="muted">使用“继续下行”或“撤离”作出选择。</p>
        </div>
      `;
      return;
    }
    node.innerHTML = `<div class="dungeon-room">未知状态。</div>`;
  }

  renderCombatPanel() {
    const combat = this.run.combat;
    if (!combat) return "";
    const enemy = combat.enemy;
    const status = this.describeEntityStatus(enemy);
    const playerStatus = this.describeEntityStatus(this.run.player, true);
    const bar = `[你 ${this.run.player.hp}/${this.run.player.maxHP} | 怪 ${enemy.hp}/${enemy.maxHP} | 能量 ${this.run.player.energy}/${this.run.player.maxEnergy}${this.renderCooldowns()}]`;
    return `
      <div class="dungeon-room">
        <div class="dungeon-room__title">〈战斗〉${enemy.name}</div>
        <div class="battle-bar">${bar}</div>
        <div class="battle-status enemy">${status}</div>
        <div class="battle-status player">${playerStatus}</div>
        ${enemy.channel ? `<div class="battle-channel">读条【${enemy.channel.name}】即将释放（${enemy.channel.remaining}回合后生效）。</div>` : ""}
      </div>
    `;
  }

  renderCooldowns() {
    const cds = Object.entries(this.run.player.cooldowns || {})
      .filter(([, v]) => v > 0)
      .map(([id, v]) => `${DungeonData.skills[id]?.name || id}(${v})`);
    if (!cds.length) return "";
    return ` | 冷却: ${cds.join("、")}`;
  }

  describeEntityStatus(entity, isPlayer = false) {
    const parts = [];
    const statuses = entity.statuses || [];
    statuses.forEach(st => {
      const def = DungeonData.statuses[st.id];
      if (def) parts.push(`${def.icon || ""}${def.name}${st.stacks ? `(${st.stacks})` : ""}${st.duration ? `/${st.duration}` : ""}`);
    });
    if (entity.armor > 0) parts.push(`护甲${entity.armor}`);
    return parts.length ? parts.join(" · ") : "无状态";
  }

  renderScenePreview() {
    const floor = this.currentFloor;
    const cell = this.currentCell;
    let icon = '🧭';
    let title = floor ? floor.name : '古井回廊';
    let desc = floor ? floor.ambience : '潮湿与阴影交织。';
    let tone = 'neutral';
    if (this.state.phase === 'combat' && this.run.combat?.enemy) {
      const enemy = this.run.combat.enemy;
      icon = '⚔️';
      title = enemy.name;
      desc = `HP ${enemy.hp}/${enemy.maxHP}`;
      tone = 'danger';
    } else if (this.state.phase === 'event' && cell?.eventId) {
      const event = DungeonData.events[cell.eventId];
      icon = '📜';
      title = event?.name || '神秘事件';
      desc = event?.description || '未知的石室回响。';
      tone = 'mystic';
    } else if (this.state.phase === 'merchant') {
      icon = '💰';
      title = '行商的帐篷';
      desc = '潮气弥漫，灵魂碎片在指间流转。';
      tone = 'info';
    } else if (this.state.phase === 'camp') {
      icon = '🔥';
      title = '潮湿营地';
      desc = '火光驱散寒意，腐蚀条却在抖动。';
      tone = 'warm';
    } else if (this.state.phase === 'transition') {
      icon = '🪜';
      title = '楼梯间';
      desc = '下行可更深，亦可择日再战。';
      tone = 'info';
    } else if (this.state.phase === 'ended') {
      const won = this.run?.result === 'victory';
      icon = won ? '🏆' : '💀';
      title = won ? '冒险结算' : '冒险终止';
      desc = won ? '查看积分榜，重新启程吧。' : '你可以总结教训，再战古井。';
      tone = won ? 'victory' : 'danger';
    } else if (cell) {
      icon = this.cellIcon(cell);
      title = this.cellTypeLabel(cell, { reveal: true });
      const moves = this.availableMoves();
      desc = moves.length ? `可行方向：${moves.map(m => m.label).join(' / ')}` : '四周暂时无路。';
    }
    return `
      <div class="scene-preview scene-${tone}">
        <div class="scene-preview__icon">${icon}</div>
        <div class="scene-preview__body">
          <div class="scene-preview__title">${title}</div>
          <div class="scene-preview__desc">${desc}</div>
        </div>
      </div>
    `;
  }

  renderCommands() {
    const node = this.root.querySelector('#dungeon-commands');
    if (!node) return;
    let body = '';
    if (this.state.phase === 'combat') {
      body = this.combatCommands();
    } else if (this.state.phase === 'event') {
      body = this.eventCommands();
    } else if (this.state.phase === 'merchant') {
      body = this.merchantCommands();
    } else if (this.state.phase === 'camp') {
      body = this.campCommands();
    } else if (this.state.phase === 'transition') {
      body = this.transitionCommands();
    } else if (this.state.phase === 'ended') {
      body = `<div class="command-group"><div class="command-title">冒险已记录</div><div class="command-row"><button data-cmd="restart-run">重新启程</button></div></div>`;
    } else {
      body = this.exploreCommands();
    }
    const preview = this.renderScenePreview();
    node.innerHTML = `<div class="command-board">${preview}<div class="command-stack">${body}</div></div>`;
    node.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        this.handleCommand(cmd, btn.dataset.arg || null);
      });
    });
  }

  combatCommands() {
    const skillButtons = this.availableSkills().map(skill => `<button data-cmd="skill" data-arg="${skill.id}">${skill.name}</button>`).join("");
    const itemButtons = this.run.player.inventory.filter(item => !item.slot).map((item, idx) => `<button data-cmd="item" data-arg="${idx}">${item.name}</button>`).join("");
    return `
      <div class="command-group">
        <div class="command-title">基础动作</div>
        <div class="command-row">
          <button data-cmd="attack">攻击</button>
          <button data-cmd="defend">防御</button>
          <button data-cmd="heal">治疗</button>
          <button data-cmd="run">撤退</button>
        </div>
        <div class="command-title">战术指令</div>
        <div class="command-row">
          <button data-cmd="inspect">侦察</button>
          <button data-cmd="mark">标记</button>
          <button data-cmd="taunt">挑衅</button>
          <button data-cmd="log">战斗记录</button>
        </div>
        <div class="command-title">职业技能</div>
        <div class="command-row">
          ${skillButtons || '<span class="muted">无可用技能</span>'}
        </div>
        <div class="command-title">消耗品</div>
        <div class="command-row">
          ${itemButtons || '<span class="muted">无可用消耗品</span>'}
        </div>
      </div>
    `;
  }

  availableSkills() {
    const cls = DungeonData.classes[this.run.player.classId];
    const list = new Set([cls.startingSkill]);
    this.run.player.codex.forEach(id => list.add(id));
    return Array.from(list).map(id => DungeonData.skills[id]).filter(Boolean);
  }

  exploreCommands() {
    const moves = this.availableMoves();
    const moveButtons = moves.map(move => `<button data-cmd="move" data-arg="${move.dir}">${move.label}</button>`).join('');
    return `
      <div class="command-group">
        <div class="command-title">移动</div>
        <div class="command-row">${moveButtons || '<span class="muted">四面都是坚固石壁</span>'}</div>
        <div class="command-title">准备</div>
        <div class="command-row">
          <button data-cmd="rest">原地整备</button>
          <button data-cmd="inventory">查看背包</button>
          <button data-cmd="map">查看地图</button>
          <button data-cmd="leave">撤离</button>
        </div>
        <div class="command-title">情报</div>
        <div class="command-row">
          <button data-cmd="status">查看状态</button>
          <button data-cmd="bestiary">敌典</button>
          <button data-cmd="relics">遗物列表</button>
          <button data-cmd="log">战斗记录</button>
        </div>
      </div>
    `;
  }

  eventCommands() {
    const event = DungeonData.events[this.run.currentRoom.eventId];
    if (!event) return '<div class="command-group"><div class="command-row"><span class="muted">未知事件</span></div></div>';
    const buttons = [];
    switch (event.id) {
      case 'blood_oath':
        buttons.push(`<button data-cmd="event" data-arg="blood_oath:accept">献血签下誓约</button>`);
        buttons.push(`<button data-cmd="skip-event">保持距离</button>`);
        break;
      case 'old_page':
        buttons.push(`<button data-cmd="event" data-arg="old_page:study">研读纸页</button>`);
        buttons.push(`<button data-cmd="skip-event">放下</button>`);
        break;
      case 'cracked_mirror':
        buttons.push(`<button data-cmd="event" data-arg="cracked_mirror:touch">触摸裂纹</button>`);
        buttons.push(`<button data-cmd="skip-event">避开</button>`);
        break;
      case 'damp_torch':
        buttons.push(`<button data-cmd="event" data-arg="damp_torch:dry">烘干火把</button>`);
        buttons.push(`<button data-cmd="skip-event">任其熄灭</button>`);
        break;
      case 'moth_eaten':
        buttons.push(`<button data-cmd="event" data-arg="moth_eaten:search">翻找残页</button>`);
        buttons.push(`<button data-cmd="skip-event">保持距离</button>`);
        break;
      case 'tide_chosen':
        buttons.push(`<button data-cmd="event" data-arg="tide_chosen:accept">接纳潮汐</button>`);
        buttons.push(`<button data-cmd="skip-event">拒绝改造</button>`);
        break;
      case 'mirror_sigil':
        buttons.push(`<button data-cmd="event" data-arg="mirror_sigil:accept">刻下誓印</button>`);
        buttons.push(`<button data-cmd="skip-event">退后</button>`);
        break;
      case 'tide_surge':
        buttons.push(`<button data-cmd="event" data-arg="tide_surge:brace">稳住身形</button>`);
        buttons.push(`<button data-cmd="event" data-arg="tide_surge:soak">任其冲刷</button>`);
        break;
      case 'silhouette_lock':
        buttons.push(`<button data-cmd="event" data-arg="silhouette_lock:attempt">按影敲击</button>`);
        buttons.push(`<button data-cmd="skip-event">暂且离开</button>`);
        break;
      case 'mirror_maze':
        buttons.push(`<button data-cmd="event" data-arg="mirror_maze:inspect">记下路线</button>`);
        buttons.push(`<button data-cmd="event" data-arg="mirror_maze:dash">强行穿行</button>`);
        buttons.push(`<button data-cmd="skip-event">原路返回</button>`);
        break;
      case 'dry_well_echo':
        buttons.push(`<button data-cmd="event" data-arg="dry_well_echo:listen">聆听回声</button>`);
        buttons.push(`<button data-cmd="skip-event">继续前进</button>`);
        break;
      case 'altar_shadow':
        buttons.push(`<button data-cmd="event" data-arg="altar_shadow:offer">献上贡品</button>`);
        buttons.push(`<button data-cmd="skip-event">拒绝阴影</button>`);
        break;
      default:
        buttons.push(`<button data-cmd="skip-event">继续前进</button>`);
        break;
    }
    return `<div class="command-group"><div class="command-title">事件抉择</div><div class="command-row">${buttons.join('')}</div></div>`;
  }

  merchantCommands() {
    return `
      <div class="command-group">
        <div class="command-title">行商服务</div>
        <div class="command-row">
          <button data-cmd="merchant-buy">购入补给</button>
          <button data-cmd="merchant-relic">探查遗物</button>
          <button data-cmd="merchant-leave">告辞离开</button>
        </div>
      </div>
    `;
  }

  campCommands() {
    return `
      <div class="command-group">
        <div class="command-title">营地选择</div>
        <div class="command-row">
          <button data-cmd="camp-rest">扎营休息</button>
          <button data-cmd="camp-prepare">整理装备</button>
          <button data-cmd="camp-pray">祷告净化</button>
          <button data-cmd="camp-leave">继续前进</button>
        </div>
      </div>
    `;
  }

  transitionCommands() {
    return `
      <div class="command-group">
        <div class="command-title">楼梯间</div>
        <div class="command-row">
          <button data-cmd="go-down">继续下行</button>
          <button data-cmd="leave">撤离</button>
        </div>
      </div>
    `;
  }

  renderAdminPanel() {
    const node = this.root.querySelector('#dungeon-panel-admin');
    if (!node) return;
    node.innerHTML = `
      <div class="panel-title">管理员调试</div>
      <div class="admin-switches">
        <label class="admin-toggle"><input type="checkbox" data-admin="game" ${this.admin.gameEnabled ? 'checked' : ''}/> 游戏开放</label>
        <label class="admin-toggle"><input type="checkbox" data-admin="invincible" ${this.admin.invincible ? 'checked' : ''}/> 无敌模式</label>
      </div>
      <div class="admin-status">状态：<span class="${this.admin.gameEnabled ? 'hl-good' : 'hl-warn'}">${this.admin.gameEnabled ? '入口开放' : '维护关闭'}</span> ｜ <span class="${this.admin.invincible ? 'hl-heroism' : 'hl-info'}">${this.admin.invincible ? '无敌' : '正常'}</span></div>
    `;
    node.querySelectorAll('input[data-admin]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.dataset.admin === 'game') {
          this.admin.gameEnabled = input.checked;
          this.addLog(this.admin.gameEnabled ? '管理员重新开启了古井入口。' : '管理员暂时关闭了古井入口。', this.admin.gameEnabled ? 'info' : 'announce');
        } else if (input.dataset.admin === 'invincible') {
          this.admin.invincible = input.checked;
          this.addLog(this.admin.invincible ? '无敌模式已启用，伤害将被忽略。' : '无敌模式关闭，战斗恢复正常。', this.admin.invincible ? 'good' : 'info');
        }
        this.updateAll();
      });
    });
  }

  renderScoreboard() {
    const node = this.root.querySelector('#dungeon-panel-score');
    if (!node) return;
    const recent = this.scores.slice(0, 5);
    const top = [...this.scores].sort((a, b) => b.score - a.score).slice(0, 5);
    const format = entry => {
      const date = new Date(entry.timestamp);
      const time = Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '-';
      const badge = entry.victory ? '<span class="score-badge victory">通关</span>' : '<span class="score-badge defeat">殒落</span>';
      return `<li><span class="score-value">${entry.score}</span>${badge}<span class="muted"> 第${entry.floor}层 · ${time}</span></li>`;
    };
    const topFormat = entry => `<li><span class="score-rank">${entry.score}</span><span class="muted"> ${entry.victory ? '通关' : '未竟'} · 勇气${entry.heroism}</span></li>`;
    node.innerHTML = `
      <div class="panel-title">积分记录</div>
      <div class="score-current">本次积分：<span class="hl-score">${this.run?.score || 0}</span></div>
      <div class="score-section">
        <div class="score-section__title">最近记录</div>
        <ul>${recent.map(format).join('') || '<li class="muted">暂无记录</li>'}</ul>
      </div>
      <div class="score-section">
        <div class="score-section__title">排行榜</div>
        <ul>${top.map(topFormat).join('') || '<li class="muted">暂无高分</li>'}</ul>
      </div>
    `;
  }

  addScore(amount = 0, reason = '', options = {}) {
    if (!this.run) return 0;
    const delta = Math.max(0, Math.round(amount));
    if (delta <= 0) return 0;
    this.run.score = (this.run.score || 0) + delta;
    if (options.log) {
      this.addLog(`积分 +${delta}${reason ? `（${reason}）` : ''}`, 'score');
    }
    this.renderScoreboard();
    return delta;
  }

  recordScore(entry) {
    const payload = {
      score: Math.max(0, Math.round(entry.score || 0)),
      victory: !!entry.victory,
      floor: entry.floor || (this.run?.floorIndex + 1) || 0,
      heroism: entry.heroism || 0,
      timestamp: entry.timestamp || Date.now(),
    };
    this.scores.unshift(payload);
    this.scores = this.scores.slice(0, 12);
    DungeonStorage.saveScores(this.scores);
    this.renderScoreboard();
  }

  renderInventory() {
    const node = this.root.querySelector('#dungeon-panel-inventory');
    if (!node) return;
    const items = this.run.player.inventory.map((item, idx) => {
      const tags = [];
      if (item.slot) tags.push(`<span class="item-tag rarity-${item.rarity || 'common'}">${item.slot}</span>`);
      if (item.equipped) tags.push('<span class="item-tag equipped">已装备</span>');
      if (item.effect?.imbue === 'ember') tags.push('<span class="item-tag ember">余烬</span>');
      const actions = [];
      if (item.slot) actions.push(`<button data-inv-action="equip" data-idx="${idx}">装备</button>`);
      if (this.canUseItemOutsideCombat(item)) actions.push(`<button data-inv-action="use" data-idx="${idx}">使用</button>`);
      return `
        <li>
          <div class="item-line"><span class="item-name">${item.name}${item.charges > 1 ? ` ×${item.charges}` : ''}</span>${tags.join('')}</div>
          <div class="muted">${item.description || ''}</div>
          ${actions.length ? `<div class="item-actions">${actions.join('')}</div>` : ''}
        </li>
      `;
    }).join('');
    const equips = Object.entries(this.run.player.equipment).map(([slot, item]) => `<li>${slot}：${item?.name || "无"}</li>`).join('');
    node.innerHTML = `
      <div class="panel-title">背包</div>
      <ul>${items || '<li class="muted">空空如也</li>'}</ul>
      <div class="panel-title">装备</div>
      <ul>${equips || '<li class="muted">未装备</li>'}</ul>
    `;
    node.querySelectorAll('button[data-inv-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleInventoryAction(btn.dataset.invAction, Number(btn.dataset.idx));
      });
    });
  }

  renderBestiary() {
    const node = this.root.querySelector('#dungeon-panel-bestiary');
    if (!node) return;
    const entries = Array.from(this.run.player.bestiary).map(id => {
      const enemy = DungeonData.enemies[id];
      return `<li><span class="text-enemy">${enemy?.name || id}</span><span class="muted"> · 弱点：${enemy?.weakness.join("、") || "未知"}</span></li>`;
    }).join("");
    node.innerHTML = `
      <div class="panel-title">图鉴</div>
      <ul>${entries || '<li class="muted">尚无记录</li>'}</ul>
    `;
  }

  renderRelics() {
    const node = this.root.querySelector('#dungeon-panel-relics');
    if (!node) return;
    const entries = this.run.player.relics.map(id => {
      const relic = DungeonData.relics[id];
      return `<li><span class="text-relic">${relic?.name || id}</span><span class="muted"> · ${relic?.effect || ""}</span></li>`;
    }).join("");
    node.innerHTML = `
      <div class="panel-title">遗物</div>
      <ul>${entries || '<li class="muted">暂无遗物</li>'}</ul>
    `;
  }

  canUseItemOutsideCombat(item) {
    if (!item || item.slot || !item.effect) return false;
    const effect = item.effect;
    return Boolean(effect.heal || effect.energy || effect.guard || effect.armor || effect.cleanse || effect.heroism || effect.inspire);
  }

  handleInventoryAction(action, idx) {
    if (Number.isNaN(idx)) return;
    if (action === 'equip') {
      this.equipItem(idx);
    } else if (action === 'use') {
      this.useInventoryItem(idx);
    }
  }

  equipItem(idx) {
    const item = this.run.player.inventory[idx];
    if (!item || !item.slot) {
      this.addLog('无法装备该物品。', 'warn');
      return;
    }
    const slot = item.slot;
    const current = this.run.player.equipment[slot];
    if (current === item) {
      this.addLog(`${item.name}已经装备。`, 'info');
      return;
    }
    if (current) current.equipped = false;
    this.run.player.equipment[slot] = item;
    item.equipped = true;
    this.addLog(`你装备了${item.name}。`, 'good');
    this.updateAll();
  }

  useInventoryItem(idx) {
    const item = this.run.player.inventory[idx];
    if (!item || item.slot || item.charges <= 0) {
      this.addLog('无法使用该物品。', 'warn');
      return;
    }
    item.charges -= 1;
    this.applyItemEffects(item, { context: 'explore' });
    if (item.charges <= 0 && !item.slot) {
      this.run.player.inventory.splice(idx, 1);
    }
    this.updateAll();
  }

  guideContent() {
    const stage = this.state.phase;
    const player = this.run?.player || { streak: 0, heroism: 0 };
    const map = {
      combat: {
        stage: '战斗回合',
        tips: [
          { icon: '👁️', text: '先使用「侦察」掌握敌人的词缀与弱点。' },
          { icon: '🛡️', text: '当HP告急时，点击「防御」或使用药水稳住局面。' },
          { icon: '⚡', text: '技能带有冷却，记得交替使用以保持压力。' },
        ],
      },
      event: {
        stage: '房间事件',
        tips: [
          { icon: '🎲', text: '事件多带风险与收益，留意描述决定是否参与。' },
          { icon: '📜', text: '部分事件可学技能或获得遗物，错过就没了。' },
          { icon: '❤️', text: '若状态不佳，可选择保守离开，保持连胜也重要。' },
        ],
      },
      merchant: {
        stage: '行商与补给',
        tips: [
          { icon: '🧪', text: '优先购入治疗或驱散道具，以备Boss战所需。' },
          { icon: '♻️', text: '记得出售无用装备换碎片，背包空间有限。' },
          { icon: '📈', text: '连胜越高，掉落越好，合理规划资源投资。' },
        ],
      },
      camp: {
        stage: '营地休整',
        tips: [
          { icon: '🔥', text: '营地每层只有一次，慎用。休息可大量恢复生命。' },
          { icon: '🧰', text: '整备能重置技能冷却，适合Boss前夜。' },
          { icon: '🙏', text: '祷告能净化负面，但会让腐蚀条上涨。' },
        ],
      },
      transition: {
        stage: '楼梯间',
        tips: [
          { icon: '🪜', text: '确认好背包与状态，再决定是继续下潜还是撤离。' },
          { icon: '🏅', text: '撤离可保留战利品，但勇者终将面对层主。' },
        ],
      },
    };
    const base = {
      stage: '探索旅程',
      tips: [
        { icon: '🧭', text: '使用「上 / 下 / 左 / 右」选择行进方向，未知房间以问号显示。' },
        { icon: '🗺️', text: '右侧关卡地图实时更新，营地与商人位置一目了然。' },
        { icon: '📖', text: '多用图鉴与遗物面板，熟悉敌人弱点与被动效果。' },
      ],
    };
    const result = map[stage] || base;
    const streak = player.streak || 0;
    const heroism = player.heroism || 0;
    const focus = [];
    if (streak > 0) focus.push(`连胜 ×${streak}`);
    if (heroism > 0) focus.push(`勇气 ${heroism}`);
    const promise = this.run?.heroicPromise || 0;
    if (promise > 0) focus.push(`下一场掉落保障 ${promise} 次`);
    return { ...result, focus };
  }

  renderGuide() {
    const node = this.root.querySelector('#dungeon-panel-guide');
    if (!node) return;
    const info = this.guideContent();
    const tips = info.tips.map(tip => `
      <div class="guide-step">
        <div class="guide-icon">${tip.icon}</div>
        <div class="guide-text">${tip.text}</div>
      </div>
    `).join("");
    const focus = info.focus.length ? `<div class="guide-highlight">${info.focus.join(' · ')}</div>` : '';
    node.innerHTML = `
      <div class="panel-title">新手指引</div>
      <div class="guide-stage">当前阶段：${info.stage}</div>
      <div class="guide-steps">${tips}</div>
      ${focus}
    `;
  }

  renderProgress() {
    const node = this.root.querySelector('#dungeon-panel-progress');
    if (!node) return;
    if (!this.run?.floors) {
      node.innerHTML = `<div class="panel-title">关卡进度</div><div class="muted">尚未踏入古井。</div>`;
      return;
    }
    const floorsHtml = this.run.floors.map((floor, idx) => {
      const active = idx === this.run.floorIndex;
      const stateClass = active ? 'is-active' : (idx < this.run.floorIndex ? 'is-cleared' : '');
      const rows = floor.map?.cells?.map((row, y) => {
        const cellsHtml = row.map((cell, x) => {
          const classes = ['map-cell', `type-${cell.type}`];
          if (!cell.revealed && cell.type !== 'start') classes.push('is-hidden');
          if (cell.resolved) classes.push('is-resolved');
          if (active && floor.position?.x === x && floor.position?.y === y) classes.push('is-current');
          const title = this.cellTypeLabel(cell, { reveal: cell.revealed });
          return `<div class="${classes.join(' ')}" title="${title}"><span class="map-icon">${this.cellIcon(cell)}</span></div>`;
        }).join('');
        return `<div class="map-row">${cellsHtml}</div>`;
      }).join('') || '';
      const nextMoves = active ? this.availableMoves().map(move => `${move.label}→${this.cellPreview(move.cell)}`).join(' ｜ ') : '';
      const nextHtml = nextMoves ? `<div class="map-next">可前往：${nextMoves}</div>` : '';
      const stateLabel = idx < this.run.floorIndex ? '已通关' : (active ? '探索中' : '未探索');
      return `
        <div class="progress-floor ${stateClass}">
          <div class="progress-floor__header">
            <div class="progress-floor__name">第${idx + 1}层 · ${floor.name}</div>
            <div class="progress-floor__state">${stateLabel}</div>
          </div>
          <div class="dungeon-map">${rows}</div>
          ${nextHtml}
          <div class="progress-ambience">${floor.ambience}</div>
        </div>
      `;
    }).join('');
    node.innerHTML = `
      <div class="panel-title">关卡进度</div>
      <div class="progress-floors">${floorsHtml}</div>
    `;
  }

  renderLog() {
    const node = this.root.querySelector('#dungeon-log');
    if (!node) return;
    node.innerHTML = this.logEntries.slice(-80).map(entry => `<div class="log-entry ${entry.type}">${entry.text}</div>`).join("");
    node.scrollTop = node.scrollHeight;
  }

  addLog(text, type = "info") {
    this.logEntries.push({ text, type });
    this.renderLog();
  }

  handleCommand(cmd, arg) {
    if (!this.admin.gameEnabled && cmd !== 'restart-run') {
      this.addLog('管理员正在维护古井入口，暂不可行动。', 'warn');
      return;
    }
    if (this._finished && cmd !== 'restart-run') {
      this.addLog('本次冒险已落幕，如需再战请点击“重新启程”。', 'info');
      return;
    }
    switch (cmd) {
      case 'attack':
        this.playerAttack();
        break;
      case 'defend':
        this.playerDefend();
        break;
      case 'heal':
        this.playerHeal();
        break;
      case 'run':
        this.playerRun();
        break;
      case 'inspect':
        this.playerInspect();
        break;
      case 'mark':
        this.playerMark();
        break;
      case 'taunt':
        this.playerTaunt();
        break;
      case 'skill':
        this.playerSkill(arg);
        break;
      case 'item':
        this.playerItem(Number(arg));
        break;
      case 'log':
        this.addLog('你回顾战斗记录，寻找下次出手的节奏。', 'info');
        break;
      case 'move':
        this.commandMove(arg);
        break;
      case 'go-down':
        this.commandDescend();
        break;
      case 'rest':
        this.commandRest();
        break;
      case 'inventory':
        this.addLog('你翻了翻背包，确认物资尚可。', 'info');
        break;
      case 'map':
        this.addLog('关卡地图已在右侧展示，未知房间以问号标记。', 'info');
        break;
      case 'status':
        this.addLog(`状态：HP ${this.run.player.hp}/${this.run.player.maxHP}，腐蚀 ${this.run.corruption}/${this.run.maxCorruption}。`, 'info');
        break;
      case 'bestiary':
        this.addLog('你翻阅图鉴，回忆敌人的弱点。', 'info');
        break;
      case 'relics':
        this.addLog('你感受遗物的脉动，它们等待被唤醒。', 'info');
        break;
      case 'leave':
        this.finishRun(false);
        break;
      case 'event':
        this.resolveEvent(arg);
        break;
      case 'skip-event':
        this.addLog('你选择保持谨慎，暂不触碰。', 'info');
        if (this.run.currentRoom) this.run.currentRoom.resolved = true;
        this.state.phase = 'explore';
        this.tutorial.stage = 'explore';
        this.updateAll();
        break;
      case 'merchant-buy':
        this.handleMerchantBuy();
        break;
      case 'merchant-relic':
        this.handleMerchantRelic();
        break;
      case 'merchant-leave':
        if (this.run.currentRoom) this.run.currentRoom.resolved = true;
        this.state.phase = 'explore';
        this.addLog('“祝你好运，井底的风可不好伺候。”', 'info');
        this.tutorial.stage = 'explore';
        this.updateAll();
        break;
      case 'camp-rest':
        this.handleCamp('rest');
        break;
      case 'camp-prepare':
        this.handleCamp('prepare');
        break;
      case 'camp-pray':
        this.handleCamp('pray');
        break;
      case 'camp-leave':
        if (this.run.currentRoom) this.run.currentRoom.resolved = true;
        this.state.phase = 'explore';
        this.addLog('你熄灭火堆，继续深入。', 'info');
        this.tutorial.stage = 'explore';
        this.updateAll();
        break;
      case 'restart-run':
        this.restartRun();
        break;
      default:
        this.addLog(`指令 ${cmd} 尚未实装。`, 'warn');
    }
    this.updateAll();
  }
  playerAttack() {
    const combat = this.run.combat;
    if (!combat) return;
    const enemy = combat.enemy;
    const player = this.run.player;
    let dmg = player.attack + this.equipmentBonus('attack') + Math.floor(this.rng.random() * 3);
    if (this.hasStatus(enemy, 'mark')) {
      dmg = Math.round(dmg * 1.15);
      if (player.passiveId === 'backstab') dmg = Math.round(dmg * 1.25);
    }
    if (this.hasStatus(enemy, 'burn') && this.equipmentBonus('burnBonus')) {
      dmg = Math.round(dmg * (1 + this.equipmentBonus('burnBonus')));
    }
    dmg = this.applyArmor(enemy, dmg);
    enemy.hp -= dmg;
    this.addLog(`你挥剑斩击 → 造成 ${dmg} 伤。`, 'player');
    if (player.imbue === 'poison') {
      this.applyStatus(enemy, 'poison', 2, 3);
      this.addLog('你对敌人施加了【中毒】，毒素开始渗透。', 'buff');
      player.imbue = null;
    } else if (player.imbue === 'ember') {
      this.applyStatus(enemy, 'burn', 2, 3);
      this.addLog('火焰附魔点燃了敌人。', 'buff');
      player.imbue = null;
    }
    if (enemy.hp <= 0) {
      this.finishCombat(true);
    } else {
      this.enemyTurn();
    }
  }

  playerDefend() {
    const combat = this.run.combat;
    if (!combat) return;
    const player = this.run.player;
    this.applyStatus(player, 'guard', 1, 1);
    if (player.passiveId === 'steadfast') {
      player.armor += 1;
      this.addLog('稳固生效：你获得1层护甲。', 'buff');
    }
    this.addLog('你举盾守备，呼吸沉稳。', 'player');
    this.enemyTurn();
  }

  healPlayer(amount, { source, context } = {}) {
    const player = this.run.player;
    if (!player) return 0;
    let value = Math.round(amount || 0);
    if (this.hasStatus(player, 'poison')) value = Math.floor(value * 0.7);
    const bonus = this.equipmentBonus('healBonus') || 0;
    value = Math.round(value * (1 + bonus));
    player.hp = Math.min(player.maxHP, player.hp + value);
    return value;
  }

  applyPlayerDamage(amount, { silent = false } = {}) {
    const dmg = Math.max(0, Math.round(amount));
    if (dmg <= 0) return 0;
    if (this.admin?.invincible) {
      if (!silent) this.addLog('无敌状态抵御了伤害。', 'good');
      return 0;
    }
    this.run.player.hp -= dmg;
    return dmg;
  }

  handlePlayerDown() {
    const player = this.run?.player;
    if (!player) return false;
    if (player.hp > 0) return false;
    if (this.hasRelic('time_hourglass') && !this.run.timeHourglassUsed) {
      this.run.timeHourglassUsed = true;
      player.hp = 1;
      this.applyStatus(player, 'guard', 1, 1);
      this.addLog('时停沙漏碎裂，将致死化为擦伤。', 'good');
      return false;
    }
    this.finishRun(false);
    return true;
  }

  playerHeal() {
    const player = this.run.player;
    if (player.energy < 1) {
      this.addLog('能量不足，无法进行治疗。', 'warn');
      return;
    }
    player.energy -= 1;
    const healed = this.healPlayer(12, { context: 'combat' });
    this.addLog(`你调整呼吸，恢复 ${healed} 点生命。`, 'player');
    this.enemyTurn();
  }

  playerRun() {
    const combat = this.run.combat;
    if (!combat) return;
    const player = this.run.player;
    let success = this.rng.random() < 0.45;
    const smoke = player.inventory.find(item => item.id === 'smoke' && item.charges > 0);
    if (smoke) {
      success = true;
      smoke.charges -= 1;
      this.addLog('烟雾弹爆开，视线被遮蔽。', 'buff');
    }
    if (success) {
      this.addLog('你借机撤离战场。', 'info');
      if (this.hasRelic('veil')) {
        const healed = this.healPlayer(6, { source: 'veil', context: 'explore' });
        player.energy = Math.min(player.maxEnergy, player.energy + 2);
        this.addLog(`面纱生效：恢复 ${healed} 点生命与 2 点能量。`, 'good');
      }
      this.state.phase = 'explore';
      if (this.run.currentRoom) this.run.currentRoom.resolved = true;
      this.updateAll();
    } else {
      this.addLog('撤退失败，敌人拦住了去路。', 'warn');
      this.enemyTurn();
    }
  }

  playerInspect() {
    const combat = this.run.combat;
    if (!combat) return;
    const enemy = combat.enemy;
    enemy.inspected = true;
    this.run.player.bestiary.add(enemy.id);
    const info = this.run.player.passiveId === 'tracker'
      ? enemy.tags.join('、')
      : (enemy.tags[0] || '未识别');
    this.addLog(`你观察敌人：弱点 ${enemy.weakness.join('、')}。词缀：${info}`, 'info');
  }

  playerMark() {
    const combat = this.run.combat;
    if (!combat) return;
    const player = this.run.player;
    if (player.energy < 1) {
      this.addLog('能量不足，无法标记目标。', 'warn');
      return;
    }
    player.energy -= 1;
    this.applyStatus(combat.enemy, 'mark', 1, 2);
    this.addLog('你锁定目标，标记亮起。', 'buff');
    this.enemyTurn();
  }

  playerTaunt() {
    const combat = this.run.combat;
    if (!combat) return;
    this.applyStatus(combat.enemy, 'slow', 1, 2);
    this.addLog('你挑衅对手，使其进攻迟滞。', 'player');
    this.enemyTurn();
  }

  playerSkill(skillId) {
    const combat = this.run.combat;
    if (!combat) return;
    const skill = DungeonData.skills[skillId];
    if (!skill) {
      this.addLog('技能不存在。', 'warn');
      return;
    }
    const player = this.run.player;
    const cooldown = player.cooldowns[skillId] || 0;
    if (cooldown > 0) {
      this.addLog(`${skill.name}冷却中（${cooldown}）。`, 'warn');
      return;
    }
    if (player.energy < skill.cost) {
      this.addLog('能量不足，无法施放技能。', 'warn');
      return;
    }
    player.energy -= skill.cost;
    player.cooldowns[skillId] = skill.cooldown;
    if (skillId === 'prayer') {
      const healed = this.healPlayer(16, { source: 'prayer', context: 'combat' });
      this.removeNegative(player, 1);
      this.addLog(`祷言的暖光缠绕你，恢复 ${healed} 点生命。`, 'good');
      this.enemyTurn();
      return;
    }
    if (skillId === 'hunter_net') {
      this.applyStatus(combat.enemy, 'slow', 2, 2);
      this.applyStatus(combat.enemy, 'stun', 1, 1);
      this.addLog('猎网缠住对手，行动被迫停顿。', 'good');
      this.enemyTurn();
      return;
    }
    if (skillId === 'skill_mark') {
      this.applyStatus(combat.enemy, 'mark', 1, 3);
      this.addLog('精准标记目标，弱点尽收眼底。', 'buff');
      this.enemyTurn();
      return;
    }
    if (skillId === 'shadowstep') {
      this.applyStatus(player, 'inspire', 1, 3);
      this.addLog('你融入阴影，激励随之升腾。', 'buff');
      this.enemyTurn();
      return;
    }
    if (skillId === 'poison_edge') {
      this.applyStatus(combat.enemy, 'poison', 2, 3);
      this.addLog('毒刃划过，绿色伤痕蔓延。', 'player');
      this.enemyTurn();
      return;
    }
    let dmg = player.attack + Math.floor(this.rng.random() * 4);
    if (skill.type === 'arcane') dmg += this.equipmentBonus('spellPower') || 0;
    if (skillId === 'shield_bash') {
      dmg = Math.round(dmg * 0.8);
      this.applyStatus(combat.enemy, 'stun', 1, 1);
      this.addLog('盾面轰鸣，敌人陷入眩晕。', 'player');
    }
    if (skillId === 'spark') {
      dmg += 4;
      this.applyStatus(combat.enemy, 'burn', 2, 3);
      if (this.equipmentBonus('applyWet')) this.applyStatus(combat.enemy, 'wet', 1, 2);
      this.addLog('火花溅射，潮湿表面被点燃。', 'player');
    }
    if (skillId === 'smite') {
      if (this.hasStatus(combat.enemy, 'corrupt')) dmg = Math.round(dmg * 1.25);
      this.addLog('圣光惩戒，驱散腐化。', 'player');
    }
    dmg = this.applyArmor(combat.enemy, dmg);
    combat.enemy.hp -= dmg;
    this.addLog(`${skill.name} → 造成 ${dmg} 伤。`, 'player');
    if (combat.enemy.hp <= 0) {
      this.finishCombat(true);
    } else {
      this.enemyTurn();
    }
  }

  applyItemEffects(item, { enemy = null, context = 'combat' } = {}) {
    const player = this.run.player;
    if (!player || !item?.effect) return { enemyDefeated: false };
    const effect = item.effect;
    if (effect.heal) {
      const healed = this.healPlayer(effect.heal, { source: item, context });
      this.addLog(`${item.name}恢复 ${healed} 点生命。`, 'good');
    }
    if (effect.energy) {
      player.energy = Math.min(player.maxEnergy, player.energy + effect.energy);
      this.addLog(`${item.name}恢复 ${effect.energy} 能量。`, 'good');
    }
    if (effect.guard) {
      this.applyStatus(player, 'guard', effect.guard, 1);
      this.addLog('守备环绕在你身旁。', 'buff');
    }
    if (effect.armor) {
      player.armor += effect.armor;
      this.addLog(`护甲+${effect.armor}，你更加稳固。`, 'buff');
    }
    if (Array.isArray(effect.cleanse)) {
      effect.cleanse.forEach(id => {
        if (this.removeStatus(player, id)) {
          this.addLog(`你净化了【${DungeonData.statuses[id]?.name || id}】。`, 'good');
        }
      });
    }
    if (effect.heroism) {
      player.heroism += effect.heroism;
      this.addScore(effect.heroism * 25, '勇气鼓舞', { log: true });
    }
    if (effect.inspire) {
      this.applyStatus(player, 'inspire', effect.inspire, 3);
      this.addLog('激励涌上心头。', 'good');
    }
    if (effect.imbue) {
      player.imbue = effect.imbue;
      const imbueText = effect.imbue === 'poison' ? '毒素' : '余烬';
      this.addLog(`你为武器附上${imbueText}。`, 'buff');
    }
    let enemyDefeated = false;
    if (enemy && effect.damage) {
      let dmg = effect.damage;
      if (effect.bonusVsWet && this.hasStatus(enemy, 'wet')) dmg += effect.bonusVsWet;
      const bonus = this.equipmentBonus('bonusVsWet') || 0;
      if (bonus && this.hasStatus(enemy, 'wet')) dmg = Math.round(dmg * (1 + bonus));
      dmg = this.applyArmor(enemy, dmg);
      enemy.hp -= dmg;
      this.addLog(`你使用${item.name} → 造成 ${dmg} 伤。`, 'player');
      if (effect.burn) {
        this.applyStatus(enemy, 'burn', effect.burn, 3);
        this.addLog('敌人被燃烧吞没。', 'buff');
      }
      if (effect.stun) {
        this.applyStatus(enemy, 'stun', effect.stun, effect.stun);
        this.addLog('雷鸣击中了敌人，令其眩晕。', 'good');
      }
      if (enemy.hp <= 0) enemyDefeated = true;
    }
    return { enemyDefeated };
  }

  playerItem(idx) {
    const combat = this.run.combat;
    if (!combat) return;
    const item = this.run.player.inventory[idx];
    if (!item || item.slot || item.charges <= 0) {
      this.addLog('物品不可用。', 'warn');
      return;
    }
    item.charges -= 1;
    const result = this.applyItemEffects(item, { enemy: combat.enemy, context: 'combat' });
    if (item.charges <= 0) this.run.player.inventory.splice(idx, 1);
    if (result.enemyDefeated || combat.enemy.hp <= 0) {
      this.finishCombat(true);
    } else {
      this.enemyTurn();
    }
  }
  enemyTurn() {
    const combat = this.run.combat;
    if (!combat) return;
    const enemy = combat.enemy;
    if (enemy.hp <= 0) return;
    this.reduceCooldowns();
    this.tickStatuses(this.run.player);
    if (this.handlePlayerDown()) return;
    this.tickStatuses(enemy);
    if (enemy.hp <= 0) {
      this.finishCombat(true);
      return;
    }
    if (this.hasStatus(enemy, 'stun')) {
      this.decrementStatus(enemy, 'stun');
      this.addLog(`${enemy.name}被眩晕，行动中止。`, 'good');
      return;
    }
    if (enemy.hp <= enemy.maxHP / 2 && !enemy.enraged && enemy.tier !== 'normal') {
      enemy.enraged = true;
      this.addLog(`${enemy.name}狂暴！伤害提升。`, 'warn');
    }
    let dmg = enemy.attack + Math.floor(this.rng.random() * 4);
    if (enemy.enraged) dmg = Math.round(dmg * 1.3);
    if (this.hasStatus(enemy, 'slow')) dmg = Math.round(dmg * 0.85);
    if (this.hasStatus(this.run.player, 'guard')) dmg = Math.round(dmg * 0.6);
    if (this.run.player.flags?.tideWeak && Array.isArray(enemy.weakness) && enemy.weakness.some(w => w.includes('雷'))) {
      dmg = Math.round(dmg * 1.1);
      this.addLog('潮汐选民的代价：雷鸣更刺骨。', 'warn');
    }
    dmg = this.applyArmor(this.run.player, dmg, true);
    const applied = this.applyPlayerDamage(dmg, { silent: true });
    this.addLog(`${enemy.name}攻击 → 你受 ${applied} 伤。${applied === 0 && this.admin?.invincible ? '（无敌）' : ''}`, 'enemy');
    const heavyHit = applied >= enemy.attack + 3;
    if (this.hasRelic('mirror_sigil') && heavyHit) {
      enemy.hp -= 5;
      this.addLog('镜像反噬：反射5点真实伤害。', 'good');
      if (enemy.hp <= 0) {
        this.finishCombat(true);
        return;
      }
    }
    if (this.handlePlayerDown()) return;
    this.run.player.energy = Math.min(this.run.player.maxEnergy, this.run.player.energy + 1);
  }

  reduceCooldowns() {
    Object.keys(this.run.player.cooldowns).forEach(id => {
      if (this.run.player.cooldowns[id] > 0) this.run.player.cooldowns[id] -= 1;
    });
  }

  tickStatuses(entity) {
    entity.statuses = entity.statuses || [];
    const removals = [];
    const isPlayer = entity === this.run.player;
    entity.statuses.forEach(st => {
      let dmg = 0;
      let text = '';
      if (st.id === 'bleed') { dmg = st.stacks; text = '因流血'; }
      if (st.id === 'poison') { dmg = 4; text = '因中毒'; }
      if (st.id === 'burn') { dmg = 3; text = '被燃烧灼伤'; }
      if (dmg > 0) {
        if (isPlayer) {
          const applied = this.applyPlayerDamage(dmg, { silent: true });
          const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`你${text}受 ${applied} 伤。${suffix}`, applied > 0 ? 'warn' : 'good');
        } else {
          entity.hp -= dmg;
          this.addLog(`敌人${text}受 ${dmg} 伤。`, 'good');
        }
      }
      if (st.duration != null) {
        st.duration -= 1;
        if (st.duration <= 0) removals.push(st.id);
      }
    });
    removals.forEach(id => this.removeStatus(entity, id));
  }

  applyArmor(target, damage, isPlayer = false) {
    let dmg = damage;
    if (target.armor && target.armor > 0) {
      const reduction = Math.min(target.armor, dmg);
      dmg = Math.max(0, dmg - reduction);
      target.armor = Math.max(0, target.armor - 1);
      this.addLog(`${isPlayer ? '你的' : target.name + '的'}护甲抵挡了部分伤害。`, isPlayer ? 'good' : 'info');
    }
    return Math.max(0, dmg);
  }

  applyStatus(target, id, stacks = 1, duration = null) {
    target.statuses = target.statuses || [];
    const existing = target.statuses.find(st => st.id === id);
    if (existing) {
      existing.stacks = Math.min((DungeonData.statuses[id]?.maxStacks || 5), existing.stacks + stacks);
      if (duration != null) existing.duration = duration;
    } else {
      target.statuses.push({ id, stacks, duration });
    }
    const def = DungeonData.statuses[id];
    if (def) {
      const who = target === this.run.player ? '你' : target.name;
      this.addLog(`${who}获得了【${def.name}】`, def.type === 'buff' ? 'good' : 'warn');
    }
  }

  hasStatus(entity, id) {
    return (entity.statuses || []).some(st => st.id === id && (st.duration == null || st.duration > 0));
  }

  removeStatus(entity, id) {
    entity.statuses = (entity.statuses || []).filter(st => st.id !== id);
  }

  decrementStatus(entity, id) {
    const st = (entity.statuses || []).find(s => s.id === id);
    if (!st) return;
    st.duration = (st.duration || 1) - 1;
    if (st.duration <= 0) this.removeStatus(entity, id);
  }

  removeNegative(entity, count = 1) {
    const negatives = (entity.statuses || []).filter(st => {
      const def = DungeonData.statuses[st.id];
      return def && def.type === 'debuff';
    });
    for (let i = 0; i < count && negatives.length; i += 1) {
      const st = negatives.shift();
      this.removeStatus(entity, st.id);
      this.addLog(`${entity === this.run.player ? '你' : entity.name}净化了【${DungeonData.statuses[st.id]?.name || st.id}】。`, 'good');
    }
  }

  equipmentBonus(key) {
    const equip = this.run.player.equipment || {};
    return Object.values(equip).reduce((acc, item) => {
      if (item?.modifiers && item.modifiers[key]) return acc + item.modifiers[key];
      return acc;
    }, 0);
  }

  hasRelic(id) {
    return this.run.player.relics.includes(id);
  }
  availableMoves() {
    const floor = this.currentFloor;
    if (!floor?.map) return [];
    const pos = floor.position || floor.map.start;
    const { size } = floor.map;
    const options = [
      { dir: 'up', dx: 0, dy: -1, label: '上' },
      { dir: 'down', dx: 0, dy: 1, label: '下' },
      { dir: 'left', dx: -1, dy: 0, label: '左' },
      { dir: 'right', dx: 1, dy: 0, label: '右' },
    ];
    return options
      .map(opt => {
        const nx = pos.x + opt.dx;
        const ny = pos.y + opt.dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) return null;
        const cell = floor.map.cells[ny][nx];
        return { ...opt, x: nx, y: ny, cell };
      })
      .filter(Boolean);
  }

  cellTypeLabel(cell, { reveal = false } = {}) {
    if (!cell) return '未知';
    if (!cell.revealed && !reveal) return '未知';
    const map = {
      start: '入口',
      normal: '普通战',
      elite: '精英战',
      boss: '终殿',
      event: '事件',
      merchant: '商人',
      camp: '营地',
      treasure: '秘藏',
    };
    if (['normal', 'elite', 'boss'].includes(cell.type) && cell.enemyId) {
      const enemy = DungeonData.enemies[cell.enemyId];
      return `${map[cell.type]}${enemy ? `·${enemy.name}` : ''}`;
    }
    if (cell.type === 'event' && cell.eventId) {
      const event = DungeonData.events[cell.eventId];
      return `事件${event ? `·${event.name}` : ''}`;
    }
    return map[cell.type] || '未知';
  }

  cellIcon(cell) {
    if (!cell || (!cell.revealed && cell.type !== 'start')) return '？';
    const icons = {
      start: 'ⓢ',
      normal: '⚔️',
      elite: '👑',
      boss: '🛡️',
      event: '📜',
      merchant: '💰',
      camp: '🔥',
      treasure: '🎁',
    };
    return icons[cell.type] || '？';
  }

  cellPreview(cell) {
    if (!cell) return '未知';
    if (!cell.revealed) return '未知房';
    return this.cellTypeLabel(cell, { reveal: true });
  }

  commandMove(direction) {
    if (this.state.phase !== 'explore') {
      this.addLog('你正在处理当前房间。', 'warn');
      return;
    }
    const move = this.availableMoves().find(opt => opt.dir === direction);
    if (!move) {
      this.addLog('该方向是坚实石壁。', 'warn');
      return;
    }
    const floor = this.currentFloor;
    floor.position = { x: move.x, y: move.y };
    this.addLog(`你朝${move.label}迈进。`, 'info');
    this.tutorial.stage = 'explore';
    this.handleCellArrival(move.cell, { viaMove: true });
  }

  commandDescend() {
    if (this.state.phase !== 'transition') {
      this.addLog('尚未抵达楼梯。', 'warn');
      return;
    }
    const nextIndex = this.run.floorIndex + 1;
    if (nextIndex < this.run.floors.length) {
      this.addLog('你踏入更深的石阶，湿气愈发浓郁。', 'info');
      this.state.phase = 'explore';
      this.enterFloor(nextIndex);
    } else {
      this.finishRun(true);
    }
  }

  commandRest() {
    if (this.state.phase !== 'explore') {
      this.addLog('此刻难以休息。', 'warn');
      return;
    }
    const healed = this.healPlayer(10, { context: 'explore' });
    this.run.corruption = Math.min(this.run.maxCorruption, this.run.corruption + 1);
    this.addLog(`你短暂靠墙休息，恢复 ${healed} 点生命，但腐蚀条上涨。`, 'info');
  }

  resolveEvent(arg) {
    const [id, action = 'accept'] = (arg || '').split(':');
    let advance = true;
    let scoreGain = 0;
    const player = this.run.player;
    switch (id) {
      case 'blood_oath':
        if (action === 'accept') {
          player.maxHP = Math.max(10, player.maxHP - 5);
          if (player.hp > player.maxHP) player.hp = player.maxHP;
          if (!player.relics.includes('bloodlust')) player.relics.push('bloodlust');
          this.addLog('鲜血滴在石台上，誓约生效：获得【嗜血】。', 'goal');
          scoreGain += 90;
        }
        break;
      case 'old_page':
        if (action === 'study') {
          this.learnRandomSkill();
          scoreGain += 70;
        }
        break;
      case 'cracked_mirror': {
        if (action === 'touch') {
          const before = this.run.player.statuses?.length || 0;
          this.crackedMirrorEffect();
          if ((this.run.player.statuses?.length || 0) <= before) scoreGain += 60;
        }
        break;
      }
      case 'damp_torch':
        if (action === 'dry') {
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          player.imbue = 'ember';
          this.addLog('你烘干火把，暖光裹住双手，获得火焰附魔与能量。', 'good');
          scoreGain += 45;
        }
        break;
      case 'moth_eaten':
        if (action === 'search') {
          if (this.rng.random() < 0.65) {
            this.learnRandomSkill();
            this.addLog('虫蛀的纸页仍藏锋利，你掌握了新技巧。', 'goal');
            scoreGain += 60;
          } else {
            this.applyStatus(player, 'poison', 1, 3);
            this.addLog('尘埃呛入口鼻，你被中毒。', 'warn');
          }
        }
        break;
      case 'tide_chosen':
        if (action === 'accept') {
          if (!player.relics.includes('tide_codex')) player.relics.push('tide_codex');
          player.flags.tideWeak = true;
          this.addLog('潮水符纹缠绕你：施法附带潮湿，但雷鸣会更加刺骨。', 'goal');
          scoreGain += 100;
        }
        break;
      case 'mirror_sigil':
        if (action === 'accept') {
          if (!player.relics.includes('mirror_sigil')) player.relics.push('mirror_sigil');
          player.flags.mirrorPenalty = true;
          this.addLog('誓印贴上皮肤，阴影在耳边低语。普通战可能失去护甲。', 'goal');
          scoreGain += 120;
        }
        break;
      case 'tide_surge': {
        if (action === 'brace') {
          const applied = this.applyPlayerDamage(4);
          this.applyStatus(player, 'guard', 1, 1);
          const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`潮水拍打你造成 ${applied} 点伤害，但你稳住了身形。${suffix}`, 'warn');
          if (this.handlePlayerDown()) {
            advance = false;
            break;
          }
        } else if (action === 'soak') {
          const applied = this.applyPlayerDamage(7);
          if (applied > 0) this.applyStatus(player, 'wet', 1, 2);
          const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`你任潮水冲刷，承受 ${applied} 点伤害。${suffix}`, 'warn');
          if (this.handlePlayerDown()) {
            advance = false;
            break;
          }
          if (player.hp > 0) {
            player.heroism += 1;
            this.run.heroicPromise += 1;
            this.addLog('疼痛换来了勇气：勇气+1，下一场战利品更丰。', 'goal');
            scoreGain += 55;
          }
        }
        break;
      }
      case 'silhouette_lock':
        if (action === 'attempt') {
          const base = this.rng.random();
          const successRate = player.flags.mazeHint ? 0.85 : 0.6;
          if (base < successRate) {
            const lootPool = ['breaker_hammer', 'ruby_ring', 'tide_staff'];
            const pick = this.rng.pick(lootPool);
            const item = DungeonData.equipments[pick];
            if (item) {
              player.inventory.push({ ...item, charges: 1 });
              this.addLog(`剪影锁打开，你获得了装备【${item.name}】。`, 'good');
              scoreGain += 110;
            }
          } else {
            this.applyStatus(player, 'bleed', 1, 2);
            this.addLog('剪影锁的暗刃反噬，你被割伤。', 'warn');
          }
        }
        break;
      case 'mirror_maze':
        if (action === 'inspect') {
          player.flags.mazeHint = true;
          this.addLog('你记下镜面回声给出的正确顺序。', 'good');
          scoreGain += 40;
        } else if (action === 'dash') {
          if (this.rng.random() < 0.5) {
            player.heroism += 1;
            this.run.heroicPromise += 1;
            this.addLog('你穿过迷障，勇气提升，下一场掉落提升。', 'goal');
            scoreGain += 90;
          } else {
            const applied = this.applyPlayerDamage(6);
            const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
            this.addLog(`镜面碎裂反噬，你受 ${applied} 点伤害。${suffix}`, 'warn');
            if (this.handlePlayerDown()) {
              advance = false;
            }
          }
        }
        break;
      case 'dry_well_echo':
        if (action === 'listen') {
          player.heroism += 1;
          this.run.heroicPromise += 1;
          this.addLog('井底回声化作鼓舞：勇气+1，下一场必有战利品。', 'goal');
          scoreGain += 70;
        }
        break;
      case 'altar_shadow':
        if (action === 'offer') {
          if (!player.inventory.length) {
            this.addLog('你身无长物，阴影不满地缠上腐蚀。', 'warn');
            this.applyStatus(player, 'corrupt', 1, 3);
          } else {
            const sacrifice = player.inventory.shift();
            this.addLog(`你献上了${sacrifice.name}，阴影吞噬了它。`, 'info');
            if (this.rng.random() < 0.7) {
              const relicOptions = ['veil', 'cleric_pendant', 'time_hourglass'];
              const pick = this.rng.pick(relicOptions);
              if (!player.relics.includes(pick)) player.relics.push(pick);
              this.addLog(`阴影回赠遗物【${DungeonData.relics[pick]?.name || pick}】。`, 'goal');
              scoreGain += 130;
            } else {
              this.applyStatus(player, 'corrupt', 1, 4);
              this.addLog('阴影发出低笑，腐化在体内蔓延。', 'warn');
            }
          }
        }
        break;
      default:
        this.addLog('事件尚未实现。', 'warn');
        break;
    }
    if (scoreGain > 0) {
      if (player.relics.includes('echo_lantern')) scoreGain += 20;
      this.addScore(scoreGain, '事件奖励', { log: true });
    }
    if (advance && !this._finished) {
      if (this.run.currentRoom) this.run.currentRoom.resolved = true;
      this.state.phase = 'explore';
      this.tutorial.stage = 'explore';
      this.updateAll();
    }
  }

  learnRandomSkill() {
    const pool = ['smite', 'whirlwind', 'frost_ring'];
    const unknown = pool.filter(id => !this.run.player.codex.has(id));
    const pick = this.rng.pick(unknown.length ? unknown : pool);
    this.run.player.codex.add(pick);
    this.addLog(`你研读书页，学会了技能【${DungeonData.skills[pick]?.name || pick}】。`, 'good');
  }

  crackedMirrorEffect() {
    const neg = (this.run.player.statuses || []).filter(st => DungeonData.statuses[st.id]?.type === 'debuff');
    if (!neg.length) {
      this.addLog('镜面裂痕映照你完好的精神，没有发生变化。', 'info');
      return;
    }
    const target = this.rng.pick(neg);
    if (this.rng.random() < 0.5) {
      this.removeStatus(this.run.player, target.id);
      this.applyStatus(this.run.player, 'inspire', 1, 3);
      this.addLog('裂痕散去，负面化作激励。', 'good');
    } else {
      this.applyStatus(this.run.player, target.id, 1, (target.duration || 2) + 1);
      this.addLog('镜像扭曲，负面加剧。', 'warn');
    }
  }

  handleMerchantBuy() {
    const gain = this.rng.pick(['small_heal', 'bomb', 'dispel', 'ether']);
    const item = DungeonData.consumables[gain];
    this.run.player.inventory.push({ ...item, charges: 1 });
    this.addLog(`你购买了${item.name}。`, 'good');
  }

  handleMerchantRelic() {
    const options = ['time_hourglass', 'veil', 'cleric_pendant', 'tide_codex'];
    const available = options.filter(id => !this.run.player.relics.includes(id));
    const pick = this.rng.pick(available.length ? available : options);
    if (!this.run.player.relics.includes(pick)) this.run.player.relics.push(pick);
    this.addLog(`你获得遗物【${DungeonData.relics[pick]?.name || pick}】。`, 'good');
  }

  handleCamp(mode) {
    const key = `${this.run.floorIndex}-${mode}`;
    if (this.run.campUsed[key]) {
      this.addLog('营地火堆已冷，无法重复使用。', 'warn');
      return;
    }
    this.run.campUsed[key] = true;
    this.run.corruption = Math.min(this.run.maxCorruption, this.run.corruption + 2);
    if (mode === 'rest') {
      const healed = this.healPlayer(20, { context: 'camp' });
      this.addLog(`你在营地歇息，恢复 ${healed} 点生命。`, 'good');
    } else if (mode === 'prepare') {
      Object.keys(this.run.player.cooldowns).forEach(k => { this.run.player.cooldowns[k] = 0; });
      this.addLog('你整备装备，所有技能冷却归零。', 'good');
    } else if (mode === 'pray') {
      this.removeNegative(this.run.player, 2);
      this.addLog('你在火光前祷告，净化了负面。', 'good');
    }
  }

  finishCombat(victory) {
    const combat = this.run.combat;
    if (!combat) return;
    const enemy = combat.enemy;
    const room = combat.room;
    if (victory) {
      this.addLog(`${enemy.name}倒下，战斗结束。`, 'goal');
      this.run.player.bestiary.add(enemy.id);
      this.run.player.streak += 1;
      const tier = room?.type || enemy.tier || 'normal';
      const scoreMap = { normal: 60, elite: 150, boss: 360 };
      const labelMap = { normal: '战斗胜利', elite: '精英讨伐', boss: '终殿制胜' };
      this.addScore(scoreMap[tier] || 40, labelMap[tier] || '战斗胜利', { log: true });
      if (['elite', 'boss'].includes(tier)) {
        this.run.player.heroism += 1;
        this.addLog(`勇气涌动，勇气提升至 ${this.run.player.heroism}。`, 'goal');
        this.addScore(80, '勇气结算', { log: true });
      }
      if (this.run.player.passiveId === 'manareturn') {
        this.run.player.energy = Math.min(this.run.player.maxEnergy, this.run.player.energy + 1);
        this.addLog('回流：击杀返还1点能量。', 'good');
      }
      if (this.hasRelic('bloodlust')) {
        const healAmount = Math.max(5, Math.round(this.run.player.maxHP * 0.1));
        const healed = this.healPlayer(healAmount, { source: 'bloodlust', context: 'combat' });
        this.addLog(`嗜血：你吸收了敌人的余温，恢复 ${healed} 点生命。`, 'good');
      }
      this.rollLoot(enemy);
      if (room) {
        room.resolved = true;
        room.revealed = true;
      }
      this.run.combat = null;
      if (tier === 'boss') {
        const floor = this.currentFloor;
        if (floor) floor.cleared = true;
        if (this.run.floorIndex === this.run.floors.length - 1) {
          this.finishRun(true);
          return;
        }
        this.state.phase = 'transition';
        this.tutorial.stage = 'transition';
        this.addLog('楼梯间亮起符光，等待你的选择。', 'announce');
        this.updateAll();
        return;
      }
      this.state.phase = 'explore';
      this.tutorial.stage = 'explore';
      this.updateAll();
    } else {
      this.finishRun(false);
    }
  }

  rollLoot(enemy) {
    const drops = [];
    if (this.run.combat?.room?.type === 'boss') {
      drops.push('relic', 'equip');
    } else if (this.run.combat?.room?.type === 'elite') {
      drops.push('equip');
    } else if (this.run.combat?.dropsGuaranteed) {
      drops.push('equip');
    } else if (this.rng.random() < 0.4) {
      drops.push('item');
    }
    drops.forEach(type => {
      if (type === 'item') {
        const pick = this.rng.pick(Object.keys(DungeonData.consumables));
        const item = DungeonData.consumables[pick];
        this.run.player.inventory.push({ ...item, charges: 1 });
        this.addLog(`战利品：${item.name}`, 'good');
        this.addScore(25, '战利品', { log: true });
      } else if (type === 'equip') {
        const pick = this.rng.pick(Object.keys(DungeonData.equipments));
        const item = DungeonData.equipments[pick];
        this.run.player.inventory.push({ ...item, charges: 1 });
        this.addLog(`获得装备：${item.name}`, 'good');
        this.addScore(55, '装备收获', { log: true });
      } else if (type === 'relic') {
        const pick = this.rng.pick(Object.keys(DungeonData.relics));
        if (!this.run.player.relics.includes(pick)) this.run.player.relics.push(pick);
        this.addLog(`拾取遗物：${DungeonData.relics[pick]?.name || pick}`, 'goal');
        this.addScore(100, '遗物收集', { log: true });
      }
    });
  }

  finishRun(victory) {
    if (this._finished) return;
    this._finished = true;
    this.state.phase = 'ended';
    this.run.combat = null;
    this.run.player.hp = Math.max(0, this.run.player.hp);
    this.tutorial.stage = 'ended';
    if (this.run) this.run.result = victory ? 'victory' : 'defeat';
    const floorsCleared = victory ? this.run.floors.length : Math.max(1, this.run.floorIndex + 1);
    this.recordScore({
      score: this.run.score || 0,
      victory,
      floor: floorsCleared,
      heroism: this.run.player.heroism,
    });
    this.addLog(`最终积分：${this.run.score || 0} ｜ 勇气 ${this.run.player.heroism}`, 'score');
    if (victory) {
      this.addLog('公爵的面皮如薄纸般破裂，井水终于落下的声音回荡。', 'goal');
      this.addLog('【卷一：史莱姆古井】完结。你带着召唤阵的碎片离开——碎片仍在轻轻颤动。', 'goal');
    } else {
      this.addLog('潮湿渗入伤口，火把在倒下前发出最后一声噼啪。古井继续吞下回声。', 'warn');
    }
    this.updateAll();
  }

  restartRun() {
    this.destroy();
    this.logEntries = [];
    this.state = { phase: 'intro' };
    this.renderIntro();
  }
}

const DungeonCrawlerPage = {
  _game: null,
  render() {
    return `<div class="card dungeon-card"><div id="dungeon-root"></div></div>`;
  },
  bind() {
    const root = document.getElementById('dungeon-root');
    this._game = new DungeonGame(root);
  },
  teardown() {
    this._game?.destroy();
    this._game = null;
  },
  presence() {
    if (!this._game?.run) return { activity: 'dungeon:intro' };
    const floor = this._game.currentFloor;
    return {
      activity: 'dungeon:run',
      details: {
        floor: floor?.name || '未知',
        hp: this._game.run.player.hp,
        energy: this._game.run.player.energy,
      }
    };
  }
};
