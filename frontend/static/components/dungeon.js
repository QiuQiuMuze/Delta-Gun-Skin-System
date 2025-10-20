/* eslint-disable */
const dungeonEscapeHtml = value => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

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
    hex_bolt: { id: "hex_bolt", name: "咒缚电矢", cooldown: 2, cost: 2, type: "arcane", tags: ["腐化", "缓速"], description: "释放束缚性的咒雷，使敌人腐化并可能减速。", flavor: "紫色雷光盘旋，带着低语的符印。" },
    fury_slash: { id: "fury_slash", name: "狂怒斩击", cooldown: 2, cost: 1, type: "physical", tags: ["溅血", "破甲"], description: "以怒意挥出重斩，对敌造成高额伤害并撕裂护甲。", flavor: "战吼震碎井壁，血雾随刃光迸散。" },
    chi_wave: { id: "chi_wave", name: "气浪疗息", cooldown: 3, cost: 2, type: "spirit", tags: ["治疗", "守备"], description: "引导内息化作护身波动，疗愈自身体魄。", flavor: "掌心泛起涟漪，尘埃随之静止。" },
    gadget_bolt: { id: "gadget_bolt", name: "机械震雷", cooldown: 2, cost: 1, type: "tech", tags: ["穿透", "易伤"], description: "启动秘制弩炮，发射震荡螺栓削弱敌人。", flavor: "齿轮飞转，电光沿着螺栓噼啪作响。" },
    nature_bloom: { id: "nature_bloom", name: "森灵绽放", cooldown: 3, cost: 2, type: "nature", tags: ["治疗", "激励"], description: "唤起井底藤蔓包裹自身，恢复生命并鼓舞斗志。", flavor: "青藤破土，野花在指尖盛开。" },
    storm_dance: { id: "storm_dance", name: "风暴舞步", cooldown: 2, cost: 1, type: "agility", tags: ["回避", "连击"], description: "化身电光穿梭战场，攻击同时获得守备。", flavor: "脚步踏出雷鸣节奏，披风卷起潮雾。" },
    spirit_bind: { id: "spirit_bind", name: "魂锁引", cooldown: 3, cost: 2, type: "mystic", tags: ["控制", "腐化"], description: "以魂火锁链束缚敌人，使其短暂麻痹并沾染腐蚀。", flavor: "幽蓝锁环缠绕，低语从另一侧世界传来。" },
    time_shift: { id: "time_shift", name: "时序扭转", cooldown: 4, cost: 2, type: "arcane", tags: ["减速", "增益"], description: "短暂拨动时间，削弱敌人动作并为自己争取喘息。", flavor: "沙漏倒流，光迹在空中折返。" }
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
    berserk_draught: { id: "berserk_draught", name: "狂怒药剂", type: "potion", description: "饮下后激发怒意，恢复生命并点燃斗志。", effect: { heal: 10, inspire: 1 } },
    focus_bead: { id: "focus_bead", name: "静心念珠", type: "charm", description: "以禅意抚平伤势并驱散毒素。", effect: { heal: 6, cleanse: ["bleed", "poison"] } },
    gadget_charge: { id: "gadget_charge", name: "机械充能瓶", type: "potion", description: "恢复能量并生成护幕。", effect: { energy: 3, guard: 1 } },
    sapling_totem: { id: "sapling_totem", name: "青木护符", type: "totem", description: "唤起小型树灵协助，恢复生命并提升勇气。", effect: { heal: 8, heroism: 1 } },
    storm_vial: { id: "storm_vial", name: "闪潮瓶", type: "potion", description: "雷潮在瓶中翻滚，饮下可恢复能量并激励。", effect: { energy: 2, inspire: 1 } },
    spirit_lantern: { id: "spirit_lantern", name: "幽灵提灯", type: "charm", description: "借灯火守护心神，恢复生命并获得守备。", effect: { heal: 5, guard: 1, heroism: 1 } },
    time_dust: { id: "time_dust", name: "沙漏余尘", type: "potion", description: "吸入尘末，令时间稍缓，恢复少量能量。", effect: { energy: 2, inspire: 1 } }
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
    feral_axe: { id: "feral_axe", name: "野性巨斧", slot: "weapon", rarity: "purple", modifiers: { attack: 3 }, description: "厚重大斧专为近身撕裂而铸。" },
    sage_wrap: { id: "sage_wrap", name: "禅风裹衣", slot: "armor", rarity: "blue", modifiers: { defense: 1, healBonus: 0.12 }, description: "柔韧衣料引导呼吸，治疗效果提升。" },
    gyro_launcher: { id: "gyro_launcher", name: "陀螺弩炮", slot: "weapon", rarity: "blue", modifiers: { spellPower: 2, extraInspect: true }, description: "巧匠的弩炮装置，兼具侦察与火力。" },
    grove_charm: { id: "grove_charm", name: "林灵坠饰", slot: "amulet", rarity: "blue", modifiers: { healBonus: 0.18 }, description: "树灵祝福在颈间流转，回复更充沛。" },
    tempest_blade: { id: "tempest_blade", name: "暴风军刀", slot: "weapon", rarity: "purple", modifiers: { attack: 2, speed: 1 }, description: "刀身刻满风符，让持有者更敏捷。" },
    spirit_bell: { id: "spirit_bell", name: "魂鸣之铃", slot: "amulet", rarity: "purple", modifiers: { defense: 1, healBonus: 0.08 }, description: "铃音守护着持有者的灵魂。" },
    echo_band: { id: "echo_band", name: "回声指环", slot: "ring", rarity: "blue", modifiers: { extraInspect: true, speed: 1 }, description: "共鸣指环令感知更敏锐，脚步更轻盈。" }
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
      passive: "稳固：防御会获得1层护甲",
      passiveId: "steadfast",
      baseStats: { maxHP: 42, maxEnergy: 5, attack: 6, defense: 2 },
      startingSkill: "shield_bash",
      startingItems: [consumables.small_heal, equipments.short_sword],
      lore: "前城卫队长，擅长正面对决。稳扎稳打、护甲与反击是他的生存之道。",
    },
    rogue: {
      id: "rogue",
      name: "盗贼",
      passive: "背刺：攻击标记目标时+25%伤害",
      passiveId: "backstab",
      baseStats: { maxHP: 36, maxEnergy: 6, attack: 5, defense: 1 },
      startingSkill: "skill_mark",
      startingItems: [consumables.poison_coat, consumables.smoke],
      lore: "来自港区的影子行者，习惯用陷阱与毒药解决问题。她的战斗节奏极快但身板较脆。",
    },
    mage: {
      id: "mage",
      name: "法师",
      passive: "回流：击杀返还1点能量",
      passiveId: "manareturn",
      baseStats: { maxHP: 34, maxEnergy: 7, attack: 5, defense: 1 },
      startingSkill: "spark",
      startingItems: [consumables.ether, consumables.small_heal],
      lore: "流浪的咒术学者，熟悉火焰与寒霜的转换。她需要保持距离并管理能量。",
    },
    cleric: {
      id: "cleric",
      name: "神官",
      passive: "安魂：战后20%移除1负面",
      passiveId: "sanctify",
      baseStats: { maxHP: 44, maxEnergy: 5, attack: 4, defense: 2 },
      startingSkill: "prayer",
      startingItems: [consumables.small_heal, consumables.dispel],
      lore: "誓言守夜的圣堂侍者，以祷言与光辉稳住队伍。她能自保也能在危急时刻拯救同伴。",
    },
    hunter: {
      id: "hunter",
      name: "猎人",
      passive: "追踪：调查揭示额外1词缀",
      passiveId: "tracker",
      baseStats: { maxHP: 40, maxEnergy: 6, attack: 5, defense: 2 },
      startingSkill: "hunter_net",
      startingItems: [consumables.bomb, equipments.ranger_cloak],
      lore: "被潮湿森林养出的追迹者，射术与侦察兼备。靠控制敌人节奏来取胜。",
    },
    warden: {
      id: "warden",
      name: "守卫",
      passive: "御壁：防御时额外恢复少量生命",
      passiveId: "bulwark",
      baseStats: { maxHP: 48, maxEnergy: 5, attack: 5, defense: 3 },
      startingSkill: "whirlwind",
      startingItems: [consumables.guard_tonic, equipments.guardian_plate],
      lore: "古井入口的老兵，习惯用厚重护甲抵挡潮水与利齿。他的盾墙像城门般稳固。",
    },
    elementalist: {
      id: "elementalist",
      name: "灵术师",
      passive: "灵纹：施法会拖慢敌人并附带潮湿",
      passiveId: "elemental_focus",
      baseStats: { maxHP: 36, maxEnergy: 7, attack: 5, defense: 1 },
      startingSkill: "frost_ring",
      startingItems: [consumables.ether, equipments.tide_staff],
      lore: "潮汐学院的离经弟子，能操纵寒霜与海风。她依赖远程施法与状态控制。",
    },
    occultist: {
      id: "occultist",
      name: "秘术师",
      passive: "咒缚：首次命中敌人时附加腐化",
      passiveId: "hexweave",
      baseStats: { maxHP: 38, maxEnergy: 6, attack: 5, defense: 2 },
      startingSkill: "hex_bolt",
      startingItems: [consumables.smoke, equipments.ruby_ring],
      lore: "研究无面遗痕的术士，用束缚与腐化削弱敌人，再以暗雷终结战斗。",
    },
    berserker: {
      id: "berserker",
      name: "狂战士",
      passive: "血怒：生命低于一半时伤害提升",
      passiveId: "bloodrush",
      baseStats: { maxHP: 52, maxEnergy: 5, attack: 7, defense: 1 },
      startingSkill: "fury_slash",
      startingItems: [consumables.berserk_draught, equipments.feral_axe],
      lore: "曾在海上护卫队中厮杀，他相信唯有怒火能冲开深井的阴霾。",
    },
    monk: {
      id: "monk",
      name: "武僧",
      passive: "内息：施放治疗时额外获得勇气",
      passiveId: "inner_peace",
      baseStats: { maxHP: 42, maxEnergy: 6, attack: 4, defense: 2 },
      startingSkill: "chi_wave",
      startingItems: [consumables.focus_bead, equipments.sage_wrap],
      lore: "来自山门的行脚僧，擅以呼吸调和伤势，在战场中亦能自守。",
    },
    artificer: {
      id: "artificer",
      name: "巧匠",
      passive: "备用零件：使用消耗品有几率不消耗",
      passiveId: "tinker",
      baseStats: { maxHP: 38, maxEnergy: 6, attack: 5, defense: 2 },
      startingSkill: "gadget_bolt",
      startingItems: [consumables.gadget_charge, equipments.gyro_launcher],
      lore: "以齿轮与火花对抗古井的阴影，临场即兴改造她的机械伙伴。",
    },
    druid: {
      id: "druid",
      name: "驭林者",
      passive: "野性回响：整备时额外降低腐蚀",
      passiveId: "wildbond",
      baseStats: { maxHP: 44, maxEnergy: 6, attack: 4, defense: 2 },
      startingSkill: "nature_bloom",
      startingItems: [consumables.sapling_totem, equipments.grove_charm],
      lore: "她能召唤井底生长的苔藤，修补创口，也能让藤蔓缠住敌人。",
    },
    stormrunner: {
      id: "stormrunner",
      name: "雷奔客",
      passive: "风暴步：移动后获得短暂守备",
      passiveId: "tempest_step",
      baseStats: { maxHP: 40, maxEnergy: 7, attack: 5, defense: 1 },
      startingSkill: "storm_dance",
      startingItems: [consumables.storm_vial, equipments.tempest_blade],
      lore: "曾在风暴中传递情报的信使，她的脚步快得连潮水都追不上。",
    },
    spiritcaller: {
      id: "spiritcaller",
      name: "唤魂者",
      passive: "魂盾：战斗开始时自动获得守备",
      passiveId: "soulguard",
      baseStats: { maxHP: 42, maxEnergy: 6, attack: 5, defense: 2 },
      startingSkill: "spirit_bind",
      startingItems: [consumables.spirit_lantern, equipments.spirit_bell],
      lore: "与井底幽魂缔结契约的行者，让亡者守护活人。",
    },
    chronomancer: {
      id: "chronomancer",
      name: "时序术士",
      passive: "时轮：回合结束时额外缩短技能冷却",
      passiveId: "time_loop",
      baseStats: { maxHP: 36, maxEnergy: 7, attack: 4, defense: 2 },
      startingSkill: "time_shift",
      startingItems: [consumables.time_dust, equipments.echo_band],
      lore: "她研究井底破碎的时序裂缝，能短暂倒转自身的战斗节奏。",
    }
  };

  const enemies = {
    slime: { id: "slime", name: "史莱姆", tier: "normal", hp: 24, attack: 5, defense: 1, speed: 5, weakness: ["火焰", "雷系过载"], flavor: "半透明的软体不断抽动，似乎随时会分裂。", tags: ["潮湿体质"] },
    rat: { id: "rat", name: "洞鼠", tier: "normal", hp: 22, attack: 6, defense: 0, speed: 8, weakness: ["恐惧", "群攻"], flavor: "鼠群在石缝间穿梭，偷袭你的行囊。", tags: ["轻巧", "偷窃"] },
    skeleton: { id: "skeleton", name: "骷髅兵", tier: "normal", hp: 28, attack: 6, defense: 2, speed: 4, weakness: ["钝击", "破甲"], flavor: "骨骼的碰撞声在井壁回响，眼眶微微发光。", tags: ["不死", "顽固"] },
    bone_captain: { id: "bone_captain", name: "骸骨队长", tier: "elite", hp: 48, attack: 8, defense: 4, speed: 5, weakness: ["破甲", "打断怒吼"], flavor: "骨盔刻着古旧军徽，怒吼震得火把摇晃。", tags: ["护甲", "怒吼"] },
    muck_beast: { id: "muck_beast", name: "淤泥巨兽", tier: "boss", hp: 112, attack: 9, defense: 3, speed: 4, weakness: ["雷震", "持续燃烧"], flavor: "巨大的泥团包裹着骨片，张开的巨口要吞下光亮。", tags: ["读条吞噬", "召唤小史莱姆"] },
    spider: { id: "spider", name: "毒蛛", tier: "normal", hp: 24, attack: 6, defense: 1, speed: 7, weakness: ["火", "净化"], flavor: "毒液滴在地面冒泡，蛛丝拉成了网。", tags: ["中毒", "织网"] },
    cultist: { id: "cultist", name: "邪教徒", tier: "normal", hp: 30, attack: 7, defense: 1, speed: 5, weakness: ["打断祈祷", "神圣"], flavor: "低语声在耳边缠绕，他举起骨刃划出符文。", tags: ["腐化", "召唤"] },
    gargoyle: { id: "gargoyle", name: "石像鬼", tier: "normal", hp: 32, attack: 8, defense: 5, speed: 3, weakness: ["破甲", "雷震"], flavor: "粗糙的石翼展开，碎屑不断落下。", tags: ["高防", "反震"] },
    chanter: { id: "chanter", name: "吟咒者", tier: "elite", hp: 55, attack: 7, defense: 2, speed: 6, weakness: ["打断", "静默"], flavor: "吟咏如潮，令空气震颤。", tags: ["控场", "恐惧"] },
    spider_queen: { id: "spider_queen", name: "蛛后", tier: "elite", hp: 66, attack: 8, defense: 3, speed: 5, weakness: ["火焰", "猎网"], flavor: "巨大的腹部悬着蛋囊，蛛足踏在蛛丝上发出滴答声。", tags: ["召唤幼蛛", "织网覆盖"] },
    twilight_priestess: { id: "twilight_priestess", name: "暮光女祭司", tier: "boss", hp: 138, attack: 10, defense: 3, speed: 6, weakness: ["打断祈月", "驱散腐化"], flavor: "她背对火盆祈祷，暮光在指间凝成利刃。", tags: ["净化光束", "腐化祈祷"] },
    shadow: { id: "shadow", name: "掠食影", tier: "normal", hp: 28, attack: 9, defense: 1, speed: 9, weakness: ["标记", "群控"], flavor: "影子拉长又断裂，尖笑声像刀刮玻璃。", tags: ["高回避", "暴击"] },
    stone_colossus: { id: "stone_colossus", name: "石甲魔像", tier: "normal", hp: 46, attack: 9, defense: 6, speed: 2, weakness: ["破甲", "雷震"], flavor: "巨石缝隙闪烁蓝光。", tags: ["极高防御"] },
    cult_deacon: { id: "cult_deacon", name: "邪教执事", tier: "normal", hp: 38, attack: 8, defense: 2, speed: 5, weakness: ["驱散", "打断祝祷"], flavor: "执事的面具无口，却能发出刺耳吟唱。", tags: ["群体腐化"] },
    twin_assassins: { id: "twin_assassins", name: "双影刺客", tier: "elite", hp: 64, attack: 10, defense: 2, speed: 8, weakness: ["拆分击杀", "控场"], flavor: "影与影交错，刀光成双。", tags: ["协同出手"] },
    mirror_guard: { id: "mirror_guard", name: "镜像守卫", tier: "elite", hp: 72, attack: 9, defense: 4, speed: 5, weakness: ["破除增益", "标记"], flavor: "它复制你的姿态，甚至模仿呼吸。", tags: ["复制buff"] },
    faceless_duke: { id: "faceless_duke", name: "无面公爵", tier: "boss", hp: 152, attack: 11, defense: 4, speed: 6, weakness: ["破镜", "控制镜像"], flavor: "面皮如蜡，声音像多个人同时说话。", tags: ["镜像", "偷取增益"] },
    barnacle_lurker: { id: "barnacle_lurker", name: "藤壳潜袭者", tier: "normal", hp: 44, attack: 9, defense: 2, speed: 6, weakness: ["火焰", "群控"], flavor: "长满藤壳的怪物从潮水中弹起，挥舞尖刺。", tags: ["突袭", "缠绕"] },
    fungal_warden: { id: "fungal_warden", name: "孢囊守卫", tier: "normal", hp: 58, attack: 9, defense: 3, speed: 4, weakness: ["火焰", "净化"], flavor: "巨大的菌盖撑开石壁，孢子如雾般散落。", tags: ["孢子", "中毒"] },
    drowned_knight: { id: "drowned_knight", name: "溺亡骑士", tier: "normal", hp: 60, attack: 10, defense: 4, speed: 4, weakness: ["破甲", "雷震"], flavor: "铁甲滴水，他的盔甲里回荡着潮鸣。", tags: ["重甲", "怒意蓄力"] },
    void_singer: { id: "void_singer", name: "虚渊咏者", tier: "elite", hp: 88, attack: 11, defense: 3, speed: 7, weakness: ["打断", "沉默"], flavor: "无音之歌震荡空气，暗影随之震颤。", tags: ["混乱", "腐化音波"] },
    tide_hydra: { id: "tide_hydra", name: "潮汐九首", tier: "elite", hp: 104, attack: 12, defense: 4, speed: 5, weakness: ["持续燃烧", "群控"], flavor: "九条水首盘绕井柱，喷吐腐蚀性潮水。", tags: ["多段攻击", "潮湿蔓延"] },
    abyssal_leviathan: { id: "abyssal_leviathan", name: "深渊巨渊", tier: "boss", hp: 184, attack: 13, defense: 5, speed: 5, weakness: ["雷震", "破甲"], flavor: "庞大的影子盘踞在水面下，巨鳍拖曳着藤壳。", tags: ["潮汐冲击", "召唤水滴"] },
    obsidian_warlock: { id: "obsidian_warlock", name: "黑曜术师", tier: "normal", hp: 64, attack: 11, defense: 3, speed: 5, weakness: ["打断", "神圣"], flavor: "黑曜碎片悬浮在他周围，低语着古老咒文。", tags: ["暗影术式", "护盾"] },
    rift_hound: { id: "rift_hound", name: "裂隙猎犬", tier: "normal", hp: 58, attack: 12, defense: 2, speed: 8, weakness: ["标记", "群控"], flavor: "犬类身影被裂隙扯得虚实难辨。", tags: ["撕裂", "穿行"] },
    storm_scuttler: { id: "storm_scuttler", name: "风暴爬蟹", tier: "normal", hp: 52, attack: 11, defense: 3, speed: 9, weakness: ["冰霜", "打断"], flavor: "甲壳积蓄电光，移动间迸发雷弧。", tags: ["高速", "雷电反击"] },
    gloom_weaver: { id: "gloom_weaver", name: "幽纱织者", tier: "elite", hp: 98, attack: 12, defense: 3, speed: 6, weakness: ["火焰", "净化"], flavor: "影丝在空中织成网，触及便吸走温度。", tags: ["缠绕", "减速"] },
    echo_engine: { id: "echo_engine", name: "回声机枢", tier: "elite", hp: 112, attack: 13, defense: 5, speed: 4, weakness: ["破甲", "雷震"], flavor: "古老机关重新运转，齿轮间夹着幽光。", tags: ["反射", "护盾再生"] },
    oracle_of_depths: { id: "oracle_of_depths", name: "深渊神谕者", tier: "boss", hp: 198, attack: 14, defense: 5, speed: 6, weakness: ["沉默", "神圣"], flavor: "她的眼睛映着深海星辰，言语能改写潮汐。", tags: ["命运改写", "腐蚀浪潮"] },
    ashen_guardian: { id: "ashen_guardian", name: "灰烬守卫", tier: "normal", hp: 66, attack: 11, defense: 4, speed: 4, weakness: ["水流", "破甲"], flavor: "炭灰覆盖的巨人守护着祭坛火焰。", tags: ["燃烧护体", "慢速重击"] },
    soul_flayer: { id: "soul_flayer", name: "噬魂者", tier: "normal", hp: 64, attack: 12, defense: 3, speed: 6, weakness: ["净化", "控制"], flavor: "半透明的触须探向你的心跳。", tags: ["吸取", "精神打击"] },
    tidal_champion: { id: "tidal_champion", name: "潮汐勇士", tier: "elite", hp: 120, attack: 13, defense: 5, speed: 5, weakness: ["破甲", "雷震"], flavor: "曾经的祭坛守卫者，如今只为潮声挥刀。", tags: ["守护姿态", "激流反击"] },
    luminous_seraph: { id: "luminous_seraph", name: "辉翼侍女", tier: "elite", hp: 118, attack: 12, defense: 4, speed: 7, weakness: ["腐化", "沉默"], flavor: "破碎神殿中仍回荡她的圣歌，光翼能灼伤阴影。", tags: ["净化光束", "强化盟友"] },
    tidal_matriarch: { id: "tidal_matriarch", name: "潮母仪主", tier: "boss", hp: 210, attack: 14, defense: 5, speed: 5, weakness: ["群控", "持续燃烧"], flavor: "巨大的珊瑚王座上端坐潮母，她挥手便掀起海啸。", tags: ["潮汐唤潮", "召唤护卫"] },
    void_stalker: { id: "void_stalker", name: "虚空潜猎", tier: "normal", hp: 70, attack: 12, defense: 2, speed: 8, weakness: ["标记", "光耀"], flavor: "身影断裂重叠，让人难以捕捉。", tags: ["隐匿", "瞬移袭击"] },
    rift_warden: { id: "rift_warden", name: "裂隙门卫", tier: "elite", hp: 128, attack: 14, defense: 4, speed: 6, weakness: ["破甲", "连击"], flavor: "掌控裂隙之门的守卫，能随意改变战场位置。", tags: ["换位", "防护壁垒"] },
    void_tyrant: { id: "void_tyrant", name: "虚渊霸主", tier: "boss", hp: 226, attack: 15, defense: 6, speed: 6, weakness: ["沉默", "群控"], flavor: "虚渊的统治者从阴影中现身，手持裂隙长戟。", tags: ["裂隙重击", "召唤阴影"] },
    mirror_sentinel: { id: "mirror_sentinel", name: "镜映哨兵", tier: "normal", hp: 68, attack: 11, defense: 4, speed: 5, weakness: ["破镜", "连续打击"], flavor: "每次攻击都有镜面反射回来的错觉。", tags: ["镜像残影", "反射护盾"] },
    spiritbound_knight: { id: "spiritbound_knight", name: "魂缚骑士", tier: "normal", hp: 74, attack: 12, defense: 4, speed: 5, weakness: ["净化", "破甲"], flavor: "灵魂被锁进盔甲，仍忠诚守护深井。", tags: ["护盾", "灵魂锁链"] },
    echo_colossus: { id: "echo_colossus", name: "回声巨像", tier: "boss", hp: 236, attack: 16, defense: 6, speed: 5, weakness: ["破甲", "持续燃烧"], flavor: "巨像的脚步让整座井壁震颤，回声像浪一样拍回你身上。", tags: ["声浪冲击", "护盾回响"] },
    tidal_vindicator: { id: "tidal_vindicator", name: "潮汐执律者", tier: "normal", hp: 76, attack: 13, defense: 4, speed: 6, weakness: ["雷震", "破甲"], flavor: "他挥舞潮刃，宣判一切亵渎者。", tags: ["律法重击", "潮汐护盾"] },
    crown_keeper: { id: "crown_keeper", name: "王冠守灯人", tier: "elite", hp: 132, attack: 14, defense: 5, speed: 6, weakness: ["群控", "破甲"], flavor: "手持熔光灯盏的守卫，能点燃敌人并驱散黑暗。", tags: ["光耀护盾", "炽焰惩戒"] },
    luminous_regent: { id: "luminous_regent", name: "辉耀摄政", tier: "boss", hp: 248, attack: 16, defense: 6, speed: 6, weakness: ["腐化", "沉默"], flavor: "他身披光辉披风，手持潮光权杖，光芒几乎让人睁不开眼。", tags: ["光矛扫射", "护盾加持"] },
    ancient_sentinel: { id: "ancient_sentinel", name: "远古哨兵", tier: "normal", hp: 80, attack: 13, defense: 5, speed: 4, weakness: ["破甲", "持续燃烧"], flavor: "沉眠于井底的守卫被重新唤醒，石质盔甲坚不可摧。", tags: ["守护姿态", "反震"] },
    abyssal_warder: { id: "abyssal_warder", name: "深渊狱卒", tier: "elite", hp: 148, attack: 15, defense: 6, speed: 5, weakness: ["雷震", "群控"], flavor: "持巨链的狱卒把闯入者拖入更深的暗潮。", tags: ["缠绕", "重钳"] },
    abyssal_crown: { id: "abyssal_crown", name: "深渊之冠", tier: "boss", hp: 268, attack: 17, defense: 7, speed: 6, weakness: ["群控", "持续燃烧"], flavor: "深井的核心意识凝聚成王冠，意志如浪拍击一切。", tags: ["潮汐审判", "召唤护卫"] }
  };

  const events = {
    blood_oath: {
      id: "blood_oath",
      name: "血字誓约",
      description: "你在石台上看到一行古旧誓文：献出体与力，换得刀锋饮血的许可。",
      effect: "失去上限HP 5，获得嗜血到本层结束",
      options: [
        { id: 'pledge', label: '献血签下誓约', badge: 'danger', preview: '牺牲生命换取嗜血祝福，可能激发勇气或引来流血。' },
        { id: 'temper', label: '以碎片稳住仪式', badge: 'trade', preview: '支付35灵魂碎片，使契约更稳妥并保留更多体魄。', requiresCurrency: 35 },
        { id: 'observe', label: '抄录誓文', badge: 'mystic', preview: '暂不签约，记录誓词以换取战斗心得。' },
      ],
    },
    cracked_mirror: {
      id: "cracked_mirror",
      name: "碎裂镜面",
      description: "镜面映出你的轮廓，又像在嘲笑。你伸手触摸，裂痕像花绽放。",
      effect: "随机重掷一个负面状态，有概率转正或恶化",
      options: [
        { id: 'touch', label: '触摸裂纹', badge: 'mystic', preview: '让镜面决定你的命运，负面可能转化为激励。' },
        { id: 'shatter', label: '敲碎镜面', badge: 'danger', preview: '强行粉碎映像，可能受伤却能清除负面。' },
        { id: 'meditate', label: '凝神观照', badge: 'blessing', preview: '放下武器平复心绪，缓解腐蚀但消耗时间。' },
      ],
    },
    old_page: {
      id: "old_page",
      name: "旧书页",
      description: "纸页泛黄，却仍散发墨香。几行注记似是基础式。",
      effect: "从三条基础技能指令中学会一条",
      options: [
        { id: 'study', label: '研读纸页', badge: 'mystic', preview: '耐心学习，掌握一项基础技能，并有机会获得额外笔记。' },
        { id: 'copy', label: '抄录要点', badge: 'support', preview: '抄写有用片段，提升勇气或恢复能量。' },
        { id: 'torch', label: '焚烧供暖', badge: 'danger', preview: '烧掉纸页取暖，换取短暂的生命与腐蚀波动。' },
      ],
    },
    tide_chosen: {
      id: "tide_chosen",
      name: "潮汐选民",
      description: "潮水符纹绕着石台流动。呼吸中有咸味。",
      effect: "施法使敌潮湿，但你受雷伤+10%",
      options: [
        { id: 'accept', label: '接纳潮汐', badge: 'danger', preview: '接受潮汐改造，获得潮湿恩赐但承受弱点。' },
        { id: 'etch', label: '刻下防护符', badge: 'mystic', preview: '花费1点勇气稳住潮力，降低副作用。', requiresHeroism: 1 },
        { id: 'walk', label: '缓步离开', badge: 'support', preview: '观察潮汐运行，稍作冥想恢复状态。' },
      ],
    },
    mirror_sigil: {
      id: "mirror_sigil",
      name: "无面誓印",
      description: "冰冷的符印贴上皮肤，你听见另一张嗓音在耳边低语。",
      effect: "获得镜像反噬，但普通战初始-1层护甲",
      options: [
        { id: 'accept', label: '刻下誓印', badge: 'danger', preview: '接受镜像力量，获得强力反击也可能失去护甲。' },
        { id: 'reflect', label: '与影对视', badge: 'mystic', preview: '凝视镜像进行谈判，可能换取勇气或腐蚀。' },
        { id: 'retreat', label: '撤离阴影', badge: 'support', preview: '不冒险，恢复少量能量并离开。' },
      ],
    },
    tide_surge: {
      id: "tide_surge",
      name: "潮水突涨",
      description: "潮水猛然倒灌，几乎淹过脚踝。",
      effect: "本房内每回合后额外受潮汐伤害",
      options: [
        { id: 'brace', label: '稳住身形', badge: 'danger', preview: '硬扛潮水换取守备，但会受伤。' },
        { id: 'soak', label: '任其冲刷', badge: 'danger', preview: '完全交给潮水，可能受潮湿或更大伤害。' },
        { id: 'channel', label: '引导潮力', badge: 'mystic', preview: '尝试吸收潮水能量，用于恢复或提升勇气。' },
      ],
    },
    silhouette_lock: {
      id: "silhouette_lock",
      name: "剪影锁",
      description: "锁孔如剪影，需按顺序敲击才能开启。",
      effect: "mark后attack次序即可打开",
      options: [
        { id: 'attempt', label: '按影敲击', badge: 'danger', preview: '凭直觉敲击，可能开锁也可能触发陷阱。' },
        { id: 'decode', label: '细察纹路', badge: 'mystic', preview: '消耗1点勇气分析线路，几乎可以成功。', requiresHeroism: 1 },
        { id: 'force', label: '强行撬开', badge: 'danger', preview: '用武器撬锁，消耗装备耐久但换来碎片。' },
      ],
    },
    mirror_maze: {
      id: "mirror_maze",
      name: "镜像迷障",
      description: "镜面反射无数条路，错指令会被反噬。",
      effect: "在此房inspect可获正确口令提示",
      options: [
        { id: 'inspect', label: '记下路线', badge: 'mystic', preview: '耐心观察，下一场遭遇将获得提示。' },
        { id: 'dash', label: '强行穿行', badge: 'danger', preview: '冒险突进，可能获得勇气或遭受反噬。' },
        { id: 'chalk', label: '用粉笔标记', badge: 'support', preview: '消耗10灵魂碎片，永久在地图上标注安全路径。', requiresCurrency: 10 },
      ],
    },
    moth_eaten: {
      id: "moth_eaten",
      name: "蛀书堆",
      description: "残卷堆成小山，虫蛀的洞还残留湿迹。",
      effect: "翻找或许能找到技能线索",
      options: [
        { id: 'search', label: '翻找残页', badge: 'mystic', preview: '耐心翻找，可能学会技能或被毒尘侵袭。' },
        { id: 'press', label: '压榨药汁', badge: 'support', preview: '小心压制，换取治疗或净化道具。' },
        { id: 'brew', label: '熬制苦茶', badge: 'blessing', preview: '熬出提神苦茶，恢复能量但腐蚀上升。' },
      ],
    },
    damp_torch: {
      id: "damp_torch",
      name: "潮湿火把",
      description: "火把忽明忽暗，空气湿到让火星发愁。",
      effect: "晾干可换少量能量或火焰加成",
      options: [
        { id: 'dry', label: '烘干火把', badge: 'support', preview: '恢复能量并附带余烬效果。' },
        { id: 'split', label: '取下火', badge: 'mystic', preview: '萃取火油，获得额外的余烬药剂。' },
        { id: 'extinguish', label: '彻底熄灭', badge: 'blessing', preview: '熄灭火焰换取腐蚀下降，但勇气会减弱。' },
      ],
    },
    dry_well_echo: {
      id: "dry_well_echo",
      name: "枯井回声",
      description: "低沉的回声告诉你，召唤阵就在更深处。",
      effect: "增强勇气，连胜加成",
      options: [
        { id: 'listen', label: '聆听回声', badge: 'blessing', preview: '获得勇气，并提升下一次战利品品质。' },
        { id: 'hum', label: '回声和鸣', badge: 'mystic', preview: '以回声共鸣，清理腐蚀或恢复能量。' },
        { id: 'descend', label: '沿声找路', badge: 'danger', preview: '贸然前进，可能触发伏击或发现宝物。' },
      ],
    },
    altar_shadow: {
      id: "altar_shadow",
      name: "祭坛阴影",
      description: "祭坛阴影里潜伏着另一双眼睛。",
      effect: "献祭换祝福或承受诅咒",
      options: [
        { id: 'offer', label: '献上贡品', badge: 'danger', preview: '献出背包物品换取遗物或腐蚀。' },
        { id: 'resist', label: '抵抗诱惑', badge: 'blessing', preview: '以勇气抵抗阴影，净化腐蚀但可能受伤。', requiresHeroism: 1 },
        { id: 'trade', label: '以碎片交易', badge: 'trade', preview: '支付40灵魂碎片，换取随机遗物或装备。', requiresCurrency: 40 },
      ],
    },
    glimmering_pool: {
      id: 'glimmering_pool',
      name: '磷光之池',
      description: '池水泛着微光，水面上漂浮着不明的孢子。',
      effect: '池水可净化或强化，但同样可能引来潮湿诅咒。',
      options: [
        { id: 'drink', label: '饮下池水', badge: 'danger', preview: '随机获得强化或潮湿负面。' },
        { id: 'bottle', label: '舀入水囊', badge: 'trade', preview: '支付10灵魂碎片，换取一瓶稀有药剂。', requiresCurrency: 10 },
        { id: 'wash', label: '净手静坐', badge: 'blessing', preview: '解除一个负面并降低腐蚀，但会消耗时间。' },
      ],
    },
    rusted_armory: {
      id: 'rusted_armory',
      name: '锈蚀军械库',
      description: '铁柜半开，锁扣却被潮水锈死。里面隐约可见光泽。',
      effect: '可能获得武器或装备，也可能惊动守卫。',
      options: [
        { id: 'force', label: '蛮力撬开', badge: 'danger', preview: '强行破坏锁具，可能受伤或找到装备。' },
        { id: 'salvage', label: '拆解零件', badge: 'support', preview: '小心拆解，换取灵魂碎片与材料。' },
        { id: 'catalog', label: '研究铭文', badge: 'mystic', preview: '记录铭文，获得技能灵感或勇气。' },
      ],
    },
    echo_shrine: {
      id: 'echo_shrine',
      name: '回声祭坛',
      description: '石台上堆着旧供品，祭坛中心有条裂缝通向深处。',
      effect: '回应祭坛的祈求可恢复或强化，但也可能激怒阴影。',
      options: [
        { id: 'kneel', label: '跪祷献声', badge: 'blessing', preview: '恢复生命并净化一个负面。' },
        { id: 'chant', label: '吟唱古语', badge: 'mystic', preview: '消耗1点勇气，换取随机遗物增益。', requiresHeroism: 1 },
        { id: 'steal', label: '顺走供品', badge: 'danger', preview: '取走供品，获得资源但会增长腐蚀。' },
      ],
    },
    sacrifice_vendor: {
      id: 'sacrifice_vendor',
      name: '献祭行商',
      description: '披着贝壳的行商摆出奇异货品，他收的不是碎片，而是你的体魄。',
      effect: '可献祭上限属性以换取强力回报',
      options: [
        { id: 'blood_price', label: '献出体魄', badge: 'danger', preview: '失去6点最大生命，换取稀有遗物或装备。' },
        { id: 'essence_price', label: '献出元息', badge: 'mystic', preview: '失去1点最大能量，换取技能或勇气奖励。' },
        { id: 'decline', label: '谨慎离开', badge: 'support', preview: '保持距离，行商会赠你少量灵魂碎片以示礼貌。' },
      ],
    },
    coral_orchard: {
      id: 'coral_orchard',
      name: '珊瑚苗圃',
      description: '井壁上长满了会呼吸的珊瑚树，散发着淡淡花香。',
      effect: '照料或采集珊瑚会影响你的状态',
      options: [
        { id: 'harvest', label: '切取珊瑚', badge: 'trade', preview: '获得药剂或装备材料，但有机会引来毒素。' },
        { id: 'tend', label: '细心照料', badge: 'blessing', preview: '照料珊瑚，减缓腐蚀并获得少量治疗。' },
        { id: 'meditate', label: '倚靠聆听', badge: 'mystic', preview: '在珊瑚间冥想，积蓄勇气并激发灵感。' },
      ],
    },
    echoing_archive: {
      id: 'echoing_archive',
      name: '回声档案',
      description: '一排排石板记录着前人的战斗轨迹，敲击时会回荡旧日声音。',
      effect: '可以抄录战法或揭示地图',
      options: [
        { id: 'read', label: '阅读战报', badge: 'mystic', preview: '学得战斗技巧，或获得额外技能。' },
        { id: 'rewrite', label: '刻下心得', badge: 'trade', preview: '花费20碎片刻下心得，揭示附近房间。', requiresCurrency: 20 },
        { id: 'seal', label: '合上档案', badge: 'support', preview: '将档案封存，换取少量积分与勇气。' },
      ],
    },
    tide_pylon: {
      id: 'tide_pylon',
      name: '潮汐晶塔',
      description: '晶塔脉动着潮蓝色的光芒，触碰会反馈能量。',
      effect: '导引晶塔能调整你的属性',
      options: [
        { id: 'absorb', label: '吸纳能量', badge: 'mystic', preview: '获得能量与守备，但腐蚀稍有波动。' },
        { id: 'stabilize', label: '稳固晶塔', badge: 'support', preview: '降低腐蚀并获得护甲。' },
        { id: 'overload', label: '过载晶塔', badge: 'danger', preview: '过载晶塔可得大量碎片，但可能受到反噬。' },
      ],
    },
    abyssal_forge: {
      id: 'abyssal_forge',
      name: '深渊熔炉',
      description: '熔炉中的海火无声燃烧，可以重铸武器或注入魂火。',
      effect: '牺牲装备或勇气以换取强力提升',
      options: [
        { id: 'temper', label: '回炉重铸', badge: 'trade', preview: '消耗一件装备，换取更高品质的武器或护符。', requiresItemName: '任意装备' },
        { id: 'fuse', label: '注入魂火', badge: 'mystic', preview: '消耗1点勇气，永久提升攻击或防御。', requiresHeroism: 1 },
        { id: 'warm', label: '借火休息', badge: 'blessing', preview: '在炉旁休息，恢复生命并获得激励。' },
      ],
    }
  };

  const floors = [
    { id: "floor1", name: "苔痕石室", ambience: "潮湿、苔藓、积水，火把昏黄。", rooms: { normal: ["slime", "rat", "skeleton"], elite: ["bone_captain"], boss: "muck_beast", events: ["blood_oath", "old_page", "cracked_mirror", "damp_torch", "glimmering_pool", "rusted_armory"], merchants: true, camp: 1 }, size: 4 },
    { id: "floor2", name: "腐潮洞廊", ambience: "水汽更重，暗潮与骨粉混杂。", rooms: { normal: ["spider", "cultist", "gargoyle"], elite: ["chanter", "spider_queen"], boss: "twilight_priestess", events: ["tide_chosen", "tide_surge", "altar_shadow", "moth_eaten", "glimmering_pool", "echo_shrine"], merchants: true, camp: 1 }, size: 4 },
    { id: "floor3", name: "无面之厅", ambience: "镜面墙、回声长廊，偶有低语。", rooms: { normal: ["shadow", "stone_colossus", "cult_deacon"], elite: ["twin_assassins", "mirror_guard"], boss: "faceless_duke", events: ["mirror_sigil", "silhouette_lock", "mirror_maze", "dry_well_echo", "rusted_armory", "echo_shrine"], merchants: true, camp: 1 }, size: 5 },
    { id: "floor4", name: "潮骨花圃", ambience: "藤壳与孢子缠绕石柱，水汽带着甜腥味。", rooms: { normal: ["barnacle_lurker", "fungal_warden", "drowned_knight"], elite: ["void_singer", "tide_hydra"], boss: "abyssal_leviathan", events: ["coral_orchard", "sacrifice_vendor", "damp_torch", "tide_pylon", "glimmering_pool", "moth_eaten"], merchants: true, camp: 1 }, size: 5 },
    { id: "floor5", name: "回声熔井", ambience: "残存的熔炉与黑曜碎片散落，温度时冷时热。", rooms: { normal: ["obsidian_warlock", "storm_scuttler", "rift_hound"], elite: ["gloom_weaver", "echo_engine"], boss: "oracle_of_depths", events: ["echoing_archive", "abyssal_forge", "rusted_armory", "sacrifice_vendor", "tide_pylon"], merchants: true, camp: 1 }, size: 5 },
    { id: "floor6", name: "潮母圣坛", ambience: "潮汐圣歌在殿内回荡，祭坛火焰忽明忽暗。", rooms: { normal: ["ashen_guardian", "fungal_warden", "soul_flayer"], elite: ["tidal_champion", "luminous_seraph"], boss: "tidal_matriarch", events: ["tide_chosen", "tide_pylon", "echo_shrine", "coral_orchard", "abyssal_forge"], merchants: false, camp: 1 }, size: 5 },
    { id: "floor7", name: "虚渊裂罅", ambience: "裂隙裂开蓝紫色的闪光，空气里充满低语。", rooms: { normal: ["void_stalker", "obsidian_warlock", "rift_hound"], elite: ["rift_warden", "gloom_weaver"], boss: "void_tyrant", events: ["mirror_maze", "echoing_archive", "sacrifice_vendor", "tide_pylon", "dry_well_echo"], merchants: false, camp: 1 }, size: 5 },
    { id: "floor8", name: "幽辉回廊", ambience: "光影交织，镜面残片漂浮于半空。", rooms: { normal: ["mirror_sentinel", "spiritbound_knight", "ashen_guardian"], elite: ["luminous_seraph", "echo_engine"], boss: "echo_colossus", events: ["echoing_archive", "tide_pylon", "damp_torch", "echo_shrine", "coral_orchard"], merchants: false, camp: 1 }, size: 6 },
    { id: "floor9", name: "王冠回潮", ambience: "王冠雕纹刻满墙壁，潮水像脉络般流动。", rooms: { normal: ["tidal_vindicator", "drowned_knight", "storm_scuttler"], elite: ["tidal_champion", "crown_keeper"], boss: "luminous_regent", events: ["sacrifice_vendor", "echo_shrine", "abyssal_forge", "tide_pylon", "glimmering_pool"], merchants: false, camp: 1 }, size: 6 },
    { id: "floor10", name: "深渊心室", ambience: "井底最深处的水面静止如镜，只有心跳般的震动。", rooms: { normal: ["ancient_sentinel", "void_stalker", "soul_flayer"], elite: ["abyssal_warder", "crown_keeper"], boss: "abyssal_crown", events: ["abyssal_forge", "sacrifice_vendor", "echoing_archive", "tide_pylon", "coral_orchard"], merchants: false, camp: 1 }, size: 6 }
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
  loadProfile() {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('dungeon-profile');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  },
  saveProfile(profile) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('dungeon-profile', JSON.stringify(profile || {}));
    } catch (err) {
      // ignore
    }
  },
  loadAdminSettings() {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('dungeon-admin-settings');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  },
  saveAdminSettings(settings) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('dungeon-admin-settings', JSON.stringify(settings || {}));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dungeon-admin-updated', { detail: settings || {} }));
      }
    } catch (err) {
      // ignore
    }
  },
  loadRunState() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('dungeon-run-state');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  },
  saveRunState(state) {
    if (typeof window === 'undefined') return;
    try {
      if (!state) {
        window.localStorage.removeItem('dungeon-run-state');
        return;
      }
      window.localStorage.setItem('dungeon-run-state', JSON.stringify(state));
    } catch (err) {
      // ignore
    }
  },
  clearRunState() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('dungeon-run-state');
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
    this.state = { phase: "intro", overlay: null };
    this.logEntries = [];
    this._tutorialTimer = null;
    this._audioPhase = null;
    this._restoring = false;
    this._lastPersistAt = null;
    this._retreated = false;
    const storedProfile = DungeonStorage.loadProfile();
    const storedName = this.sanitizeName(storedProfile?.name || '');
    this.profile = { name: storedName };
    this.accountDisplayName();
    this.introChoice = { classId: null };
    const storedAdmin = DungeonStorage.loadAdminSettings();
    this.admin = { gameEnabled: true, invincible: false, ...storedAdmin };
    this.scores = this.normalizeScoreList(DungeonStorage.loadScores());
    DungeonStorage.saveScores(this.scores);
    this._handleAdminBroadcast = (event) => {
      if (!event?.detail) return;
      this.applyAdminSettings(event.detail);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('dungeon-admin-updated', this._handleAdminBroadcast);
    }
    if (typeof API !== 'undefined' && !API._me) {
      Promise.resolve().then(async () => {
        try {
          await API.me();
          this.accountDisplayName();
          if (this.state?.phase === 'intro') {
            this.renderIntro();
          }
        } catch (_) {
          /* ignore */
        }
      });
    }
    const saved = DungeonStorage.loadRunState();
    if (saved && saved.run) {
      this.restoreFromSnapshot(saved);
    } else {
      this.renderIntro();
    }
  }

  snapshotState() {
    if (!this.run || this.state.phase === 'intro') return null;
    const run = this.serializeRun();
    if (!run) return null;
    const tutorial = this.serializeTutorial();
    const logEntries = Array.isArray(this.logEntries)
      ? this.logEntries.slice(0, 160).map(entry => ({ text: entry.text, type: entry.type }))
      : [];
    return {
      version: 1,
      state: { phase: this.state.phase, finished: !!this._finished },
      run,
      tutorial,
      logEntries,
      rngSeed: this.rng?.seed || null,
      timestamp: Date.now(),
    };
  }

  serializeTutorial() {
    if (!this.tutorial) return null;
    const base = {
      ...this.tutorial,
      seen: Array.from(this.tutorial.seen || []),
    };
    return JSON.parse(JSON.stringify(base));
  }

  serializeRun() {
    if (!this.run) return null;
    const run = this.run;
    const player = run.player || {};
    const playerData = {
      ...player,
      bestiary: Array.from(player.bestiary || []),
      codex: Array.from(player.codex || []),
    };
    const playerClone = JSON.parse(JSON.stringify(playerData));
    const floorsClone = JSON.parse(JSON.stringify(Array.isArray(run.floors) ? run.floors : []));
    const currentRoom = run.currentRoom && run.currentRoom.coords
      ? { floorIndex: run.floorIndex, x: run.currentRoom.coords.x, y: run.currentRoom.coords.y }
      : null;
    const combat = run.combat
      ? {
          enemy: JSON.parse(JSON.stringify(run.combat.enemy || null)),
          turn: run.combat.turn || 1,
          playerActed: !!run.combat.playerActed,
          dropsGuaranteed: !!run.combat.dropsGuaranteed,
          room: run.combat.room?.coords
            ? { floorIndex: run.floorIndex, x: run.combat.room.coords.x, y: run.combat.room.coords.y }
            : null,
        }
      : null;
    return {
      floorIndex: run.floorIndex,
      corruption: run.corruption,
      maxCorruption: run.maxCorruption,
      currency: run.currency,
      heroicPromise: run.heroicPromise,
      score: run.score,
      startTime: run.startTime,
      timeHourglassUsed: !!run.timeHourglassUsed,
      history: Array.isArray(run.history) ? run.history.slice(0, 40) : [],
      floors: floorsClone,
      player: playerClone,
      currentRoom,
      combat,
      result: run.result || null,
    };
  }

  persistState(forceClear = false) {
    if (this._restoring) return;
    if (forceClear) {
      DungeonStorage.clearRunState();
      this._lastPersistAt = null;
      return;
    }
    const snapshot = this.snapshotState();
    if (snapshot) {
      this._lastPersistAt = snapshot.timestamp || Date.now();
      DungeonStorage.saveRunState(snapshot);
    } else {
      DungeonStorage.clearRunState();
      this._lastPersistAt = null;
    }
  }

  restoreFromSnapshot(saved) {
    const run = this.deserializeRun(saved?.run);
    if (!run) {
      this.renderIntro();
      return;
    }
    this._restoring = true;
    this._lastPersistAt = Number.isFinite(Number(saved?.timestamp)) ? Number(saved.timestamp) : Date.now();
    this.run = run;
    this.state = { phase: saved?.state?.phase || 'explore', overlay: null };
    this._finished = !!(saved?.state?.finished);
    this.logEntries = Array.isArray(saved?.logEntries)
      ? saved.logEntries.filter(entry => entry && typeof entry.text === 'string')
          .map(entry => ({ text: entry.text, type: entry.type || 'info' }))
      : [];
    this.tutorial = this.deserializeTutorial(saved?.tutorial);
    if (!this.tutorial) {
      this.tutorial = { stage: 'explore', seen: new Set(), actions: 0, expiresAt: Date.now() + 120000, hidden: false };
    }
    this.rng = new DungeonRng(saved?.rngSeed || Date.now());
    this.clearTutorialTimer();
    this.scheduleTutorialTimeout();
    this.renderLayout();
    this.renderLog();
    this._restoring = false;
    this.persistState();
  }

  deserializeTutorial(data) {
    if (!data || typeof data !== 'object') return null;
    const copy = { ...data };
    copy.seen = new Set(Array.isArray(data.seen) ? data.seen : []);
    copy.actions = Number.isFinite(copy.actions) ? Number(copy.actions) : 0;
    copy.expiresAt = Number.isFinite(copy.expiresAt) ? Number(copy.expiresAt) : Date.now() + 120000;
    copy.stage = typeof copy.stage === 'string' ? copy.stage : 'explore';
    copy.hidden = !!copy.hidden;
    return copy;
  }

  deserializeRun(data) {
    if (!data || typeof data !== 'object') return null;
    const run = {
      floorIndex: Number.isFinite(data.floorIndex) ? Number(data.floorIndex) : 0,
      corruption: Number.isFinite(data.corruption) ? Number(data.corruption) : 0,
      maxCorruption: Number.isFinite(data.maxCorruption) ? Number(data.maxCorruption) : 10,
      currency: Number.isFinite(data.currency) ? Number(data.currency) : 0,
      heroicPromise: Number.isFinite(data.heroicPromise) ? Number(data.heroicPromise) : 0,
      score: Number.isFinite(data.score) ? Number(data.score) : 0,
      startTime: Number.isFinite(data.startTime) ? Number(data.startTime) : Date.now(),
      timeHourglassUsed: !!data.timeHourglassUsed,
      history: Array.isArray(data.history) ? data.history.slice(0, 40) : [],
      floors: Array.isArray(data.floors) ? JSON.parse(JSON.stringify(data.floors)) : [],
      result: data.result || null,
    };
    const playerData = data.player || {};
    const player = JSON.parse(JSON.stringify(playerData));
    player.bestiary = new Set(Array.isArray(playerData.bestiary) ? playerData.bestiary : []);
    player.codex = new Set(Array.isArray(playerData.codex) ? playerData.codex : []);
    if (!Array.isArray(player.inventory)) player.inventory = [];
    player.inventory = player.inventory.map(item => {
      if (!item || typeof item !== 'object') return item;
      const copyItem = { ...item };
      if (copyItem.charges != null && Number.isFinite(Number(copyItem.charges))) {
        copyItem.charges = Number(copyItem.charges);
      }
      return copyItem;
    });
    if (!player.cooldowns || typeof player.cooldowns !== 'object') player.cooldowns = {};
    if (!Array.isArray(player.statuses)) player.statuses = [];
    player.statuses = player.statuses.map(status => {
      if (!status || typeof status !== 'object') return status;
      const copyStatus = { ...status };
      if (copyStatus.duration != null && Number.isFinite(Number(copyStatus.duration))) {
        copyStatus.duration = Number(copyStatus.duration);
      }
      if (copyStatus.stacks != null && Number.isFinite(Number(copyStatus.stacks))) {
        copyStatus.stacks = Number(copyStatus.stacks);
      }
      return copyStatus;
    });
    if (!player.equipment || typeof player.equipment !== 'object') player.equipment = {};
    if (!Array.isArray(player.relics)) player.relics = [];
    if (!player.flags || typeof player.flags !== 'object') player.flags = {};
    Object.keys(player.cooldowns).forEach(key => {
      const val = player.cooldowns[key];
      player.cooldowns[key] = Number.isFinite(val) ? Number(val) : (Number.isFinite(Number(val)) ? Number(val) : 0);
    });
    ['hp', 'maxHP', 'energy', 'maxEnergy', 'armor', 'guard', 'heroism', 'streak', 'level', 'attack', 'defense'].forEach(stat => {
      if (player[stat] != null && Number.isFinite(Number(player[stat]))) {
        player[stat] = Number(player[stat]);
      }
    });
    run.player = player;
    run.floors = run.floors.map(floor => {
      const mapped = { ...floor };
      if (!mapped.map) mapped.map = {};
      if (!Array.isArray(mapped.map.cells)) mapped.map.cells = [];
      if (!mapped.position && mapped.map?.start) {
        mapped.position = { ...mapped.map.start };
      }
      return mapped;
    });
    const currentRoomInfo = data.currentRoom;
    const ensureRoom = (floorIndex, x, y) => {
      const floor = run.floors[floorIndex];
      if (!floor?.map?.cells?.[y]?.[x]) return null;
      floor.position = { x, y };
      return floor.map.cells[y][x];
    };
    let currentRoom = null;
    if (currentRoomInfo && Number.isFinite(currentRoomInfo.x) && Number.isFinite(currentRoomInfo.y)) {
      const idx = Number.isFinite(currentRoomInfo.floorIndex) ? currentRoomInfo.floorIndex : run.floorIndex;
      currentRoom = ensureRoom(idx, currentRoomInfo.x, currentRoomInfo.y);
    }
    const floorFallback = run.floors[run.floorIndex] || run.floors[0];
    if (!currentRoom && floorFallback?.map?.start) {
      const { x, y } = floorFallback.position || floorFallback.map.start;
      currentRoom = ensureRoom(run.floorIndex, x, y) || currentRoom;
    }
    run.currentRoom = currentRoom;
    if (data.combat && data.combat.enemy && currentRoom) {
      const combatRoomInfo = data.combat.room;
      let combatRoom = currentRoom;
      if (combatRoomInfo && Number.isFinite(combatRoomInfo.x) && Number.isFinite(combatRoomInfo.y)) {
        const idx = Number.isFinite(combatRoomInfo.floorIndex) ? combatRoomInfo.floorIndex : run.floorIndex;
        combatRoom = ensureRoom(idx, combatRoomInfo.x, combatRoomInfo.y) || combatRoom;
      }
      run.combat = {
        enemy: JSON.parse(JSON.stringify(data.combat.enemy)),
        room: combatRoom,
        turn: Number.isFinite(data.combat.turn) ? Number(data.combat.turn) : 1,
        playerActed: !!data.combat.playerActed,
        dropsGuaranteed: !!data.combat.dropsGuaranteed,
      };
    } else {
      run.combat = null;
    }
    return run;
  }

  destroy(options = {}) {
    const preserve = options?.preserve !== false;
    if (preserve) {
      this.persistState();
    } else {
      this.persistState(true);
    }
    if (typeof window !== 'undefined' && this._handleAdminBroadcast) {
      window.removeEventListener('dungeon-admin-updated', this._handleAdminBroadcast);
    }
    this.clearTutorialTimer();
    this.stopAudio(true);
    this.root.innerHTML = "";
  }

  renderIntro() {
    DungeonStorage.clearRunState();
    this.closeOverlay();
    this.run = null;
    this.state.phase = 'intro';
    this.state.overlay = null;
    const classes = Object.values(DungeonData.classes);
    const selected = classes.find(cls => cls.id === this.introChoice?.classId);
    if (!selected) this.introChoice = { ...this.introChoice, classId: null };
    const classCards = classes.map(cls => {
      const stats = cls.baseStats || {};
      const selectedClass = this.introChoice?.classId === cls.id ? ' is-selected' : '';
      const items = cls.startingItems.map(item => item.name).join('、');
      return `
        <button type="button" class="dungeon-class-card${selectedClass}" data-class="${cls.id}">
          <div class="dungeon-class-card__header">
            <span class="dungeon-class-card__name">${cls.name}</span>
            <span class="dungeon-class-card__passive">${cls.passive}</span>
          </div>
          <div class="dungeon-class-card__stats">
            <span>生命 ${stats.maxHP ?? '-'}</span>
            <span>能量 ${stats.maxEnergy ?? '-'}</span>
            <span>攻击 ${stats.attack ?? '-'}</span>
            <span>防御 ${stats.defense ?? '-'}</span>
          </div>
          <div class="dungeon-class-card__items"><span class="label">开局物品</span>${items}</div>
        </button>
      `;
    }).join('');
    const featureList = [
      '每次进入古井都会重新生成地图，怪物与事件完全随机分布。',
      '事件拥有多重抉择，成功或失败会影响状态、物品与遗物。',
      '奖励不止积分，还可能获得装备、药剂、勇气与灵魂碎片。',
    ].map(text => `<li>${text}</li>`).join('');
    const seed = Math.floor(Date.now() + Math.random() * 1_000_000);
    this.currentIntroSeed = seed;
    const heroName = dungeonEscapeHtml(this.accountDisplayName());
    this.root.innerHTML = `
      <div class="dungeon-intro">
        <div class="dungeon-intro__layout">
          <div class="dungeon-intro__story">
            <h2>〈史莱姆古井〉探险</h2>
            <p>潮水倒灌的古井再次开放。先挑好一名先锋，确认装备后再下井。</p>
            <ul class="dungeon-intro__features">${featureList}</ul>
          </div>
          <div class="dungeon-intro__preview" id="dungeon-class-preview">
            <div class="dungeon-preview-placeholder">选择一名职业即可查看详细介绍与建议。</div>
          </div>
        </div>
        <div class="dungeon-intro__name">
          <div class="dungeon-intro__name-label">冒险者</div>
          <div class="dungeon-intro__name-value">${heroName}</div>
          <div class="dungeon-intro__name-hint">排行榜将以你的账号名称记录成绩。</div>
        </div>
        <div class="dungeon-class-grid">${classCards}</div>
        <div class="dungeon-intro__actions">
          <button type="button" class="dungeon-intro__start" id="dungeon-start-run" ${(!this.admin.gameEnabled || !selected) ? 'disabled' : ''}>准备下井</button>
          <button type="button" class="dungeon-intro__random" id="dungeon-random-class">随机推荐</button>
        </div>
          <div class="dungeon-intro__meta">
          <div>提示：首层前两场战斗必掉职业相关装备。</div>
          <div class="dungeon-seed">本次探险种子：<span id="dungeon-seed">${seed}</span></div>
        </div>
        <div class="dungeon-panel dungeon-intro-scores" id="dungeon-intro-scores" data-context="intro"></div>
        ${this.admin.gameEnabled ? '' : '<div class="dungeon-maintenance">古井入口暂时关闭，请等待管理员重新开启。</div>'}
      </div>
    `;
    this.renderScoreboard('dungeon-intro-scores');
    if (selected) {
      this.updateIntroPreview(selected);
    }
    this.bindIntroInteractions();
    window.AudioEngine?.decorateArea?.(this.root);
    this.updateAudio();
  }

  bindIntroInteractions() {
    const cards = this.root.querySelectorAll('.dungeon-class-card');
    cards.forEach(node => {
      node.addEventListener('click', () => {
        const clsId = node.dataset.class;
        this.selectIntroClass(clsId);
      });
    });
    const randomBtn = this.root.querySelector('#dungeon-random-class');
    if (randomBtn) {
      randomBtn.addEventListener('click', () => {
        const entries = Object.values(DungeonData.classes || {});
        if (!entries.length) return;
        const pick = entries[Math.floor(Math.random() * entries.length)];
        this.selectIntroClass(pick.id);
      });
    }
    const startBtn = this.root.querySelector('#dungeon-start-run');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (!this.admin.gameEnabled) {
          alert('古井入口正在维护，请稍后再尝试。');
          return;
        }
        const clsId = this.introChoice?.classId;
        if (!clsId) {
          this.addLog('请先选择一名职业再启程。', 'warn');
          return;
        }
        const fallbackSeed = Math.floor(Date.now() + Math.random() * 1_000_000);
        this.startRun(clsId, this.currentIntroSeed || fallbackSeed);
      });
    }
    if (this.introChoice?.classId) {
      this.highlightIntroSelection(this.introChoice.classId);
    }
  }

  selectIntroClass(classId) {
    const cls = DungeonData.classes[classId];
    if (!cls) return;
    this.introChoice = { ...this.introChoice, classId };
    this.highlightIntroSelection(classId);
    const startBtn = this.root.querySelector('#dungeon-start-run');
    if (startBtn) {
      startBtn.disabled = !this.admin.gameEnabled;
    }
    this.updateIntroPreview(cls);
  }

  highlightIntroSelection(classId) {
    const cards = this.root.querySelectorAll('.dungeon-class-card');
    cards.forEach(node => {
      if (node.dataset.class === classId) {
        node.classList.add('is-selected');
        if (typeof node.focus === 'function') {
          try {
            node.focus({ preventScroll: true });
          } catch (err) {
            node.focus();
          }
        }
      } else {
        node.classList.remove('is-selected');
      }
    });
  }

  updateIntroPreview(cls) {
    const node = this.root.querySelector('#dungeon-class-preview');
    if (!node || !cls) return;
    const stats = cls.baseStats || {};
    const skill = DungeonData.skills[cls.startingSkill];
    const items = cls.startingItems.map(item => `<li>${item.name}</li>`).join('');
    node.innerHTML = `
      <div class="dungeon-preview-card">
        <div class="dungeon-preview-card__head">
          <div class="dungeon-preview-card__name">${cls.name}</div>
          <div class="dungeon-preview-card__passive">${cls.passive}</div>
        </div>
        <div class="dungeon-preview-card__stats">
          <div><span>生命</span><span>${stats.maxHP ?? '-'}</span></div>
          <div><span>能量</span><span>${stats.maxEnergy ?? '-'}</span></div>
          <div><span>攻击</span><span>${stats.attack ?? '-'}</span></div>
          <div><span>防御</span><span>${stats.defense ?? '-'}</span></div>
        </div>
        <div class="dungeon-preview-card__lore">${cls.lore || '这位冒险者的经历仍是谜团。'}</div>
        <div class="dungeon-preview-card__meta">
          <div><span class="meta-label">起始技能</span><span>${skill?.name || '-'}</span></div>
          <div><span class="meta-label">开局物品</span><ul>${items}</ul></div>
        </div>
      </div>
    `;
  }

  applyAdminSettings(settings = {}) {
    this.admin = { ...this.admin, ...settings };
    if (this.state.phase === 'intro') {
      this.renderIntro();
    } else {
      this.updateAll();
    }
  }

  startRun(classId, seed) {
    const cls = DungeonData.classes[classId];
    if (!cls) return;
    const displayName = this.accountDisplayName();
    this.rng = new DungeonRng(seed + classId.length * 17);
    this._finished = false;
    this.logEntries = [];
    const player = {
      classId,
      name: cls.name,
      nickname: displayName,
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
    player.startingSkill = cls.startingSkill;
    player.codex.add(cls.startingSkill);
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
      currency: 120,
      history: [],
      heroicPromise: 0,
      score: 0,
      startTime: Date.now(),
      timeHourglassUsed: false,
    };
    this.clearTutorialTimer();
    this.tutorial = { stage: 'explore', seen: new Set(), actions: 0, expiresAt: Date.now() + 120000, hidden: false };
    this.scheduleTutorialTimeout();
    this.state.phase = "explore";
    this.renderLayout();
    this.enterFloor(0);
    this.addLog(`你以代号“${alias}”踏入古井，选择了${cls.name}，握紧武器，火光在指间跳动。`, "info");
    this.addLog('【教学】指令区下方的“新手指引”会根据阶段给出建议，可随时查看。', 'announce');
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
    const center = Math.floor(size / 2);
    const startCandidates = [];
    for (let y = Math.max(1, center - 1); y <= Math.min(size - 2, center + 1); y += 1) {
      for (let x = Math.max(1, center - 1); x <= Math.min(size - 2, center + 1); x += 1) {
        startCandidates.push({ x, y });
      }
    }
    const start = this.rng.pick(startCandidates) || { x: center, y: center };
    const totalSlots = size * size - 1;

    const pool = [];
    const baseEvents = Array.isArray(floor.rooms.events) ? floor.rooms.events.filter(id => DungeonData.events[id]) : [];
    const allEvents = Object.keys(DungeonData.events);
    const targetEventCount = Math.max(baseEvents.length, Math.max(3, Math.ceil(totalSlots * 0.3)));
    const eventCount = Math.min(totalSlots, targetEventCount);
    const eventChoices = baseEvents.slice();
    const generalPool = this.rng.shuffle(allEvents.filter(id => !eventChoices.includes(id)));
    while (eventChoices.length < eventCount && generalPool.length) {
      const next = generalPool.shift();
      if (next) eventChoices.push(next);
    }
    while (eventChoices.length < eventCount) {
      const extra = this.rng.pick(allEvents);
      if (!extra) break;
      eventChoices.push(extra);
    }
    const randomizedEvents = this.rng.shuffle(eventChoices);
    for (let i = 0; i < eventCount; i += 1) {
      const pick = randomizedEvents[i % randomizedEvents.length];
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
      <div class="dungeon-save-banner" id="dungeon-save-banner"></div>
      <div class="dungeon-layout">
        <div class="dungeon-left">
          <div class="dungeon-panel" id="dungeon-panel-status"></div>
          <div class="dungeon-panel" id="dungeon-panel-room"></div>
          <div class="dungeon-commands" id="dungeon-commands"></div>
          <div class="dungeon-panel dungeon-guide" id="dungeon-inline-guide"></div>
        </div>
        <div class="dungeon-right">
          <div class="dungeon-panel" id="dungeon-panel-inventory"></div>
          <div class="dungeon-panel" id="dungeon-panel-log">
            <div class="panel-title">冒险回声</div>
            <div class="dungeon-log" id="dungeon-log"></div>
          </div>
        </div>
      </div>
      <div class="dungeon-overlay is-hidden" id="dungeon-overlay"></div>
    `;
    this.updateAll();
  }

  updateAll() {
    this.markAdjacentThreats(this.currentFloor, this.run?.currentRoom?.coords);
    this.renderStatus();
    this.renderRoom();
    this.renderCommands();
    this.renderInventory();
    this.renderGuide();
    this.renderLog();
    this.renderOverlay();
    this.updateAudio();
    if (!this._restoring) this.persistState();
    this.renderSaveBanner();
  }

  audioPhaseKey() {
    if (this.state.phase === 'intro' || !this.run) return 'lobby';
    if (this.state.phase === 'ended') {
      return this.run?.result === 'victory' ? 'victory' : 'defeat';
    }
    if (this.state.phase === 'combat') return 'combat';
    if (['event', 'merchant', 'camp'].includes(this.state.phase)) return 'event';
    return 'explore';
  }

  updateAudio() {
    if (typeof window === 'undefined') return;
    const engine = window.AudioEngine;
    if (!engine || typeof engine.playPreset !== 'function') return;
    const phase = this.audioPhaseKey();
    if (phase === this._audioPhase) return;
    this._audioPhase = phase;
    switch (phase) {
      case 'lobby':
        engine.playPreset('dungeon', 'dungeon-lobby');
        break;
      case 'combat':
        engine.playPreset('dungeon', 'dungeon-combat');
        break;
      case 'event':
        engine.playPreset('dungeon', 'dungeon-event');
        break;
      case 'victory':
        engine.playPreset('dungeon', 'dungeon-victory');
        break;
      case 'defeat':
        engine.playPreset('dungeon', 'dungeon-defeat');
        break;
      case 'explore':
      default:
        engine.playPreset('dungeon', 'dungeon-explore');
        break;
    }
  }

  stopAudio(immediate = false) {
    window.AudioEngine?.stopChannel?.('dungeon', immediate);
    this._audioPhase = null;
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
    this.markAdjacentThreats(floor, startCell.coords);
    this.closeOverlay();
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
    this.markAdjacentThreats(floor, cell.coords);
    if (["normal", "elite", "boss"].includes(cell.type)) {
      if (cell.resolved) {
        this.addLog('战斗痕迹犹在，此处暂时空无一人。', 'info');
        this.state.phase = 'explore';
        this.updateAll();
        return;
      }
      const enemy = DungeonData.enemies[cell.enemyId];
      this.addLog(`〈${this.randomRoomTitle(enemy)}〉`, "title");
      this.startCombat(cell);
      return;
    }
    if (cell.type === "event") {
      if (cell.resolved) {
        this.addLog('这个房间的事件已经平息。', 'info');
        this.state.phase = 'explore';
        this.updateAll();
        return;
      }
      this.ensureEventState(cell);
      this.addLog(`〈${DungeonData.events[cell.eventId]?.name || "未知事件"}〉`, "title");
      this.state.phase = 'event';
      this.tutorial.stage = 'event';
      this.updateAll();
      return;
    }
    if (cell.type === 'merchant') {
      this.ensureMerchantStock(cell);
      this.addLog(`〈行商的帐篷〉潮湿的纸币不收——灵魂碎片另当别论。`, 'title');
      this.state.phase = 'merchant';
      this.tutorial.stage = 'merchant';
      this.updateAll();
      return;
    }
    if (cell.type === 'camp') {
      if (cell.resolved) {
        this.addLog('营地火堆只剩灰烬，已无法停留。', 'info');
        this.state.phase = 'explore';
        this.updateAll();
        return;
      }
      this.addLog(`〈潮湿营地〉火光驱散了寒意，但腐蚀条在抖动。`, 'title');
      this.state.phase = 'camp';
      this.tutorial.stage = 'camp';
      this.updateAll();
      return;
    }
    if (cell.type === 'treasure') {
      if (cell.resolved) {
        this.addLog('秘藏已被取走，只剩空匣。', 'info');
        this.state.phase = 'explore';
        this.updateAll();
        return;
      }
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
    this.run.currency = this.ensureCurrency() + 60;
    this.addLog('灵魂碎片 +60。', 'score');
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
    if (this.run.player.passiveId === 'soulguard') {
      this.applyStatus(this.run.player, 'guard', 1, 1);
    }
    if (this.run.heroicPromise > 0 && enemy.tier !== 'boss') {
      this.run.combat.dropsGuaranteed = true;
      this.run.heroicPromise -= 1;
    }
    this.state.phase = "combat";
    this.tutorial.stage = 'combat';
    if (this.corruptionTier() >= 3) {
      this.applyStatus(this.run.player, 'corrupt', 1, 3);
      this.addLog('腐蚀在战斗伊始暴走，你身披【腐化】。', 'warn');
    }
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
    const tier = this.corruptionTier();
    const tierLabel = this.corruptionStateLabel();
    const badge = `<span class="status-badge tier-${tier}">${tierLabel}</span>`;
    const currency = this.ensureCurrency();
    const displayName = dungeonEscapeHtml(this.accountDisplayName());
    const className = dungeonEscapeHtml(p.name || '未知');
    node.innerHTML = `
      <div class="dungeon-status-line">【等级】${p.level} 【HP】<span class="hl-hp">${p.hp}/${p.maxHP}</span> 【能量】<span class="hl-energy">${p.energy}/${p.maxEnergy}</span> 【腐蚀】<span class="hl-corrupt">${this.run.corruption}/${this.run.maxCorruption}</span>${badge}</div>
      <div class="dungeon-status-line">【冒险者】${displayName} ｜ 【职业】${className} ｜ 【被动】${this.describePassive()} ｜ 【货币】<span class="hl-coin">${currency}</span></div>
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
      bulwark: "御壁",
      elemental_focus: "灵纹",
      hexweave: "咒缚",
      bloodrush: "血怒",
      inner_peace: "内息",
      tinker: "备用零件",
      wildbond: "野性回响",
      tempest_step: "风暴步",
      soulguard: "魂盾",
      time_loop: "时轮",
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
      .map(([id, v]) => {
        if (id === '__heal') return `治疗(${v})`;
        return `${DungeonData.skills[id]?.name || id}(${v})`;
      });
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
    node.innerHTML = `<div class="command-board"><div class="command-preview">${preview}</div><div class="command-stack">${body}</div></div>`;
    node.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        this.handleCommand(cmd, btn.dataset.arg || null);
      });
    });
    window.AudioEngine?.decorateArea?.(node);
  }

  ensureEventState(cell = this.run?.currentRoom) {
    if (!cell || cell.type !== 'event') return null;
    const event = DungeonData.events[cell.eventId];
    if (!event) return null;
    if (!cell.eventState || cell.eventState.eventId !== event.id) {
      cell.eventState = {
        eventId: event.id,
        options: this.rollEventOptions(event),
      };
    }
    return cell.eventState;
  }

  rollEventOptions(event) {
    const base = Array.isArray(event?.options) && event.options.length
      ? event.options
      : this.defaultEventOptions(event);
    const max = event?.maxOptions && event.maxOptions > 0
      ? Math.min(event.maxOptions, base.length)
      : base.length;
    const picks = this.rng.shuffle(base).slice(0, max).map(opt => ({ ...opt }));
    const hasSkip = picks.some(opt => opt && opt.skip);
    if (!hasSkip) {
      picks.push({ id: 'skip', label: '保持距离', preview: '离开房间，避免未知风险。', skip: true });
    }
    return picks;
  }

  defaultEventOptions(event) {
    if (!event) {
      return [{ id: 'ignore', label: '离开', skip: true }];
    }
    return [
      { id: `${event.id}:interact`, label: '尝试互动', badge: 'mystic', preview: '面对未知的祭坛，结果难料。' },
      { id: 'skip', label: '保持距离', skip: true, preview: '谨慎离开，等待下次机会。' },
    ];
  }

  choiceBadgeLabel(type) {
    const map = {
      danger: '风险',
      mystic: '秘术',
      blessing: '祝福',
      trade: '交易',
      support: '补给',
    };
    return map[type] || '';
  }

  isEventOptionDisabled(option) {
    if (!option || !this.run?.player) return false;
    if (option.requiresCurrency != null) {
      return this.ensureCurrency() < Number(option.requiresCurrency);
    }
    if (option.requiresHeroism != null) {
      return (this.run.player.heroism || 0) < Number(option.requiresHeroism);
    }
    if (option.requiresItem) {
      return !this.run.player.inventory.some(item => item?.id === option.requiresItem && (item.charges == null || item.charges > 0));
    }
    if (option.requiresItemName) {
      const name = option.requiresItemName;
      const hasMatch = this.run.player.inventory.some(item => {
        if (!item || item.charges <= 0) return false;
        if (name === '任意装备') return Boolean(item.slot);
        return item.name === name;
      });
      return !hasMatch;
    }
    return false;
  }

  eventOptionHint(option) {
    if (!option) return '';
    const hints = [];
    if (option.preview) hints.push(option.preview);
    if (option.requiresCurrency != null) hints.push(`需要灵魂碎片 ${option.requiresCurrency}`);
    if (option.requiresHeroism != null) hints.push(`需要勇气 ${option.requiresHeroism}`);
    if (option.requiresItemName) hints.push(`需要 ${option.requiresItemName}`);
    if (this.isEventOptionDisabled(option)) hints.push('条件不足');
    return hints.join(' · ');
  }

  combatCommands() {
    const player = this.run.player;
    const healCd = player.cooldowns.__heal || 0;
    const healDisabled = player.energy < 1 || healCd > 0;
    const healTip = healCd > 0 ? `治疗冷却中（${healCd}回合）` : '消耗1点能量并进入2回合冷却，恢复生命。';
    const baseButtons = `
      <button data-cmd="attack" title="普通攻击：根据攻击力造成伤害。">攻击</button>
      <button data-cmd="defend" title="防御：获得守备，剑士额外获得护甲。">防御</button>
      <button data-cmd="heal" title="${healTip}" ${healDisabled ? 'disabled' : ''}>治疗</button>
      <button data-cmd="run" title="撤退：尝试离开战斗，部分道具可确保成功。">撤退</button>
    `;
    const tacticButtons = `
      <button data-cmd="inspect" title="侦察敌人的词缀与弱点。">侦察</button>
      <button data-cmd="mark" title="标记目标，使其额外受伤。">标记</button>
      <button data-cmd="taunt" title="挑衅敌人，吸引火力。">挑衅</button>
      <button data-cmd="log" title="查看完整战斗记录。">战斗记录</button>
    `;
    const skillButtons = this.availableSkills().map(skill => {
      const cooldown = player.cooldowns[skill.id] || 0;
      const disabled = cooldown > 0 || player.energy < skill.cost;
      const label = `${skill.name}${cooldown > 0 ? `(${cooldown})` : ''}`;
      const tip = `${skill.description || ''}（冷却${skill.cooldown}，耗能${skill.cost}）`;
      return `<button data-cmd="skill" data-arg="${skill.id}" title="${tip}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    }).join("");
    const consumables = this.run.player.inventory
      .map((item, idx) => ({ item, idx }))
      .filter(entry => !entry.item.slot && entry.item.charges > 0);
    const itemButtons = consumables.map(({ item, idx }) => {
      const tip = item.description || '';
      return `<button data-cmd="item" data-arg="${idx}" title="${tip}">${item.name}${item.charges > 1 ? `(${item.charges})` : ''}</button>`;
    }).join("");
    return `
      <div class="command-group">
        <div class="command-title">基础动作</div>
        <div class="command-row">${baseButtons}</div>
        <div class="command-title">战术指令</div>
        <div class="command-row">${tacticButtons}</div>
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
    const moveButtons = moves.map(move => {
      const caution = move.caution ? ' ⚠️' : '';
      const cautionClass = move.caution ? ' class="move-warn"' : '';
      return `<button${cautionClass} data-cmd="move" data-arg="${move.dir}" title="前往：${this.cellPreview(move.cell)}">${move.label}${caution}</button>`;
    }).join('');
    return `
      <div class="command-group">
        <div class="command-title">移动</div>
        <div class="command-row">${moveButtons || '<span class="muted">四面都是坚固石壁</span>'}</div>
        <div class="command-title">准备</div>
        <div class="command-row">
          <button data-cmd="rest" title="恢复生命但腐蚀上升。">原地整备</button>
          <button data-cmd="inventory" title="打开背包界面。">查看背包</button>
          <button data-cmd="map" title="查看关卡地图。">查看地图</button>
          <button data-cmd="leave" title="立即撤离并保留本层战利品。">撤离</button>
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
    const room = this.run.currentRoom;
    const event = DungeonData.events[room.eventId];
    if (!event) {
      return '<div class="command-group"><div class="command-row"><span class="muted">未知事件</span></div></div>';
    }
    const state = this.ensureEventState(room);
    const options = Array.isArray(state?.options) ? state.options : [];
    const rows = options.map(option => {
      const hint = this.eventOptionHint(option);
      if (option.skip) {
        return `
          <div class="event-choice">
            <button data-cmd="skip-event">${option.label || '离开'}</button>
            ${hint ? `<div class="event-choice__hint">${hint}</div>` : ''}
          </div>
        `;
      }
      const disabled = this.isEventOptionDisabled(option);
      const badge = option.badge ? `<span class="choice-badge choice-${option.badge}">${this.choiceBadgeLabel(option.badge)}</span>` : '';
      return `
        <div class="event-choice">
          <button data-cmd="event" data-arg="${event.id}:${option.id}" ${disabled ? 'disabled' : ''}>${option.label || '选择'}${badge}</button>
          ${hint ? `<div class="event-choice__hint">${hint}</div>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div class="command-group event-command-group">
        <div class="command-title">事件抉择</div>
        <div class="event-choice-list">${rows || '<div class="muted">暂无可行选项</div>'}</div>
      </div>
    `;
  }

  merchantCommands() {
    return `
      <div class="command-group">
        <div class="command-title">行商服务</div>
        <div class="command-row">
          <button data-cmd="merchant-buy" title="查看并购买消耗品与装备。">购入补给</button>
          <button data-cmd="merchant-relic" title="以灵魂碎片兑换稀有遗物。">探查遗物</button>
          <button data-cmd="merchant-leave" title="离开行商帐篷，返回探索。">告辞离开</button>
        </div>
      </div>
    `;
  }

  campCommands() {
    return `
      <div class="command-group">
        <div class="command-title">营地选择</div>
        <div class="command-row">
          <button data-cmd="camp-rest" title="大量恢复生命，腐蚀+2。">扎营休息</button>
          <button data-cmd="camp-prepare" title="重置技能冷却，腐蚀+2。">整理装备</button>
          <button data-cmd="camp-pray" title="净化负面状态，腐蚀+2。">祷告净化</button>
          <button data-cmd="camp-leave" title="离开营地，保留决策机会。">继续前进</button>
        </div>
      </div>
    `;
  }

  transitionCommands() {
    return `
      <div class="command-group">
        <div class="command-title">楼梯间</div>
        <div class="command-row">
          <button data-cmd="go-down" title="前往下一层，难度将提升。">继续下行</button>
          <button data-cmd="leave" title="结束冒险并保留战利品。">撤离</button>
        </div>
      </div>
    `;
  }

  sanitizeName(raw, maxLen = 12) {
    if (raw == null) return '';
    let text = String(raw).replace(/[\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim();
    if (maxLen && text.length > maxLen) text = text.slice(0, maxLen);
    return text;
  }

  nameKey(name, maxLen = 12) {
    const cleaned = this.sanitizeName(name, maxLen);
    return cleaned ? cleaned.toLowerCase() : '__anon__';
  }

  accountDisplayName(maxLen = 32) {
    const apiName = (typeof API !== 'undefined' && API._me && API._me.username)
      ? API._me.username
      : '';
    const fallback = this.profile?.name || '';
    const raw = apiName || fallback || '';
    const sanitized = this.sanitizeName(raw, maxLen);
    if (sanitized) {
      if (!this.profile) this.profile = {};
      if (this.profile.name !== sanitized) {
        this.profile = { ...this.profile, name: sanitized };
        DungeonStorage.saveProfile(this.profile);
      }
      return sanitized;
    }
    return '无名冒险者';
  }

  normalizeScoreEntry(entry = {}) {
    if (!entry || typeof entry !== 'object') return null;
    const score = Math.max(0, Math.round(Number(entry.score) || 0));
    const heroism = Math.max(0, Math.round(Number(entry.heroism) || 0));
    const floor = Math.max(1, Math.round(Number(entry.floor) || 1));
    const victory = !!entry.victory;
    const timestamp = Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now();
    const classId = typeof entry.classId === 'string' ? entry.classId : null;
    const aliasRaw = entry.alias != null ? entry.alias : (entry.playerName != null ? entry.playerName : entry.name);
    const accountRaw = entry.username != null ? entry.username : (entry.accountName != null ? entry.accountName : entry.name);
    const preferredRaw = entry.name != null ? entry.name : accountRaw;
    const alias = this.sanitizeName(aliasRaw || '', 12);
    let display = this.sanitizeName(preferredRaw || '', 32);
    if (!display) {
      display = this.sanitizeName(accountRaw || '', 32);
    }
    if (!display) {
      display = alias;
    }
    if (!display) {
      display = '无名冒险者';
    }
    const accountKey = (accountRaw && typeof accountRaw === 'string')
      ? accountRaw.trim().toLowerCase()
      : (display ? display.toLowerCase() : null);
    return { score, heroism, floor, victory, timestamp, classId, name: display, alias, accountKey };
  }

  normalizeScoreList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(entry => this.normalizeScoreEntry(entry)).filter(Boolean).slice(0, 40);
  }

  uniqueTopScores(limit = 5) {
    const sorted = this.scores
      .slice()
      .sort((a, b) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        if ((b.victory ? 1 : 0) !== (a.victory ? 1 : 0)) return (b.victory ? 1 : 0) - (a.victory ? 1 : 0);
        if ((b.floor || 0) !== (a.floor || 0)) return (b.floor || 0) - (a.floor || 0);
        if ((b.heroism || 0) !== (a.heroism || 0)) return (b.heroism || 0) - (a.heroism || 0);
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
    const seen = new Set();
    const top = [];
    sorted.forEach(entry => {
      const key = entry.accountKey || this.nameKey(entry.name, 32);
      if (seen.has(key)) return;
      seen.add(key);
      top.push(entry);
    });
    return top.slice(0, limit);
  }

  renderScoreboard(targetId) {
    let node = null;
    if (targetId) node = this.root.querySelector(`#${targetId}`);
    if (!node) node = this.root.querySelector('#dungeon-panel-score');
    if (!node) node = this.root.querySelector('#dungeon-intro-scores');
    if (!node) return;
    const recent = this.scores.slice(0, 5);
    const top = this.uniqueTopScores(5);
    const format = entry => {
      const date = new Date(entry.timestamp);
      const time = Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '-';
      const badge = entry.victory ? '<span class="score-badge victory">通关</span>' : '<span class="score-badge defeat">殒落</span>';
      const name = `<span class="score-name">${dungeonEscapeHtml(entry.name)}</span>`;
      const className = entry.classId ? DungeonData.classes[entry.classId]?.name : '';
      const classLabel = className ? `<span class="score-class">${dungeonEscapeHtml(className)}</span>` : '';
      const meta = `<span class="score-meta">第${entry.floor}层 · ${time}</span>`;
      return `<li><span class="score-value">${entry.score}</span>${name}${classLabel}${badge}${meta}</li>`;
    };
    const topFormat = (entry, idx) => {
      const name = `<span class="score-name">${dungeonEscapeHtml(entry.name)}</span>`;
      const className = entry.classId ? DungeonData.classes[entry.classId]?.name : '';
      const classLabel = className ? `<span class="score-class">${dungeonEscapeHtml(className)}</span>` : '';
      const status = entry.victory ? '通关' : '未竟';
      const meta = `<span class="score-meta">#${idx + 1} · 第${entry.floor}层 · ${status} · 勇气${entry.heroism}</span>`;
      return `<li><span class="score-rank">${entry.score}</span>${name}${classLabel}${meta}</li>`;
    };
    const context = node.dataset?.context || 'run';
    const currentBlock = context === 'intro'
      ? ''
      : `<div class="score-current">本次积分：<span class="hl-score">${this.run?.score || 0}</span></div>`;
    node.innerHTML = `
      <div class="panel-title">积分记录</div>
      ${currentBlock}
      <div class="score-section">
        <div class="score-section__title">最近记录</div>
        <ul>${recent.map(format).join('') || '<li class="muted">暂无记录</li>'}</ul>
      </div>
      <div class="score-section">
        <div class="score-section__title">排行榜</div>
        <ul>${top.map((entry, idx) => topFormat(entry, idx)).join('') || '<li class="muted">暂无高分</li>'}</ul>
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
    const username = entry && entry.username != null
      ? entry.username
      : ((typeof API !== 'undefined' && API._me && API._me.username) ? API._me.username : (entry && entry.name));
    const displayName = entry && entry.name != null
      ? entry.name
      : this.accountDisplayName();
    const payload = this.normalizeScoreEntry({
      ...entry,
      score: entry.score,
      victory: !!entry.victory,
      floor: entry.floor || (this.run?.floorIndex + 1) || 1,
      heroism: entry.heroism != null ? entry.heroism : (this.run?.player?.heroism || 0),
      timestamp: entry.timestamp || Date.now(),
      alias: '',
      username,
      name: displayName,
      classId: entry.classId || this.run?.player?.classId || null,
    });
    if (!payload) return;
    this.scores.unshift(payload);
    this.scores = this.scores.slice(0, 16);
    DungeonStorage.saveScores(this.scores);
    this.renderScoreboard();
  }

  renderInventory() {
    const node = this.root.querySelector('#dungeon-panel-inventory');
    if (!node) return;
    node.innerHTML = `
      <div class="panel-title">背包</div>
      ${this.inventoryMarkup({ mode: 'panel' })}
    `;
    this.bindInventoryActions(node);
    const expand = node.querySelector('[data-overlay-open="inventory"]');
    if (expand) {
      expand.addEventListener('click', () => {
        this.openOverlay('inventory');
      });
    }
  }

  inventoryMarkup({ mode = 'panel' } = {}) {
    const player = this.run?.player;
    if (!player) return '<div class="muted">尚未开局。</div>';
    const showDescriptions = mode !== 'panel';
    const showActions = true;
    const currency = this.ensureCurrency();
    const consumables = [];
    const equipmentBag = [];
    player.inventory.forEach((item, idx) => {
      if (!item) return;
      if (item.slot) equipmentBag.push({ item, idx });
      else consumables.push({ item, idx });
    });
    const slotLabel = slot => ({ weapon: '武器', armor: '护甲', ring: '戒指', amulet: '护符', glove: '手套', boots: '靴子', shield: '盾牌' }[slot] || slot || '装备');
    const renderEntries = (entries, { emptyText }) => {
      if (!entries.length) return `<li class="muted">${emptyText}</li>`;
      return entries.map(({ item, idx }) => {
        const rarity = item.rarity || 'common';
        const tags = [];
        if (item.slot) tags.push(`<span class="item-tag rarity-${rarity}">${slotLabel(item.slot)}</span>`);
        if (item.equipped) tags.push('<span class="item-tag equipped">已装备</span>');
        if (item.effect?.imbue === 'ember') tags.push('<span class="item-tag ember">余烬</span>');
        const actions = [];
        if (item.slot) actions.push(`<button data-inv-action="equip" data-idx="${idx}">装备</button>`);
        if (!item.slot && this.canUseItemOutsideCombat(item)) actions.push(`<button data-inv-action="use" data-idx="${idx}">使用</button>`);
        const desc = item.description ? `<div class="item-desc">${item.description}</div>` : '';
        const detail = showDescriptions ? desc : '';
        const info = item.effect?.charges && item.charges === undefined ? ` ×${item.effect.charges}` : '';
        const charges = item.charges > 1 ? ` ×${item.charges}` : info;
        return `
          <li>
            <div class="item-line"><span class="item-name rarity-${rarity}">${item.name}${charges || ''}</span>${tags.join('')}</div>
            ${detail}
            ${actions.length && showActions ? `<div class="item-actions">${actions.join('')}</div>` : ''}
          </li>
        `;
      }).join('');
    };
    const equipped = Object.entries(player.equipment).map(([slot, item]) => `<li>${slotLabel(slot)}：<span class="item-name rarity-${item?.rarity || 'common'}">${item?.name || '无'}</span></li>`).join('');
    const overlayHint = mode === 'panel' ? '<button class="inventory-expand" data-overlay-open="inventory">查看全部详情</button>' : '';
    return `
      <div class="dungeon-inventory-currency">灵魂碎片：<span class="hl-coin">${currency}</span></div>
      <div class="dungeon-inventory-section">
        <div class="dungeon-inventory-section__title">消耗品</div>
        <ul>${renderEntries(consumables, { emptyText: '暂无消耗品' })}</ul>
      </div>
      <div class="dungeon-inventory-section">
        <div class="dungeon-inventory-section__title">已装备</div>
        <ul>${equipped || '<li class="muted">未装备</li>'}</ul>
      </div>
      <div class="dungeon-inventory-section">
        <div class="dungeon-inventory-section__title">未装备</div>
        <ul>${renderEntries(equipmentBag.filter(({ item }) => !item.equipped), { emptyText: '暂无备用装备' })}</ul>
      </div>
      ${overlayHint}
    `;
  }

  bindInventoryActions(rootNode) {
    if (!rootNode) return;
    rootNode.querySelectorAll('button[data-inv-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleInventoryAction(btn.dataset.invAction, Number(btn.dataset.idx));
      });
    });
  }

  openOverlay(type, payload = {}) {
    this.state.overlay = { type, payload };
    this.renderOverlay();
  }

  closeOverlay() {
    this.state.overlay = null;
    const node = this.root.querySelector('#dungeon-overlay');
    if (node) {
      node.classList.add('is-hidden');
      node.innerHTML = '';
    }
  }

  renderOverlay() {
    const node = this.root.querySelector('#dungeon-overlay');
    if (!node) return;
    const overlay = this.state.overlay;
    if (!overlay) {
      node.classList.add('is-hidden');
      node.innerHTML = '';
      return;
    }
    const { type } = overlay;
    const payload = overlay.payload || {};
    const { title, body } = this.overlayContent(type, payload);
    node.innerHTML = `
      <div class="overlay-backdrop" data-overlay-close></div>
      <div class="overlay-content">
        <div class="overlay-head">
          <div class="overlay-title">${title}</div>
          <button class="overlay-close" data-overlay-close>×</button>
        </div>
        <div class="overlay-body">${body}</div>
      </div>
    `;
    node.classList.remove('is-hidden');
    node.querySelectorAll('[data-overlay-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeOverlay());
    });
    this.bindOverlayInteractions(type, node);
    window.AudioEngine?.decorateArea?.(node);
  }

  relativeTime(timestamp) {
    if (!Number.isFinite(Number(timestamp))) return '刚刚';
    const delta = Date.now() - Number(timestamp);
    if (delta < 15000) return '刚刚';
    if (delta < 60000) return `${Math.max(1, Math.round(delta / 1000))} 秒前`;
    if (delta < 3600000) return `${Math.max(1, Math.round(delta / 60000))} 分钟前`;
    try {
      return new Date(Number(timestamp)).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      void err;
      return '稍早之前';
    }
  }

  renderSaveBanner() {
    const node = this.root.querySelector('#dungeon-save-banner');
    if (!node) return;
    if (!this.run) {
      node.innerHTML = '<div class="dungeon-save-banner__message">冒险过程中将自动存档，可随时中断。</div>';
      return;
    }
    const finished = this._finished;
    const timeLabel = this.relativeTime(this._lastPersistAt);
    const status = finished
      ? '冒险已记录，可在需要时重新启程。'
      : `自动存档已启用 · 上次保存${timeLabel}`;
    const actionLabel = finished ? '返回入口' : '重置旅途';
    const cmd = finished ? 'restart-run' : 'retreat-run';
    node.innerHTML = `
      <div class="dungeon-save-banner__message">${status}</div>
      <button class="dungeon-save-banner__action" data-cmd="${cmd}">${actionLabel}</button>
    `;
    node.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleCommand(btn.dataset.cmd, btn.dataset.arg || null);
      });
    });
  }

  overlayContent(type, payload = {}) {
    switch (type) {
      case 'map':
        return { title: '关卡地图', body: this.progressMarkup() };
      case 'status':
        return { title: '状态总览', body: this.statusMarkup() };
      case 'bestiary':
        return { title: '敌典情报', body: this.bestiaryMarkup() };
      case 'relics':
        return { title: '遗物列表', body: this.relicsMarkup() };
      case 'log':
        return { title: '战斗记录', body: this.logMarkup() };
      case 'inventory':
        return { title: '背包详情', body: this.inventoryMarkup({ mode: 'overlay' }) };
      case 'merchant-items':
        return { title: '行商补给', body: this.merchantItemsMarkup(payload) };
      case 'merchant-relics':
        return { title: '遗物交换', body: this.merchantRelicsMarkup(payload) };
      case 'retreat':
        return {
          title: '撤离古井',
          body: `
            <div class="dungeon-retreat">
              <p>确认要结束当前冒险吗？已探索的进度会保存到排行榜中，你可以随时从入口重新开始。</p>
              <div class="dungeon-retreat__actions">
                <button class="primary" data-retreat-action="confirm">确认撤离</button>
                <button data-retreat-action="cancel">再想想</button>
              </div>
            </div>
          `,
        };
      default:
        return { title: '记录', body: '<div class="muted">暂无内容。</div>' };
    }
  }

  bindOverlayInteractions(type, node) {
    if (!node) return;
    if (type === 'inventory') {
      this.bindInventoryActions(node);
      return;
    }
    if (type === 'merchant-items') {
      node.querySelectorAll('[data-merchant-buy]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.purchaseMerchantItem(btn.dataset.merchantBuy);
        });
      });
    }
    if (type === 'merchant-relics') {
      node.querySelectorAll('[data-merchant-relic]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.purchaseMerchantRelic(btn.dataset.merchantRelic);
        });
      });
    }
    if (type === 'retreat') {
      node.querySelectorAll('[data-retreat-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.retreatAction;
          if (action === 'confirm') {
            this.retreatCurrentRun();
          } else {
            this.closeOverlay();
          }
        });
      });
    }
  }

  corruptionTierFor(value) {
    const max = this.run?.maxCorruption || 10;
    if (value >= max) return 3;
    if (value >= Math.ceil(max * 0.8)) return 2;
    if (value >= Math.ceil(max * 0.5)) return 1;
    return 0;
  }

  corruptionTier() {
    return this.corruptionTierFor(this.run?.corruption || 0);
  }

  corruptionStateLabel() {
    const labels = ['稳定', '浸染', '溢出', '暴走'];
    return labels[this.corruptionTier()] || '未知';
  }

  adjustCorruption(delta = 0) {
    if (!this.run) return;
    const before = this.run.corruption;
    const beforeTier = this.corruptionTierFor(before);
    const max = this.run.maxCorruption || 10;
    const next = Math.min(max, Math.max(0, before + delta));
    this.run.corruption = next;
    const afterTier = this.corruptionTierFor(next);
    this.run.player.flags = this.run.player.flags || {};
    this.run.player.flags.corruptionTier = afterTier;
    if (next >= max) {
      if (!this.run.player.flags.maxCorruptActive) {
        this.run.player.flags.maxCorruptActive = true;
        this.applyMaxCorruptionPenalty();
      }
    } else {
      this.run.player.flags.maxCorruptActive = false;
    }
    if (afterTier !== beforeTier) {
      this.applyCorruptionEffects(beforeTier, afterTier);
    }
  }

  applyCorruptionEffects(beforeTier, afterTier) {
    if (afterTier > beforeTier) {
      if (afterTier === 1) this.addLog('腐蚀浸入血脉，治疗效果降低。', 'warn');
      if (afterTier === 2) this.addLog('腐蚀溢出，你感到潮汐的压迫。', 'warn');
      if (afterTier >= 3) this.addLog('腐蚀爆满，追猎者紧盯着你的气息！', 'announce');
    } else if (afterTier < beforeTier) {
      this.addLog('腐蚀暂时缓解，呼吸变得顺畅。', 'good');
    }
  }

  currentMerchantRoom() {
    if (this.run?.currentRoom?.type === 'merchant') return this.run.currentRoom;
    return null;
  }

  ensureMerchantStock(room) {
    if (!room) return null;
    if (!room.merchantStock) {
      room.merchantStock = this.generateMerchantStock();
    }
    return room.merchantStock;
  }

  generateMerchantStock() {
    const depth = this.run?.floorIndex || 0;
    const makeKey = prefix => `${prefix}-${Math.floor(this.rng.random() * 1e7)}`;
    const items = [];
    const consumablePool = this.rng.shuffle(Object.keys(DungeonData.consumables)).slice(0, 4);
    consumablePool.forEach((id, idx) => {
      const def = DungeonData.consumables[id];
      if (!def) return;
      const base = 36 + idx * 9 + Math.round(this.rng.random() * 12);
      const cost = base + depth * 14;
      items.push({
        key: makeKey('c'),
        type: 'consumable',
        id,
        name: def.name,
        description: def.description,
        cost,
        sold: false,
        data: { ...def },
      });
    });
    const equipmentPool = this.rng.shuffle(Object.keys(DungeonData.equipments)).slice(0, 3);
    equipmentPool.forEach((id, idx) => {
      const def = DungeonData.equipments[id];
      if (!def) return;
      const base = 120 + idx * 35 + Math.round(this.rng.random() * 30);
      const cost = base + depth * 45;
      items.push({
        key: makeKey('e'),
        type: 'equipment',
        id,
        name: def.name,
        description: def.description,
        cost,
        sold: false,
        data: { ...def },
      });
    });
    const relicPool = this.rng.shuffle(Object.keys(DungeonData.relics)).slice(0, 3);
    const relics = relicPool.map((id, idx) => {
      const def = DungeonData.relics[id];
      const base = 210 + idx * 70 + Math.round(this.rng.random() * 40);
      const cost = base + depth * 60;
      return {
        key: makeKey('r'),
        id,
        name: def?.name || id,
        description: def?.effect || '',
        cost,
        sold: false,
      };
    });
    return { items, relics };
  }

  merchantItemsMarkup() {
    const room = this.currentMerchantRoom();
    const stock = this.ensureMerchantStock(room);
    if (!stock) return '<div class="muted">行商不在此处。</div>';
    const currency = this.ensureCurrency();
    const entries = stock.items.map(entry => {
      const disabled = entry.sold || currency < entry.cost;
      const state = entry.sold
        ? '<span class="item-tag sold">已售罄</span>'
        : `<button data-merchant-buy="${entry.key}" ${disabled ? 'disabled' : ''}>购入</button>`;
      const rarity = entry.type === 'equipment' ? entry.data?.rarity || 'common' : 'common';
      const typeLabel = entry.type === 'equipment' ? '装备' : '消耗品';
      return `
        <li class="merchant-line ${entry.sold ? 'is-sold' : ''}">
          <div class="item-line"><span class="item-name rarity-${rarity}">${entry.name}</span><span class="item-tag">${typeLabel}</span><span class="item-price">${entry.cost} 碎片</span></div>
          <div class="muted">${entry.description || ''}</div>
          <div class="item-actions">${state}</div>
        </li>
      `;
    }).join('');
    return `
      <div class="merchant-currency">当前拥有：<span class="hl-coin">${currency}</span> 灵魂碎片</div>
      <ul class="info-list">${entries || '<li class="muted">库存已清空</li>'}</ul>
    `;
  }

  merchantRelicsMarkup() {
    const room = this.currentMerchantRoom();
    const stock = this.ensureMerchantStock(room);
    if (!stock) return '<div class="muted">暂无遗物可换。</div>';
    const currency = this.ensureCurrency();
    const player = this.run?.player;
    const entries = stock.relics.map(entry => {
      const owned = player?.relics?.includes(entry.id);
      const disabled = entry.sold || owned || currency < entry.cost;
      const state = entry.sold
        ? '<span class="item-tag sold">已售罄</span>'
        : owned
          ? '<span class="item-tag owned">已拥有</span>'
          : `<button data-merchant-relic="${entry.key}" ${disabled ? 'disabled' : ''}>兑换</button>`;
      return `
        <li class="merchant-line ${entry.sold ? 'is-sold' : ''}">
          <div class="item-line"><span class="item-name rarity-purple">${entry.name}</span><span class="item-price">${entry.cost} 碎片</span></div>
          <div class="muted">${entry.description || ''}</div>
          <div class="item-actions">${state}</div>
        </li>
      `;
    }).join('');
    return `
      <div class="merchant-currency">当前拥有：<span class="hl-coin">${currency}</span> 灵魂碎片</div>
      <ul class="info-list">${entries || '<li class="muted">遗物已售罄</li>'}</ul>
    `;
  }

  purchaseMerchantItem(key) {
    const room = this.currentMerchantRoom();
    const stock = this.ensureMerchantStock(room);
    if (!stock) { this.addLog('行商不在此处。', 'warn'); return; }
    const entry = stock.items.find(item => item.key === key);
    if (!entry) return;
    if (entry.sold) { this.addLog('这件物品已被购走。', 'warn'); return; }
    const current = this.ensureCurrency();
    if (current < entry.cost) { this.addLog('灵魂碎片不足。', 'warn'); return; }
    this.run.currency = Math.max(0, current - entry.cost);
    entry.sold = true;
    if (entry.type === 'consumable') {
      this.run.player.inventory.push({ ...entry.data, charges: entry.data.effect?.charges || 1 });
    } else if (entry.type === 'equipment') {
      this.run.player.inventory.push({ ...entry.data, charges: 1 });
    }
    this.addLog(`你购买了${entry.name}，灵魂碎片-${entry.cost}。`, 'good');
    this.updateAll();
  }

  purchaseMerchantRelic(key) {
    const room = this.currentMerchantRoom();
    const stock = this.ensureMerchantStock(room);
    if (!stock) { this.addLog('此处没有遗物可换。', 'warn'); return; }
    const entry = stock.relics.find(item => item.key === key);
    if (!entry) return;
    if (entry.sold) { this.addLog('遗物已被取走。', 'warn'); return; }
    if (this.run.player.relics.includes(entry.id)) { this.addLog('你已经拥有该遗物。', 'warn'); return; }
    const current = this.ensureCurrency();
    if (current < entry.cost) { this.addLog('灵魂碎片不足以兑换。', 'warn'); return; }
    this.run.currency = Math.max(0, current - entry.cost);
    entry.sold = true;
    if (!this.run.player.relics.includes(entry.id)) this.run.player.relics.push(entry.id);
    this.addLog(`你兑换了遗物【${entry.name}】。`, 'goal');
    this.updateAll();
  }

  statusMarkup() {
    const player = this.run?.player;
    if (!player) return '<div class="muted">尚未开局。</div>';
    const corruption = `${this.run.corruption}/${this.run.maxCorruption}`;
    const tierLabel = this.corruptionStateLabel();
    const statuses = this.describeEntityStatus(player, true);
    const cooldowns = Object.entries(player.cooldowns || {})
      .filter(([, v]) => v > 0)
      .map(([id, v]) => {
        if (id === '__heal') return `治疗(${v})`;
        return `${DungeonData.skills[id]?.name || id}(${v})`;
      });
    const relics = player.relics.map(id => DungeonData.relics[id]?.name || id).join('、');
    const passive = this.describePassive();
    return `
      <div class="status-overview">
        <div class="status-row"><span>生命</span><span class="hl-hp">${player.hp}/${player.maxHP}</span></div>
        <div class="status-row"><span>能量</span><span class="hl-energy">${player.energy}/${player.maxEnergy}</span></div>
        <div class="status-row"><span>腐蚀</span><span class="hl-corrupt">${corruption}</span><span class="status-badge tier-${this.corruptionTier()}">${tierLabel}</span></div>
        <div class="status-row"><span>勇气</span><span class="hl-heroism">${player.heroism}</span></div>
        <div class="status-row"><span>连胜</span><span>${player.streak}</span></div>
        <div class="status-row"><span>灵魂碎片</span><span class="hl-coin">${this.run?.currency ?? 0}</span></div>
        <div class="status-row"><span>职业被动</span><span>${passive}</span></div>
      </div>
      <div class="status-section">
        <div class="status-section__title">当前状态</div>
        <div class="status-section__body">${statuses}</div>
      </div>
      <div class="status-section">
        <div class="status-section__title">技能冷却</div>
        <div class="status-section__body">${cooldowns.length ? cooldowns.join('、') : '无'}</div>
      </div>
      <div class="status-section">
        <div class="status-section__title">遗物</div>
        <div class="status-section__body">${relics || '暂无遗物'}</div>
      </div>
    `;
  }

  bestiaryMarkup() {
    const player = this.run?.player;
    if (!player) return '<div class="muted">尚未记录敌人。</div>';
    const entries = Array.from(player.bestiary).map(id => {
      const enemy = DungeonData.enemies[id];
      return `<li><span class="text-enemy">${enemy?.name || id}</span><span class="muted"> · 弱点：${enemy?.weakness.join('、') || '未知'}</span><div class="muted">${enemy?.flavor || ''}</div></li>`;
    }).join('');
    return `<ul class="info-list">${entries || '<li class="muted">尚无记录</li>'}</ul>`;
  }

  relicsMarkup() {
    const player = this.run?.player;
    if (!player) return '<div class="muted">尚未获得遗物。</div>';
    const entries = player.relics.map(id => {
      const relic = DungeonData.relics[id];
      return `<li><span class="text-relic">${relic?.name || id}</span><span class="muted"> · ${relic?.effect || ''}</span></li>`;
    }).join('');
    return `<ul class="info-list">${entries || '<li class="muted">暂无遗物</li>'}</ul>`;
  }

  logMarkup() {
    if (!this.logEntries.length) return '<div class="muted">暂无记录</div>';
    return `<div class="overlay-log">${this.logEntries.slice(-120).map(entry => `<div class="log-entry ${entry.type}">${entry.text}</div>`).join('')}</div>`;
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
    this.maybeTinkerRefund(item);
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
        { icon: '🗺️', text: '使用“查看地图”指令打开关卡全图，营地与商人位置一目了然。' },
        { icon: '📖', text: '点击指令即可打开图鉴与遗物面板，熟悉敌人弱点与被动效果。' },
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

  dismissTutorial(reason = 'auto') {
    if (!this.tutorial || this.tutorial.hidden) return;
    this.tutorial.hidden = true;
    this.tutorial.dismissedReason = reason;
    this.clearTutorialTimer();
    this.addLog('新手指引渐渐淡去，你已能独当一面。', 'info');
    this.renderGuide();
  }

  registerTutorialAction(cmd) {
    if (!this.tutorial || this.tutorial.hidden) return;
    const ignore = new Set(['status', 'bestiary', 'relics', 'map', 'log']);
    if (ignore.has(cmd)) return;
    this.tutorial.actions = (this.tutorial.actions || 0) + 1;
    if (this.tutorial.actions >= 12) {
      this.dismissTutorial('actions');
    }
  }

  renderGuide() {
    const node = this.root.querySelector('#dungeon-inline-guide');
    if (!node) return;
    if (this.tutorial?.expiresAt && !this.tutorial.hidden && Date.now() >= this.tutorial.expiresAt) {
      this.dismissTutorial('time');
    }
    if (this.tutorial?.hidden) {
      node.innerHTML = '';
      node.classList.add('is-hidden');
      return;
    }
    node.classList.remove('is-hidden');
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

  clearTutorialTimer() {
    if (this._tutorialTimer) {
      clearTimeout(this._tutorialTimer);
      this._tutorialTimer = null;
    }
  }

  scheduleTutorialTimeout() {
    this.clearTutorialTimer();
    if (!this.tutorial || this.tutorial.hidden) return;
    const remain = Math.max(0, (this.tutorial.expiresAt || 0) - Date.now());
    if (typeof window === 'undefined') return;
    this._tutorialTimer = window.setTimeout(() => {
      this.dismissTutorial('time');
      this.renderGuide();
    }, remain);
  }

  ensureCurrency() {
    if (!this.run) return 0;
    const value = Number(this.run.currency);
    if (Number.isNaN(value)) {
      this.run.currency = 0;
      return 0;
    }
    this.run.currency = Math.max(0, value);
    return this.run.currency;
  }

  applyCorruptionPressure(context = 'move') {
    const tier = this.corruptionTier();
    if (tier <= 0) return false;
    const player = this.run?.player;
    if (!player) return false;
    const effects = [];
    if (tier >= 1 && player.energy > 0) {
      player.energy -= 1;
      effects.push('能量 -1');
    }
    if (tier >= 2) {
      const pressure = tier === 2 ? 2 : 4;
      const applied = this.applyPlayerDamage(pressure, { silent: true });
      if (applied > 0) effects.push(`受到 ${applied} 点伤害`);
      if (this.handlePlayerDown()) return true;
    }
    if (tier >= 3) {
      if (!this.hasStatus(player, 'corrupt')) {
        this.applyStatus(player, 'corrupt', 1, 2);
      }
      effects.push('腐化缠身');
    }
    if (effects.length) {
      const prefix = context === 'rest' ? '静坐之际腐蚀翻涌' : '腐蚀潮水席卷';
      this.addLog(`${prefix}：${effects.join('，')}。`, 'warn');
    }
    return false;
  }

  applyMaxCorruptionPenalty() {
    const player = this.run?.player;
    if (!player) return;
    const effects = [];
    if (player.energy > 0) {
      const drained = Math.min(2, player.energy);
      player.energy -= drained;
      if (drained > 0) effects.push(`能量 -${drained}`);
    }
    const damage = this.applyPlayerDamage(6, { silent: true });
    if (damage > 0) effects.push(`受到 ${damage} 点伤害`);
    this.applyStatus(player, 'slow', 1, 2);
    this.applyStatus(player, 'corrupt', 1, 3);
    effects.push('陷入【缓速】【腐化】');
    this.addLog(`腐蚀条爆满，追猎者咬噬：${effects.join('，')}。`, 'danger');
    this.handlePlayerDown();
  }

  progressMarkup() {
    if (!this.run?.floors) {
      return '<div class="muted">尚未踏入古井。</div>';
    }
    const floorsHtml = this.run.floors.map((floor, idx) => {
      const active = idx === this.run.floorIndex;
      const stateClass = active ? 'is-active' : (idx < this.run.floorIndex ? 'is-cleared' : '');
      const rows = floor.map?.cells?.map((row, y) => {
        const cellsHtml = row.map((cell, x) => {
          const classes = ['map-cell', `type-${cell.type}`];
          if (!cell.revealed && cell.type !== 'start') classes.push('is-hidden');
          if (!cell.revealed && cell.hint) classes.push('has-hint');
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
    return `<div class="progress-floors">${floorsHtml}</div>`;
  }

  renderLog() {
    const node = this.root.querySelector('#dungeon-log');
    if (!node) return;
    const entries = Array.isArray(this.logEntries) ? this.logEntries.slice(0, 80) : [];
    node.innerHTML = entries.map(entry => `<div class="log-entry ${entry.type}">${entry.text}</div>`).join("");
    node.scrollTop = 0;
  }

  addLog(text, type = "info") {
    if (!Array.isArray(this.logEntries)) this.logEntries = [];
    this.logEntries.unshift({ text, type });
    if (this.logEntries.length > 160) {
      this.logEntries.length = 160;
    }
    this.renderLog();
    if (!this._restoring) this.persistState();
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
    const overlayCommands = new Set(['map', 'status', 'bestiary', 'relics', 'log', 'inventory', 'merchant-buy', 'merchant-relic']);
    if (!overlayCommands.has(cmd)) this.closeOverlay();
    this.registerTutorialAction(cmd);
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
        this.openOverlay('log');
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
        this.openOverlay('inventory');
        break;
      case 'map':
        this.addLog('你展开地图，未知房间以问号标记。', 'info');
        this.openOverlay('map');
        break;
      case 'status':
        this.addLog(`状态：HP ${this.run.player.hp}/${this.run.player.maxHP}，腐蚀 ${this.run.corruption}/${this.run.maxCorruption}。`, 'info');
        this.openOverlay('status');
        break;
      case 'bestiary':
        this.addLog('你翻阅图鉴，回忆敌人的弱点。', 'info');
        this.openOverlay('bestiary');
        break;
      case 'relics':
        this.addLog('你感受遗物的脉动，它们等待被唤醒。', 'info');
        this.openOverlay('relics');
        break;
      case 'leave':
        this.openOverlay('retreat');
        break;
      case 'retreat-run':
        this.openOverlay('retreat');
        break;
      case 'event':
        this.resolveEvent(arg);
        break;
      case 'skip-event':
        this.addLog('你选择保持谨慎，暂不触碰。', 'info');
        if (this.run.currentRoom) {
          this.run.currentRoom.resolved = true;
          if (this.run.currentRoom.eventState) this.run.currentRoom.eventState.resolved = 'skip';
        }
        this.state.phase = 'explore';
        this.tutorial.stage = 'explore';
        this.updateAll();
        break;
      case 'merchant-buy':
        this.openOverlay('merchant-items');
        break;
      case 'merchant-relic':
        this.openOverlay('merchant-relics');
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
    dmg = this.applyBloodrushBonus(dmg);
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
      if (player.passiveId === 'hexweave' && !this.hasStatus(enemy, 'corrupt')) {
        this.applyStatus(enemy, 'corrupt', 1, 3);
      }
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
    if (player.passiveId === 'bulwark') {
      const healed = this.healPlayer(2, { source: 'bulwark', context: 'combat' });
      if (healed > 0) this.addLog(`御壁：防御恢复 ${healed} 点生命。`, 'good');
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
    const tier = this.corruptionTier();
    if (tier === 1) value = Math.round(value * 0.8);
    if (tier === 2) value = Math.round(value * 0.65);
    if (tier >= 3) value = Math.round(value * 0.5);
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
    const cd = player.cooldowns.__heal || 0;
    if (cd > 0) {
      this.addLog(`治疗冷却中（${cd}）。`, 'warn');
      return;
    }
    player.energy -= 1;
    player.cooldowns.__heal = 2;
    const healed = this.healPlayer(12, { context: 'combat' });
    this.addLog(`你调整呼吸，恢复 ${healed} 点生命。`, 'player');
    this.triggerInnerPeace('heal');
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
      this.triggerInnerPeace('skill');
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
    if (skillId === 'chi_wave') {
      const healed = this.healPlayer(18, { source: 'chi_wave', context: 'combat' });
      this.applyStatus(player, 'guard', 1, 1);
      this.applyStatus(player, 'inspire', 1, 3);
      this.addLog(`气浪疗息恢复 ${healed} 点生命，灵息护体。`, 'good');
      this.triggerInnerPeace('skill');
      this.enemyTurn();
      return;
    }
    if (skillId === 'nature_bloom') {
      const healed = this.healPlayer(16, { source: 'nature_bloom', context: 'combat' });
      this.applyStatus(player, 'inspire', 1, 3);
      this.adjustCorruption(-1);
      this.addLog(`森灵绽放包裹住你，恢复 ${healed} 点生命并驱散些许腐蚀。`, 'good');
      this.triggerInnerPeace('skill');
      this.enemyTurn();
      return;
    }
    let dmg = player.attack + Math.floor(this.rng.random() * 4);
    if (skill.type === 'arcane') dmg += this.equipmentBonus('spellPower') || 0;
    let extraHit = 0;
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
    if (skillId === 'whirlwind') {
      dmg = Math.round(dmg * 1.1);
      this.applyStatus(combat.enemy, 'shattered', 1, 2);
      this.addLog('回旋斩撕裂了敌人的护甲。', 'player');
    }
    if (skillId === 'frost_ring') {
      dmg = Math.round(dmg * 0.95) + 2;
      if (!this.hasStatus(combat.enemy, 'slow')) this.applyStatus(combat.enemy, 'slow', 1, 2);
      this.applyStatus(combat.enemy, 'wet', 1, 2);
      this.addLog('冰环冻结空气，敌人动作迟缓。', 'player');
    }
    if (skillId === 'hex_bolt') {
      dmg = Math.round(dmg * 0.9) + 4;
      if (!this.hasStatus(combat.enemy, 'corrupt')) this.applyStatus(combat.enemy, 'corrupt', 1, 3);
      if (this.rng.random() < 0.35) this.applyStatus(combat.enemy, 'slow', 1, 2);
      this.addLog('咒缚电矢撕裂了敌人的意志。', 'player');
    }
    if (skillId === 'smite') {
      if (this.hasStatus(combat.enemy, 'corrupt')) dmg = Math.round(dmg * 1.25);
      this.addLog('圣光惩戒，驱散腐化。', 'player');
    }
    if (skillId === 'fury_slash') {
      dmg = Math.round(dmg * 1.25) + 3;
      this.applyStatus(combat.enemy, 'shattered', 1, 2);
      this.applyStatus(combat.enemy, 'bleed', 2, 3);
    }
    if (skillId === 'gadget_bolt') {
      dmg = Math.round(dmg * 1.1) + 2;
      this.applyStatus(combat.enemy, 'shattered', 1, 2);
      this.applyStatus(combat.enemy, 'mark', 1, 2);
    }
    if (skillId === 'storm_dance') {
      dmg = Math.round(dmg * 1.05);
      extraHit = Math.max(3, Math.round(dmg * 0.4));
      this.applyStatus(player, 'guard', 1, 1);
      this.applyStatus(player, 'inspire', 1, 3);
    }
    if (skillId === 'spirit_bind') {
      dmg = Math.round(dmg * 0.9) + 2;
      this.applyStatus(combat.enemy, 'stun', 1, 1);
      this.applyStatus(combat.enemy, 'corrupt', 1, 3);
    }
    if (skillId === 'time_shift') {
      dmg = Math.round(dmg * 0.85);
      this.applyStatus(combat.enemy, 'slow', 2, 3);
      Object.keys(player.cooldowns).forEach(key => {
        if (player.cooldowns[key] > 0) player.cooldowns[key] = Math.max(0, player.cooldowns[key] - 1);
      });
      this.addLog('时序扭转削弱了敌人的动作，你的冷却随之缩短。', 'buff');
    }
    if (this.run.player.passiveId === 'elemental_focus' && skill.type === 'arcane') {
      if (!this.hasStatus(combat.enemy, 'slow')) this.applyStatus(combat.enemy, 'slow', 1, 2);
      if (!this.hasStatus(combat.enemy, 'wet')) this.applyStatus(combat.enemy, 'wet', 1, 2);
    }
    dmg = this.applyBloodrushBonus(dmg);
    dmg = this.applyArmor(combat.enemy, dmg);
    combat.enemy.hp -= dmg;
    this.addLog(`${skill.name} → 造成 ${dmg} 伤。`, 'player');
    if (extraHit > 0 && combat.enemy.hp > 0) {
      const bonus = this.applyArmor(combat.enemy, extraHit);
      combat.enemy.hp -= bonus;
      this.addLog(`风暴舞步追加打击 → 造成 ${bonus} 伤。`, 'player');
    }
    if (this.run.player.passiveId === 'hexweave' && !this.hasStatus(combat.enemy, 'corrupt')) {
      this.applyStatus(combat.enemy, 'corrupt', 1, 3);
    }
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
    this.maybeTinkerRefund(item);
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
    const tier = this.corruptionTier();
    if (tier >= 2) {
      const pressure = tier === 2 ? 2 : 3;
      const applied = this.applyPlayerDamage(pressure, { silent: true });
      if (applied > 0) {
        this.addLog(`腐蚀潮汐压迫你，造成 ${applied} 点伤害。`, 'warn');
        if (this.handlePlayerDown()) return;
      }
    }
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
    const player = this.run.player;
    const extra = player.passiveId === 'time_loop' ? 1 : 0;
    Object.keys(player.cooldowns).forEach(id => {
      if (player.cooldowns[id] > 0) {
        const reduction = 1 + extra;
        player.cooldowns[id] = Math.max(0, player.cooldowns[id] - reduction);
      }
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
        const caution = cell && !cell.revealed && !cell.resolved && cell.hint === 'threat';
        return { ...opt, x: nx, y: ny, cell, caution };
      })
      .filter(Boolean);
  }

  markAdjacentThreats(floor, coords) {
    if (!floor?.map?.cells) return;
    floor.map.cells.forEach(row => {
      row.forEach(cell => {
        if (!cell) return;
        if (cell.revealed || cell.resolved) {
          cell.hint = null;
        } else if (cell.hint) {
          cell.hint = null;
        }
      });
    });
    if (!coords) return;
    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    deltas.forEach(([dx, dy]) => {
      const nx = coords.x + dx;
      const ny = coords.y + dy;
      const row = floor.map.cells[ny];
      const cell = row ? row[nx] : null;
      if (!cell || cell.revealed || cell.resolved) return;
      if (['normal', 'elite', 'boss'].includes(cell.type)) {
        cell.hint = 'threat';
      }
    });
  }

  revealAdjacentRooms(floor, coords) {
    if (!floor?.map?.cells || !coords) return;
    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    deltas.forEach(([dx, dy]) => {
      const nx = coords.x + dx;
      const ny = coords.y + dy;
      const row = floor.map.cells[ny];
      const cell = row ? row[nx] : null;
      if (cell && !cell.revealed) {
        cell.revealed = true;
      }
      if (cell && cell.revealed) {
        cell.hint = null;
      }
    });
    this.markAdjacentThreats(floor, coords);
  }

  cellTypeLabel(cell, { reveal = false } = {}) {
    if (!cell) return '未知';
    if (!cell.revealed && !reveal) {
      if (cell.hint === 'threat') return '未知（有敌人气息）';
      return '未知';
    }
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
    if (!cell) return '？';
    if (!cell.revealed && cell.type !== 'start') {
      return cell.hint === 'threat' ? '⚠️' : '？';
    }
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
    if (!cell.revealed) {
      return cell.hint === 'threat' ? '未知房（敌意涌动）' : '未知房';
    }
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
    if (this.applyCorruptionPressure('move')) return;
    const floor = this.currentFloor;
    floor.position = { x: move.x, y: move.y };
    this.addLog(`你朝${move.label}迈进。`, 'info');
    this.tutorial.stage = 'explore';
    const player = this.run.player;
    if (player?.passiveId === 'tempest_step') {
      this.applyStatus(player, 'guard', 1, 1);
    }
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
    const player = this.run.player;
    const healed = this.healPlayer(10, { context: 'explore' });
    this.adjustCorruption(1);
    if (player?.passiveId === 'wildbond') {
      this.adjustCorruption(-1);
      this.addLog('野性回响平复了附近的腐蚀。', 'good');
    }
    const corruptionNote = player?.passiveId === 'wildbond'
      ? '腐蚀几乎没有上涨。'
      : '腐蚀条上涨。';
    this.addLog(`你短暂靠墙休息，恢复 ${healed} 点生命，${corruptionNote}`, 'info');
    if (this.applyCorruptionPressure('rest')) return;
    this.updateAll();
  }

  grantConsumable(id, { logType = 'good', log = true } = {}) {
    const item = DungeonData.consumables[id];
    if (!item || !this.run?.player) return null;
    const entry = { ...item, charges: item.effect?.charges || 1 };
    this.run.player.inventory.push(entry);
    if (log) this.addLog(`获得消耗品【${item.name || id}】。`, logType);
    return entry;
  }

  grantEquipment(id, { logType = 'good', log = true } = {}) {
    const equip = DungeonData.equipments[id];
    if (!equip || !this.run?.player) return null;
    const entry = { ...equip, charges: 1 };
    this.run.player.inventory.push(entry);
    if (log) this.addLog(`获得装备【${equip.name || id}】。`, logType);
    return entry;
  }

  grantRelic(id, { logType = 'goal', log = true } = {}) {
    const relic = DungeonData.relics[id];
    if (!relic || !this.run?.player) return null;
    if (this.run.player.relics.includes(id)) {
      if (log) {
        this.addLog(`遗物【${relic.name || id}】的力量与现有共鸣，转化为灵魂碎片。`, 'info');
      }
      this.run.currency = this.ensureCurrency() + 25;
      return relic;
    }
    this.run.player.relics.push(id);
    if (log) this.addLog(`获得遗物【${relic.name || id}】。`, logType);
    return relic;
  }

  applyBloodrushBonus(damage) {
    const player = this.run?.player;
    if (!player || player.passiveId !== 'bloodrush') return Math.round(damage);
    const threshold = Math.floor(player.maxHP * 0.5);
    if (player.hp <= threshold) {
      player.flags = player.flags || {};
      if (!player.flags.bloodrushActive) {
        this.addLog('血怒发动，你的攻击更为凶猛。', 'buff');
      }
      player.flags.bloodrushActive = true;
      return Math.max(0, Math.round(damage * 1.25));
    }
    if (player.flags) player.flags.bloodrushActive = false;
    return Math.round(damage);
  }

  triggerInnerPeace(source = 'heal') {
    void source;
    const player = this.run?.player;
    if (!player || player.passiveId !== 'inner_peace') return;
    player.heroism += 1;
    this.addLog('内息：治疗激发勇气，勇气+1。', 'goal');
  }

  maybeTinkerRefund(item) {
    if (!item || item.slot || this.run?.player?.passiveId !== 'tinker') return false;
    if (this.rng.random() < 0.35) {
      item.charges = Math.max(1, (item.charges || 0) + 1);
      this.addLog('备用零件发挥作用，消耗品完好无损。', 'good');
      return true;
    }
    return false;
  }

  resolveEvent(arg) {
    const [id, action = 'accept'] = (arg || '').split(':');
    let advance = true;
    let scoreGain = 0;
    const player = this.run.player;
    const room = this.run.currentRoom;
    this.ensureEventState(room);
    switch (id) {
      case 'blood_oath': {
        if (action === 'pledge') {
          player.maxHP = Math.max(10, player.maxHP - 5);
          if (player.hp > player.maxHP) player.hp = player.maxHP;
          this.grantRelic('bloodlust', { log: false });
          this.addLog('鲜血滴在石台上，誓约生效：获得【嗜血】。', 'goal');
          if (this.rng.random() < 0.5) {
            player.heroism += 1;
            this.addLog('誓约回馈战意，勇气+1。', 'goal');
          } else {
            this.applyStatus(player, 'bleed', 1, 3);
            this.addLog('鲜血未止，你陷入轻微流血。', 'warn');
          }
          scoreGain += 120;
        } else if (action === 'temper') {
          if (this.ensureCurrency() < 35) {
            this.addLog('灵魂碎片不足以稳定仪式。', 'warn');
            advance = false;
            break;
          }
          this.run.currency = Math.max(0, this.ensureCurrency() - 35);
          player.maxHP = Math.max(12, player.maxHP - 2);
          if (player.hp > player.maxHP) player.hp = player.maxHP;
          this.grantRelic('bloodlust', { log: false });
          this.addLog('碎片化作护符，你仅失去少量体魄。', 'good');
          player.heroism += 1;
          this.addLog('你把握住仪式的节奏，勇气+1。', 'goal');
          scoreGain += 110;
        } else if (action === 'observe') {
          const before = player.codex.size;
          this.learnRandomSkill();
          if (player.codex.size === before) {
            player.heroism += 1;
            this.addLog('誓文提醒了旧日技巧，勇气+1。', 'good');
          }
          this.run.currency = this.ensureCurrency() + 20;
          this.addLog('你整理誓文的笔记，灵魂碎片 +20。', 'score');
          scoreGain += 80;
        }
        break;
      }
      case 'old_page': {
        if (action === 'study') {
          this.learnRandomSkill();
          if (this.rng.random() < 0.4) this.grantConsumable('ether');
          scoreGain += 90;
        } else if (action === 'copy') {
          player.heroism += 1;
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          this.addLog('你抄录要点，勇气+1，能量+2。', 'good');
          scoreGain += 70;
        } else if (action === 'torch') {
          const healed = this.healPlayer(8, { context: 'event' });
          this.adjustCorruption(-1);
          this.addLog(`纸页化作暖焰，恢复 ${healed} 点生命并降低1点腐蚀。`, 'good');
          scoreGain += 60;
        }
        break;
      }
      case 'cracked_mirror': {
        if (action === 'touch') {
          this.crackedMirrorEffect();
          scoreGain += 80;
        } else if (action === 'shatter') {
          const dmg = this.applyPlayerDamage(5);
          this.removeNegative(player, 2);
          const suffix = dmg === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`镜片碎裂时反噬了你，受到 ${dmg} 点伤害${suffix}，但负面被震散。`, dmg > 0 ? 'warn' : 'good');
          if (this.handlePlayerDown()) { advance = false; break; }
          scoreGain += 70;
        } else if (action === 'meditate') {
          this.adjustCorruption(-1);
          player.energy = Math.min(player.maxEnergy, player.energy + 1);
          this.addLog('你凝神望向镜面，腐蚀下降，能量+1。', 'good');
          scoreGain += 60;
        }
        break;
      }
      case 'damp_torch': {
        if (action === 'dry') {
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          player.imbue = 'ember';
          this.addLog('你烘干火把，暖光裹住双手，获得火焰附魔与能量。', 'good');
          if (this.rng.random() < 0.4) this.grantConsumable('ember_oil');
          scoreGain += 70;
        } else if (action === 'split') {
          this.grantConsumable('ember_oil');
          this.grantConsumable('guard_tonic');
          this.addLog('你小心收集火油，得到了两瓶补给。', 'goal');
          scoreGain += 80;
        } else if (action === 'extinguish') {
          this.adjustCorruption(-1);
          if (player.heroism > 0) player.heroism -= 1;
          this.addLog('你让火焰熄灭，腐蚀下降，但勇气被浇熄了一分。', 'info');
          scoreGain += 50;
        }
        break;
      }
      case 'moth_eaten': {
        if (action === 'search') {
          if (this.rng.random() < 0.65) {
            this.learnRandomSkill();
            if (this.rng.random() < 0.3) this.grantConsumable('small_heal');
            scoreGain += 70;
          } else {
            this.applyStatus(player, 'poison', 1, 3);
            this.addLog('尘埃呛入口鼻，你被中毒。', 'warn');
          }
        } else if (action === 'press') {
          this.grantConsumable('mending_salve');
          if (this.rng.random() < 0.4) this.grantConsumable('small_heal');
          this.addLog('你从虫蛀纸堆中压出药汁，得到治疗用品。', 'good');
          scoreGain += 65;
        } else if (action === 'brew') {
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          this.adjustCorruption(1);
          this.addLog('苦茶提振精神，能量+2，但腐蚀上涨。', 'info');
          scoreGain += 55;
        }
        break;
      }
      case 'tide_chosen': {
        if (action === 'accept') {
          this.grantRelic('tide_codex', { log: false });
          player.flags = player.flags || {};
          player.flags.tideWeak = true;
          this.addLog('潮水符纹缠绕你：施法附带潮湿，但雷鸣会更加刺骨。', 'goal');
          if (this.rng.random() < 0.5) {
            player.heroism += 1;
            this.addLog('潮水的呼唤激励你，勇气+1。', 'good');
          }
          scoreGain += 110;
        } else if (action === 'etch') {
          if ((player.heroism || 0) < 1) {
            this.addLog('需要至少1点勇气才能刻下防护符。', 'warn');
            advance = false;
            break;
          }
          player.heroism -= 1;
          this.grantRelic('tide_codex');
          player.flags = player.flags || {};
          player.flags.tideWeak = false;
          this.applyStatus(player, 'guard', 1, 1);
          this.addLog('你以勇气稳住潮力，获得守备并避免副作用。', 'goal');
          scoreGain += 120;
        } else if (action === 'walk') {
          const healed = this.healPlayer(6, { context: 'event' });
          this.adjustCorruption(-1);
          this.addLog(`你观察潮汐的律动，恢复 ${healed} 点生命并降低腐蚀。`, 'good');
          scoreGain += 60;
        }
        break;
      }
      case 'mirror_sigil': {
        if (action === 'accept') {
          this.grantRelic('mirror_sigil');
          player.flags = player.flags || {};
          player.flags.mirrorPenalty = true;
          this.addLog('誓印贴上皮肤，阴影在耳边低语。普通战可能失去护甲。', 'goal');
          scoreGain += 130;
        } else if (action === 'reflect') {
          this.grantRelic('mirror_sigil', { log: false });
          if (this.rng.random() < 0.6) {
            player.heroism += 1;
            this.addLog('镜像低语中蕴含力量，勇气+1。', 'goal');
          } else {
            this.applyStatus(player, 'corrupt', 1, 3);
            this.addLog('镜像反噬，你被腐蚀缠绕。', 'warn');
          }
          scoreGain += 100;
        } else if (action === 'retreat') {
          player.energy = Math.min(player.maxEnergy, player.energy + 1);
          this.adjustCorruption(-1);
          this.addLog('你谨慎退后，整理心绪，能量+1，腐蚀-1。', 'info');
          scoreGain += 40;
        }
        break;
      }
      case 'tide_surge': {
        if (action === 'brace') {
          const applied = this.applyPlayerDamage(4);
          this.applyStatus(player, 'guard', 1, 1);
          const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`潮水拍打你造成 ${applied} 点伤害，但你稳住了身形。${suffix}`, 'warn');
          if (this.handlePlayerDown()) { advance = false; break; }
          scoreGain += 40;
        } else if (action === 'soak') {
          const applied = this.applyPlayerDamage(7);
          if (applied > 0) this.applyStatus(player, 'wet', 1, 2);
          const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
          this.addLog(`你任潮水冲刷，承受 ${applied} 点伤害。${suffix}`, 'warn');
          if (this.handlePlayerDown()) { advance = false; break; }
          scoreGain += 30;
        } else if (action === 'channel') {
          if (this.rng.random() < 0.6) {
            player.energy = Math.min(player.maxEnergy, player.energy + 2);
            player.heroism += 1;
            this.addLog('你引导潮力进入体内，能量+2，勇气+1。', 'goal');
            scoreGain += 70;
          } else {
            const applied = this.applyPlayerDamage(5);
            this.applyStatus(player, 'wet', 1, 2);
            const suffix = applied === 0 && this.admin?.invincible ? '（无敌）' : '';
            this.addLog(`潮力失控，造成 ${applied} 点伤害并令你潮湿。${suffix}`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        }
        break;
      }
      case 'silhouette_lock': {
        if (action === 'attempt') {
          if (this.rng.random() < 0.5) {
            this.run.currency = this.ensureCurrency() + 35;
            this.addLog('剪影锁被你巧手打开，灵魂碎片 +35。', 'goal');
            scoreGain += 70;
          } else {
            const dmg = this.applyPlayerDamage(5);
            this.addLog(`机关反噬，你受到 ${dmg} 点伤害。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        } else if (action === 'decode') {
          if ((player.heroism || 0) < 1) {
            this.addLog('你需要1点勇气来解析锁上的符号。', 'warn');
            advance = false;
            break;
          }
          player.heroism -= 1;
          this.grantConsumable('valor_banner');
          this.run.currency = this.ensureCurrency() + 30;
          this.addLog('你读懂剪影顺序，得到战旗与碎片奖励。', 'goal');
          scoreGain += 90;
        } else if (action === 'force') {
          if (this.rng.random() < 0.5) {
            const equipId = this.rng.pick(Object.keys(DungeonData.equipments));
            this.grantEquipment(equipId);
            scoreGain += 85;
          } else {
            const dmg = this.applyPlayerDamage(6);
            this.addLog(`撬锁触发陷阱，你受到 ${dmg} 点伤害。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        }
        break;
      }
      case 'mirror_maze': {
        if (action === 'inspect') {
          this.revealAdjacentRooms(this.currentFloor, room?.coords);
          player.heroism += 1;
          this.addLog('你记下镜面折射，临近房间显露，勇气+1。', 'goal');
          scoreGain += 70;
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
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        } else if (action === 'chalk') {
          if (this.ensureCurrency() < 10) {
            this.addLog('粉笔标记需要 10 灵魂碎片。', 'warn');
            advance = false;
            break;
          }
          this.run.currency = Math.max(0, this.ensureCurrency() - 10);
          this.revealAdjacentRooms(this.currentFloor, room?.coords);
          this.addLog('你在镜面上画下符号，附近道路被标记出来。', 'good');
          scoreGain += 60;
        }
        break;
      }
      case 'dry_well_echo': {
        if (action === 'listen') {
          player.heroism += 1;
          this.run.heroicPromise += 1;
          this.addLog('井底回声化作鼓舞：勇气+1，下一场必有战利品。', 'goal');
          scoreGain += 70;
        } else if (action === 'hum') {
          this.adjustCorruption(-1);
          player.energy = Math.min(player.maxEnergy, player.energy + 1);
          this.addLog('你与回声合鸣，腐蚀下降，能量+1。', 'good');
          scoreGain += 60;
        } else if (action === 'descend') {
          if (this.rng.random() < 0.5) {
            this.run.currency = this.ensureCurrency() + 45;
            this.addLog('你顺着回声找到一袋碎片，灵魂碎片 +45。', 'goal');
            scoreGain += 80;
          } else {
            const dmg = this.applyPlayerDamage(6);
            this.addLog(`你误入陷阱，受到 ${dmg} 点伤害。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        }
        break;
      }
      case 'altar_shadow': {
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
              this.grantRelic(pick);
              scoreGain += 130;
            } else {
              this.applyStatus(player, 'corrupt', 1, 4);
              this.addLog('阴影发出低笑，腐化在体内蔓延。', 'warn');
            }
          }
        } else if (action === 'resist') {
          if ((player.heroism || 0) < 1) {
            this.addLog('你需要1点勇气才能正面抵御阴影。', 'warn');
            advance = false;
            break;
          }
          player.heroism -= 1;
          this.adjustCorruption(-2);
          const dmg = this.applyPlayerDamage(3);
          this.addLog(`你高举火焰抵御阴影，腐蚀-2，但受到 ${dmg} 点灼伤。`, 'info');
          if (this.handlePlayerDown()) { advance = false; break; }
          scoreGain += 75;
        } else if (action === 'trade') {
          if (this.ensureCurrency() < 40) {
            this.addLog('灵魂碎片不足以完成交易。', 'warn');
            advance = false;
            break;
          }
          this.run.currency = Math.max(0, this.ensureCurrency() - 40);
          if (this.rng.random() < 0.5) {
            const relicOptions = ['veil', 'echo_lantern', 'mirror_sigil'];
            const pick = this.rng.pick(relicOptions);
            this.grantRelic(pick);
          } else {
            const equipId = this.rng.pick(Object.keys(DungeonData.equipments));
            this.grantEquipment(equipId);
          }
          scoreGain += 120;
        }
        break;
      }
      case 'glimmering_pool': {
        if (action === 'drink') {
          if (this.rng.random() < 0.55) {
            const healed = this.healPlayer(10, { context: 'event' });
            this.applyStatus(player, 'inspire', 1, 3);
            this.addLog(`池水回荡暖意，恢复 ${healed} 点生命并获得【激励】。`, 'good');
            scoreGain += 90;
          } else {
            const dmg = this.applyPlayerDamage(6);
            this.applyStatus(player, 'wet', 1, 3);
            this.addLog(`寒潮瞬间入体，造成 ${dmg} 点伤害并令你潮湿。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        } else if (action === 'bottle') {
          if (this.ensureCurrency() < 10) {
            this.addLog('舀取池水需要 10 灵魂碎片。', 'warn');
            advance = false;
            break;
          }
          this.run.currency = Math.max(0, this.ensureCurrency() - 10);
          const options = ['ether', 'guard_tonic', 'ember_oil', 'mending_salve'];
          const pick = this.rng.pick(options);
          this.grantConsumable(pick);
          scoreGain += 70;
        } else if (action === 'wash') {
          this.removeNegative(player, 1);
          this.adjustCorruption(-1);
          const healed = this.healPlayer(6, { context: 'event' });
          this.addLog(`你净手静坐，恢复 ${healed} 点生命并降低腐蚀。`, 'good');
          scoreGain += 60;
        }
        break;
      }
      case 'rusted_armory': {
        if (action === 'force') {
          if (this.rng.random() < 0.6) {
            const equipId = this.rng.pick(Object.keys(DungeonData.equipments));
            this.grantEquipment(equipId);
            scoreGain += 100;
          } else {
            const dmg = this.applyPlayerDamage(7);
            this.addLog(`铁锈崩裂砸向你，造成 ${dmg} 点伤害。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          }
        } else if (action === 'salvage') {
          this.run.currency = this.ensureCurrency() + 35;
          if (this.rng.random() < 0.4) this.grantConsumable('guard_tonic');
          this.addLog('你拆解旧件，获得灵魂碎片与备用零件。', 'good');
          scoreGain += 75;
        } else if (action === 'catalog') {
          this.learnRandomSkill();
          player.heroism += 1;
          this.addLog('你记录下军械铭文，勇气+1。', 'goal');
          scoreGain += 95;
        }
        break;
      }
      case 'echo_shrine': {
        if (action === 'kneel') {
          const healed = this.healPlayer(14, { context: 'event' });
          this.removeNegative(player, 1);
          this.addLog(`回声祭坛回应你的祈祷，恢复 ${healed} 点生命并净化负面。`, 'good');
          scoreGain += 85;
        } else if (action === 'chant') {
          if ((player.heroism || 0) < 1) {
            this.addLog('吟唱古语需要消耗1点勇气。', 'warn');
            advance = false;
            break;
          }
          player.heroism -= 1;
          const relicOptions = ['veil', 'echo_lantern', 'cleric_pendant'];
          const pick = this.rng.pick(relicOptions);
          this.grantRelic(pick);
          scoreGain += 130;
        } else if (action === 'steal') {
          this.run.currency = this.ensureCurrency() + 50;
          this.adjustCorruption(2);
          this.applyStatus(player, 'corrupt', 1, 3);
          this.addLog('你顺走供品，灵魂碎片 +50，但阴影愤怒地灌入腐蚀。', 'warn');
          scoreGain += 90;
        }
        break;
      }
      case 'sacrifice_vendor': {
        if (action === 'blood_price') {
          if (player.maxHP <= 12) {
            this.addLog('你的体魄已经太弱，行商摇头拒绝交易。', 'warn');
            advance = false;
            break;
          }
          player.maxHP = Math.max(8, player.maxHP - 6);
          if (player.hp > player.maxHP) player.hp = player.maxHP;
          this.addLog('你献出体魄换取力量，血液在晶壳上蒸腾。', 'warn');
          const roll = this.rng.random();
          if (roll < 0.45) {
            const relicOptions = ['time_hourglass', 'hunter_totem', 'mirror_sigil', 'bloodlust'];
            const pick = this.rng.pick(relicOptions);
            if (pick) this.grantRelic(pick);
            scoreGain += 150;
          } else if (roll < 0.75) {
            const purples = Object.values(DungeonData.equipments).filter(eq => eq?.rarity === 'purple');
            const reward = this.rng.pick(purples) || Object.values(DungeonData.equipments)[0];
            if (reward?.id) this.grantEquipment(reward.id);
            scoreGain += 120;
          } else {
            const tonics = ['guard_tonic', 'ember_oil', 'sapling_totem'];
            const pick = this.rng.pick(tonics);
            if (pick) this.grantConsumable(pick);
            player.heroism += 1;
            this.addLog('行商称赞你的勇气，勇气+1。', 'goal');
            scoreGain += 110;
          }
        } else if (action === 'essence_price') {
          if (player.maxEnergy <= 3) {
            this.addLog('你的元息太过薄弱，无法完成这笔交易。', 'warn');
            advance = false;
            break;
          }
          player.maxEnergy = Math.max(3, player.maxEnergy - 1);
          if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
          const before = player.codex.size;
          this.learnRandomSkill();
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          player.heroism += 1;
          this.addLog('你献出元息换取秘术，精神随之振奋。', 'good');
          scoreGain += player.codex.size > before ? 120 : 95;
        } else if (action === 'decline') {
          this.run.currency = this.ensureCurrency() + 25;
          this.addLog('你婉拒了交易，行商仍递来一袋碎片。', 'info');
          scoreGain += 50;
        }
        break;
      }
      case 'coral_orchard': {
        if (action === 'harvest') {
          const picks = ['mending_salve', 'sapling_totem', 'guard_tonic'];
          const pick = this.rng.pick(picks);
          if (pick) this.grantConsumable(pick);
          if (this.rng.random() < 0.35) {
            this.applyStatus(player, 'poison', 1, 3);
            this.addLog('锋利的珊瑚刺让你中毒。', 'warn');
          }
          scoreGain += 85;
        } else if (action === 'tend') {
          const healed = this.healPlayer(8, { context: 'event' });
          this.adjustCorruption(-2);
          this.addLog(`你耐心照料珊瑚，恢复 ${healed} 点生命并让腐蚀平缓。`, 'good');
          scoreGain += 70;
        } else if (action === 'meditate') {
          player.heroism += 1;
          this.learnRandomSkill();
          this.applyStatus(player, 'inspire', 1, 3);
          this.addLog('珊瑚的呼吸让你心神安定，勇气+1。', 'goal');
          scoreGain += 95;
        }
        break;
      }
      case 'echoing_archive': {
        if (action === 'read') {
          const before = player.codex.size;
          this.learnRandomSkill();
          player.heroism += 1;
          this.addLog('你研读前人的战报，勇气+1。', 'goal');
          scoreGain += player.codex.size > before ? 110 : 90;
        } else if (action === 'rewrite') {
          if (this.ensureCurrency() < 20) {
            this.addLog('刻下心得需要20枚灵魂碎片。', 'warn');
            advance = false;
            break;
          }
          this.run.currency = Math.max(0, this.ensureCurrency() - 20);
          this.revealAdjacentRooms(this.currentFloor, room?.coords);
          this.addLog('你刻下心得，附近的道路被记录在案。', 'good');
          scoreGain += 80;
        } else if (action === 'seal') {
          player.heroism += 1;
          this.run.currency = this.ensureCurrency() + 20;
          this.addLog('你将档案封存，带走了前人的启迪。', 'info');
          scoreGain += 75;
        }
        break;
      }
      case 'tide_pylon': {
        if (action === 'absorb') {
          player.energy = Math.min(player.maxEnergy, player.energy + 2);
          this.applyStatus(player, 'guard', 1, 1);
          this.adjustCorruption(1);
          this.addLog('潮汐能量涌入，你获得守备但腐蚀随之翻涌。', 'info');
          scoreGain += 65;
        } else if (action === 'stabilize') {
          this.adjustCorruption(-2);
          player.armor += 1;
          this.addLog('你稳固晶塔，护甲+1。', 'good');
          scoreGain += 75;
        } else if (action === 'overload') {
          this.run.currency = this.ensureCurrency() + 60;
          this.adjustCorruption(2);
          if (this.rng.random() < 0.5) {
            const dmg = this.applyPlayerDamage(8);
            this.addLog(`晶塔反噬，造成 ${dmg} 点伤害。`, 'warn');
            if (this.handlePlayerDown()) { advance = false; break; }
          } else {
            this.applyStatus(player, 'inspire', 1, 3);
          }
          scoreGain += 100;
        }
        break;
      }
      case 'abyssal_forge': {
        if (action === 'temper') {
          const options = this.run.player.inventory.filter(item => item && item.slot);
          if (!options.length) {
            this.addLog('没有可供回炉的装备。', 'warn');
            advance = false;
            break;
          }
          const target = this.rng.pick(options);
          const idx = this.run.player.inventory.indexOf(target);
          if (idx >= 0) this.run.player.inventory.splice(idx, 1);
          if (target?.slot && this.run.player.equipment[target.slot] === target) {
            delete this.run.player.equipment[target.slot];
          }
          this.addLog(`你将${target?.name || '装备'}投入熔炉，火焰吞噬了旧形。`, 'info');
          const pool = Object.values(DungeonData.equipments).filter(eq => ['purple', 'blue'].includes(eq?.rarity));
          const reward = this.rng.pick(pool);
          if (reward?.id) this.grantEquipment(reward.id);
          scoreGain += 140;
        } else if (action === 'fuse') {
          if ((player.heroism || 0) < 1) {
            this.addLog('你需要1点勇气才能注入魂火。', 'warn');
            advance = false;
            break;
          }
          player.heroism -= 1;
          const roll = this.rng.random();
          if (roll < 0.34) {
            player.attack += 2;
            this.addLog('魂火淬炼了你的斗志，攻击+2。', 'good');
          } else if (roll < 0.68) {
            player.defense += 2;
            this.addLog('魂火凝成护盾，防御+2。', 'good');
          } else {
            player.maxHP += 6;
            player.hp += 6;
            this.addLog('魂火滋养血肉，最大生命+6。', 'good');
          }
          scoreGain += 130;
        } else if (action === 'warm') {
          const healed = this.healPlayer(14, { context: 'event' });
          this.applyStatus(player, 'inspire', 1, 3);
          player.energy = Math.min(player.maxEnergy, player.energy + 1);
          this.addLog(`熔炉余温驱散疲惫，恢复 ${healed} 点生命并激励士气。`, 'good');
          this.triggerInnerPeace('event');
          scoreGain += 85;
        }
        break;
      }
      default:
        this.addLog('事件尚未实现。', 'warn');
        break;
    }
    if (room?.eventState) room.eventState.resolved = action;
    if (scoreGain > 0) {
      if (player.relics.includes('echo_lantern')) scoreGain += 20;
      this.addScore(scoreGain, '事件奖励', { log: true });
    }
    if (advance && !this._finished) {
      if (room) room.resolved = true;
      this.state.phase = 'explore';
      this.tutorial.stage = 'explore';
      this.updateAll();
    }
  }

  learnRandomSkill() {
    const pool = ['smite', 'whirlwind', 'frost_ring', 'hex_bolt', 'fury_slash', 'chi_wave', 'gadget_bolt', 'nature_bloom', 'storm_dance', 'spirit_bind', 'time_shift'];
    const unknown = pool.filter(id => !this.run.player.codex.has(id));
    const pick = this.rng.pick(unknown.length ? unknown : pool);
    this.run.player.codex.add(pick);
    this.addLog(`你掌握了技能【${DungeonData.skills[pick]?.name || pick}】。`, 'good');
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

  handleCamp(mode) {
    const room = this.run.currentRoom;
    if (!room || room.resolved) {
      this.addLog('营地火堆已冷，无法停留。', 'warn');
      return;
    }
    const player = this.run.player;
    if (room.campChoice) {
      this.addLog('你已在此营地做出抉择。', 'warn');
      return;
    }
    room.campChoice = mode;
    this.adjustCorruption(2);
    if (player?.passiveId === 'wildbond' && (mode === 'rest' || mode === 'prepare')) {
      this.adjustCorruption(-1);
      this.addLog('野性回响环绕营地，你感到腐蚀减轻。', 'good');
    }
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
    room.resolved = true;
    this.state.phase = 'explore';
    this.addLog('你熄灭火堆，继续深入。', 'info');
    this.tutorial.stage = 'explore';
    this.updateAll();
  }

  retreatCurrentRun() {
    if (!this.run || this._finished) {
      this.closeOverlay();
      return;
    }
    this._retreated = true;
    this.addLog('你选择暂时撤离古井，保留了目前的收获。', 'info');
    this.finishRun(false);
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
      const currencyGain = tier === 'boss' ? 90 : (tier === 'elite' ? 45 : 20);
      this.run.currency = this.ensureCurrency() + currencyGain;
      this.addLog(`灵魂碎片 +${currencyGain}。`, 'score');
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
    this.closeOverlay();
    if (this.run) this.run.result = victory ? 'victory' : 'defeat';
    const floorsCleared = victory ? this.run.floors.length : Math.max(1, this.run.floorIndex + 1);
    this.recordScore({
      score: this.run.score || 0,
      victory,
      floor: floorsCleared,
      heroism: this.run.player.heroism,
      name: this.run.player.nickname,
      classId: this.run.player.classId,
    });
    this.addLog(`最终积分：${this.run.score || 0} ｜ 勇气 ${this.run.player.heroism}`, 'score');
    if (victory) {
      this.addLog('公爵的面皮如薄纸般破裂，井水终于落下的声音回荡。', 'goal');
      this.addLog('【卷一：史莱姆古井】完结。你带着召唤阵的碎片离开——碎片仍在轻轻颤动。', 'goal');
    } else {
      if (this._retreated) {
        this.addLog('你选择撤离古井，打算整备后再战。', 'info');
      } else {
        this.addLog('潮湿渗入伤口，火把在倒下前发出最后一声噼啪。古井继续吞下回声。', 'warn');
      }
    }
    this._retreated = false;
    this.updateAll();
  }

  restartRun() {
    this.destroy({ preserve: false });
    this.logEntries = [];
    this.state = { phase: 'intro', overlay: null };
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
    this._game?.destroy({ preserve: true });
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
