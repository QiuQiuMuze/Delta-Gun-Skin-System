const StarfallData = (() => {
  const ITEM_CATALOG = {
    rationSeal: { name: "真空封装器", hint: "降低每日口粮消耗。" },
    thrusterKit: { name: "推进器稳定器", hint: "让燃料消耗更可控。" },
    o2Recycler: { name: "O₂ 再生装置", hint: "缓解氧气流失。" },
    distressBeacon: { name: "相位信标", hint: "大幅提升求救信号。" },
    stasisPatch: { name: "医用稳态贴", hint: "抵御极寒或创伤。" },
    grappleHarness: { name: "磁索工具组", hint: "安全拖回漂浮残骸。" },
  };

  const getItemName = (id) => ITEM_CATALOG[id]?.name || id;

  function defineEvent(generator, meta = {}) {
    return Object.assign(generator, meta);
  }
  const countdownEvents = [
    {
      id: "alarm",
      time: 60,
      title: "主控舱爆炸警告",
      description: "红光在视野里跳动。救生舱的门在远处闪着蓝色。",
      options: [
        {
          key: "cargo",
          label: "冲向物资舱",
          detail: "把能抱的口粮塞进袋子。",
          resolve(state) {
            return {
              log: "你抱起两箱冻干口粮，冰冷的金属边割破手套。",
              effects: { food: 8, mind: -2 },
              itemsGain: ["rationSeal"],
            };
          },
        },
        {
          key: "bridge",
          label: "跑向飞行甲板",
          detail: "抢回足够的燃料。",
          resolve() {
            return {
              log: "你撬开储油柜，把剩下的两桶推进背带里。",
              effects: { fuel: 12 },
              itemsGain: ["thrusterKit"],
            };
          },
        },
        {
          key: "signal",
          label: "原地搜索信号模块",
          detail: "拆下一块完整的通讯芯片。",
          resolve(state) {
            const bonus = state.flags.consoleDamaged ? 10 : 18;
            return {
              log: "你拔出一块闪着余温的信号芯片。希望它还能接通宇宙。",
              effects: { signal: bonus },
              flags: { signalChip: true },
              itemsGain: ["distressBeacon"],
            };
          },
        },
        {
          key: "medkit",
          label: "扛走医疗箱",
          detail: "抓起绷带与止痛剂。",
          resolve() {
            return {
              log: "你踢开药柜，拖出一只半融化的医疗箱。里面还有几枚注射剂。",
              effects: { food: 2, mind: 6, o2: 4 },
              flags: { medkit: true },
              itemsGain: ["stasisPatch"],
            };
          },
        },
        {
          key: "drone",
          label: "启动维修无人机",
          detail: "让它跟随逃生舱。",
          resolve() {
            return {
              log: "你拍醒一台维护无人机，它的光学镜片快速聚焦到你身上。",
              effects: { fuel: 4, signal: 6 },
              flags: { supportDrone: true },
              itemsGain: ["grappleHarness"],
            };
          },
        },
      ],
    },
    {
      id: "rescue",
      time: 50,
      title: "听见呼救",
      description: "隔壁舱传来重物敲击声。有人在拍门。",
      options: [
        {
          key: "save",
          label: "救船员",
          detail: "牺牲几秒钟，把他拖出来。",
          resolve(state) {
            const extraTime = state.resources.crew >= 2 ? -6 : -4;
            if (state.resources.crew >= 3 || getCrewById(state, "rae")) {
              return {
                log: "门后是空荡的舱室，警报声在里面回旋。",
                effects: { mind: -4, time: extraTime },
              };
            }
            return {
              log: "你撬开安全门，把浑身冒烟的工程师 Rae 拖进走廊。",
              effects: { mind: 8, time: extraTime },
              crewGain: ["rae"],
              flags: { savedCrew: true },
            };
          },
        },
        {
          key: "bulkhead",
          label: "封锁隔舱",
          detail: "封住破裂的通道，为撤离争取空间。",
          resolve(state) {
            const drone = state.flags.supportDrone;
            const timeGain = drone ? 6 : 4;
            return {
              log: drone
                ? "无人机快速焊上舱门边缘，你趁机封住爆裂口。走廊重获稳定。"
                : "你合上隔舱门，把锁杆死死压下。短暂的安静让每个人重新呼吸。",
              effects: { time: timeGain, mind: drone ? 6 : 3, signal: drone ? 6 : 3 },
              flags: { corridorSafe: true },
            };
          },
        },
        {
          key: "supply",
          label: "隔门递送工具",
          detail: "把拆卸器塞进门缝，让他自己挣脱。",
          resolve() {
            return {
              log: "你递出一把震动扳手。门后的声音感谢你，承诺会在逃生舱会合。",
              effects: { mind: 4, time: -2, fuel: -2 },
              flags: { allyAwaiting: true },
            };
          },
        },
        {
          key: "guide",
          label: "广播撤离路径",
          detail: "打开通话频道指示安全路线。",
          resolve(state) {
            const success = Math.random() < 0.5;
            return {
              log: success
                ? "你在公共频道里播报疏散路线。脚步声迅速远去。"
                : "信号里充满杂音。你只能希望他听懂了。",
              effects: { signal: 10, mind: success ? 5 : -2 },
              flags: success ? { guidedCrew: true } : {},
            };
          },
        },
      ],
    },
    {
      id: "oxygen",
      time: 40,
      title: "氧气罐滚落",
      description: "一只氧气罐撞到你脚边，还在冒白雾。",
      options: [
        {
          key: "grab",
          label: "拾取",
          detail: "抱起罐子塞进袋里。",
          resolve() {
            return {
              log: "你扛起氧气罐，阀门蹭出刺耳的金属声。",
              effects: { o2: 12, mind: -2 },
            };
          },
        },
        {
          key: "dash",
          label: "冲刺前进",
          detail: "绕过罐体，直接冲向舱门。",
          resolve() {
            return {
              log: "你跨过氧气罐，沿着火花滑行。每一步都像踩在爆炸的边缘。",
              effects: { time: 5, mind: -2 },
              flags: { sprintFocus: true },
            };
          },
        },
        {
          key: "stabilize",
          label: "固定氧气罐",
          detail: "利用挂带让罐体随你滑行。",
          resolve(state) {
            const bonus = state.flags.supportDrone ? 6 : 3;
            return {
              log: "你把挂带勾在罐阀上，让它跟着你滑向舱门。",
              effects: { o2: 8 + bonus, time: -1 },
              itemsGain: ["o2Recycler"],
            };
          },
        },
        {
          key: "share",
          label: "分发氧气",
          detail: "把罐子推给跟随的同伴，自己继续前进。",
          resolve(state) {
            const hasCrew = state.resources.crew > 0 || getRoster(state).length > 0;
            return {
              log: hasCrew
                ? "你把氧气罐推向身后的伙伴。她点头致谢，你们一同跑向舱口。"
                : "你把罐子滑向通道尽头，希望有人能捡到。",
              effects: { mind: hasCrew ? 8 : 2, o2: hasCrew ? 6 : 0 },
              flags: hasCrew ? { crewBond: true } : {},
            };
          },
        },
      ],
    },
    {
      id: "battery",
      time: 30,
      title: "辅助舱火光",
      description: "火舌正舔着备用能源架。",
      options: [
        {
          key: "cell",
          label: "取能量电池",
          detail: "从火焰里抢回最后一颗核心。",
          resolve() {
            return {
              log: "你把手伸进火光，灼烧感透过手套。电池还温热。",
              effects: { fuel: 10, mind: -6 },
            };
          },
        },
        {
          key: "avoid",
          label: "避开",
          detail: "绕开火场，保护自己。",
          resolve() {
            return {
              log: "你沿着舷窗奔跑，告诉自己不要回头。燃烧声在身后渐远。",
              effects: { mind: 6 },
            };
          },
        },
        {
          key: "vent",
          label: "排气灭火",
          detail: "打开外阀，让火焰瞬间熄灭。",
          resolve() {
            return {
              log: "你猛地扳下排气阀。火焰被真空吞没，你的耳朵一阵轰鸣。",
              effects: { o2: -6, fuel: 6, mind: 2 },
              flags: { rapidVent: true },
            };
          },
        },
        {
          key: "rig",
          label: "拆下能源轨道",
          detail: "把备用导轨拆走，日后可修复推进器。",
          resolve(state) {
            const engineer = hasCrewRole(state, "repair");
            const helper = engineer ? getCrewById(state, "rae")?.name || "工程师" : null;
            return {
              log: engineer
                ? `${helper} 与你合力拆下烧红的导轨。她说这些金属还能救你们一次。`
                : "你徒手拉扯烫手的导轨，终于在报警声中取下一段完好的金属。",
              effects: { fuel: 6, mind: engineer ? 6 : -2, signal: engineer ? 4 : 0 },
              flags: { spareRails: true },
            };
          },
        },
      ],
    },
    {
      id: "console",
      time: 20,
      title: "控制台失火",
      description: "火花从主控台窜出，通讯面板冒出黑烟。",
      options: [
        {
          key: "poweroff",
          label: "断电扑灭",
          detail: "冒险保住信号。",
          resolve() {
            return {
              log: "你拍下紧急断电开关，火光在指尖熄灭。",
              effects: { signal: 12, mind: -4, time: -3 },
            };
          },
        },
        {
          key: "reroute",
          label: "切换备用总线",
          detail: "拔下主控芯片，手动连接应急线路。",
          resolve() {
            return {
              log: "你把烧焦的线路拔下，临时接上备用总线。面板重新亮起蓝光。",
              effects: { signal: 8, mind: -2, fuel: -2 },
              flags: { consoleSaved: true },
            };
          },
        },
        {
          key: "shield",
          label: "让无人机遮挡",
          detail: "指挥维修无人机吸走火焰。",
          resolve(state) {
            const helped = state.flags.supportDrone;
            return {
              log: helped
                ? "无人机喷出灭火泡沫，火苗缩成几个红点。"
                : "你试图用工具挡住火光，但还是被灼到。",
              effects: helped ? { mind: 6, signal: 4 } : { mind: -8 },
              flags: helped ? { consoleSaved: true } : { consoleDamaged: true },
            };
          },
        },
        {
          key: "backup",
          label: "下载航行日志",
          detail: "趁火花减弱时拷出星图。",
          resolve(state) {
            const hasChip = state.flags.signalChip;
            return {
              log: hasChip
                ? "你把备用芯片插入接口。完整的航行日志涌入终端。"
                : "你强行拷贝数据，虽然杂音密布，但至少保住了部分航道。",
              effects: { signal: hasChip ? 20 : 12, mind: hasChip ? 6 : 0, time: -1 },
              flags: { navArchive: true },
            };
          },
        },
      ],
    },
    {
      id: "launch",
      time: 10,
      title: "船员呼喊：“走啊！”",
      description: "舱门前堆满箱子与人影。你只有一次选择。",
      options: [
        {
          key: "haul",
          label: "带所有资源登舱",
          detail: "谁知道之后还有没有补给。",
          resolve() {
            return {
              log: "你把箱子塞进救生舱，舱门被挤得几乎关不上。",
              effects: { mind: 4, time: -2 },
            };
          },
        },
        {
          key: "people",
          label: "舍弃物资带人",
          detail: "把座位留给喘息的人。",
          resolve(state) {
            const freeSlots = Math.max(0, 3 - state.resources.crew);
            if (freeSlots <= 0) {
              return {
                log: "救生舱里已经没有多余座位。你只能祈祷他们能逃到别的舱。",
                effects: { fuel: -4, mind: -6 },
              };
            }
            const crewIds = [];
            const first = chooseCrew(state, ["noor", "maru", "ilya"]);
            if (first) crewIds.push(first);
            if (freeSlots > 1) {
              const tempState = { flags: { crewRoster: [...getRoster(state)] } };
              if (first) {
                tempState.flags.crewRoster.push(crewTemplates[first]);
              }
              const second = chooseCrew(tempState, ["maru", "ilya", "noor"]);
              if (second && second !== first) {
                crewIds.push(second);
              }
            }
            return {
              log:
                crewIds.length > 0
                  ? `你把箱子扔出舱门，扶起${crewIds
                      .map((id) => crewTemplates[id]?.name || "陌生人")
                      .join("和")}。他们喘着粗气点头致谢。`
                  : "门外只剩空荡荡的走廊。",
              effects: { fuel: -6, mind: crewIds.length ? 10 : -4, food: -2 },
              crewGain: crewIds.length ? crewIds : undefined,
              flags: crewIds.length ? { savedCrew: true } : {},
            };
          },
        },
        {
          key: "stagger",
          label: "分批转移",
          detail: "把重物交给无人机拖行，其余人依次进入。",
          resolve(state) {
            const drone = state.flags.supportDrone;
            const crewBoost = drone && !getCrewById(state, "maru") ? 1 : 0;
            return {
              log: drone
                ? "无人机抓起两箱燃料，沿着轨道滑向救生舱后方。导航员 Maru 顺势跳进座位，立刻开始校准舱体。"
                : "你安排人手按顺序登舱，最后时刻仍有人留在原地。",
              effects: { fuel: drone ? 6 : 2, food: 2, mind: drone ? 6 : 0 },
              crewGain: crewBoost ? ["maru"] : undefined,
              flags: drone ? { convoy: true } : {},
            };
          },
        },
        {
          key: "balance",
          label: "重新分配负重",
          detail: "把物资按用途划分，确保舱内重心稳定。",
          resolve(state) {
            const roster = getRoster(state);
            const helper = roster.length ? roster.map((member) => member.name).join("、") : null;
            return {
              log: helper
                ? `${helper} 帮你把燃料与食物分区堆放。舱体重心稳定下来，你们的心也稳了。`
                : "你迅速把物资分成三堆，确保起飞时不会倾斜。",
              effects: { fuel: 4, food: 2, mind: helper ? 8 : 4, signal: helper ? 4 : 2 },
              flags: { organizedCargo: true },
            };
          },
        },
        {
          key: "solo",
          label: "只身逃离",
          detail: "清空舱室，独自起航。",
          resolve(state) {
            const roster = getRoster(state);
            return {
              log: "你关上舱门。嘈杂的声音被隔绝在另一侧。",
              effects: { fuel: 5, mind: -22 },
              crewLoss: roster.length ? roster.map((member) => member.id) : undefined,
              flags: { loner: true },
            };
          },
        },
      ],
    },
  ];

  const crewTemplates = {
    rae: {
      id: "rae",
      name: "Rae",
      role: "工程师",
      description: "负责推进器和能源回路，她的手永远沾着机油。",
      focus: "repair",
    },
    ilya: {
      id: "ilya",
      name: "Ilya",
      role: "科学官",
      description: "研究信号折射的科学官，随身携带一叠数据片。",
      focus: "signal",
    },
    noor: {
      id: "noor",
      name: "Noor",
      role: "医师",
      description: "舰医，善于调配镇静剂与热量片。",
      focus: "care",
    },
    maru: {
      id: "maru",
      name: "Maru",
      role: "导航员",
      description: "导航员，擅长读取旧时代的星图。",
      focus: "nav",
    },
  };

  function buildDayEvent(day, title, body, options) {
    return {
      title: `Day ${day} · ${title}`,
      body,
      options,
    };
  }

  const sharedLongHaulEvents = [];
  sharedLongHaulEvents.push(
    defineEvent((state, day) => {
      const roster = getRoster(state);
      const care = hasCrewRole(state, "care");
      const nav = hasCrewRole(state, "nav");
      return buildDayEvent(
        day,
      "静域调整",
      "逃生舱缓慢旋转，只有仪表的脉冲在跳动。你趁这个窗口重新布置长期旅程。",
      [
        {
          key: "vent",
          label: "校准生命维持",
          detail: "调节气阀和温控。",
          resolve: () => ({
            effects: { o2: 10, mind: 6 },
            log: "你调节了再循环阀门，舱内霜雾缓慢散开。",
            preventMindDecay: true,
          }),
        },
        {
          key: "ration",
          label: "重新封装口粮",
          detail: care ? "Noor 提出节律饮食方案。" : "把热量片按天数重新分装。",
          resolve: () => ({
            effects: { food: 6, satiety: 1, mind: care ? 12 : 8 },
            log: care
              ? "Noor 把营养片封装成新配方，并写下鼓励的话。"
              : "你将口粮真空封装，贴上鲜艳的标签。",
            flags: { rationTight: false },
            preventMindDecay: true,
          }),
        },
        {
          key: "chart",
          label: "描绘星象",
          detail: nav ? "与 Maru 一起修订星图。" : "靠肉眼记录星轨。",
          resolve: () => ({
            effects: { signal: 12, mind: 10 },
            log: roster.length
              ? "你们轮流在舷窗前描摹星点，方向感重新回到胸腔。"
              : "你独自描绘星轨，笔尖颤抖却没有停下。",
            preventMindDecay: true,
          }),
        },
      ]
    );
    }, { tags: ["o2", "food", "signal", "mind"], baseWeight: 1.2 })
  );

  sharedLongHaulEvents.push(
    defineEvent((state, day) => {
      const engineer = hasCrewRole(state, "repair");
      return buildDayEvent(
        day,
        "漂流拾荒",
        "雷达捕捉到一串散落的残骸，也许能拆出可用的燃料芯。",
      [
        {
          key: "harvest",
          label: "系缆拖回",
          detail: engineer ? "让 Rae 操控无人机。" : "亲自驾缆。",
          resolve: () => {
            const gain = randomInt(6, 12);
            return {
              effects: { fuel: gain, mind: engineer ? 6 : -2 },
              log: engineer
                ? "Rae 操控无人机勾住货箱，你们拖着碎片返航。"
                : "你亲自拖拽残骸，肩膀被安全带勒出淤痕。",
            };
          },
        },
        {
          key: "scan",
          label: "扫描日志",
          detail: "读取残骸中的旧数据。",
          resolve: () => ({
            effects: { signal: 14, mind: 6 },
            log: "你整理出几条仍可使用的跳跃航道。",
            preventMindDecay: true,
            flags: { archiveHints: true },
          }),
        },
        {
          key: "observe",
          label: "保持距离",
          detail: "只在远处记录。",
          resolve: () => ({
            effects: { mind: 12 },
            log: "你们静静看着金属在星光里转动，借此放缓心跳。",
            preventMindDecay: true,
          }),
        },
      ]
    );
    }, { tags: ["fuel", "food", "signal", "mind"], baseWeight: 1.1 })
  );

  sharedLongHaulEvents.push(
    defineEvent((state, day) => {
      const roster = getRoster(state);
      return buildDayEvent(
        day,
        "航程预测",
        "AI 建议进行一次百日航程模拟，以评估资源是否足够。",
        [
          {
            key: "optimize",
            label: "优化航线",
            detail: "重新推算燃料曲线。",
            resolve: () => ({
              effects: { fuel: 8, signal: 8, mind: 6 },
              log: "你删去几段弯折的航线，能耗图表变得顺眼。",
              flags: { vectorPlotted: true },
            }),
          },
          {
            key: "drill",
            label: "应急演练",
            detail: roster.length ? "同伴分组演练故障。" : "独自模拟突发。",
            resolve: () => ({
              effects: { mind: roster.length ? 14 : 8, o2: -2 },
              log: roster.length
                ? "你们演练火警、失压和舱外作业，肌肉记住了动作。"
                : "你对着镜面重复操作，直到反应变成直觉。",
              preventMindDecay: true,
            }),
          },
          {
            key: "diet",
            label: "规划进食",
            detail: "决定下一次进食窗口。",
            resolve: () => ({
              effects: { food: 4, satiety: 2 },
              log: "你安排错峰进食，留出额外的储备。",
              preventMindDecay: true,
            }),
          },
        ]
      );
    }, { tags: ["fuel", "signal", "mind", "food"], baseWeight: 1 })
  );
  const surfaceLongHaulEvents = [];
  surfaceLongHaulEvents.push(
    defineEvent((state, day) => {
      const engineer = hasCrewRole(state, "repair");
      return buildDayEvent(
        day,
        "冰原踏勘",
        "Erevia 的冰层在极夜里发出细微的裂响。新的裂谷可能藏着晶体或液态水。",
        [
          {
            key: "crystal",
            label: "采集晶体",
            detail: "提炼燃料补给。",
            resolve: () => {
              const gain = randomInt(8, 14);
              return {
                effects: { fuel: gain, mind: engineer ? 8 : 4 },
                log: engineer
                  ? "Rae 设计了支撑器，晶体矿车安全返回营地。"
                  : "你小心把晶体装进保温箱，手套被寒霜磨白。",
              };
            },
          },
          {
            key: "water",
            label: "融化冰河",
            detail: "补充氧气与饮水。",
            resolve: () => ({
              effects: { o2: 12, satiety: 1 },
              log: "融化的冰雾在舱内形成透明水珠，你们轮流饮下。",
              preventMindDecay: true,
            }),
          },
          {
            key: "map",
            label: "绘制地貌",
            detail: "为基地扩张记录安全路线。",
            resolve: () => ({
              effects: { signal: 10, mind: 10 },
              log: "你把地形标注在全息图上，为未来的温室找到了遮蔽点。",
              preventMindDecay: true,
              flags: { surfaceSurvey: true },
            }),
          },
        ]
      );
    }, { tags: ["fuel", "o2", "signal", "mind"], baseWeight: 1.1 })
  );

  surfaceLongHaulEvents.push(
    defineEvent((state, day) => {
      const care = hasCrewRole(state, "care");
      return buildDayEvent(
        day,
        "极夜温室",
        "临时温室里出现第一批真菌，只要投入热量就能形成稳定的食物循环。",
        [
          {
            key: "expand",
            label: "扩建温室",
            detail: "耗费燃料维持温度。",
            resolve: () => ({
              effects: { fuel: -4, food: 10, mind: 8 },
              log: "你铺设新的加热管，真菌孢子在暗红光里舒展。",
              flags: { surfaceGreenhouse: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "med",
            label: "调配营养剂",
            detail: care ? "Noor 调制镇静饮剂。" : "提取高热量汤剂。",
            resolve: () => ({
              effects: { food: 6, mind: care ? 12 : 6 },
              log: care
                ? "Noor 把真菌磨成药剂，分给每位船员。"
                : "你提取的汤剂让喉咙再次感到温热。",
              preventMindDecay: true,
            }),
          },
          {
            key: "seed",
            label: "封存孢子",
            detail: "为未来的基地保留种子。",
            resolve: () => ({
              effects: { food: 3, signal: 6 },
              log: "你把成熟孢子封进储存舱，希望有一天能在其他世界生根。",
              flags: { surfaceColonySeed: true },
            }),
          },
        ]
      );
    }, { tags: ["food", "mind", "signal"], baseWeight: 1 })
  );

  surfaceLongHaulEvents.push(
    defineEvent(
      (state, day) =>
        buildDayEvent(
          day,
          "极光脉冲",
          "极夜上空出现罕见的亮度，科学官建议同步信号，借助极光把讯息投射得更远。",
          [
            {
              key: "sync",
              label: "同步极光",
              detail: "调节晶体阵列。",
              resolve: () => ({
                effects: { signal: 18, mind: 12 },
                log: "极光顺着晶体折射，灯塔的音调被无限延伸。",
                flags: { surfaceChorus: true, surfaceAwaken: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "sample",
              label: "采集样本",
              detail: "储存能量碎屑。",
              resolve: () => ({
                effects: { fuel: 10, signal: 6 },
                log: "你收集的极光碎屑像微小的流星，提供了额外能源。",
              }),
            },
            {
              key: "meditate",
              label: "静坐观测",
              detail: "让意识与行星同频。",
              resolve: () => ({
                effects: { mind: 18 },
                log: "你躺在冰面上，星光的低语穿过骨骼。",
                preventMindDecay: true,
              }),
            },
          ]
        ),
      { tags: ["signal", "fuel", "mind"], baseWeight: 1 }
    )
  );
  const orbitalLongHaulEvents = [];
  orbitalLongHaulEvents.push(
    defineEvent((state, day) => {
      const nav = hasCrewRole(state, "nav");
      return buildDayEvent(
        day,
        "星港残影",
        "雷达捕捉到早已废弃的星港。结构尚存，或许还能拆下能源模块。",
        [
          {
            key: "dock",
            label: "靠近拆解",
            detail: "冒险获取燃料。",
            resolve: () => {
              const success = Math.random() < (nav ? 0.8 : 0.6);
              return {
                effects: { fuel: success ? 14 : 5, mind: success ? 10 : -4 },
                log: success
                  ? "你稳稳贴近残骸，成功拆下完整的燃料芯。"
                  : "残骸碎裂，金属擦过舱壁，你在惊喘中脱离。",
                mindShock: !success,
              };
            },
          },
          {
            key: "relay",
            label: "申请协助",
            detail: "呼叫经过的商队。",
            resolve: () => ({
              effects: { signal: 12, food: 6 },
              log: "一支流浪舰队回应，丢下一箱干燥蔬菜。",
              flags: { caravanAlliance: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "record",
            label: "记录结构",
            detail: "将星港数据上传档案。",
            resolve: () => ({
              effects: { signal: 10, mind: 8 },
              log: "你整理星港构造，准备将来重建时使用。",
              preventMindDecay: true,
              flags: { archiveLinked: true },
            }),
          },
        ]
      );
    }, { tags: ["fuel", "food", "signal", "mind"], baseWeight: 1.1 })
  );

  orbitalLongHaulEvents.push(
    defineEvent(
      (state, day) =>
        buildDayEvent(
          day,
          "彗尾补给",
          "一颗缓慢的彗星擦过。尾部冻结气体足以补充氧气和饮水。",
          [
            {
              key: "collect",
              label: "部署捕捉帆",
              detail: "收集彗尾。",
              resolve: () => ({
                effects: { o2: 16, satiety: 1 },
                log: "捕捉帆布满霜花，你们吸入久违的清新空气。",
                preventMindDecay: true,
              }),
            },
            {
              key: "distill",
              label: "蒸馏水源",
              detail: "把冰晶化为饮水。",
              resolve: () => ({
                effects: { food: 4, mind: 6 },
                log: "蒸馏器发出轻鸣，透明水珠滴入储罐。",
                preventMindDecay: true,
              }),
            },
            {
              key: "log",
              label: "记录轨迹",
              detail: "上传彗星数据。",
              resolve: () => ({
                effects: { signal: 12 },
                log: "你把彗星轨迹标注在信标网里，提醒后来者。",
              }),
            },
          ]
        ),
      { tags: ["o2", "food", "signal", "mind"], baseWeight: 1.15 }
    )
  );

  orbitalLongHaulEvents.push(
    defineEvent((state, day) => {
      const signaler = hasCrewRole(state, "signal");
      return buildDayEvent(
        day,
        "深空集市",
        "一支临时拼装的集市船队向你广播问候，只要交换故事，他们愿意分享资源。",
        [
          {
            key: "stories",
            label: "交换经历",
            detail: "讲述逃离的经过。",
            resolve: () => ({
              effects: { food: 8, mind: 10 },
              log: "你讲述了 Ecliptica 的爆炸，换来一批新鲜的营养果冻。",
              preventMindDecay: true,
              flags: { caravanAlliance: true },
            }),
          },
          {
            key: "harmonic",
            label: "建立中继",
            detail: signaler ? "Ilya 调整频率。" : "请求他们放大信号。",
            resolve: () => ({
              effects: { signal: 20, mind: signaler ? 12 : 6 },
              log: signaler
                ? "Ilya 与他们同步谐波，信号板亮成一片。"
                : "他们分享中继器，你的求救声传得更远。",
              preventMindDecay: true,
              flags: { rescuePulse: true },
            }),
          },
          {
            key: "trade",
            label: "燃料换补给",
            detail: "付出少量燃料换稀缺物资。",
            resolve: () => ({
              effects: { fuel: -4, food: 6, o2: 6 },
              log: "你把老化燃料换成急救箱与干燥蔬菜。",
            }),
          },
        ]
      );
    }, { tags: ["food", "signal", "mind", "o2"], baseWeight: 1.05 })
  );
  const longHaulMilestones = {};
  longHaulMilestones[19] = (state, day) => {
    const surface = state.flags.landedErevia && !state.flags.surfaceAscended;
    return buildDayEvent(
      day,
      surface ? "极夜盘点" : "深空盘点",
      surface
        ? "基地第十九日，风暴暂歇。你终于可以清点资源，把短期营地改造成长期家园。"
        : "长航第十九日，仪表稳定。是时候整理仓储，制定余下旅程的节奏。",
      [
        {
          key: "inventory",
          label: "全面清点",
          detail: "核对燃料与备用件。",
          resolve: () => ({
            effects: { fuel: 6, food: 4, mind: 8 },
            log: "你重新编号储物柜，写下新的消耗表。",
            flags: { longhaulPrepared: true },
            preventMindDecay: true,
          }),
        },
        {
          key: "delegate",
          label: "分派职责",
          detail: "让同伴承担固定任务。",
          resolve: () => ({
            effects: { mind: 12, signal: 6 },
            log: "你为每位船员安排巡检表，士气提升了一些。",
            flags: { crewSynergy: true },
            preventMindDecay: true,
          }),
        },
        {
          key: "rest",
          label: "轮流休整",
          detail: "关掉非必要系统睡上一整昼夜。",
          resolve: () => ({
            effects: { mind: 20, satiety: 1 },
            log: "你们轮流睡在最暖的角落，梦境暂时恢复了秩序。",
            preventMindDecay: true,
          }),
        },
      ]
    );
  };

  longHaulMilestones[23] = (state, day) => {
    const roster = getRoster(state);
    return buildDayEvent(
      day,
      "专长演练",
      roster.length
        ? "为了撑过漫长旅程，你决定让每位同伴主导一次演练。"
        : "没有伙伴，你只能对着镜面重复所有步骤。",
      [
        {
          key: "repair",
          label: "推进器检修",
          detail: roster.length ? "Rae 拆开引擎。" : "独自检查喷嘴。",
          resolve: () => ({
            effects: { fuel: 5, mind: roster.length ? 10 : 6 },
            log: roster.length
              ? "Rae 换掉老化的点火针，喷嘴声音顺畅。"
              : "你替换喷嘴，指尖因寒冷而僵硬。",
            preventMindDecay: true,
          }),
        },
        {
          key: "med",
          label: "医疗应急",
          detail: roster.length ? "Noor 示范如何处理冻伤。" : "复习医疗资料。",
          resolve: () => ({
            effects: { mind: 12, satiety: 1 },
            log: roster.length
              ? "Noor 把急救包重新分类，任何人都能快速找到工具。"
              : "你仔细背诵止血与保温流程。",
            preventMindDecay: true,
          }),
        },
        {
          key: "nav",
          label: "航线推演",
          detail: roster.length ? "Maru 分享隐藏重力井。" : "与 AI 模拟飞行。",
          resolve: () => ({
            effects: { signal: 12, mind: 8 },
            log: roster.length
              ? "Maru 指出几个隐蔽的重力井，为你节省了燃料。"
              : "你和 AI 重复模拟跳跃，直到它给出满意评分。",
            preventMindDecay: true,
          }),
        },
      ]
    );
  };

  longHaulMilestones[28] = (state, day) => {
    const surface = state.flags.landedErevia && !state.flags.surfaceAscended;
    return buildDayEvent(
      day,
      surface ? "冰洞补给" : "碎片补给",
      surface
        ? "风暴撕开新的冰洞，露出蓝色晶体和冻结植物。"
        : "你的传感器发现一艘刚被撕裂的货舱，里面或许还剩余粮和空气。",
      [
        {
          key: "gather",
          label: surface ? "采集冰蘑" : "搜刮口粮",
          detail: "补充食物储备。",
          resolve: () => ({
            effects: { food: 10, mind: 6 },
            log: surface
              ? "冰蘑的菌伞在手心颤动，你把它们安置到温室。"
              : "你在货柜中找到几箱保质期完好的干粮。",
            preventMindDecay: true,
          }),
        },
        {
          key: "fuel",
          label: surface ? "提炼晶体" : "拆解推进芯",
          detail: "将素材转化为燃料。",
          resolve: () => ({
            effects: { fuel: 12 },
            log: surface
              ? "晶体裂开，淡蓝色能量雾散入储罐。"
              : "你拆下半损的推进芯，把零件焊在逃生舱外。",
          }),
        },
        {
          key: "chart",
          label: surface ? "绘制冰层地图" : "标记废船坐标",
          detail: "让其他幸存者也受益。",
          resolve: () => ({
            effects: { signal: 14, mind: 10 },
            log: "你把坐标上传到共享信标，希望未来有人能找到这里。",
            preventMindDecay: true,
            flags: { archivePlan: true },
          }),
        },
      ]
    );
  };

  longHaulMilestones[33] = (state, day) => {
    const surface = state.flags.landedErevia && !state.flags.surfaceAscended;
    const options = surface
      ? [
          {
            key: "colony",
            label: "建设基地",
            detail: "将营地升级为长期栖居。",
            resolve: () => ({
              effects: { fuel: -4, mind: 12 },
              log: "你决定把 Erevia 当作新的家园，开始扩展骨架。",
              flags: { longGoal: "colony", goalStage: 1, surfaceColonyPlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "beacon",
            label: "建造灯塔",
            detail: "集中资源呼唤救援。",
            resolve: () => ({
              effects: { signal: 16, fuel: -3 },
              log: "你为求救塔挖下地基，准备让极光替你发声。",
              flags: { longGoal: "beacon", goalStage: 1, surfaceBeaconPlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "chorus",
            label: "追随极光",
            detail: "把意识与行星同步。",
            resolve: () => ({
              effects: { mind: 20, signal: 10 },
              log: "你计划在冰原竖起晶体阵列，倾听星海的合唱。",
              flags: { longGoal: "chorus", goalStage: 1, surfaceChorusPlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "ascent",
            label: "准备二次起飞",
            detail: "整备推进器返回星海。",
            resolve: () => ({
              effects: { fuel: 8, signal: 8 },
              log: "你重新计算起飞窗口，清点每一枚螺栓。",
              flags: { longGoal: "ascent", goalStage: 1, ascentPlan: true },
              preventMindDecay: true,
            }),
          },
        ]
      : [
          {
            key: "rescue",
            label: "强化求救",
            detail: "让信号覆盖更大范围。",
            resolve: () => ({
              effects: { signal: 18, mind: 8 },
              log: "你设计新的谐波序列，把求救脉冲送往外缘。",
              flags: { longGoal: "rescue", goalStage: 1, rescuePlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "caravan",
            label: "寻找商队",
            detail: "与流浪舰队结盟。",
            resolve: () => ({
              effects: { signal: 12, food: 6 },
              log: "你把自己的航迹上传到商队频道，换来互助的承诺。",
              flags: { longGoal: "caravan", goalStage: 1, caravanPlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "archive",
            label: "接入档案",
            detail: "寻找星海档案库。",
            resolve: () => ({
              effects: { signal: 14, mind: 10 },
              log: "你与远端节点建立初始握手，记忆即将上传。",
              flags: { longGoal: "archive", goalStage: 1, archivePlan: true },
              preventMindDecay: true,
            }),
          },
          {
            key: "wayfinder",
            label: "绘制新航线",
            detail: "抛弃原航图，另辟蹊径。",
            resolve: () => ({
              effects: { fuel: 6, mind: 12 },
              log: "你决意成为新的引路人，把未知航道写进日志。",
              flags: { longGoal: "wayfinder", goalStage: 1, vectorPlotted: true },
              preventMindDecay: true,
            }),
          },
        ];
    return buildDayEvent(
      day,
      surface ? "抉择长夜" : "制定愿景",
      surface
        ? "极夜久驻，基地需要一个明确方向。你必须选择未来的道路。"
        : "漂流太久，信念必须凝成目标。你决定未来几十日的航向。",
      options
    );
  };

  longHaulMilestones[38] = (state, day) => {
    const goal = state.flags.longGoal;
    const stage = state.flags.goalStage || 1;
    const options = [
      {
        key: "fortify",
        label: "补强基础",
        detail: "投入时间检修舱体。",
        resolve: () => ({
          effects: { fuel: 4, mind: 8, o2: 4 },
          log: "你把缆索、密封圈和电容全部检查一遍，长途航程的根基更稳固。",
          preventMindDecay: true,
        }),
      },
      {
        key: "bond",
        label: "集体会议",
        detail: "让每个人提出自己的担忧。",
        resolve: () => ({
          effects: { mind: 14 },
          log: "你们围成一圈讨论未来的危险，彼此的眼神变得坚定。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const newStage = Math.max(stage, 2);
      const result = { effects: {}, log: "", flags: { goalStage: newStage }, preventMindDecay: true };
      switch (goal) {
        case "colony":
          result.effects = { food: 8, mind: 10, satiety: 1 };
          result.log = "你加固居住舱的保温层，为未来的居所打下基础。";
          result.flags.surfaceGreenhouse = true;
          break;
        case "beacon":
          result.effects = { signal: 18, fuel: -2, mind: 8 };
          result.log = "你竖起新的天线塔，极光灯阵开始向外脉动。";
          result.flags.surfaceBeacon = true;
          break;
        case "chorus":
          result.effects = { mind: 18, signal: 8 };
          result.log = "你布置晶体阵列，让极光的音调与自己的心跳重叠。";
          result.flags.surfaceChorus = true;
          result.flags.surfaceAwaken = true;
          break;
        case "ascent":
          result.effects = { fuel: 12, signal: 6 };
          result.log = "你把熔化的晶体注入推进器，起飞系统再次发出熟悉的嗡鸣。";
          result.flags.surfaceForge = true;
          break;
        case "rescue":
          result.effects = { signal: 20, mind: 8 };
          result.log = "你与回收网络同步频率，求救脉冲持续不间断。";
          result.flags.rescuePulse = true;
          break;
        case "caravan":
          result.effects = { food: 6, signal: 10, mind: 8 };
          result.log = "你向商队发送定时报告，换来一批充满香料味的干粮。";
          result.flags.caravanAlliance = true;
          break;
        case "archive":
          result.effects = { signal: 12, mind: 12 };
          result.log = "你上传更多记忆片段，星海档案库回传暖色的确认灯。";
          result.flags.archiveLinked = true;
          break;
        case "wayfinder":
          result.effects = { fuel: 6, mind: 14 };
          result.log = "你绘制一条穿越暗带的捷径，准备带领后来者走这条路。";
          result.flags.vectorPlotted = true;
          break;
        default:
          break;
      }
      options.push({
        key: "advance",
        label: "推进目标",
        detail: "把计划具体化。",
        resolve: () => result,
      });
    } else {
      options.push({
        key: "plan",
        label: "重新立项",
        detail: "制定长期目标。",
        resolve: () => ({
          effects: { mind: 12, signal: 8 },
          log: "你把愿望再次写在白板上，提醒自己为何仍要活着。",
          preventMindDecay: true,
        }),
      });
    }
    return buildDayEvent(
      day,
      "阶段推进",
      goal
        ? "计划进入关键阶段，你需要亲自推动它。"
        : "缺乏目标的日子会磨掉意志，是时候重新聚焦了。",
      options
    );
  };

  longHaulMilestones[43] = (state, day) => {
    const goal = state.flags.longGoal;
    const stage = state.flags.goalStage || 2;
    const progress = (state.flags.goalProgress || 0) + 1;
    const options = [
      {
        key: "conserve",
        label: "精细配给",
        detail: "重新安排吃喝节奏。",
        resolve: () => ({
          effects: { food: 5, satiety: 2, mind: 6 },
          log: "你制定新的进食表，让饥饿只在必要时刻来临。",
          preventMindDecay: true,
          flags: { rationTight: true },
        }),
      },
      {
        key: "survey",
        label: "广域勘测",
        detail: "扩大雷达的探测范围。",
        resolve: () => ({
          effects: { signal: 12, mind: 8 },
          log: "你扩展雷达基准，捕捉到远方零散的应答。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const flags = { goalStage: Math.max(stage, 2), goalProgress: progress };
      let effects = { mind: 10 };
      let detail = "推进计划";
      let log = "";
      switch (goal) {
        case "colony":
          effects = { food: 8, mind: 12 };
          detail = "扩展居住舱";
          log = "你铺设新的支撑梁，营地开始像真正的聚落。";
          flags.surfaceColony = true;
          break;
        case "beacon":
          effects = { signal: 20, mind: 8 };
          detail = "校准灯塔";
          log = "你调整灯塔的共振频率，求救脉冲覆盖整个极夜。";
          flags.surfaceBeacon = true;
          break;
        case "chorus":
          effects = { mind: 18, signal: 12 };
          detail = "构筑祭坛";
          log = "你在冰原上摆放晶体圆环，极光的声纹与你的呼吸同步。";
          flags.surfaceChorus = true;
          break;
        case "ascent":
          effects = { fuel: 14, mind: 8 };
          detail = "完成推进检修";
          log = "推进器的热量重新充满舱体，你能想象再次升空的轨迹。";
          flags.surfaceAscendPrep = true;
          break;
        case "rescue":
          effects = { signal: 22, mind: 10 };
          detail = "拓展中继";
          log = "你与远端信标建立稳定链路，求救信号变成连绵的吟唱。";
          flags.rescuePulse = true;
          break;
        case "caravan":
          effects = { food: 7, signal: 12, mind: 10 };
          detail = "整合商队资源";
          log = "你与商队制定互助协议，他们承诺在百日内送来补给。";
          flags.caravanAlliance = true;
          break;
        case "archive":
          effects = { signal: 16, mind: 14 };
          detail = "同步档案库";
          log = "档案库的节点向你敞开，你的旅程化作一段清晰的数据。";
          flags.archiveLinked = true;
          break;
        case "wayfinder":
          effects = { fuel: 8, mind: 14, signal: 8 };
          detail = "布设航路标记";
          log = "你在暗带布置浮标，未来的旅人将跟随你的灯光。";
          flags.vectorPlotted = true;
          break;
        default:
          break;
      }
      options.push({
        key: "progress",
        label: detail,
        detail: "推动既定蓝图。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "长期整备",
      goal
        ? "距离终点还有一段距离，你必须巩固计划的每一个环节。"
        : "没有目标的生活像漂浮的尘埃。至少补充物资，让灵魂暂时安稳。",
      options
    );
  };

  longHaulMilestones[47] = (state, day) => {
    const goal = state.flags.longGoal;
    const options = [
      {
        key: "audit",
        label: "终检系统",
        detail: "逐一检测所有仪表。",
        resolve: () => ({
          effects: { fuel: 4, o2: 4, mind: 6 },
          log: "你把每一个仪表都重新标定，任何故障都会提前预警。",
          preventMindDecay: true,
        }),
      },
      {
        key: "story",
        label: "记录口述史",
        detail: "把这段旅程讲给日志听。",
        resolve: () => ({
          effects: { mind: 12, signal: 6 },
          log: "你把每个人的声音都录进日志，提醒自己为何坚持。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const stage = Math.max(3, state.flags.goalStage || 0);
      const progress = (state.flags.goalProgress || 0) + 1;
      const flags = { goalStage: stage, goalProgress: progress, goalPrepared: true };
      let effects = { mind: 12 };
      let log = "";
      let label = "执行预案";
      switch (goal) {
        case "colony":
          effects = { food: 8, mind: 18, signal: 6 };
          log = "霜辉基地的结构被完全封闭，暖光在雪原上投下长影。";
          flags.surfaceColony = true;
          flags.surfaceColonyReady = true;
          break;
        case "beacon":
          effects = { signal: 24, mind: 10 };
          log = "灯塔的脉冲贯穿冰层，极夜像海潮般回应。";
          flags.surfaceBeacon = true;
          flags.beaconReady = true;
          break;
        case "chorus":
          effects = { mind: 22, signal: 14 };
          log = "极光祭坛亮起，意识与行星的边界开始模糊。";
          flags.surfaceChorus = true;
          flags.surfaceAwaken = true;
          flags.chorusReady = true;
          break;
        case "ascent":
          effects = { fuel: 16, mind: 8, signal: 6 };
          log = "推进器的蓝焰在夜空划出弧线，只待下个窗口起飞。";
          flags.surfaceAscendPrep = true;
          flags.ascentReady = true;
          break;
        case "rescue":
          effects = { signal: 24, mind: 12 };
          log = "你的求救声通过中继网汇聚成耀眼的浪潮。";
          flags.rescuePulse = true;
          flags.rescueReady = true;
          break;
        case "caravan":
          effects = { food: 8, signal: 12, mind: 12 };
          log = "商队派出先行艇与你会合，互相共享燃料表与歌谣。";
          flags.caravanAlliance = true;
          flags.caravanReady = true;
          break;
        case "archive":
          effects = { mind: 16, signal: 18 };
          log = "远端档案库打开核心通道，你的记忆与他们的记录交织。";
          flags.archiveLinked = true;
          flags.archiveReady = true;
          break;
        case "wayfinder":
          effects = { fuel: 10, mind: 16, signal: 8 };
          log = "你在星图上标注最后的节点，新的航道已经成形。";
          flags.vectorPlotted = true;
          flags.wayfinderReady = true;
          break;
        default:
          break;
      }
      options.push({
        key: "finalize",
        label,
        detail: "把长期蓝图变成现实。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "终程检验",
      goal
        ? "计划即将收束，任何遗留的环节都会影响未来的结局。"
        : "你静静地打磨舱体，等待一个属于自己的答案。",
      options
    );
  };

  longHaulMilestones[50] = (state, day) => {
    const goal = state.flags.longGoal;
    const goalReady = state.flags.goalPrepared;
    const options = [
      {
        key: "review",
        label: "复盘日志",
        detail: "把前五十日的选择重新过一遍。",
        resolve: () => ({
          effects: { mind: 14, signal: 6 },
          log: "你重读每一条记录，明白自己走过的路径。",
          preventMindDecay: true,
        }),
      },
      {
        key: "reserve",
        label: "储备物资",
        detail: "花一日时间修补储藏。",
        resolve: () => ({
          effects: { food: 6, o2: 6, fuel: 6 },
          log: "你把空的储罐重新填满，下一阶段的消耗不会让你措手不及。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal && goalReady) {
      const progress = (state.flags.goalProgress || 0) + 1;
      const flags = { goalProgress: progress, goalReady: true, goalComplete: true };
      let effects = { mind: 16 };
      let log = "";
      switch (goal) {
        case "colony":
          effects = { mind: 20, food: 10, signal: 10 };
          log = "霜辉基地点亮长明灯，你宣布这里将接纳所有漂泊者。";
          flags.surfaceColony = true;
          break;
        case "beacon":
          effects = { signal: 28, mind: 12 };
          log = "灯塔发出连绵不绝的谐波，求救信号跨越星系。";
          flags.surfaceBeacon = true;
          flags.rescuePulse = true;
          break;
        case "chorus":
          effects = { mind: 26, signal: 16 };
          log = "你沉入极夜的歌声，意识与星海合奏成新的语言。";
          flags.surfaceChorus = true;
          flags.surfaceAwaken = true;
          break;
        case "ascent":
          effects = { fuel: 20, mind: 12, signal: 10 };
          log = "起飞程序确认无误，只要按下开关，逃生舱就能升空。";
          flags.surfaceAscendPrep = true;
          flags.ascentReady = true;
          break;
        case "rescue":
          effects = { signal: 28, mind: 14 };
          log = "中继网确认收到你的讯号，回收船开始向你靠近。";
          flags.rescuePulse = true;
          flags.rescueReady = true;
          break;
        case "caravan":
          effects = { food: 10, mind: 16, signal: 12 };
          log = "商队发来航行计划，邀请你在下一次会合加入舰队。";
          flags.caravanAlliance = true;
          flags.caravanReady = true;
          break;
        case "archive":
          effects = { mind: 20, signal: 20 };
          log = "星海档案库把你的意识列入守护清单，你的故事再不会遗失。";
          flags.archiveLinked = true;
          flags.archiveReady = true;
          break;
        case "wayfinder":
          effects = { fuel: 12, mind: 18, signal: 12 };
          log = "你发布新的航路图，数个漂流舱在远端点亮回应。";
          flags.vectorPlotted = true;
          flags.wayfinderReady = true;
          break;
        default:
          break;
      }
      options.push({
        key: "commit",
        label: "执行计划",
        detail: "接受这条道路的结局。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
      options.push({
        key: "delay",
        label: "暂缓执行",
        detail: "继续观察更多日子。",
        resolve: () => ({
          effects: { mind: 8, signal: 4 },
          log: "你决定再观察更久的星光，也许未来还有新的选择。",
          flags: { goalReady: false, goalDeferred: true },
          preventMindDecay: true,
        }),
      });
    } else if (goal) {
      options.push({
        key: "focus",
        label: "补完准备",
        detail: "把剩余的步骤全部补齐。",
        resolve: () => ({
          effects: { mind: 14, signal: 8 },
          log: "你整理清单，把所有未完成的细节逐条划掉。",
          flags: { goalPrepared: true, goalStage: Math.max(3, state.flags.goalStage || 0) },
          preventMindDecay: true,
        }),
      });
    } else {
      options.push({
        key: "search",
        label: "寻找意义",
        detail: "在星海里寻找下一个目标。",
        resolve: () => ({
          effects: { mind: 18, signal: 10 },
          log: "你盯着窗外的星芒，重新勾勒心中的方向。",
          preventMindDecay: true,
        }),
      });
    }
    return buildDayEvent(
      day,
      "抉择日",
      goal
        ? "五十日的坚持来到拐点。你可以执行既定计划，也可以选择继续观望。"
        : "漫长的旅程提醒你：没有目标就无法得到结局。",
      options
    );
  };

  longHaulMilestones[60] = (state, day) => {
    const goal = state.flags.longGoal;
    const options = [
      {
        key: "restock",
        label: "巡检仓库",
        detail: "补齐老化的滤芯与密封环。",
        resolve: () => ({
          effects: { fuel: 6, o2: 8, mind: 8 },
          log: "你把磨损的滤芯全部换新，长途旅程又多了一份保障。",
          preventMindDecay: true,
        }),
      },
      {
        key: "share",
        label: "广播播报",
        detail: "向其他幸存者广播生存经验。",
        resolve: () => ({
          effects: { signal: 14, mind: 10 },
          log: "你的频道被反复转发，陌生的声音向你致谢。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const legend = Math.max(state.flags.legendStage || 0, 1);
      const flags = { legendStage: legend };
      let effects = { mind: 12 };
      let label = "深化计划";
      let log = "";
      switch (goal) {
        case "colony":
          effects = { food: 12, mind: 18, signal: 8 };
          label = "扩建霜辉城";
          log = "你为基地增建新的穹顶居所，霜辉城的轮廓愈发清晰。";
          flags.surfaceCitadel = true;
          break;
        case "beacon":
          effects = { signal: 26, mind: 12 };
          label = "搭建灯塔网络";
          log = "你在冰原上布置多个信标，灯塔的歌声开始相互呼应。";
          flags.beaconNetwork = true;
          break;
        case "chorus":
          effects = { mind: 24, signal: 16 };
          label = "沉入合唱";
          log = "你让意识在极光间穿行，星海的旋律延伸到更远的星域。";
          flags.chorusMantle = true;
          flags.surfaceAwaken = true;
          break;
        case "ascent":
          effects = { fuel: 18, mind: 10, signal: 10 };
          label = "打造远航船壳";
          log = "你为逃生舱加装扩展舱段，它已准备好飞往未知航道。";
          flags.deepVoyage = true;
          break;
        case "rescue":
          effects = { signal: 28, mind: 14 };
          label = "组织救援舰";
          log = "你与回收舰队建立常驻联系，他们开始清理附近的残骸带。";
          flags.rescueArmada = true;
          break;
        case "caravan":
          effects = { food: 12, signal: 14, mind: 14 };
          label = "汇聚商队";
          log = "多支流浪舰队在你的协调下组建成新的商道。";
          flags.caravanFleet = true;
          break;
        case "archive":
          effects = { mind: 20, signal: 22 };
          label = "拓展档案节点";
          log = "你负责的档案节点连通更多星球，记忆从此不会断层。";
          flags.archiveContinuum = true;
          break;
        case "wayfinder":
          effects = { fuel: 14, mind: 18, signal: 12 };
          label = "标定暗带航线";
          log = "你把暗带航线刻在量子浮标上，引路灯穿透了迷雾。";
          flags.wayfinderBeyond = true;
          break;
        default:
          break;
      }
      options.push({
        key: "legend",
        label,
        detail: "让计划跨越百日。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "延长航程",
      goal
        ? "计划迈入更宏大的阶段。只有大胆扩张，才能支撑百日之后的未来。"
        : "你决定继续漂流，保持系统与希望的稳定。",
      options
    );
  };

  longHaulMilestones[75] = (state, day) => {
    const goal = state.flags.longGoal;
    const options = [
      {
        key: "resilience",
        label: "体能循环",
        detail: "花一日训练肌肉和呼吸。",
        resolve: () => ({
          effects: { mind: 12, satiety: 1 },
          log: "你们在狭窄的舱内做缓慢的力量训练，骨骼再次感到扎实。",
          preventMindDecay: true,
        }),
      },
      {
        key: "commune",
        label: "星际问候",
        detail: "向所有已知频道发送慰问。",
        resolve: () => ({
          effects: { signal: 16, mind: 12 },
          log: "数十个弱小的灯光回应你，证明这片宇宙并不空荡。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const legend = Math.max(state.flags.legendStage || 0, 2);
      const flags = { legendStage: legend };
      let effects = { mind: 14 };
      let label = "巩固遗产";
      let log = "";
      switch (goal) {
        case "colony":
          effects = { food: 14, mind: 20, signal: 10 };
          label = "成立霜辉议会";
          log = "霜辉城的居民开始制定自治章程，你们真正成为一个聚落。";
          flags.legendColony = true;
          break;
        case "beacon":
          effects = { signal: 30, mind: 14 };
          label = "点亮星座";
          log = "多座灯塔按特定节奏闪烁，形成横跨天际的求救星座。";
          flags.legendBeacon = true;
          break;
        case "chorus":
          effects = { mind: 26, signal: 18 };
          label = "与极光同唱";
          log = "你分裂出意识碎片，让它们在极光中持续吟唱。";
          flags.legendChorus = true;
          break;
        case "ascent":
          effects = { fuel: 20, mind: 12, signal: 12 };
          label = "编队远航";
          log = "多艘漂流舱在你的指挥下编队，它们将跟随你前往未知的航道。";
          flags.legendVoyage = true;
          break;
        case "rescue":
          effects = { signal: 32, mind: 16 };
          label = "救援舰队";
          log = "你组织的救援舰队开始主动寻找其他求救信号。";
          flags.legendRescue = true;
          break;
        case "caravan":
          effects = { food: 14, signal: 16, mind: 18 };
          label = "星际集会";
          log = "商队在你的旗帜下举办集会，互换物资与故事。";
          flags.legendCaravan = true;
          break;
        case "archive":
          effects = { mind: 22, signal: 24 };
          label = "记忆中枢";
          log = "你建立一个漂浮档案站，任何漂泊者都能在此上传记忆。";
          flags.legendArchive = true;
          break;
        case "wayfinder":
          effects = { fuel: 16, mind: 20, signal: 14 };
          label = "灯火罗盘";
          log = "你布设的浮标组成罗盘，带领旅人穿过最危险的暗带。";
          flags.legendWayfinder = true;
          break;
        default:
          break;
      }
      options.push({
        key: "legacy",
        label,
        detail: "让你的计划留下长久的印记。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "遗产奠基",
      goal
        ? "七十五日后的你不再只是求生者，而是某条道路的开创者。"
        : "你提醒自己，即使孤身一人，也能留下痕迹。",
      options
    );
  };

  longHaulMilestones[90] = (state, day) => {
    const goal = state.flags.longGoal;
    const options = [
      {
        key: "storm",
        label: "穿越离子风暴",
        detail: "冒险换取额外能源。",
        resolve: () => {
          const gain = randomInt(8, 16);
          return {
            effects: { fuel: gain, mind: -4 },
            log: "你顶着离子风暴穿越暗带，船体被闪电抚过后仍然完整。",
          };
        },
      },
      {
        key: "still",
        label: "进入静默",
        detail: "关闭大部分系统，感受宇宙脉动。",
        resolve: () => ({
          effects: { mind: 22, signal: 10 },
          log: "你将系统调到最低，意识在静默中延伸。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      const legend = Math.max(state.flags.legendStage || 0, 3);
      const flags = { legendStage: legend };
      let effects = { mind: 18 };
      let label = "跨越极限";
      let log = "";
      switch (goal) {
        case "colony":
          effects = { food: 16, mind: 24, signal: 12 };
          label = "开启霜辉学院";
          log = "霜辉城建立第一所学院，未来的拓荒者将在此受训。";
          flags.legendColony = true;
          flags.citadelLegacy = true;
          break;
        case "beacon":
          effects = { signal: 34, mind: 18 };
          label = "组建灯塔舰队";
          log = "灯塔不再固定于地面，它们开始在星海中移动，为求救者领航。";
          flags.legendBeacon = true;
          flags.beaconConstellation = true;
          break;
        case "chorus":
          effects = { mind: 30, signal: 20 };
          label = "化身极光";
          log = "你的意识融入极光，成为星海中永恒的一抹乐章。";
          flags.legendChorus = true;
          flags.chorusAscend = true;
          break;
        case "ascent":
          effects = { fuel: 24, mind: 14, signal: 14 };
          label = "开启远征";
          log = "你为长距跃迁准备最后的导航补丁，将带领编队离开暗带。";
          flags.legendVoyage = true;
          flags.voyageArmada = true;
          break;
        case "rescue":
          effects = { signal: 36, mind: 20 };
          label = "构建救援网络";
          log = "你的救援舰队在各个星域建立前哨站，任何求救都会被捕捉。";
          flags.legendRescue = true;
          flags.rescueWeb = true;
          break;
        case "caravan":
          effects = { food: 16, signal: 18, mind: 20 };
          label = "形成流浪邦联";
          log = "商队联盟签订共同航图，你们成为星海中的移动城邦。";
          flags.legendCaravan = true;
          flags.caravanConstellation = true;
          break;
        case "archive":
          effects = { mind: 26, signal: 26 };
          label = "刻录永恒";
          log = "档案中枢将你的意识备份于多个星系，再无人会忘记你。";
          flags.legendArchive = true;
          flags.archiveEternal = true;
          break;
        case "wayfinder":
          effects = { fuel: 18, mind: 24, signal: 16 };
          label = "拓荒终点";
          log = "你把暗带尽头的安全港标注出来，旅人终于有了休憩的地方。";
          flags.legendWayfinder = true;
          flags.wayfinderHarbor = true;
          break;
        default:
          break;
      }
      options.push({
        key: "ascend",
        label,
        detail: "让你的事业跨越极限。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "星海考验",
      goal
        ? "第九十日的宇宙向你发出考验。跨过去，便能触及超越生存的意义。"
        : "你在风暴中握紧方向盘，告诉自己一切值得。",
      options
    );
  };

  longHaulMilestones[100] = (state, day) => {
    const goal = state.flags.longGoal;
    const options = [
      {
        key: "sustain",
        label: "继续漂流",
        detail: "保持现状，接受更多未知。",
        resolve: () => ({
          effects: { mind: 14, signal: 6 },
          log: "你决定让旅程继续延伸，未来的终点仍待寻找。",
          preventMindDecay: true,
        }),
      },
      {
        key: "rest",
        label: "百日庆典",
        detail: "与同伴分享这段旅途。",
        resolve: () => ({
          effects: { mind: 20, food: -2 },
          log: "你们把仅存的甜品分给彼此，百日旅程终于有了庆祝的理由。",
          preventMindDecay: true,
        }),
      },
    ];
    if (goal) {
      let effects = { mind: 28 };
      let log = "";
      const flags = { goalComplete: true, legendFinal: goal };
      switch (goal) {
        case "colony":
          effects = { mind: 26, signal: 16, food: 12 };
          log = "霜辉城成为新的文明火种，你宣誓守护这里的每一盏灯。";
          flags.surfaceCitadel = true;
          flags.legendColony = true;
          break;
        case "beacon":
          effects = { signal: 38, mind: 18 };
          log = "灯塔群构成永不熄灭的求救星河，远方的舰队将其作为导航。";
          flags.beaconNetwork = true;
          flags.legendBeacon = true;
          break;
        case "chorus":
          effects = { mind: 34, signal: 22 };
          log = "你把身体交给冰原，只留下在极光里回荡的意识。";
          flags.legendChorus = true;
          flags.surfaceAwaken = true;
          break;
        case "ascent":
          effects = { fuel: 26, mind: 18, signal: 16 };
          log = "你率领整支编队升空，驶向没有标记的星海。";
          flags.legendVoyage = true;
          flags.ascentReady = true;
          break;
        case "rescue":
          effects = { signal: 40, mind: 20 };
          log = "你把指挥权移交给救援网络，百日航程化作他人的求生指南。";
          flags.legendRescue = true;
          flags.rescuePulse = true;
          break;
        case "caravan":
          effects = { food: 18, mind: 22, signal: 18 };
          log = "星际商队围绕你的旗舰旋转，移动城邦正式启航。";
          flags.legendCaravan = true;
          flags.caravanAlliance = true;
          break;
        case "archive":
          effects = { mind: 28, signal: 28 };
          log = "你的灵魂被刻写进星海档案，每一次呼吸都化作未来的故事。";
          flags.legendArchive = true;
          flags.archiveLinked = true;
          break;
        case "wayfinder":
          effects = { fuel: 20, mind: 24, signal: 18 };
          log = "你在暗带终点竖起罗盘，告诉后来者这里可以安全停靠。";
          flags.legendWayfinder = true;
          flags.vectorPlotted = true;
          break;
        default:
          break;
      }
      options.push({
        key: "final",
        label: "成就百日",
        detail: "让这段旅程进入传说。",
        resolve: () => ({ effects, log, flags, preventMindDecay: true }),
      });
    }
    return buildDayEvent(
      day,
      "百日终章",
      goal
        ? "你已守住一百天。无论选择继续或停驻，这段历史都将留下名字。"
        : "孤身百日，你仍然记得自己的心跳。是否该寻找新的方向？",
      options
    );
  };

  function calculateTagWeight(state, tag) {
    const res = state?.resources || {};
    switch (tag) {
      case "fuel": {
        const value = Number(res.fuel || 0);
        if (value <= 18) return 2.2;
        if (value <= 32) return 1.1;
        return 0;
      }
      case "food": {
        const value = Number(res.food || 0);
        if (value <= 6) return 2.4;
        if (value <= 14) return 1.2;
        return 0;
      }
      case "o2": {
        const value = Number(res.o2 || 0);
        if (value <= 28) return 2;
        if (value <= 48) return 1;
        return 0;
      }
      case "mind": {
        const value = Number(res.mind || 0);
        if (value <= 40) return 1.8;
        if (value <= 65) return 0.9;
        return 0;
      }
      case "signal": {
        const value = Number(res.signal || 0);
        if (value <= 12) return 1.6;
        if (value <= 30) return 0.8;
        return 0;
      }
      case "satiety": {
        const value = Number(res.satiety || 0);
        if (value <= 0) return 1.5;
        if (value <= 1) return 0.7;
        return 0;
      }
      default:
        return 0;
    }
  }

  function fromPool(pool, state, day, seed = 0) {
    if (!pool.length) return null;
    const weights = pool.map((generator, index) => {
      if (!generator) return 0;
      if (typeof generator.weight === "function") {
        const value = Number(generator.weight(state, day));
        return Number.isFinite(value) ? Math.max(0, value) : 0;
      }
      const base = Number.isFinite(generator.baseWeight) ? generator.baseWeight : 1;
      const tags = Array.isArray(generator.tags) ? generator.tags : [];
      const bonus = tags.reduce((sum, tag) => sum + calculateTagWeight(state, tag), 0);
      const jitter = ((Math.abs(Math.floor(day + seed + index)) % 7) + 1) * 0.001;
      return Math.max(0, base + bonus + jitter);
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) {
      const index = Math.abs(Math.floor(day + seed)) % pool.length;
      return pool[index];
    }
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        return pool[i];
      }
    }
    return pool[pool.length - 1];
  }

  function getExtendedEvent(state, day) {
    if (!state) return null;
    const milestone = longHaulMilestones[day];
    if (typeof milestone === "function") {
      return milestone(state, day);
    }
    const surface = state.flags.landedErevia && !state.flags.surfaceAscended;
    const pool = surface ? surfaceLongHaulEvents : orbitalLongHaulEvents;
    const shared = fromPool(sharedLongHaulEvents, state, day, surface ? 2 : 5);
    const pick = fromPool(pool, state, day, state.flags.goalStage || 0);
    const generator = pick || shared;
    if (!generator) return shared ? shared(state, day) : null;
    return generator(state, day);
  }

  function getRoster(state) {
    if (!state?.flags) return [];
    if (!Array.isArray(state.flags.crewRoster)) {
      state.flags.crewRoster = [];
    }
    return state.flags.crewRoster;
  }

  function hasCrewRole(state, focus) {
    return getRoster(state).some((member) => member.focus === focus);
  }

  function getCrewById(state, id) {
    return getRoster(state).find((member) => member.id === id) || null;
  }

  function pickCrewForLoss(state, preferredFocus) {
    const roster = getRoster(state);
    if (!roster.length) return null;
    if (preferredFocus) {
      const match = roster.find((member) => member.focus === preferredFocus);
      if (match) {
        return match.id;
      }
    }
    const index = Math.floor(Math.random() * roster.length);
    return roster[index]?.id || null;
  }

  function crewListLabel(state) {
    const roster = getRoster(state);
    if (!roster.length) return "无";
    return roster.map((member) => `${member.name}·${member.role}`).join(" / ");
  }

  function chooseCrew(state, priorities) {
    const roster = getRoster(state);
    const owned = new Set(roster.map((member) => member.id));
    for (const key of priorities) {
      if (!owned.has(key) && crewTemplates[key]) {
        return key;
      }
    }
    const remaining = Object.keys(crewTemplates).filter((key) => !owned.has(key));
    return remaining[0] || null;
  }

  function getInventory(state) {
    if (!state?.flags) return [];
    if (!Array.isArray(state.flags.inventory)) {
      state.flags.inventory = [];
    }
    return state.flags.inventory;
  }

  function hasItem(state, id) {
    if (!id) return false;
    const inventory = getInventory(state);
    return inventory.includes(id);
  }

  function addItem(state, id) {
    if (!state || !id) return false;
    const inventory = getInventory(state);
    if (inventory.includes(id)) {
      return false;
    }
    inventory.push(id);
    return true;
  }

  function removeItem(state, id) {
    if (!state || !id) return false;
    const inventory = getInventory(state);
    const index = inventory.indexOf(id);
    if (index >= 0) {
      inventory.splice(index, 1);
      return true;
    }
    return false;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return {
    countdownEvents,
    randomInt,
    crewTemplates,
    getRoster,
    hasCrewRole,
    getCrewById,
    pickCrewForLoss,
    crewListLabel,
    chooseCrew,
    getExtendedEvent,
    getInventory,
    hasItem,
    addItem,
    removeItem,
    getItemName,
    ITEM_CATALOG,
  };
})();

const EFFECT_LABELS = {
  fuel: "燃料",
  food: "食物",
  o2: "O₂",
  mind: "心智",
  signal: "信号",
  satiety: "饱腹",
  crew: "人员",
  time: "时间",
};

const {
  crewTemplates,
  getRoster,
  hasCrewRole,
  getCrewById,
  pickCrewForLoss,
  crewListLabel,
  chooseCrew,
  getExtendedEvent,
  getInventory: getInventoryState,
  hasItem: hasInventoryItem,
  addItem: addInventoryItem,
  removeItem: removeInventoryItem,
  getItemName,
} = StarfallData;

const StarfallPage = {
  _state: null,
  _els: null,
  _handlers: null,
  presence() {
    if (!this._state) {
      return { activity: "game:starfall" };
    }
    const { phase, resources } = this._state;
    const details = {};
    if (phase === "day" || phase === "ending") {
      details.day = resources.day || 0;
      details.signal = Math.round(resources.signal || 0);
      details.score = Math.max(0, Math.round(this.calculateScore()));
    }
    return { activity: `game:starfall:${phase}`, details };
  },
  render() {
    return `
      <div class=\"card starfall-card\">
        <h2 class=\"starfall-title\">星际余生 · Starfall 60</h2>
        <p class=\"starfall-sub\">倒计时、抉择与孤独求生。每个选项都会在之后的十日里留下痕迹。</p>
      </div>
      <div class=\"card starfall-card starfall-card--layout\">
        <div class=\"starfall-layout\">
          <div class=\"starfall-main\">
            <section class=\"starfall-stats\" id=\"starfall-stats\"></section>
            <section class=\"starfall-story\" id=\"starfall-story\"></section>
            <section class=\"starfall-outcome is-hidden\" id=\"starfall-outcome\"></section>
            <section class=\"starfall-choices\" id=\"starfall-choices\"></section>
          </div>
          <aside class=\"starfall-side\">
            <section class=\"starfall-log\" id=\"starfall-log\" aria-live=\"polite\"></section>
            <section class=\"starfall-codex\" id=\"starfall-codex\"></section>
            <section class=\"starfall-leaderboard\" id=\"starfall-leaderboard\"></section>
          </aside>
        </div>
        <div class=\"starfall-actions\">
          <button class=\"btn ghost\" id=\"starfall-audio\">🔇 音景关闭</button>
          <button class=\"btn ghost\" id=\"starfall-restart\">重置旅程</button>
        </div>
      </div>
    `;
  },
  bind() {
    this._audio = {
      enabled: false,
      userMuted: false,
      currentMode: null,
      currentPreset: null,
      pendingMode: "prelude",
    };
    this._isAdmin = (typeof API !== "undefined") && !!(API._me && API._me.is_admin);
    const feature = (typeof API !== "undefined" && API._features) ? (API._features.starfall || {}) : {};
    this._feature = feature;
    this._locked = !this._isAdmin && !feature.available;
    this._els = {
      stats: document.getElementById("starfall-stats"),
      story: document.getElementById("starfall-story"),
      choices: document.getElementById("starfall-choices"),
      log: document.getElementById("starfall-log"),
      codex: document.getElementById("starfall-codex"),
      leaderboard: document.getElementById("starfall-leaderboard"),
      restart: document.getElementById("starfall-restart"),
      audioToggle: document.getElementById("starfall-audio"),
      outcome: document.getElementById("starfall-outcome"),
    };
    this._handlers = {
      onChoice: (e) => {
        const btn = e.target.closest("[data-choice]");
        if (!btn) return;
        if (btn.classList.contains("is-disabled")) return;
        const key = btn.dataset.choice;
        this.handleChoice(key);
      },
      onRestart: () => {
        if (this._locked) return;
        this.initState();
        this.renderState();
        this.refreshProfile();
        this.refreshLeaderboard();
      },
      onToggleAudio: () => {
        this.toggleAudio();
      },
      onToggleLeaderboard: (ev) => {
        const btn = ev.target.closest('[data-role="starfall-leaderboard-toggle"]');
        if (!btn) return;
        ev.preventDefault();
        this._showLeaderboard = !this._showLeaderboard;
        this.renderLeaderboard();
      },
    };
    this._leaderboard = [];
    this._leaderboardSelf = null;
    this._profile = null;
    this._showLeaderboard = false;
    this._els.choices.addEventListener("click", this._handlers.onChoice);
    this._els.restart.addEventListener("click", this._handlers.onRestart);
    if (this._els.audioToggle) {
      this._els.audioToggle.addEventListener("click", this._handlers.onToggleAudio);
    }
    if (this._els.leaderboard) {
      this._els.leaderboard.addEventListener("click", this._handlers.onToggleLeaderboard);
    }
    if (this._locked) {
      this.renderLocked();
      this.disableAudio(false, true);
      return;
    }
    this.initState();
    this.renderState();
    this.refreshProfile();
    this.refreshLeaderboard();
  },
  teardown() {
    if (this._els?.choices && this._handlers?.onChoice) {
      this._els.choices.removeEventListener("click", this._handlers.onChoice);
    }
    if (this._els?.restart && this._handlers?.onRestart) {
      this._els.restart.removeEventListener("click", this._handlers.onRestart);
    }
    if (this._els?.audioToggle && this._handlers?.onToggleAudio) {
      this._els.audioToggle.removeEventListener("click", this._handlers.onToggleAudio);
    }
    if (this._els?.leaderboard && this._handlers?.onToggleLeaderboard) {
      this._els.leaderboard.removeEventListener("click", this._handlers.onToggleLeaderboard);
    }
    this.disableAudio(false, true);
    this._state = null;
    this._els = null;
    this._handlers = null;
    this._isAdmin = false;
    this._leaderboard = [];
    this._leaderboardSelf = null;
    this._profile = null;
  },
  loadCodex() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem('starfall-codex');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => entry && typeof entry.id === 'string')
        .map((entry) => ({
          id: entry.id,
          title: entry.title || entry.id,
          summary: entry.summary || '',
          tone: entry.tone || 'neutral',
        }));
    } catch (err) {
      return [];
    }
  },
  persistCodex(list = []) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem('starfall-codex', JSON.stringify(list));
    } catch (err) {
      /* ignore */
    }
  },
  unlockEnding(ending) {
    if (!ending || !ending.id) return;
    if (!this._state) return;
    const codex = Array.isArray(this._state.codex) ? [...this._state.codex] : [];
    if (!codex.find((entry) => entry.id === ending.id)) {
      codex.push({
        id: ending.id,
        title: ending.title || ending.id,
        summary: ending.codexSummary || ending.body || '',
        tone: ending.codexTone || 'neutral',
      });
      this._state.codex = codex;
      this.persistCodex(codex);
      this.renderCodex();
    }
  },
  initState() {
    this._state = {
      phase: "intro",
      countdownIndex: 0,
      resources: {
        day: 0,
        fuel: 56,
        food: 24,
        o2: 72,
        mind: 100,
        crew: 0,
        signal: 0,
        satiety: 3,
      },
      score: 0,
      currentEnding: null,
      time: 60,
      flags: { inventory: [] },
      log: [],
      codex: this.loadCodex(),
      pendingStory: {
        title: "逃离 Ecliptica",
        body: "飞船内爆计时开始。你还有 60 秒。",
      },
    };
    this.renderState();
  },
  startCountdown() {
    this._state.phase = "countdown";
    this._state.countdownIndex = 0;
    this._state.time = 60;
    this._state.log = [];
    this._state.currentEnding = null;
    this.pushLog("主控舱发出尖锐的蜂鸣。每个选择都会跟随你进入深空。", "system");
    this.showCountdownEvent();
  },
  showCountdownEvent() {
    const event = StarfallData.countdownEvents[this._state.countdownIndex];
    if (!event) {
      this.finishCountdown();
      return;
    }
    this._state.pendingStory = {
      title: `${event.time} 秒 · ${event.title}`,
      body: event.description,
      options: event.options,
      countdown: true,
    };
    this.renderState();
  },
  finishCountdown() {
    this._state.phase = "interlude";
    const { fuel, food, o2, mind, crew, signal } = this._state.resources;
    const summary = `燃料 ${Math.round(fuel)} · 食物 ${Math.round(food)} · 氧气 ${Math.round(o2)} · 人员 ${crew} · 心智 ${Math.round(mind)} · 信号 ${Math.round(signal)}`;
    this.pushLog("救生舱弹离船体。你拖着伤痕进入黑暗。", "system");
    this.pushLog(`初始状态：${summary}`, "system");
    this.startDayPhase();
  },
  startDayPhase() {
    this._state.phase = "day";
    this._state.resources.day = 1;
    this.showDayEvent();
  },
  showDayEvent() {
    const day = this._state.resources.day;
    const event = this.getDayEvent(day);
    if (!event) {
      if (!this.checkEnding()) {
        this._state.pendingStory = null;
        this.renderState();
      }
      return;
    }
    this._state.pendingStory = event;
    this.renderState();
  },
  getDayEvent(day) {
    const state = this._state;
    const r = state.resources;
    const flags = state.flags;
    const hall = r.mind <= 50;
    switch (day) {
      case 1:
        return {
          title: "Day 1 · 寂静",
          body: "你在救生舱醒来。舱壁渗着冷凝水。导航仪在昏暗处闪烁。",
          options: [
            {
              key: "nav",
              label: "检查导航",
              detail: "燃料换取一条信号轨迹。",
              resolve: () => {
                const successChance = flags.signalChip ? 0.85 : 0.65;
                const success = Math.random() < successChance;
                const outcome = {
                  effects: { fuel: -5 },
                  log: success
                    ? "备用导航芯片接通，你捕捉到一条衰减的 SOS。"
                    : "导航屏满是雪花噪点，只有自己的呼吸声。",
                  flags: success ? { signalRoute: true } : {},
                };
                if (success) {
                  outcome.effects.signal = 20;
                  outcome.preventMindDecay = true;
                } else {
                  outcome.effects.mind = -6;
                }
                return outcome;
              },
            },
            {
              key: "sort",
              label: "整理物资",
              detail: "核对箱子里的资源。",
              resolve: () => ({
                effects: { food: -1, mind: 14 },
                log: "你把物资按颜色码排列，混乱终于有了秩序。",
                preventMindDecay: true,
              }),
            },
            ...(r.crew > 0
              ? [
                  {
                    key: "hail",
                    label: "呼叫幸存者",
                    detail: "确认他们还活着。",
                    resolve: () => ({
                      effects: { mind: 10 },
                      log: "你在对讲里听见虚弱的回应。还有人在。",
                      flags: { crewBond: true },
                      preventMindDecay: true,
                    }),
                  },
                ]
              : []),
          ],
        };
      case 2:
        return {
          title: "Day 2 · 饥饿的秩序",
          body: (() => {
            const base = r.crew > 0
              ? "食物只剩下一周的量。船员们争论是否要节省配给。"
              : "你计算着自己的消耗。舱内飘着烤焦塑料的味道。";
            if (flags.allyAwaiting || flags.guidedCrew) {
              return base + " 舱门间歇传来敲击声。也许是你在火海里救下的人。";
            }
            return base;
          })(),
          options: [
            {
              key: "share",
              label: "平均分配",
              detail: "公平会让人冷静。",
              resolve: () => ({
                effects: { mind: 8, food: -Math.max(1, r.crew || 1) },
                log: "你把口粮平分。大家沉默地咀嚼。",
                preventMindDecay: true,
              }),
            },
            {
              key: "self",
              label: "优先自己",
              detail: "确保你活下去。",
              resolve: () => ({
                effects: { mind: -24 },
                log: "你锁上自己的配给柜。有人用力地摔门离开。",
                flags: { loyaltyDrop: true },
                mindShock: true,
              }),
            },
            {
              key: "pause",
              label: "暂停配给",
              detail: "把口粮封存到紧急模式。",
              resolve: () => ({
                effects: { mind: -30, food: 3 },
                log: "你宣布进入节约日。胃痛在夜里敲击你的肋骨。",
                flags: { rationTight: true },
                mindShock: true,
              }),
            },
            ...((flags.allyAwaiting || flags.guidedCrew)
              ? [{
                  key: "airlock",
                  label: "开启外舱",
                  detail: "让敲门的人进来并分享一点口粮。",
                  resolve: (state) => {
                    const free = Math.max(0, 3 - (r.crew || 0));
                    const joinedId = free > 0 ? chooseCrew(state, ["noor", "ilya"]) : null;
                    const updateFlags = { allyAwaiting: false, guidedCrew: false };
                    if (joinedId) {
                      updateFlags.savedCrew = true;
                    }
                    return {
                      effects: { food: joinedId ? -1 : 0, mind: joinedId ? 12 : 6 },
                      crewGain: joinedId ? [joinedId] : undefined,
                      log: joinedId
                        ? `你打开外舱闸门。${crewTemplates[joinedId]?.name || "一名船员"} 跌入舱内，喃喃地说着谢谢。`
                        : "舱门外只有风声。你把通道重新锁上。",
                      flags: updateFlags,
                      preventMindDecay: true,
                    };
                  },
                }]
              : []),
          ],
        };
      case 3:
        if (flags.signalRoute) {
          return {
            title: "Day 3 · 信号源",
            body: "雷达捕捉到一条衰弱的坐标 (-23, 81)。燃料却告急。",
            options: [
              {
                key: "force",
                label: "强行前往",
                detail: "燃料 -15，赌一次获救。",
                resolve: (state) => {
                  const success = Math.random() < 0.4;
                  const outcome = {
                    effects: { fuel: -15 },
                    log: success
                      ? "你找到一艘翻滚的研究舱。里面还有氧气和一名科学官。"
                      : "信号源竟是漂浮的金属残骸。你的油箱只剩薄薄一层。",
                  };
                  if (success) {
                    const reward = Math.random() < 0.5 ? "o2" : "crew";
                    if (reward === "o2") {
                      outcome.effects.o2 = 15;
                      outcome.effects.mind = 6;
                    } else {
                      const scientistId = chooseCrew(state, ["ilya", "noor"]);
                      if (scientistId) {
                        outcome.crewGain = [scientistId];
                        outcome.effects.mind = 8;
                      } else {
                        outcome.effects.mind = 6;
                      }
                    }
                    outcome.preventMindDecay = true;
                    outcome.flags = { rescueScientist: true };
                  } else {
                    outcome.effects.mind = -12;
                    outcome.mindShock = true;
                  }
                  return outcome;
                },
              },
              {
                key: "log",
                label: "记录坐标",
                detail: "先把信号编号，等待更好的机会。",
                resolve: () => ({
                  effects: { mind: -2, signal: 6 },
                  log: "你记录下衰减的坐标，提醒自己总有回头的一天。",
                  flags: { signalLog: true },
                }),
              },
              {
                key: "broadcast",
                label: "发信",
                detail: "消耗燃料，扩大求救波束。",
                resolve: () => ({
                  effects: { fuel: -5, signal: 20 },
                  log: "你把信号锁定在远方的灯塔。指针微微偏转。",
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 3 · 漂移",
          body: "只有宇宙背景噪声。坐标像失焦的星星一样滑过。",
          options: [
            {
              key: "trim",
              label: "调整航向",
              detail: "微调姿态，避免漂离航道。",
              resolve: () => ({
                effects: { fuel: -8, mind: -4 },
                log: "你点燃姿态控制器。微弱的推力让舱壁轻颤。",
              }),
            },
            {
              key: "wait",
              label: "保持漂移",
              detail: "节省资源，承受孤独。",
              resolve: () => ({
                effects: { mind: -8 },
                log: "你让自己随星海漂移。计时器在心跳之间拉长。",
              }),
            },
            {
              key: "ping",
              label: "随机发射讯号",
              detail: "也许有人会听到。",
              resolve: () => ({
                effects: { fuel: -3, signal: 10 },
                log: "你释放一串短促的脉冲。宇宙没有回应。",
              }),
            },
          ],
        };
      case 4:
        return {
          title: "Day 4 · 梦境",
          body: hall
            ? "你听见有人在窗外低语。‘回家……’你不知道那是不是自己的声音。"
            : "同一个梦反复播放：有人握住你的手，说‘回家’。",
          options: [
            {
              key: "sleep",
              label: "尝试睡眠",
              detail: "让梦完成它的回路。",
              resolve: () => {
                const outcome = {
                  effects: { mind: 20 },
                  log: "你蜷缩在安全带里。梦把你拉回伊克利普提卡的走廊。",
                  preventMindDecay: true,
                };
                if (r.fuel < 20) {
                  outcome.effects.fuel = -4;
                  outcome.effects.signal = -8;
                  outcome.flags = { drifted: true };
                  outcome.log += " 你醒来时航向偏了两度。";
                }
                return outcome;
              },
            },
            {
              key: "water",
              label: "喝水清醒",
              detail: "驱散幻象。",
              resolve: () => ({
                effects: { o2: -3, mind: 6 },
                log: "冰冷的水把你从梦里拽出。舱内只剩风扇的噪声。",
                preventMindDecay: true,
              }),
            },
            {
              key: "record",
              label: "记录梦境",
              detail: "把声音写进日志。",
              resolve: () => ({
                log: "你在航海日志写下：‘星光在耳边说话。’",
                flags: { dreamLogged: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 5:
        return {
          title: "Day 5 · 设备故障",
          body: "逃生舱轻微震动。能量电池的指示灯忽明忽暗。",
          options: [
            {
              key: "repair",
              label: "冒险修理",
              detail: "亲自拆开能源舱。",
              resolve: (state) => {
                const engineer = hasCrewRole(state, "repair");
                const success = Math.random() < (engineer ? 0.75 : 0.6);
                if (success) {
                  return {
                    effects: { fuel: 16, mind: engineer ? 8 : 6 },
                    log: engineer
                      ? "你与 Rae 配合焊接电极。能量流恢复平稳，仪表提示：‘探测到行星 Erevia。’"
                      : "你重新焊接电极，能量流恢复平稳。仪表提示：‘探测到行星 Erevia。’",
                    flags: { ereviaHint: true },
                    preventMindDecay: true,
                  };
                }
                const casualtyId = pickCrewForLoss(state, "repair");
                const log = casualtyId
                  ? `${crewTemplates[casualtyId]?.name || "同伴"} 被爆裂的火花击倒，你没能拉住他。`
                  : "电流在你掌心炸开。空气焦灼的味道久久不散。";
                return {
                  effects: { fuel: -5, mind: casualtyId ? -18 : -22 },
                  crewLoss: casualtyId ? [casualtyId] : undefined,
                  log,
                  mindShock: true,
                };
              },
            },
            {
              key: "shutdown",
              label: "关闭系统",
              detail: "切到最低功率。",
              resolve: () => ({
                effects: { signal: -12 },
                log: "你切断非必要模块。驾驶舱陷入几乎全黑的寂静。",
              }),
            },
            {
              key: "assign",
              label: "让船员修理",
              detail: "交给他们处理。",
              resolve: (state) => {
                const engineer = hasCrewRole(state, "repair");
                const medic = hasCrewRole(state, "care");
                const success = Math.random() < (engineer ? 0.75 : 0.55) && state.resources.crew > 0;
                if (success) {
                  const helper = engineer
                    ? getCrewById(state, "rae")?.name || "工程师"
                    : (getRoster(state)[0]?.name || "船员");
                  return {
                    effects: { mind: medic ? 6 : 4, fuel: engineer ? 12 : 8 },
                    log: `${helper} 在火花雨中稳住了线路，十分钟后系统重新点亮。`,
                    preventMindDecay: true,
                  };
                }
                return {
                  effects: { mind: -12 },
                  log: "维修失败。你们被迫目送警报一路飙升。",
                  mindShock: true,
                };
              },
            },
          ],
        };
      case 6:
        return {
          title: "Day 6 · 寒冷与噪音",
          body: "温控失灵。夜间温度降到 -40°C。风扇像旧时的唱片般吱呀作响。",
          options: [
            {
              key: "burn",
              label: "点燃燃料取暖",
              detail: "牺牲推进剂，换回体温。",
              resolve: () => ({
                effects: { fuel: -10, mind: 10 },
                log: "你点燃小型燃烧器。暖意短暂地驱散了颤抖。",
                preventMindDecay: true,
              }),
            },
            {
              key: "huddle",
              label: "共同抱团",
              detail: "把人挤在一起守夜。",
              resolve: () => {
                const hasCrew = r.crew > 0;
                return {
                  effects: { mind: hasCrew ? 8 : -6 },
                  log: hasCrew
                    ? "你们肩靠肩坐着。呼吸在空气里结霜，彼此的体温成了唯一的火堆。"
                    : "你抱着自己取暖。梦里有人敲舱壁。",
                  preventMindDecay: hasCrew,
                  mindShock: !hasCrew,
                };
              },
            },
            ...(hasItem(state, "o2Recycler")
              ? [
                  {
                    key: "cycle",
                    label: "启动再生器",
                    detail: "运行 O₂ 再生装置，温热舱内空气。",
                    requires: ["o2Recycler"],
                    resolve: () => ({
                      effects: { o2: 12, mind: 6 },
                      log: "你连接再生装置，霜雾化作细雨落在护目镜上。",
                      preventMindDecay: true,
                    }),
                  },
                ]
              : []),
            ...(hasItem(state, "stasisPatch")
              ? [
                  {
                    key: "patch",
                    label: "贴敷稳态贴",
                    detail: "消耗医用稳态贴让体温迅速回升。",
                    requires: ["stasisPatch"],
                    resolve: () => ({
                      effects: { mind: 18, satiety: 1 },
                      log: "稳态贴贴在颈侧，暖意沿着神经缓缓铺开。",
                      itemsUse: ["stasisPatch"],
                      preventMindDecay: true,
                    }),
                  },
                ]
              : []),
            ...(flags.medkit
              ? [{
                  key: "aid",
                  label: "使用医疗箱",
                  detail: "注射升温剂，稳定每个人的呼吸。",
                  resolve: () => ({
                    effects: { mind: 16, food: -1 },
                    log: "你给每个人注射温热的药剂。血液重新流动，指尖恢复感觉。",
                    flags: { medkit: false, crewBond: true },
                    preventMindDecay: true,
                  }),
                }]
              : []),
            {
              key: "endure",
              label: "不作为",
              detail: "让寒冷自行过去。",
              resolve: (state) => {
                const loss = Math.random() < 0.4 ? pickCrewForLoss(state) : null;
                return {
                  effects: { mind: loss ? -32 : -24 },
                  crewLoss: loss ? [loss] : undefined,
                  log: loss
                    ? `${crewTemplates[loss]?.name || "同伴"} 没能撑过这夜。她的手还紧抓着空水袋。`
                    : "你整晚没睡。肌肉僵硬得像铁。",
                  mindShock: true,
                };
              },
            },
          ],
        };
      case 7: {
        const lastLost = state.flags.lastLostCrew;
        const livingCrew = getRoster(state);
        if (lastLost) {
          return {
            title: "Day 7 · 遗体",
            body: `${lastLost} 的身体躺在储物舱旁。她的指甲掐进水袋。`,
            options: [
              {
                key: "bury",
                label: "安葬",
                detail: "把她送入星海。",
                resolve: () => ({
                  effects: { mind: 12, food: -1 },
                  log: `你打开外舱闸门，目送 ${lastLost} 缓缓漂离。她像一颗温顺的卫星。`,
                  flags: { lastLostCrew: null },
                  preventMindDecay: true,
                }),
              },
              {
                key: "preserve",
                label: "保留遗体",
                detail: "让身体成为隔热屏障。",
                resolve: () => ({
                  effects: { fuel: 5, mind: -18 },
                  log: `你把 ${lastLost} 固定在舱壁，让她的宇航服替你挡住寒气。`,
                  mindShock: true,
                }),
              },
              {
                key: "memento",
                label: "留下遗物",
                detail: "取下她的徽章，与船员分享记忆。",
                resolve: () => ({
                  effects: { mind: 10 },
                  log: livingCrew.length
                    ? `你把 ${lastLost} 的徽章贴在仪表盘上。其他人围在一起，默默点头。`
                    : `你把 ${lastLost} 的徽章贴在仪表盘上，告诉自己要记住她的名字。`,
                  flags: { memorialized: true, lastLostCrew: null },
                  preventMindDecay: true,
                }),
              },
              {
                key: "consume",
                label: "吃掉",
                detail: "在死亡与饥饿之间选择。",
                resolve: () => {
                  const mindChange = Math.random() < 0.5 ? -24 : -12;
                  return {
                    effects: { food: 6, mind: mindChange },
                    log: `你闭上眼睛。${lastLost} 的名字在齿间回响。`,
                    flags: { cannibal: true, lastLostCrew: null },
                    mindShock: true,
                  };
                },
              },
            ],
          };
        }
        if (livingCrew.length > 0) {
          return {
            title: "Day 7 · 值守",
            body: "连续的寒夜让每个人的呼吸都带着雾气。你得决定下一班的安排。",
            options: [
              {
                key: "watch",
                label: "安排轮守",
                detail: "让每个人轮流守夜。",
                resolve: () => ({
                  effects: { mind: 8 },
                  log: "你列出值守表。每一次交班都伴着彼此的寒暄。",
                  flags: { crewBond: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "train",
                label: "训练技能",
                detail: "让船员练习推进器流程。",
                resolve: (state) => ({
                  effects: { fuel: hasCrewRole(state, "nav") ? 4 : 2, mind: 6 },
                  log: "你们重复检视推力表。每个人都更熟悉下一步。",
                  flags: { crewPrepared: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "rest",
                label: "集体休息",
                detail: "允许大家睡上一个整班。",
                resolve: (state) => ({
                  effects: { mind: 14 },
                  log: hasCrewRole(state, "care")
                    ? "Noor 分发镇静剂，你们难得睡了一整夜。"
                    : "舱里陷入沉睡。即便是短暂的，也像一个完整的世界。",
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 7 · 空舱",
          body: "空气闻起来像铁。只有你自己在回声里徘徊。",
          options: [
            {
              key: "clean",
              label: "彻底清理舱室",
              detail: "把血迹与灰尘擦掉。",
              resolve: () => ({
                effects: { mind: 6 },
                log: "你擦掉走廊里的每一滴焦黑痕迹，让舱室恢复秩序。",
                preventMindDecay: true,
              }),
            },
            {
              key: "write",
              label: "写信",
              detail: "把经历写给从未抵达的收件人。",
              resolve: () => ({
                effects: { mind: 10, signal: 4 },
                log: "你在日志里写下：‘如果有人看到这条记录，请替我告诉星星我还在坚持。’",
                preventMindDecay: true,
              }),
            },
            {
              key: "stare",
              label: "凝视星海",
              detail: "让空无把你填满。",
              resolve: () => ({
                effects: { mind: -10 },
                log: "星光像旧电影的底片，你感到自己正在褪色。",
                mindShock: true,
              }),
            },
          ],
        };
      }
      case 8:
        return {
          title: "Day 8 · Erevia 轨道",
          body: flags.ereviaHint
            ? "远处的冰封行星在窗外旋转。传感器显示表面温度 -70°C。"
            : "雷达捕捉到一个冰冷的球体。也许那里有燃料，也许只有沉默。",
          options: [
            {
              key: "land",
              label: "降落探查",
              detail: "燃料 -10，氧气 -5。",
              resolve: () => {
                if (flags.engineFrozen) {
                  return {
                    log: "推进器仍被冰霜束缚。你不得不放弃再次降落的念头。",
                    effects: { mind: -8 },
                    mindShock: true,
                  };
                }
                const success = Math.random() < 0.65;
                const base = { fuel: -10, o2: -5 };
                if (success) {
                  return {
                    effects: { ...base, fuel: base.fuel + 16, o2: base.o2 + 12, mind: 8 },
                    log: "你钻入冰层裂隙，逃生舱的支撑腿扎进蓝色冰雪。晶体在灯光下闪耀。",
                    flags: { landedErevia: true, surfaceStage: 1 },
                    preventMindDecay: true,
                  };
                }
                return {
                  effects: { ...base, mind: -18 },
                  log: "冰霜锁死推进器。你差点被困在轨道，操纵杆在掌心打颤。",
                  flags: { engineFrozen: true },
                  mindShock: true,
                };
              },
            },
            {
              key: "orbit",
              label: "保持轨道",
              detail: "静观其变。",
              resolve: () => ({
                effects: { mind: -4 },
                log: "你保持轨道飞行。星球的阴影吞没了舱室。",
              }),
            },
            {
              key: "survey",
              label: "释放测绘无人机",
              detail: "让无人机预先扫描着陆点。",
              resolve: () => {
                const drone = flags.supportDrone;
                return {
                  effects: { fuel: -4, signal: 8, mind: drone ? 6 : 0 },
                  log: drone
                    ? "无人机沿着冰缝盘旋，回传出稳定着陆区的轮廓。"
                    : "你投放一个简易探针。它在下坠中消失。",
                  flags: drone ? { ereviaHint: true, surfaceSurvey: true } : {},
                  preventMindDecay: !!drone,
                };
              },
            },
            {
              key: "beacon",
              label: "投放信标",
              detail: "让信号穿透冰壳。",
              resolve: () => ({
                effects: { signal: 30, fuel: -5 },
                log: "你释放一个信标，蓝色光束划开夜色。",
                flags: { lighthouse: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 9:
        if (flags.landedErevia) {
          return {
            title: "Day 9 · 冰壳营地",
            body: "极夜的风划过冰面。救生舱支撑腿在雪中发出嘎吱声，你必须决定如何利用短暂的宁静。",
            options: [
              {
                key: "harvest",
                label: "凿取晶体",
                detail: "消耗氧气与体力换取能量。",
                resolve: () => ({
                  effects: { o2: -6, fuel: 12, mind: 4 },
                  log: "你用切割炬凿下数块蓝色晶体。它们在寒气中发出微光。",
                  flags: { surfaceCache: true, surfaceStage: 2 },
                  preventMindDecay: true,
                }),
              },
              {
                key: "dome",
                label: "搭建避风穹顶",
                detail: "耗费物资换取稳定庇护。",
                resolve: () => ({
                  effects: { food: -2, fuel: -2, mind: 14 },
                  log: "你用救生舱外壳搭出简易穹顶，把热源集中在狭小空间里。",
                  flags: { surfaceShelter: true, surfaceStage: 2 },
                  preventMindDecay: true,
                }),
              },
              {
                key: "scout",
                label: "追随极光",
                detail: "沿着地表寻找新的信号源。",
                resolve: () => {
                  const find = Math.random() < 0.5;
                  return {
                    effects: { o2: -4, mind: find ? 8 : -6, signal: find ? 12 : 0 },
                    log: find
                      ? "你追随极光来到一片裂谷。埋藏的信标迸发出新的脉冲。"
                      : "风暴阻挡了你的视线。你只能记下坐标等待明天。",
                    flags: find ? { auroraTrail: true, surfaceStage: 2 } : { surfaceStage: 2 },
                    preventMindDecay: find,
                  };
                },
              },
            ],
          };
        }
        if (!flags.toolChallengeComplete) {
          const beaconName = getItemName("distressBeacon");
          const thrusterName = getItemName("thrusterKit");
          const sealName = getItemName("rationSeal");
          const tetherName = getItemName("grappleHarness");
          const inventory = getInventory(state);
          const hasAnyTool = inventory.length > 0;
          return {
            title: "Day 9 · 工具调配",
            body:
              "救生舱里散落着在倒计时中抢救出的工具。每件道具只有一次决定性的用途，你得挑选最紧急的需求。",
            options: [
              {
                key: "beacon",
                label: `${beaconName} · 强化呼救`,
                detail: `需要 ${beaconName}，消耗信标释放相位脉冲。`,
                requires: ["distressBeacon"],
                resolve: () => ({
                  effects: { signal: 28, mind: 8 },
                  log: "你部署相位信标，蓝白色脉冲像潮汐般扫过暗带。应答灯瞬间亮得刺眼。",
                  itemsUse: ["distressBeacon"],
                  flags: { rescuePulse: true, toolChallengeComplete: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "thruster",
                label: `${thrusterName} · 调整姿态`,
                detail: `需要 ${thrusterName}，稳定推进器的燃烧曲线。`,
                requires: ["thrusterKit"],
                resolve: () => ({
                  effects: { fuel: 14, mind: 6 },
                  log: "你把稳定器锁进喷口，燃烧室的噪声骤然平顺。燃料表回升了一段让人安心的刻度。",
                  flags: { thrusterTuned: true, toolChallengeComplete: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "seal",
                label: `${sealName} · 重构口粮`,
                detail: `需要 ${sealName}，把散落的食物重新封装。`,
                requires: ["rationSeal"],
                resolve: () => ({
                  effects: { food: 10, satiety: 2, mind: 6 },
                  log: "你用真空封装器重建配给，热量片在灯光下排列成整齐的序列。",
                  flags: { rationRepacked: true, toolChallengeComplete: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "tether",
                label: `${tetherName} · 拖回残骸`,
                detail: `需要 ${tetherName}，系住附近的补给碎片。`,
                requires: ["grappleHarness"],
                resolve: () => ({
                  effects: { fuel: 6, food: 6, mind: 5 },
                  log: "磁索锁住漂浮的贮藏箱。你们拖着它回舱，金属的撞击声听起来像胜利。",
                  flags: { salvageCache: true, toolChallengeComplete: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "wait",
                label: "暂缓动作",
                detail: hasAnyTool
                  ? "保留道具，等待更合适的窗口。"
                  : "缺少任何专用道具，只能记录需求并继续等待。",
                resolve: () => ({
                  effects: { mind: -4 },
                  log: "你把工具锁进柜中，提醒自己下一次机会必须精准出手。",
                  flags: { toolChallengeComplete: true },
                }),
              },
            ],
          };
        }
        return {
          title: "Day 9 · 对话",
          body: flags.cannibal
            ? "你听见 Rae 的声音在舱壁里回荡：‘你记得我说过什么吗？’"
            : "无线电里传来熟悉的呼吸声。也许只是幻听。",
          options: [
            {
              key: "answer",
              label: "回答她",
              detail: "就像她仍在这里。",
              resolve: () => ({
                effects: { mind: -10, signal: 10 },
                log: "你对着空荡的麦克风说话。静电像潮水拍打回来。",
                flags: { echoAnswered: true },
              }),
            },
            {
              key: "silent",
              label: "沉默",
              detail: "等待声音消失。",
              resolve: () => ({
                log: "你闭上眼睛。声音持续了整整一小时才散去。",
              }),
            },
            {
              key: "journal",
              label: "记录日志",
              detail: "把幻觉写进觉醒手记。",
              resolve: () => ({
                log: "你写下：‘她问我是否记得星星的名字。’",
                flags: { dreamLogged: true, awakenChance: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 10:
        if (flags.landedErevia) {
          return {
            title: "Day 10 · 冰壳深处",
            body: "霜雾缠绕着你的护目镜。地表下方似乎有空洞传出低鸣，你得决定下一步探索。",
            options: [
              {
                key: "cavern",
                label: "进入裂隙",
                detail: "冒险下降，寻找热源。",
                resolve: () => {
                  const success = Math.random() < 0.6;
                  return {
                    effects: { o2: -6, mind: success ? 12 : -8, fuel: success ? 10 : -2 },
                    log: success
                      ? "你沿着绳索下降到温暖的地窟，地热为电池充了新能。"
                      : "裂隙深处只有回声。你差点被冻住的水汽呛到。",
                    flags: success ? { surfaceForge: true, surfaceStage: 3 } : { surfaceStage: 3 },
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "relay",
                label: "架设冰晶中继",
                detail: "利用晶体折射信号。",
                resolve: () => ({
                  effects: { fuel: -4, signal: 22, mind: 8 },
                  log: "你把晶体插入冰层，微弱的蓝光顺着裂缝延伸，像一条光纤。",
                  flags: { auroraBridge: true, surfaceStage: 3 },
                  preventMindDecay: true,
                }),
              },
              {
                key: "liftoff",
                label: "准备起飞轨道",
                detail: "重新校准推进器，为离地做准备。",
                resolve: () => ({
                  effects: { fuel: -6, mind: 6, signal: 8 },
                  log: "你调整喷嘴角度，计算薄冰上的推力窗口。引擎发出低沉的呼吸。",
                  flags: { launchWindow: true, surfaceStage: 3 },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 10 · 求救",
          body: "这是第十天。警示灯亮得像星空。你必须决定最后的行动。",
          options: [
            {
              key: "flare",
              label: "发射所有信标",
              detail: "拼尽剩余能量呼救。",
              resolve: () => ({
                effects: { signal: 25, fuel: -5 },
                log: "你把所有频段推到最大。远处似乎有蓝光闪烁。",
                flags: { rescuePulse: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "burn",
              label: "收束能量准备突围",
              detail: "朝未知航道推进。",
              resolve: () => ({
                effects: { fuel: -8, mind: 5 },
                log: "你把推进器对准虚线。舱体开始震动。",
                flags: { vectorPlotted: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "listen",
              label: "聆听星海",
              detail: "让意识与波段同频。",
              resolve: () => ({
                effects: { mind: 15 },
                log: "你关闭所有噪音。星海像潮水一样涌入脑海。",
                flags: { awakenChance: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "drift",
              label: "搜寻碎片带",
              detail: "利用无人机拖回物资。",
              resolve: () => {
                const drone = flags.supportDrone;
                const success = drone && Math.random() < 0.7;
                return {
                  effects: { fuel: success ? 6 : -2, food: success ? 3 : 0, mind: success ? 6 : -6 },
                  log: success
                    ? "无人机拖回一段补给箱，你在无垠黑暗中得到短暂安慰。"
                    : "碎片带只有冷冰冰的残骸。你浪费了几个小时。",
                  flags: success ? { salvageCache: true } : {},
                  mindShock: !success,
                };
              },
            },
          ],
        };
      case 11:
        if (flags.landedErevia) {
          return {
            title: "Day 11 · 再次点火",
            body: "冰雾贴在舱壁上。你要么继续探索，要么为离地做最后准备。",
            options: [
              {
                key: "ignite",
                label: "测试推进器",
                detail: "点火，看看引擎是否还能信你一次。",
                resolve: () => {
                  const ready = flags.launchWindow || flags.surfaceSurvey;
                  const success = Math.random() < (ready ? 0.75 : 0.45);
                  return {
                    effects: { fuel: -6, o2: -3, mind: success ? 10 : -10, signal: success ? 6 : 0 },
                    log: success
                      ? "推进器喷出清亮蓝焰。冰渣在喷口周围炸裂。你感到心脏重新跳动。"
                      : "引擎咳出一股白雾随即熄灭。寒冷抓住你的手腕。",
                    flags: success ? { launchReady: true } : { launchWindow: false, launchReady: false },
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "cache",
                label: "搜寻冰洞",
                detail: "利用无人机或直觉寻找隐藏补给。",
                resolve: () => {
                  const drone = flags.supportDrone;
                  const bonus = drone ? 4 : 0;
                  return {
                    effects: { food: 3 + bonus, o2: 4 + bonus / 2, mind: 6 },
                    log: drone
                      ? "无人机带你找到一处冻结的研究舱。里面遗留的压缩口粮还完好无损。"
                      : "你在岩壁后找到一处空洞，里面留着旧时代的氧罐。",
                    flags: { surfaceCache: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "chant",
                label: "聆听冰鸣",
                detail: "让自己与行星的脉动同频。",
                resolve: () => ({
                  effects: { mind: 18 },
                  log: "你躺在冰面上，听见地底深处的轰鸣与自己的心跳融合。",
                  flags: { awakenChance: true, surfaceStage: 4 },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 11 · 边缘回波",
          body: "救生舱穿过寂静的碎片带。每一次雷达扫描都像掷骰子。",
          options: [
            {
              key: "align",
              label: "校准航道",
              detail: "消耗燃料，锁定回收船可能的航迹。",
              resolve: () => ({
                effects: { fuel: -5, signal: 18, mind: 6 },
                log: "你重新计算航向，把舱体抬升到更稳定的轨道层。",
                flags: { vectorPlotted: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "board",
              label: "登上残骸",
              detail: "冒险接近破碎的研究舱换取物资。",
              resolve: () => {
                const success = Math.random() < 0.55;
                return {
                  effects: { o2: success ? 8 : -4, food: success ? 4 : 0, mind: success ? 8 : -8 },
                  log: success
                    ? "你拖着安全绳登上残骸。里面的储备箱发出令人安心的金属声。"
                    : "残骸忽然碎裂，锋利的边缘划开你的宇航服。",
                  mindShock: !success,
                };
              },
            },
            {
              key: "broadcast",
              label: "播送幸存日志",
              detail: "把你的故事发送到任何可能的耳朵。",
              resolve: () => ({
                effects: { mind: 12, signal: 10 },
                log: "你的声音在波段中回响。也许有人会记住这些片段。",
                flags: { rescuePulse: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 12:
        if (flags.landedErevia) {
          return {
            title: "Day 12 · 去向",
            body: "冰原的晨光像刀片一样锋利。你必须决定留在这里，还是再次踏入星海。",
            options: [
              {
                key: "ascend",
                label: "冲出冰壳",
                detail: "燃料 -12，成功则返回星际航道。",
                resolve: () => {
                  const baseChance = flags.launchReady ? 0.85 : flags.launchWindow ? 0.6 : 0.4;
                  const success = Math.random() < baseChance;
                  return {
                    effects: { fuel: -12, o2: -6, mind: success ? 14 : -14, signal: success ? 18 : -6 },
                    log: success
                      ? "逃生舱脱离冰壳，极光在舷窗外拉出长长的尾焰。"
                      : "引擎在升空时再度冻结，你重重摔回冰面。",
                    flags: success ? { surfaceAscended: true } : { engineFrozen: true },
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "call",
                label: "点亮信号塔",
                detail: "把晶体网络完全激活，等待回应。",
                resolve: () => ({
                  effects: { signal: 28, mind: 8 },
                  log: "你把最后一块晶体按入基座。整片冰原亮起蓝白色的脉冲。",
                  flags: { surfaceBeacon: true },
                  preventMindDecay: true,
                }),
              },
              {
                key: "remain",
                label: "留在极夜中",
                detail: "放下肉体，倾听星海的低语。",
                resolve: () => ({
                  effects: { mind: 25 },
                  log: "你坐在冰面，呼吸缓慢到几乎停滞。星光透过冰层照进你的骨骼。",
                  flags: { surfaceAwaken: true, awakenChance: true },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 12 · 最终信号",
          body: "你能感到舱体结构在疲惫地呻吟。最后的决定也许会改变命运。",
          options: [
            {
              key: "flare",
              label: "叠加所有频段",
              detail: "燃料 -6，尝试让信号突破噪声。",
              resolve: () => ({
                effects: { fuel: -6, signal: 22, mind: 8 },
                log: "你叠加所有频段，信号像蓝白色瀑布冲向远方。",
                flags: { rescuePulse: true, lighthouse: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "slingshot",
              label: "跃迁到新坐标",
              detail: "燃料 -9，赌一次曲率外跳。",
              resolve: () => ({
                effects: { fuel: -9, mind: 6 },
                log: "你调整舱体角度，准备利用微弱重力进行一次小幅跃迁。",
                flags: { vectorPlotted: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "record",
              label: "记录终章",
              detail: "把经历写进日志，交给星海保管。",
              resolve: () => ({
                effects: { mind: 20 },
                log: "你把十二日的碎片记录成一段讯息：如果有人找到它，请告诉星星我曾经来过。",
                flags: { awakenChance: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 13:
        if (flags.landedErevia) {
          return {
            title: "Day 13 · 冰下矿脉",
            body: "探测器显示冰层下有稳定的热信号。你们可以继续开采、搭建营地，或追逐那条神秘的低频脉冲。",
            options: [
              {
                key: "prospect",
                label: "开采晶体",
                detail: "提取更多能量晶体，补充燃料。",
                resolve: (state) => {
                  const engineer = hasCrewRole(state, "repair");
                  const scientist = hasCrewRole(state, "signal");
                  const fuelGain = engineer ? 14 : 10;
                  const signalGain = scientist ? 12 : 6;
                  return {
                    effects: { fuel: fuelGain, signal: signalGain, mind: 6 },
                    log: engineer
                      ? "Rae 带头钻入冰壁。晶体被整齐切割下来，像蓝色的火焰。"
                      : "你独自操控钻机。晶体碎屑如雪飘散。",
                    flags: { surfaceForge: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "shelter",
                label: "搭建营地",
                detail: "加固帐篷，改善夜间温度。",
                resolve: (state) => {
                  const medic = hasCrewRole(state, "care");
                  return {
                    effects: { mind: medic ? 18 : 12, satiety: medic ? 2 : 1 },
                    log: medic
                      ? "Noor 用加热毯裹住每个人。营地里飘着热水的气味。"
                      : "你用残片搭出风障。至少今晚不会被冻醒。",
                    flags: medic ? { surfaceAwaken: true } : {},
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "pulse",
                label: "追踪低频",
                detail: "深入冰裂缝，寻找隐藏的信号源。",
                resolve: () => {
                  const success = Math.random() < 0.6;
                  return {
                    effects: { o2: -4, signal: success ? 16 : 6, mind: success ? 10 : -8 },
                    log: success
                      ? "你沿着冰缝下潜，发现一座古老的信标塔在缓慢跳动。"
                      : "裂缝深处只有回声。低频脉冲像心跳般若隐若现。",
                    flags: success ? { surfaceBeacon: true } : {},
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
            ],
          };
        }
        return {
          title: "Day 13 · 宇宙潮汐",
          body: "逃生舱掠过一片反光的碎片带。每一次引擎脉冲都会牵动燃料与生机。",
          options: [
            {
              key: "trace",
              label: "追踪余波",
              detail: "沿着遥远的回声调整航线。",
              resolve: (state) => {
                const navigator = hasCrewRole(state, "nav");
                return {
                  effects: { fuel: navigator ? -4 : -6, signal: navigator ? 18 : 12, mind: 8 },
                  log: navigator
                    ? "Maru 推算出回收船留下的细小曲率。舱体在真空中轻盈滑行。"
                    : "你凭直觉调整航向，祈祷那串回声确实来自友军。",
                  flags: { vectorPlotted: true },
                  preventMindDecay: true,
                };
              },
            },
            {
              key: "harvest",
              label: "收拢碎片",
              detail: "动用无人机拖回物资。",
              resolve: (state) => {
                const drone = state.flags.supportDrone;
                const success = drone && Math.random() < 0.7;
                return {
                  effects: { food: success ? 5 : 1, o2: success ? 6 : 2, mind: success ? 8 : 0 },
                  log: success
                    ? "无人机带回密封罐与一箱压缩粮。你们终于能正经吃一顿。"
                    : "无人机返回时只有碎铁和冰渣。你们勉强收集了些可用的零件。",
                  preventMindDecay: success,
                };
              },
            },
            {
              key: "hibernate",
              label: "半休眠",
              detail: "降低消耗，积累饱腹值。",
              resolve: () => ({
                effects: { mind: 6, satiety: 1 },
                log: "你设置半休眠程序，让舱体保持最低功率。饥饿暂时离开。",
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 14:
        if (flags.landedErevia) {
          return {
            title: "Day 14 · 极夜抉择",
            body: "极夜下的风像砂纸划过舱壁。你们要决定最后的举动——点火离开、点亮灯塔，或是留下来聆听冰下的歌声。",
            options: [
              {
                key: "ignite",
                label: "重新点火",
                detail: "耗费燃料检查喷嘴，为最终起飞做准备。",
                resolve: (state) => {
                  const engineer = hasCrewRole(state, "repair");
                  const success = Math.random() < (engineer ? 0.8 : 0.55);
                  return {
                    effects: { fuel: -6, signal: success ? 10 : -4, mind: success ? 12 : -6 },
                    log: success
                      ? "喷嘴喷出稳定蓝焰，冰块被震成粉末。离开只差一个指令。"
                      : "引擎咳出一口白雾又熄灭。Rae 皱着眉再次拆开外壳。",
                    flags: success ? { launchReady: true } : {},
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "lighthouse",
                label: "建造冰灯塔",
                detail: "组合晶体与信标，扩大求救信号。",
                resolve: (state) => {
                  const scientist = hasCrewRole(state, "signal");
                  const bonus = scientist ? 26 : 18;
                  return {
                    effects: { signal: bonus, mind: 10 },
                    log: scientist
                      ? "Ilya 调整晶体折射角，蓝光冲上极夜。远方或许有人回应。"
                      : "你把晶体一块块插入冰面，灯塔亮起时你的影子被拉得很长。",
                    flags: { surfaceBeacon: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "listen",
                label: "聆听冰歌",
                detail: "坐在极夜下，让意识与星海同步。",
                resolve: () => ({
                  effects: { mind: 22 },
                  log: "你盘腿坐在冰原。地底的低鸣与你的心跳合拍。极夜像深海一样敞开。",
                  flags: { surfaceAwaken: true, awakenChance: true },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 14 · 终端抉择",
          body: "这是逃生舱漂流的第十四天。记录器的灯一次次跳动，你必须决定是燃烧最后的燃料，还是把故事交给星海。",
          options: [
            {
              key: "superflare",
              label: "释放终极求救",
              detail: "燃料 -8，信号大幅提升。",
              resolve: () => ({
                effects: { fuel: -8, signal: 28, mind: 10 },
                log: "你把所有频段推到极限，逃生舱像一颗微小的恒星般闪耀。",
                flags: { rescuePulse: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "driftvector",
              label: "驶向未知航迹",
              detail: "将航线对准未标记的引力缝隙。",
              resolve: (state) => ({
                effects: { fuel: -6, mind: 12 },
                log: hasCrewRole(state, "nav")
                  ? "Maru 把航线锁定在一条隐形曲率上。你们决定赌上一切。"
                  : "你把舱体旋向深空，未知的航迹像黑色的河流。",
                flags: { vectorPlotted: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "eulogize",
              label: "记录终章",
              detail: "把经历写进日志，交给星海保管。",
              resolve: () => ({
                effects: { mind: 20 },
                log: "你把十四日的碎片记录成一段讯息：如果有人找到它，请告诉星星我曾经来过。",
                flags: { awakenChance: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 15:
        if (flags.landedErevia) {
          return {
            title: "Day 15 · 冰下峡谷",
            body: "营地周围的冰层被你们踏出折痕。裂缝深处传来缓慢的水声。",
            options: [
              {
                key: "river",
                label: "开凿融水渠",
                detail: "消耗氧气换取可饮用融水与地衣。",
                resolve: (state) => {
                  const medic = hasCrewRole(state, "care");
                  return {
                    effects: { o2: -5, food: medic ? 7 : 5, mind: medic ? 12 : 8 },
                    log: medic
                      ? "Noor 监测每个人的血氧，你们把冰层刨成沟渠，温水沿着沟槽流入储罐。"
                      : "你独自在冰层上切开一道沟槽。融水沿着靴底缓缓流淌。",
                    flags: { surfaceRiver: true, surfaceStage: 3 },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "forge",
                label: "搭建地热炉",
                detail: "消耗燃料，换取稳定的营地热源。",
                resolve: (state) => {
                  const engineer = hasCrewRole(state, "repair");
                  return {
                    effects: { fuel: -8, mind: engineer ? 18 : 12, signal: engineer ? 10 : 6 },
                    log: engineer
                      ? "Rae 把拆下的导轨焊成炉膛，热浪驱散了极夜的寒霜。"
                      : "你搭起简易火炉。火焰摇曳，照亮狭小的穹顶。",
                    flags: { surfaceForge: true, surfaceColonyHint: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "chart",
                label: "派出测绘队",
                detail: "让导航员绘制更深入的冰洞地图。",
                resolve: (state) => {
                  const navigator = hasCrewRole(state, "nav");
                  const success = Math.random() < (navigator ? 0.8 : 0.55);
                  return {
                    effects: { o2: -4, signal: success ? 18 : 9, mind: success ? 10 : -6 },
                    log: success
                      ? navigator
                        ? "Maru 标注出数条安全通道，并发现了通往地底的光带。"
                        : "你靠着惯性测量绘制出一张粗略地图。裂缝边缘泛着幽蓝的光。"
                      : "风暴遮蔽了视线，你在冰洞里迷失数小时才回到营地。",
                    flags: success ? { surfaceSurvey: true, auroraTrail: true } : {},
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
            ],
          };
        }
        return {
          title: "Day 15 · 交错航道",
          body: "深空频道闪烁着求救信标。一支流浪船队与逃生舱平行滑行。",
          options: [
            {
              key: "convoy",
              label: "与船队并航",
              detail: "分享补给换取航道坐标。",
              resolve: (state) => {
                const candidate = chooseCrew(state, ["noor", "maru", "ilya", "rae"]);
                const recruitable = candidate && !getCrewById(state, candidate);
                return {
                  effects: { food: -2, mind: recruitable ? 14 : 8, signal: recruitable ? 16 : 10 },
                  log: recruitable
                    ? `你与船队对接，${crewTemplates[candidate].name} 背着设备跨入舱内，承诺会带来新的方向。`
                    : "船队把一张旧星图上传给你们，作为交换，你分享了口粮。",
                  crewGain: recruitable ? [candidate] : undefined,
                  flags: { convoyAllies: true },
                  preventMindDecay: true,
                };
              },
            },
            {
              key: "barter",
              label: "交易航材",
              detail: "拿晶体换取推进剂与零件。",
              resolve: () => ({
                effects: { fuel: 12, mind: 6, signal: -4 },
                log: "你在公共频道上开价。很快，一箱闪着油光的推进剂换来了几块晶体。",
                flags: { tradeLedger: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "cloak",
              label: "关闭外灯",
              detail: "降低特征信号，避免未知船只。",
              resolve: () => ({
                effects: { mind: 6, signal: -6 },
                log: "你关掉舱体外灯。救生舱隐入阴影，只剩监控光点。",
                flags: { shadowRun: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 16:
        if (flags.landedErevia) {
          return {
            title: "Day 16 · 地热脉冲",
            body: "地底传来持续的低鸣，热浪时而透过裂缝喷涌。",
            options: [
              {
                key: "vent",
                label: "沿裂隙下潜",
                detail: "寻找地热井，换取更多能源。",
                resolve: (state) => {
                  const engineer = hasCrewRole(state, "repair");
                  const success = Math.random() < (engineer ? 0.75 : 0.55);
                  return {
                    effects: {
                      o2: -5,
                      fuel: success ? 14 : 6,
                      mind: success ? 12 : -6,
                      signal: success ? 6 : 0,
                    },
                    log: success
                      ? "你们顺着热浪找到地热井。蒸汽在灯光里跳动，温暖的气息扑面而来。"
                      : "岩壁突然坍塌，你被迫返程，浑身都是冰屑。",
                    flags: success ? { surfaceForge: true } : {},
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "garden",
                label: "培植极光藻",
                detail: "在融水槽里投放营养剂，尝试养出可食植物。",
                resolve: (state) => {
                  const medic = hasCrewRole(state, "care");
                  return {
                    effects: { food: medic ? 8 : 5, satiety: medic ? 2 : 1, mind: medic ? 14 : 9 },
                    log: medic
                      ? "Noor 搅拌营养剂，绿色的光点在水面浮动，像星星落入掌心。"
                      : "你撒入救生舱里剩下的营养粉，静候第一层嫩芽破冰而出。",
                    flags: { surfaceGarden: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "council",
                label: "召开夜议",
                detail: "让所有人提出长期驻留与离开的计划。",
                resolve: (state) => {
                  const scientist = hasCrewRole(state, "signal");
                  return {
                    effects: { mind: 18, signal: scientist ? 12 : 6 },
                    log: scientist
                      ? "Ilya 把每个人的提案整理成星图，冰穹上投射出蓝色的路线。"
                      : "你们围坐在炉火边，逐条写下可能的未来。",
                    flags: { surfaceColonyHint: true, crewBond: true },
                    preventMindDecay: true,
                  };
                },
              },
            ],
          };
        }
        return {
          title: "Day 16 · 星港残响",
          body: "一座废弃星港缓慢旋转，散落的泊位像冻结的花朵。",
          options: [
            {
              key: "dock",
              label: "尝试对接",
              detail: "燃料 -6，有机会补充物资。",
              resolve: () => {
                const success = Math.random() < 0.6;
                return {
                  effects: {
                    fuel: -6,
                    food: success ? 4 : 0,
                    o2: success ? 6 : -2,
                    mind: success ? 10 : -8,
                  },
                  log: success
                    ? "你锁住泊位，仓库里残存的热量片与氧罐让人几乎落泪。"
                    : "对接臂在碰撞中折断，你只得割裂连接线撤离。",
                  mindShock: !success,
                };
              },
            },
            {
              key: "archive",
              label: "连接数据库",
              detail: "下载星港遗留的航行档案。",
              resolve: () => ({
                effects: { signal: 18, mind: 10 },
                log: "你在断裂的网络里下载到一份星图。废弃的港口仿佛短暂苏醒。",
                flags: { archiveLinked: true, awakenChance: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "drift",
              label: "进入半休眠",
              detail: "锁舱待机，降低消耗。",
              resolve: () => ({
                effects: { mind: 8, satiety: 1 },
                log: "你们轮流进入休眠舱。梦里仍能听见星港的回声。",
                flags: { rationTight: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 17:
        if (flags.landedErevia) {
          return {
            title: "Day 17 · 极光心脏",
            body: "极光像液体般穿过冰壳，脉冲让整座营地共振。",
            options: [
              {
                key: "chorus",
                label: "调谐晶体",
                detail: "让信号与极光共鸣。",
                resolve: (state) => {
                  const scientist = hasCrewRole(state, "signal");
                  return {
                    effects: { signal: scientist ? 26 : 18, mind: 12 },
                    log: scientist
                      ? "Ilya 调整晶体角度，蓝白色的束光穿透云层直指星空。"
                      : "你把晶体按进冰面，信标发出比以往更远的呼唤。",
                    flags: { surfaceChorus: true, rescuePulse: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "delve",
                label: "拓展冰洞",
                detail: "挖掘新的储藏室，搜寻可用矿脉。",
                resolve: (state) => {
                  const engineer = hasCrewRole(state, "repair");
                  const success = Math.random() < (engineer ? 0.75 : 0.5);
                  return {
                    effects: {
                      o2: -5,
                      fuel: success ? 12 : 5,
                      food: success ? 3 : 0,
                      mind: success ? 10 : -6,
                    },
                    log: success
                      ? "你们凿开冰层，发现一条被封存的补给管线。"
                      : "墙体崩落，碎冰砸在护甲上。你只带回几块无用的矿渣。",
                    flags: success ? { surfaceForge: true } : {},
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "vigil",
                label: "守望极夜",
                detail: "让每个人在极光下写下自己的期望。",
                resolve: () => ({
                  effects: { mind: 22 },
                  log: "你们轮流写下愿望，纸张在极光中泛着蓝光。",
                  flags: { crewBond: true, awakenChance: true },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 17 · 引力虹桥",
          body: "一个引力涟漪在扫描图上划过，像一道通向未知的桥。",
          options: [
            {
              key: "bridge",
              label: "乘势转向",
              detail: "调整航线，利用引力获得加速。",
              resolve: (state) => ({
                effects: { fuel: -4, signal: 18, mind: 8 },
                log: hasCrewRole(state, "nav")
                  ? "Maru 在控制台上快速连点，逃生舱沿着虹桥滑行。"
                  : "你凭直觉调整舱体，感受到隐形的牵引力。",
                flags: { vectorPlotted: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "rescue",
              label: "拖带漂流舱",
              detail: "分享口粮，换取新的同伴或讯息。",
              resolve: (state) => {
                const candidate = chooseCrew(state, ["ilya", "noor", "maru", "rae"]);
                const recruitable = candidate && !getCrewById(state, candidate);
                return {
                  effects: { food: -2, mind: recruitable ? 16 : 10, signal: recruitable ? 14 : 8 },
                  log: recruitable
                    ? `${crewTemplates[candidate].name} 从漂流舱中走出，带来一串未加密的求救坐标。`
                    : "你拖住一艘空荡的逃生舱。里面只有半张褪色的照片。",
                  crewGain: recruitable ? [candidate] : undefined,
                  flags: { convoyAllies: true },
                  preventMindDecay: true,
                };
              },
            },
            {
              key: "mirror",
              label: "校准传感镜",
              detail: "反射星光，放大信号强度。",
              resolve: () => ({
                effects: { signal: 16, mind: 6 },
                log: "你调节舱壁外的反射片，星光沿着轨道照进天线。",
                flags: { lighthouse: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 18:
        if (flags.landedErevia) {
          return {
            title: "Day 18 · 新黎明",
            body: "极夜边缘泛出一抹银光。你必须决定在这个冰封世界的归宿。",
            options: [
              {
                key: "launch",
                label: "启动升空程序",
                detail: "聚焦所有燃料，尝试再次起飞。",
                resolve: (state) => {
                  const readyBonus = state.flags.launchReady ? 0.25 : 0;
                  const forgeBonus = state.flags.surfaceForge ? 0.15 : 0;
                  const baseChance = 0.45 + readyBonus + forgeBonus;
                  const success = Math.random() < Math.min(0.95, baseChance);
                  return {
                    effects: { fuel: -12, o2: -6, mind: success ? 16 : -16, signal: success ? 20 : -6 },
                    log: success
                      ? "引擎喷出稳定蓝焰，冰屑像流星雨般坠落。你们冲破极夜。"
                      : "喷嘴再次结霜，逃生舱在震动中坠回雪地。",
                    flags: success ? { surfaceAscended: true } : { engineFrozen: true },
                    preventMindDecay: success,
                    mindShock: !success,
                  };
                },
              },
              {
                key: "settle",
                label: "建立极夜基地",
                detail: "把营地正式改造成长期栖息地。",
                resolve: (state) => {
                  const crewCount = getRoster(state).length;
                  return {
                    effects: { mind: 24, signal: 8, satiety: 2 },
                    log: crewCount
                      ? "你们竖起合金骨架，挂上第一盏长明灯。这个名字叫‘霜辉基地’。"
                      : "你独自竖起灯塔，把营地标记为未来的避难所。",
                    flags: { surfaceColony: true, surfaceBeacon: true },
                    preventMindDecay: true,
                  };
                },
              },
              {
                key: "communion",
                label: "融入极光",
                detail: "在冰原上冥想，让意识与行星合一。",
                resolve: () => ({
                  effects: { mind: 30 },
                  log: "你躺在冰面，极光在耳边低语。身体与星光的界线一点点消失。",
                  flags: { surfaceAwaken: true, awakenChance: true },
                  preventMindDecay: true,
                }),
              },
            ],
          };
        }
        return {
          title: "Day 18 · 汲星仪式",
          body: "求救信标与星海的噪声交织。你可以决定是呼唤救援，还是加入新的旅队。",
          options: [
            {
              key: "harmonics",
              label: "叠加星际谐波",
              detail: "燃烧最后的燃料提升信号。",
              resolve: () => ({
                effects: { fuel: -6, signal: 24, mind: 10 },
                log: "你让所有频段同步。逃生舱像一枚灯塔，贯穿黑暗。",
                flags: { rescuePulse: true, lighthouse: true },
                preventMindDecay: true,
              }),
            },
            {
              key: "caravan",
              label: "加入星际商队",
              detail: "分享补给，换取同行的资格。",
              resolve: (state) => {
                const roster = getRoster(state);
                return {
                  effects: { food: -3, mind: roster.length ? 18 : 12, signal: 12 },
                  log: roster.length
                    ? "你们把余粮分给商队。对方承诺带你们前往最近的定居点。"
                    : "你递出求救日志，对方邀请你成为商队的导航记录员。",
                  flags: { caravanAlliance: true },
                  preventMindDecay: true,
                };
              },
            },
            {
              key: "archive",
              label: "上传记忆",
              detail: "把全部经历备份到远端档案。",
              resolve: () => ({
                effects: { mind: 20, signal: 10 },
                log: "你把日志、星图与声音全部上传。远端档案库回送了一句：‘欢迎归档者。’",
                flags: { archiveLinked: true, awakenChance: true },
                preventMindDecay: true,
              }),
            },
          ],
        };
      default:
        return getExtendedEvent(state, day);
    }
  },
  handleChoice(key) {
    if (this._locked) return;
    if (!this._state) return;
    if (this._state.phase === "intro") {
      this.startCountdown();
      return;
    }
    if (this._state.phase === "ending") {
      return;
    }
    if (this._audio && !this._audio.enabled && !this._audio.userMuted) {
      this.enableAudio(true);
    } else if (this._audio?.enabled) {
      this.playSfx("select");
    }
    const story = this._state.pendingStory;
    if (!story) return;
    const option = story.options?.find((opt) => opt.key === key);
    if (!option) return;
    if (!this.canUseOption(option)) {
      const status = this.optionRequirementStatus(option);
      if (status.missing.length) {
        this.pushLog(`系统：缺少道具「${this.describeItems(status.missing)}」，无法执行该选项。`, "system");
      }
      return;
    }
    const outcome = option.resolve ? option.resolve(this._state) : option;
    this.applyOutcome(outcome);
  },
  applyOutcome(outcome = {}) {
    const state = this._state;
    if (!state) return;
    if (outcome.log) {
      this.pushLog(outcome.log);
    }
    if (Array.isArray(outcome.crewGain)) {
      outcome.crewGain.forEach((id) => {
        if (id) {
          this.addCrewMember(id);
        }
      });
    }
    if (Array.isArray(outcome.crewLoss)) {
      outcome.crewLoss.forEach((id) => {
        this.removeCrewMember(id);
      });
    }
    if (Array.isArray(outcome.itemsGain)) {
      outcome.itemsGain.forEach((id) => {
        if (this.addItem(id)) {
          this.pushLog(`系统：获得道具「${this.itemName(id)}」`, "system");
        }
      });
    }
    if (Array.isArray(outcome.itemsUse)) {
      outcome.itemsUse.forEach((id) => {
        if (this.removeItem(id)) {
          this.pushLog(`系统：消耗道具「${this.itemName(id)}」`, "system");
        }
      });
    }
    if (outcome.effects) {
      this.applyEffects(outcome.effects);
    }
    if (outcome.flags) {
      Object.assign(state.flags, outcome.flags);
    }
    if (state.phase === "countdown") {
      state.time = Math.max(0, state.time - 10);
      if (typeof outcome.effects?.time === "number") {
        state.time = Math.max(0, state.time + outcome.effects.time);
      }
      state.countdownIndex += 1;
      this.showCountdownEvent();
      return;
    }
    if (state.phase === "day") {
      this.endOfDay(outcome);
    }
  },
  addCrewMember(id) {
    const state = this._state;
    if (!state) return null;
    const template = crewTemplates[id];
    if (!template) return null;
    const roster = getRoster(state);
    if (roster.some((member) => member.id === id)) {
      return template;
    }
    roster.push({ ...template });
    state.resources.crew = Math.max(0, (state.resources.crew || 0) + 1);
    state.flags.crewRoster = roster;
    state.flags.lastGainedCrew = template.name;
    return template;
  },
  removeCrewMember(id) {
    const state = this._state;
    if (!state) return null;
    const roster = getRoster(state);
    if (!roster.length) return null;
    let index = -1;
    if (id) {
      index = roster.findIndex((member) => member.id === id);
    }
    if (index < 0) {
      index = roster.length - 1;
    }
    const [removed] = roster.splice(index, 1);
    if (removed) {
      state.resources.crew = Math.max(0, (state.resources.crew || 0) - 1);
      state.flags.lastLostCrew = removed.name;
    }
    state.flags.crewRoster = roster;
    return removed || null;
  },
  getInventory() {
    if (!this._state) return [];
    return getInventoryState(this._state);
  },
  hasItem(id) {
    if (!this._state) return false;
    return hasInventoryItem(this._state, id);
  },
  addItem(id) {
    if (!this._state) return false;
    const added = addInventoryItem(this._state, id);
    if (added) {
      this.renderStats();
    }
    return added;
  },
  removeItem(id) {
    if (!this._state) return false;
    const removed = removeInventoryItem(this._state, id);
    if (removed) {
      this.renderStats();
    }
    return removed;
  },
  itemName(id) {
    return getItemName(id);
  },
  inventoryLabel() {
    const list = this.getInventory();
    if (!list.length) {
      return "无";
    }
    return list.map((id) => this.itemName(id)).join("、");
  },
  describeItems(ids) {
    if (!Array.isArray(ids) || !ids.length) return "";
    return ids.map((id) => this.itemName(id)).join("、");
  },
  optionRequirementStatus(option) {
    if (!option || !Array.isArray(option.requires) || !option.requires.length) {
      return { missing: [] };
    }
    const missing = option.requires.filter((id) => !this.hasItem(id));
    return { missing };
  },
  canUseOption(option) {
    const status = this.optionRequirementStatus(option);
    return !status.missing.length;
  },
  applyEffects(effects = {}) {
    const res = this._state?.resources;
    if (!res) return;
    if (effects.set && typeof effects.set === "object") {
      Object.entries(effects.set).forEach(([key, value]) => {
        if (res[key] !== undefined) {
          res[key] = value;
        }
      });
    }
    Object.entries(effects).forEach(([key, value]) => {
      if (key === "set" || key === "time") return;
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return;
      if (res[key] === undefined) {
        res[key] = num;
      } else {
        res[key] += num;
      }
    });
    ["fuel", "food", "o2", "mind", "signal", "satiety"].forEach((key) => {
      if (res[key] !== undefined) {
        res[key] = Math.round(res[key] * 100) / 100;
      }
    });
    if (res.crew !== undefined) {
      res.crew = Math.max(0, Math.min(3, Math.round(res.crew)));
    }
    if (res.satiety !== undefined) {
      res.satiety = Math.max(-3, Math.min(5, Math.round(res.satiety)));
    }
  },
  endOfDay(outcome = {}) {
    const state = this._state;
    if (!state) return;
    const res = state.resources;
    const roster = getRoster(state);
    const crewCount = roster.length;
    const summary = [];

    const hasThrusterKit = this.hasItem("thrusterKit");
    const hasO2Recycler = this.hasItem("o2Recycler");
    const hasRationSeal = this.hasItem("rationSeal");

    const engineerBonus = hasCrewRole(state, "repair") ? 0.4 : 0;
    const navigatorBonus = hasCrewRole(state, "nav") ? 0.6 : 0;
    const day = res.day || 1;
    const ramp = Math.max(0, (day - 12) * 0.04);
    const deepRamp = Math.max(0, (day - 60) * 0.05);
    let fuelDrain = 2.1 + Math.max(0, crewCount - 1) * 0.3 - engineerBonus - navigatorBonus + ramp + deepRamp * 0.5;
    if (hasThrusterKit) {
      fuelDrain -= 0.4;
    }
    fuelDrain = Math.max(1.4, Math.round(fuelDrain * 10) / 10);
    res.fuel -= fuelDrain;
    summary.push(`燃料 -${fuelDrain}`);

    const careBonus = hasCrewRole(state, "care") ? 0.5 : 0;
    const signalBonus = hasCrewRole(state, "signal") ? 0.3 : 0;
    let o2Drain = 3.6 + crewCount * 0.75 - careBonus - signalBonus + ramp * 0.6 + deepRamp * 0.4;
    if (hasO2Recycler) {
      o2Drain -= 0.8;
    }
    o2Drain = Math.max(2.4, Math.round(o2Drain * 10) / 10);
    res.o2 -= o2Drain;
    summary.push(`O₂ -${o2Drain}`);

    if (typeof res.satiety !== "number") {
      res.satiety = 2;
    }
    let hungerDrain = 1 + (day >= 70 ? 1 : 0);
    if (hasRationSeal) {
      hungerDrain = Math.max(0, hungerDrain - 1);
    }
    res.satiety -= hungerDrain;
    summary.push(hungerDrain > 0 ? `饱腹 -${hungerDrain}` : "饱腹 稳定");

    let foodNote = "食物 0 (节约)";
    if (res.satiety <= 0) {
      const appetites = 1 + crewCount;
      const rationBase = state.flags.rationTight ? 1 : 2;
      let foodCost = rationBase * appetites;
      if (careBonus > 0) {
        foodCost = Math.max(1, foodCost - 1);
      }
      if (hasRationSeal) {
        foodCost = Math.max(1, foodCost - 1);
      }
      const available = Math.max(0, res.food);
      const consumed = Math.min(foodCost, available);
      res.food -= consumed;
      if (consumed < foodCost) {
        const deficit = foodCost - consumed;
        res.mind -= deficit * 6;
        foodNote = `食物 -${consumed} (不足 ${deficit})`;
        this.pushLog("粮仓发出空洞回声。你们紧紧裹着安全带，忍受饥饿。", "system");
        res.satiety = 1;
      } else {
        foodNote = `食物 -${consumed}`;
        this.pushLog("你们凑到一起分配热量片。每个人咬下去时都尽量不发出声响。", "system");
        res.satiety = 2 + (careBonus > 0 ? 1 : 0);
      }
    }
    summary.push(foodNote);

    if (outcome.preventMindDecay) {
      summary.push("心智 稳定");
    } else {
      const minLoss = outcome.mindShock ? 12 : 6;
      const maxLoss = outcome.mindShock ? 22 : 15;
      const dayPenalty = Math.min(22, Math.floor(day / 4));
      const loss = StarfallData.randomInt(minLoss + dayPenalty, maxLoss + dayPenalty);
      res.mind -= loss;
      summary.push(`心智 -${loss}`);
    }
    this.renderStats();
    this.pushLog(`日终结算：${summary.join(" · ")}`, "system");
    if (this.checkEnding()) {
      return;
    }
    res.day += 1;
    if (res.day > 160) {
      res.day = 160;
    }
    if (this.checkEnding()) {
      return;
    }
    this.showDayEvent();
  },
  checkEnding() {
    const state = this._state;
    if (!state) return false;
    if (state.phase === "ending" && state.currentEnding) {
      return true;
    }
    const r = state.resources;
    const flags = state.flags || {};
    let ending = null;
    if (r.fuel <= 0 || r.o2 <= 0 || r.food <= 0) {
      ending = {
        id: "cold-silence",
        title: "冷寂",
        body: "飞船静止。你的呼吸在舱壁上结霜，星光成为最后的灯。",
        codexTone: "dark",
        codexSummary: "资源耗尽后，逃生舱冻结在虚空里。",
      };
    } else if (r.mind <= 0) {
      if (flags.awakenChance || flags.dreamLogged) {
        ending = {
          id: "star-awakening",
          title: "觉醒",
          body: "一切安静。你意识到自己不再需要呼吸。亿万颗星星在耳边低语：欢迎归来。",
          codexTone: "mystic",
          codexSummary: "心智瓦解却与星海融为一体。",
        };
      } else {
        ending = {
          id: "mind-fracture",
          title: "断裂",
          body: "意识在寂静中崩塌。你忘记了自己的名字，只剩潮湿的冷雾。",
          codexTone: "dark",
          codexSummary: "心智坠入虚空，没有人听见。",
        };
      }
    } else {
      const day = r.day || 1;
      if (day < 50) {
        return false;
      }
      const finalGoal = flags.legendFinal;
      if (day >= 100 && finalGoal) {
        const finalMap = {
          colony: {
            id: "frost-citadel",
            title: "霜辉城邦",
            body: "霜辉城在冰壳下铺展。长明灯照亮雪原，你的名字被刻在第一面旗帜上。",
            codexTone: "hope",
            codexSummary: "百日后守住霜辉城，把冰原变成新的文明。",
          },
          beacon: {
            id: "luminous-net",
            title: "灯塔星海",
            body: "灯塔网络在宇宙中构成星河，每一次脉冲都引导迷途者靠岸。",
            codexTone: "hope",
            codexSummary: "灯塔遍布星海，任何求救都能被引导归航。",
          },
          chorus: {
            id: "aurora-eternity",
            title: "极光永恒",
            body: "你的意识化作极光，随星海震荡而歌。肉体沉入冰原，灵魂遍布宇宙。",
            codexTone: "mystic",
            codexSummary: "在百日尽头融入极光，与星海同鸣。",
          },
          ascent: {
            id: "voyage-armada",
            title: "远航舰队",
            body: "你率领编队升空，携带霜辉的坐标驶向未知的恒星。",
            codexTone: "hope",
            codexSummary: "百日备战后，远航舰队冲出暗带。",
          },
          rescue: {
            id: "salvation-network",
            title: "救援网络",
            body: "你的中继站遍布星海。求救信号不再孤单，舰队以你的标准执行救援。",
            codexTone: "hope",
            codexSummary: "建立覆盖星域的救援网络，永远回应求救。",
          },
          caravan: {
            id: "caravan-commonwealth",
            title: "游牧联邦",
            body: "商队结成联邦，以你的舰为旗。每一座流动的集市都传唱你的航线。",
            codexTone: "hope",
            codexSummary: "百日后组建游牧联邦，带着故事往来星际。",
          },
          archive: {
            id: "memory-continuum",
            title: "记忆长河",
            body: "你的灵魂被刻进星海档案，亿万段旅程与之共鸣。",
            codexTone: "mystic",
            codexSummary: "把记忆永久写入星海，让故事永不消失。",
          },
          wayfinder: {
            id: "harbor-of-light",
            title: "光之港口",
            body: "暗带尽头出现新的港口，灯火由你点燃，旅人终于有处可停。",
            codexTone: "hope",
            codexSummary: "百日探索后建立光之港口，庇护所有漂泊者。",
          },
        };
        ending = finalMap[finalGoal] || null;
      }
      if (!ending && day >= 90) {
        if (flags.chorusAscend) {
          ending = {
            id: "aurora-ascension",
            title: "极光升阶",
            body: "极夜的乐章与你的意识融合，冰原再无寂静。",
            codexTone: "mystic",
            codexSummary: "极光祭坛成形，意识在星海里长鸣。",
          };
        } else if (flags.beaconConstellation) {
          ending = {
            id: "constellation-lighthouse",
            title: "星座灯塔",
            body: "灯塔舰队在轨道间穿梭，求救讯号编织成灿烂星座。",
            codexTone: "hope",
            codexSummary: "灯塔不再孤单，它们组成星座守护航道。",
          };
        } else if (flags.voyageArmada) {
          ending = {
            id: "armada-prospect",
            title: "远征序曲",
            body: "你的舰队完成合练，跃迁引擎在胸腔里震动。",
            codexTone: "hope",
            codexSummary: "百日训练成就远征舰队，准备探索未知。",
          };
        } else if (flags.rescueWeb) {
          ending = {
            id: "rescue-web",
            title: "救援之网",
            body: "你的中继站遍布各星域，每个求救都会被迅速响应。",
            codexTone: "hope",
            codexSummary: "建立遍及星域的救援之网。",
          };
        } else if (flags.caravanConstellation) {
          ending = {
            id: "starlit-bazaar",
            title: "星光市集",
            body: "游牧舰队按你的轨迹巡游，星光与歌声成为新货币。",
            codexTone: "hope",
            codexSummary: "将商队联盟发展成漂浮市集。",
          };
        } else if (flags.archiveEternal) {
          ending = {
            id: "eternal-archive",
            title: "永恒档案",
            body: "你的记忆在多个星系同步，任何人都能在档案中听见你的声音。",
            codexTone: "mystic",
            codexSummary: "档案网络跨越星系，记忆永不遗失。",
          };
        } else if (flags.wayfinderHarbor) {
          ending = {
            id: "wayfinder-refuge",
            title: "领航庇护",
            body: "浮标组成安全廊道，迷路的舱体顺着你的指引找到庇护站。",
            codexTone: "hope",
            codexSummary: "在暗带中布置避难廊道，引导迷航者。",
          };
        } else if (flags.citadelLegacy) {
          ending = {
            id: "frost-academy",
            title: "霜辉学府",
            body: "霜辉城建立学院，下一代拓荒者在极夜里学习你的故事。",
            codexTone: "hope",
            codexSummary: "把霜辉基地发展为教育中心，孕育拓荒者。",
          };
        }
      }
      if (!ending && day >= 75) {
        if (flags.legendChorus) {
          ending = {
            id: "chorus-mantle",
            title: "极光披风",
            body: "极光呼唤你的名字，你的心智披上星海的披风。",
            codexTone: "mystic",
            codexSummary: "持续与极光对话，成为它的代言人。",
          };
        } else if (flags.legendBeacon) {
          ending = {
            id: "lighthouse-chain",
            title: "灯塔链路",
            body: "你的灯塔沿冰原延伸，旅人不再迷失方向。",
            codexTone: "hope",
            codexSummary: "灯塔联动形成安全航路。",
          };
        } else if (flags.legendVoyage) {
          ending = {
            id: "voyage-prelude",
            title: "远航前夜",
            body: "舰船整装待发，跨越暗带的队形已经排好。",
            codexTone: "hope",
            codexSummary: "远航舰队集结，等待最终指令。",
          };
        } else if (flags.legendRescue) {
          ending = {
            id: "rescue-pact",
            title: "救援盟约",
            body: "救援舰与漂流舱缔结盟约，你的频道成为彼此的灯塔。",
            codexTone: "hope",
            codexSummary: "救援力量形成联盟。",
          };
        } else if (flags.legendCaravan) {
          ending = {
            id: "caravan-convoy",
            title: "商队护航",
            body: "商队穿梭于星域间，每艘船都在你的导航表里签到。",
            codexTone: "hope",
            codexSummary: "商队组成稳定航线，互相护航。",
          };
        } else if (flags.legendArchive) {
          ending = {
            id: "archive-spire",
            title: "档案尖塔",
            body: "记忆尖塔高悬，成为星海旅人的心灵驿站。",
            codexTone: "mystic",
            codexSummary: "档案节点成为旅人的精神灯塔。",
          };
        } else if (flags.legendWayfinder) {
          ending = {
            id: "wayfinder-beacon",
            title: "领航灯塔",
            body: "你把领航灯撒在暗带，让未知的航道第一次拥有座标。",
            codexTone: "hope",
            codexSummary: "领航者在暗带布置灯塔，开拓新路。",
          };
        } else if (flags.legendColony) {
          ending = {
            id: "frosthaven-council",
            title: "霜辉议会",
            body: "霜辉基地召开第一次议会，你们决定把这里开放给所有旅人。",
            codexTone: "hope",
            codexSummary: "霜辉基地建立自治议会，成为避难中心。",
          };
        }
      }
      if (!ending) {
        if (flags.surfaceAscended) {
          ending = {
            id: "erevia-ascent",
            title: "霜壳升空",
            body: "逃生舱冲出 Erevia 的冰层，极光在舷窗外拉出金色尾焰。你重新拾起星际航道。",
            codexTone: "hope",
            codexSummary: "从冰封行星起飞，带着晶体燃料返回星海。",
          };
        } else if (flags.surfaceColony) {
          ending = {
            id: "frosthaven",
            title: "霜辉基地",
            body: "你们把营地扩展成第一座极夜基地。灯塔在冰原上恒久燃烧，等待下一批漂泊者。",
            codexTone: "hope",
            codexSummary: "选择留在 Erevia，建立霜辉基地守护过路的幸存者。",
          };
        } else if (flags.surfaceBeacon && r.signal >= 60) {
          ending = {
            id: "ice-beacon",
            title: "极地灯塔",
            body: "晶体网络闪耀。几小时后，回收船的灯光穿透雪雾，你在冰原上举起求救信号。",
            codexTone: "hope",
            codexSummary: "在行星表面点亮信标，引来救援。",
          };
        } else if (flags.surfaceChorus && r.signal >= 80) {
          ending = {
            id: "aurora-chorus",
            title: "极光合唱",
            body: "冰原上的晶体与极光同步歌唱。你的信号化作一曲合唱，被整个星域记住。",
            codexTone: "mystic",
            codexSummary: "让 Erevia 的极光成为宇宙的共鸣，广播出新的坐标。",
          };
        } else if (flags.surfaceAwaken) {
          ending = {
            id: "ice-awakening",
            title: "冰原归一",
            body: "你在极夜中静坐，意识沿着冰晶传播。星海的低语与你同频。",
            codexTone: "mystic",
            codexSummary: "留在 Erevia，让意识成为冰原的一部分。",
          };
        } else if (flags.caravanAlliance) {
          ending = {
            id: "star-caravan",
            title: "星际商队",
            body: "商队的船帆在星光下展开。你把日志交给新的同伴，与他们一起驶向聚落的灯火。",
            codexTone: "hope",
            codexSummary: "加入星际商队，带着故事继续旅行。",
          };
        } else if (flags.archiveLinked && r.signal >= 50) {
          ending = {
            id: "stellar-archive",
            title: "星海档案",
            body: "远端档案库接入你的意识。你的记忆化作坐标，永远记录在星海中。",
            codexTone: "mystic",
            codexSummary: "把旅程上传到星际档案，与无数记忆并肩。",
          };
        } else if (r.signal >= 75 || (flags.rescuePulse && r.signal >= 65)) {
          ending = {
            id: "human-voice",
            title: "人类之声",
            body: "远处的蓝光靠近，一艘回收船在雾霭里伸出机械臂。你终于放下日志。",
            codexTone: "hope",
            codexSummary: "信号被捕捉，你被舰队成功回收。",
          };
        } else if (flags.vectorPlotted) {
          ending = {
            id: "unknown-vector",
            title: "未知航线",
            body: "你调整舱体角度，滑入微弱重力的缝隙。未知航道在黑暗中张开。",
            codexTone: "neutral",
            codexSummary: "拒绝等待救援，独自驶向未知的航线。",
          };
        } else if (flags.engineFrozen) {
          ending = {
            id: "frozen-orbit",
            title: "轨道囚徒",
            body: "推进器被冰霜锁死，你在寒冷的行星阴影里做永恒的卫星。",
            codexTone: "dark",
            codexSummary: "引擎冻结，你永远绕着死寂行星旋转。",
          };
        } else if (flags.loner) {
          ending = {
            id: "solitary-drift",
            title: "孤航",
            body: "你保持沉默，穿越无人回应的航道。只有自己的呼吸陪伴你。",
            codexTone: "neutral",
            codexSummary: "拒绝同伴的旅人，在星海中独自漂流。",
          };
        } else if (flags.landedErevia) {
          ending = {
            id: "ice-warden",
            title: "冰壳守望",
            body: "救生舱留在 Erevia 表面。你点燃小小的炉火，守望下一艘漂泊者的到来。",
            codexTone: "neutral",
            codexSummary: "没有离开行星，而是在冰原建立孤独的基地。",
          };
        } else {
          ending = {
            id: "adrift",
            title: "漂流",
            body: "求救信标最终熄灭。你继续漂向未知的暗带，等待下一次醒来。",
            codexTone: "dark",
            codexSummary: "没有救援，也没有目的地，只剩漫长漂流。",
          };
        }
      }
    }
    if (!ending) {
      return false;
    }
    this.unlockEnding(ending);
    state.currentEnding = ending;
    state.phase = "ending";
    state.pendingStory = {
      title: `结局 · ${ending.title}`,
      body: ending.body,
      options: [],
    };
    this.renderState();
    this.submitRunResult(ending);
    return true;
  },
  pushLog(text, type = "story") {
    const list = this._state?.log;
    if (!list) return;
    list.push({ text, type, id: Date.now() + Math.random() });
    if (list.length > 120) {
      list.splice(0, list.length - 120);
    }
    this.renderLog();
  },
  renderState() {
    if (this._locked) {
      this.renderLocked();
      return;
    }
    if (typeof API !== "undefined") {
      this._isAdmin = !!(API._me && API._me.is_admin);
    }
    this.renderStats();
    this.renderStory();
    this.renderChoices();
    this.renderOutcome();
    this.renderLog();
    this.renderCodex();
    this.renderLeaderboard();
    this.renderAudio();
  },
  renderLocked() {
    if (!this._els) return;
    if (this._els.stats) {
      this._els.stats.innerHTML = `
        <div class="starfall-stat">
          <div class="starfall-stat__label">状态</div>
          <div class="starfall-stat__value">暂未开放</div>
        </div>
      `;
    }
    if (this._els.story) {
      this._els.story.innerHTML = `
        <h3 class="starfall-story__title">静候信号</h3>
        <p class="starfall-story__body">管理员尚未开放《星际余生》。当功能开放后，你即可在这里开始 60 秒的逃生倒计时。</p>
      `;
    }
    if (this._els.choices) {
      this._els.choices.innerHTML = '<p class="muted">请联系管理员或等待公告，星际旅程即将启程。</p>';
    }
    if (this._els.outcome) {
      this._els.outcome.classList.add("is-hidden");
      this._els.outcome.innerHTML = "";
    }
    if (this._els.log) {
      this._els.log.innerHTML = '<p class="starfall-log__item starfall-log__item--system">系统：功能暂未开放。</p>';
    }
    if (this._els.codex) {
      this._els.codex.innerHTML = `
        <h3 class="starfall-codex__title">结局图鉴</h3>
        <p class="starfall-codex__empty">功能关闭中，尚无可展示的结局。</p>
      `;
    }
    if (this._els.leaderboard) {
      this._els.leaderboard.innerHTML = `
        <div class="starfall-leaderboard__card">
          <div class="starfall-leaderboard__header">
            <div class="starfall-leaderboard__title">积分排行榜</div>
          </div>
          <p class="starfall-leaderboard__empty">星际余生关闭时无法查看排行。</p>
        </div>
      `;
    }
    if (this._els.restart) {
      this._els.restart.disabled = true;
    }
    if (this._els.audioToggle) {
      this._els.audioToggle.disabled = true;
      this._els.audioToggle.textContent = "🔇 音景关闭";
    }
  },
  ensureAudioEngine() {
    if (!this._audio) {
      this._audio = {
        enabled: false,
        userMuted: false,
        currentMode: null,
        currentPreset: null,
        pendingMode: this.determineBgmMode(),
      };
    }
    if (typeof window === "undefined" || !window.AudioEngine) {
      return false;
    }
    try {
      window.AudioEngine.ensure?.();
    } catch (_) {
      return false;
    }
    return true;
  },
  determineBgmMode() {
    const state = this._state;
    if (!state) return "prelude";
    switch (state.phase) {
      case "intro":
        return "prelude";
      case "countdown":
        return "countdown";
      case "interlude":
      case "day":
        return "day";
      case "ending": {
        const tone = state.currentEnding?.codexTone || "neutral";
        if (["dark", "grim", "void", "negative"].includes(tone)) return "ending-negative";
        if (["mystic", "ascend", "awaken"].includes(tone)) return "ending-mystic";
        if (["neutral", "balanced"].includes(tone)) return "ending-neutral";
        return "ending-positive";
      }
      default:
        return "day";
    }
  },
  resolveBgmPreset(mode) {
    switch (mode) {
      case "countdown":
        return "starfall-countdown";
      case "ending-positive":
        return "starfall-hope";
      case "ending-mystic":
        return "starfall-mystic";
      case "ending-negative":
        return "starfall-void";
      case "ending-neutral":
        return "starfall-neutral";
      case "day":
      case "interlude":
        return "starfall-deep";
      case "prelude":
      default:
        return "starfall-prelude";
    }
  },
  setBgmMode(mode) {
    if (!this._audio) {
      this._audio = {
        enabled: false,
        userMuted: false,
        currentMode: null,
        currentPreset: null,
        pendingMode: this.determineBgmMode(),
      };
    }
    const target = mode || this.determineBgmMode();
    const preset = this.resolveBgmPreset(target);
    this._audio.pendingMode = target;
    if (!this._audio.enabled || !preset) {
      return;
    }
    if (!this.ensureAudioEngine()) {
      return;
    }
    if (this._audio.currentMode === target && this._audio.currentPreset === preset) {
      return;
    }
    window.AudioEngine?.playPreset?.("starfall", preset);
    this._audio.currentMode = target;
    this._audio.currentPreset = preset;
  },
  syncAudioState() {
    if (!this._audio) {
      this._audio = {
        enabled: false,
        userMuted: false,
        currentMode: null,
        currentPreset: null,
        pendingMode: this.determineBgmMode(),
      };
    }
    const mode = this.determineBgmMode();
    this._audio.pendingMode = mode;
    if (this._audio.enabled) {
      this.setBgmMode(mode);
    }
  },
  enableAudio(auto = false) {
    if (this._locked) return;
    if (!this.ensureAudioEngine()) return;
    if (!this._audio) return;
    if (this._audio.enabled) return;
    this._audio.enabled = true;
    if (auto) {
      this._audio.userMuted = false;
    }
    this.setBgmMode(this.determineBgmMode());
    this.playSfx("confirm");
    this.renderAudio();
  },
  disableAudio(fromUser = false, force = false) {
    if (!this._audio) return;
    if (!force && !this._audio.enabled) {
      if (fromUser) {
        this._audio.userMuted = true;
        this.renderAudio();
      }
      return;
    }
    this._audio.enabled = false;
    if (fromUser) {
      this._audio.userMuted = true;
    }
    window.AudioEngine?.stopChannel?.("starfall", !!force);
    this._audio.currentMode = null;
    this._audio.currentPreset = null;
    this.renderAudio();
  },
  toggleAudio() {
    if (this._locked) return;
    if (!this._audio) {
      this._audio = {
        enabled: false,
        userMuted: false,
        currentMode: null,
        currentPreset: null,
        pendingMode: this.determineBgmMode(),
      };
    }
    if (this._audio.enabled) {
      this.disableAudio(true);
    } else {
      this.enableAudio(false);
    }
  },
  playSfx(type = "select") {
    if (!this._audio?.enabled) return;
    if (!this.ensureAudioEngine()) return;
    const key = type === "confirm" ? "refresh-complete" : type === "warning" ? "refresh" : "ui-tap";
    const opts = type === "warning" ? { playbackRate: 0.85 } : type === "confirm" ? { playbackRate: 1.05 } : {};
    window.AudioEngine?.playSfx?.(key, opts);
  },
  renderAudio() {
    if (this._locked) {
      if (this._els?.audioToggle) {
        this._els.audioToggle.textContent = "🔇 音景关闭";
        this._els.audioToggle.setAttribute("aria-pressed", "false");
      }
      return;
    }
    if (!this._els?.audioToggle) return;
    this.syncAudioState();
    const enabled = this._audio?.enabled;
    this._els.audioToggle.textContent = enabled ? "🔊 音景开启" : "🔇 音景关闭";
    this._els.audioToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  },
  formatScore(value) {
    if (!Number.isFinite(value)) return "0";
    const rounded = Math.round(value);
    try {
      return rounded.toLocaleString("zh-CN");
    } catch (_) {
      return String(rounded);
    }
  },
  calculateScore(state = this._state, ending = null) {
    if (!state) return 0;
    const res = state.resources || {};
    let day = Math.max(0, Math.round(res.day || 0));
    if (day <= 0 && state.phase && state.phase !== "intro") {
      day = state.phase === "countdown" ? 0 : 1;
    }
    const roster = getRoster(state);
    const flags = state.flags || {};
    const fuel = Math.max(0, Number(res.fuel || 0));
    const food = Math.max(0, Number(res.food || 0));
    const o2 = Math.max(0, Number(res.o2 || 0));
    const signal = Math.max(0, Number(res.signal || 0));
    const mind = Math.max(0, Number(res.mind || 0));
    const satiety = Math.max(0, Number(res.satiety || 0));
    const crewCount = roster.length;
    const finalEnding = ending || state.currentEnding || null;
    const dayScore = day * 140;
    const longHaulBonus = Math.max(0, day - 50) * 24;
    const resourceScore = fuel * 2.8 + o2 * 2.5 + signal * 2.2 + food * 1.7;
    const mindScore = mind * 1.35;
    const crewScore =
      crewCount * 220 +
      (flags.crewBond ? 45 : 0) +
      (flags.caravanAlliance ? 80 : 0) +
      (flags.legendColony ? 70 : 0);
    const satietyScore = satiety * 45;
    let milestoneBonus = 0;
    if (flags.legendFinal) milestoneBonus += 600;
    if (flags.surfaceColony) milestoneBonus += 260;
    if (flags.surfaceBeacon) milestoneBonus += 220;
    if (flags.surfaceChorus) milestoneBonus += 260;
    if (flags.surfaceAwaken) milestoneBonus += 240;
    if (flags.surfaceAscended) milestoneBonus += 240;
    if (flags.vectorPlotted) milestoneBonus += 180;
    if (flags.archiveLinked) milestoneBonus += 210;
    if (flags.legendVoyage) milestoneBonus += 260;
    if (flags.legendRescue) milestoneBonus += 240;
    if (flags.legendCaravan) milestoneBonus += 240;
    if (flags.legendArchive) milestoneBonus += 240;
    if (flags.legendWayfinder) milestoneBonus += 240;
    if (flags.surfaceBeacon && signal >= 60) milestoneBonus += 120;
    const toneMap = { hope: 900, mystic: 820, neutral: 680, dark: 420 };
    const toneKey = finalEnding?.codexTone || "neutral";
    const endingBonus = finalEnding ? toneMap[toneKey] || 620 : 0;
    const darkPenalty = finalEnding && toneKey === "dark" ? 180 : 0;
    const total =
      dayScore +
      longHaulBonus +
      resourceScore +
      mindScore +
      crewScore +
      satietyScore +
      milestoneBonus +
      endingBonus -
      darkPenalty;
    return Math.max(0, Math.round(total));
  },
  async refreshProfile() {
    if (this._locked) {
      this.renderLocked();
      return;
    }
    if (typeof API === "undefined" || !API.token) {
      this.renderStats();
      this.renderLeaderboard();
      return;
    }
    try {
      const profile = await API.starfallProfile();
      if (profile && typeof profile === "object") {
        this._profile = profile;
        this.renderStats();
        this.renderLeaderboard();
      }
    } catch (err) {
      /* ignore */
    }
  },
  async refreshLeaderboard(limit = 12) {
    if (this._locked) {
      this.renderLocked();
      return;
    }
    if (typeof API === "undefined" || !API.token) {
      this._leaderboard = [];
      this._leaderboardSelf = null;
      this.renderLeaderboard();
      return;
    }
    try {
      const board = await API.starfallLeaderboard(limit);
      if (board && typeof board === "object") {
        this._leaderboard = Array.isArray(board.entries) ? board.entries : [];
        if (board.self && typeof board.self === "object") {
          this._leaderboardSelf = board.self;
          this._profile = { ...(this._profile || {}), ...board.self };
        } else {
          this._leaderboardSelf = null;
        }
        this.renderLeaderboard();
        this.renderStats();
      }
    } catch (err) {
      this._leaderboard = [];
      this._leaderboardSelf = null;
      this.renderLeaderboard();
    }
  },
  async submitRunResult(ending = null) {
    if (typeof API === "undefined" || !API.token) return;
    const state = this._state;
    if (!state) return;
    const score = this.calculateScore(state, ending);
    state.score = score;
    const res = state.resources || {};
    let day = Math.max(0, Math.round(res.day || 0));
    if (day <= 0 && state.phase && state.phase !== "intro") {
      day = state.phase === "countdown" ? 0 : 1;
    }
    try {
      const resp = await API.starfallSubmit({
        score,
        day,
        ending_id: ending?.id || "",
        ending_title: ending?.title || "",
        ending_tone: ending?.codexTone || "",
      });
      if (resp && typeof resp === "object") {
        if (resp.profile && typeof resp.profile === "object") {
          this._profile = { ...(this._profile || {}), ...resp.profile };
        }
        if (resp.leaderboard && typeof resp.leaderboard === "object") {
          this._leaderboard = Array.isArray(resp.leaderboard.entries)
            ? resp.leaderboard.entries
            : this._leaderboard;
          if (resp.leaderboard.self && typeof resp.leaderboard.self === "object") {
            this._leaderboardSelf = resp.leaderboard.self;
            this._profile = { ...(this._profile || {}), ...resp.leaderboard.self };
          }
        } else if (typeof resp.best_score === "number") {
          this._profile = { ...(this._profile || {}), ...resp };
        }
        this.renderStats();
        this.renderLeaderboard();
      }
    } catch (err) {
      this.pushLog(`排行榜同步失败：${(err && err.message) || err}`, "error");
    }
  },
  renderLeaderboard() {
    if (this._locked) return;
    if (!this._els?.leaderboard) return;
    const hasApi = typeof API !== "undefined" && !!API.token;
    if (!hasApi) {
      this._els.leaderboard.innerHTML = `
        <div class="starfall-leaderboard__card">
          <div class="starfall-leaderboard__header">
            <div class="starfall-leaderboard__title">积分排行榜</div>
          </div>
          <p class="starfall-leaderboard__empty">登录后可记录得分并查看排行榜。</p>
        </div>
      `;
      return;
    }
    const profile = this._profile || {};
    const entries = Array.isArray(this._leaderboard) ? this._leaderboard : [];
    const toggleLabel = this._showLeaderboard ? "隐藏积分排行榜" : "查看积分排行榜";
    const bestScoreRaw = Number.isFinite(profile.best_score)
      ? profile.best_score
      : Number.isFinite(profile.bestScore)
      ? profile.bestScore
      : 0;
    const bestScore = this.formatScore(bestScoreRaw);
    const bestDay = Math.max(0, Number.isFinite(profile.best_day) ? profile.best_day : Number(profile.bestDay) || 0);
    const personal = `<div class="starfall-leaderboard__personal">最佳成绩：${bestScore} 分 · 最远 Day ${bestDay}</div>`;
    const rankLine = Number.isFinite(profile.rank) && Number(profile.rank) > 0
      ? `<div class="starfall-leaderboard__self">当前排名：#${Number(profile.rank)} · 最佳日数 ${bestDay}</div>`
      : "";
    let body = "";
    if (!this._showLeaderboard) {
      body = '<p class="starfall-leaderboard__hint">点击查看排行榜，了解其他旅程的轨迹。</p>';
    } else if (!entries.length) {
      body = '<p class="starfall-leaderboard__empty">暂无排行数据，完成一局旅程后刷新。</p>';
    } else {
      const rows = entries
        .map((entry, idx) => {
          if (!entry) return "";
          const rank = typeof entry.rank === "number" ? entry.rank : idx + 1;
          const isSelf = profile && entry.user_id != null && profile.user_id === entry.user_id;
          const name = escapeHtml(entry.username || "未知旅人");
          const score = this.formatScore(entry.score || 0);
          const day = Math.max(0, entry.day || 0);
          const ending = entry.ending_title ? `<span class="ending">${escapeHtml(entry.ending_title)}</span>` : "";
          return `
            <li class="${isSelf ? "is-self" : ""}">
              <span class="rank">#${rank}</span>
              <span class="name">${name}</span>
              <span class="score">${score}</span>
              <span class="day">Day ${day}</span>
              ${ending}
            </li>
          `;
        })
        .filter(Boolean)
        .join("");
      body = `<ol class="starfall-leaderboard__list">${rows}</ol>`;
    }
    this._els.leaderboard.innerHTML = `
      <div class="starfall-leaderboard__card">
        <div class="starfall-leaderboard__header">
          <div class="starfall-leaderboard__title">积分排行榜</div>
          <button class="btn btn-mini" data-role="starfall-leaderboard-toggle">${toggleLabel}</button>
        </div>
        ${rankLine || ""}
        ${personal}
        ${body}
      </div>
    `;
  },
  renderStats() {
    if (this._locked) return;
    if (!this._els?.stats || !this._state) return;
    const { phase, resources, time } = this._state;
    const profile = this._profile || {};
    const bestScoreRaw = Number.isFinite(profile.best_score)
      ? profile.best_score
      : Number.isFinite(profile.bestScore)
      ? profile.bestScore
      : 0;
    const bestDay = Number.isFinite(profile.best_day)
      ? profile.best_day
      : Number.isFinite(profile.bestDay)
      ? profile.bestDay
      : 0;
    const rankLabel = Number.isFinite(profile.rank) && profile.rank > 0
      ? `#${profile.rank}`
      : "未上榜";
    const score = this.calculateScore();
    this._state.score = score;
    const build = (label, value, cls = "") => `
      <div class="starfall-stat ${cls}">
        <div class="starfall-stat__label">${escapeHtml(label)}</div>
        <div class="starfall-stat__value">${escapeHtml(String(value))}</div>
      </div>
    `;
    if (phase === "intro") {
      this._els.stats.innerHTML = [
        build("状态", "等待启动"),
        build("最佳分数", this.formatScore(bestScoreRaw)),
        build("最长日数", Math.max(0, bestDay || 0)),
        build("排名", rankLabel),
      ].join("");
      return;
    }
    if (phase === "countdown") {
      const res = this._state.resources;
      this._els.stats.innerHTML = [
        build("倒计时", `${Math.max(0, Math.round(time || 0))} s`),
        build("燃料", Math.round(res.fuel)),
        build("食物", Math.round(res.food)),
        build("O₂", Math.round(res.o2)),
        build("心智", Math.round(res.mind)),
        build("人员", res.crew),
        build("信号", Math.round(res.signal)),
        build("道具", this.inventoryLabel()),
        build("当前分数", this.formatScore(score)),
        build("最佳分数", this.formatScore(bestScoreRaw)),
        build("最长日数", Math.max(0, bestDay || 0)),
        build("排名", rankLabel),
      ].join("");
      return;
    }
    const res = resources;
    const warn = (key, threshold) => (res[key] <= threshold ? "is-warning" : "");
    const hungerState = res.satiety <= 0 ? "饥饿" : res.satiety === 1 ? "微饥" : "温饱";
    const items = [
      build("DAY", Math.max(1, res.day || 1)),
      build("燃料", Math.round(res.fuel), warn("fuel", 18)),
      build("食物", Math.round(res.food), warn("food", 8)),
      build("O₂", Math.round(res.o2), warn("o2", 25)),
      build("心智", Math.round(res.mind), warn("mind", 50)),
      build("信号", Math.round(res.signal)),
      build("饱腹", hungerState, res.satiety <= 0 ? "is-warning" : ""),
      build("道具", this.inventoryLabel()),
      build("同伴", crewListLabel(this._state)),
      build("当前分数", this.formatScore(score)),
      build("最佳分数", this.formatScore(bestScoreRaw)),
      build("最长日数", Math.max(0, bestDay || 0)),
      build("排名", rankLabel),
    ];
    this._els.stats.innerHTML = items.join("");
  },
  renderStory() {
    if (this._locked) return;
    if (!this._els?.story || !this._state) return;
    const story = this._state.pendingStory;
    if (!story) {
      this._els.story.innerHTML = '<p class="muted">数据载入中……</p>';
      return;
    }
    const hallucination = this._state.phase === "day" && this._state.resources.mind < 50
      ? '<p class="starfall-hallucination">窗外似乎有身影贴着玻璃。你眨眼时它消失了。</p>'
      : "";
    const body = story.body ? escapeHtml(story.body).replace(/\n/g, '<br>') : "";
    this._els.story.innerHTML = `
      <h3 class="starfall-story__title">${escapeHtml(story.title || "")}</h3>
      <p class="starfall-story__body">${body}</p>
      ${hallucination}
    `;
  },
  renderChoices() {
    if (this._locked) return;
    if (!this._els?.choices || !this._state) return;
    const { phase, pendingStory } = this._state;
    if (phase === "intro") {
      this._els.choices.innerHTML = '<button class="btn primary starfall-start" data-choice="start">开始倒计时</button>';
      return;
    }
    if (!pendingStory || !pendingStory.options || pendingStory.options.length === 0) {
      this._els.choices.innerHTML = '<p class="muted">没有可选项，使用下方按钮重新开始。</p>';
      return;
    }
    const html = pendingStory.options
      .map((opt) => {
        const label = escapeHtml(opt.label || "选项");
        const status = this.optionRequirementStatus(opt);
        const available = !status.missing.length;
        const detailParts = [];
        if (opt.detail) {
          detailParts.push(escapeHtml(opt.detail));
        }
        if (Array.isArray(opt.requires) && opt.requires.length) {
          detailParts.push(`需要：${escapeHtml(this.describeItems(opt.requires))}`);
        }
        if (status.missing.length) {
          detailParts.push(
            `<span class="starfall-option__missing">缺少：${escapeHtml(this.describeItems(status.missing))}</span>`
          );
        }
        const detail = detailParts.length
          ? `<span class="starfall-option__detail">${detailParts.join("<br>")}</span>`
          : "";
        const classes = `btn starfall-option${available ? "" : " is-disabled"}`;
        const disabledAttr = available ? "" : " disabled";
        const adminBlock = this.renderAdminInspector(opt);
        return `
          <div class="starfall-option-row">
            <button class="${classes}" data-choice="${escapeHtml(opt.key)}"${disabledAttr}>
              <span class="starfall-option__label">${label}</span>
              ${detail}
            </button>
            ${adminBlock || ""}
          </div>
        `;
      })
      .join("");
    this._els.choices.innerHTML = html;
  },
  renderAdminInspector(option) {
    if (!this._isAdmin || !option) {
      return "";
    }
    const preview = this.getOptionPreview(option);
    if (!preview || !Array.isArray(preview.outcomes) || !preview.outcomes.length) {
      return "";
    }
    const list = preview.outcomes.map((entry) => {
      const chance = this._formatChance(entry.chance);
      const summary = escapeHtml(entry.summary || "无显著变动");
      return `
        <li>
          <span class="starfall-option__admin-chance">${chance}</span>
          <span class="starfall-option__admin-text">${summary}</span>
        </li>
      `;
    }).join("");
    const note = preview.iterations
      ? `<div class="starfall-option__admin-note">基于 ${preview.iterations} 次模拟</div>`
      : "";
    return `
      <div class="starfall-option__admin">
        <div class="starfall-option__admin-title">管理员预览</div>
        <ul class="starfall-option__admin-list">${list}</ul>
        ${note}
      </div>
    `;
  },
  getOptionPreview(option) {
    if (!this._isAdmin || !this._state || !option) {
      return null;
    }
    if (typeof option.resolve !== "function") {
      return null;
    }
    const base = this._createPreviewBaseState();
    if (!base) {
      return null;
    }
    const iterations = Math.max(1, option.previewSamples || 160);
    const outcomes = new Map();
    for (let i = 0; i < iterations; i += 1) {
      const sample = this._clonePreviewState(base);
      let result;
      try {
        result = option.resolve(sample);
      } catch (err) {
        result = { error: err?.message || String(err) };
      }
      if (!result || typeof result !== "object") {
        result = {};
      }
      const sanitized = this._sanitizeOutcome(result);
      const signature = JSON.stringify(sanitized);
      const bucket = outcomes.get(signature);
      if (bucket) {
        bucket.count += 1;
      } else {
        outcomes.set(signature, { count: 1, outcome: result, sanitized });
      }
    }
    const list = Array.from(outcomes.values()).map((entry) => {
      const chance = Math.round((entry.count / iterations) * 1000) / 10;
      return {
        chance,
        summary: this._describeOutcome(entry.outcome, entry.sanitized),
      };
    }).sort((a, b) => b.chance - a.chance);
    return { iterations, outcomes: list };
  },
  _createPreviewBaseState() {
    if (!this._state) {
      return null;
    }
    const snapshot = {
      phase: this._state.phase,
      countdownIndex: this._state.countdownIndex,
      time: this._state.time,
      resources: this._state.resources,
      flags: this._state.flags,
    };
    try {
      return JSON.parse(JSON.stringify(snapshot));
    } catch (err) {
      return null;
    }
  },
  _clonePreviewState(base) {
    if (!base) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(base));
    } catch (err) {
      return null;
    }
  },
  _sanitizeOutcome(outcome) {
    if (!outcome || typeof outcome !== "object") {
      return {};
    }
    const sanitized = {};
    Object.keys(outcome).forEach((key) => {
      if (key === "log") return;
      const value = outcome[key];
      if (typeof value === "function" || value === undefined) {
        return;
      }
      sanitized[key] = this._normalizeOutcomeValue(value);
    });
    return sanitized;
  },
  _normalizeOutcomeValue(value) {
    if (value == null) {
      return value;
    }
    if (Array.isArray(value)) {
      const mapped = value.map((item) => this._normalizeOutcomeValue(item));
      const sortable = mapped.every((item) => item == null || typeof item !== "object");
      if (sortable) {
        return mapped.slice().sort((a, b) => {
          if (a === b) return 0;
          return a > b ? 1 : -1;
        });
      }
      return mapped;
    }
    if (typeof value === "object") {
      const ordered = Object.keys(value).sort().map((key) => [key, this._normalizeOutcomeValue(value[key])]);
      const result = {};
      ordered.forEach(([key, val]) => {
        result[key] = val;
      });
      return result;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 1000) / 1000;
    }
    return value;
  },
  _describeOutcome(outcome, sanitized) {
    const parts = [];
    const effects = sanitized.effects;
    if (effects && typeof effects === "object") {
      Object.keys(effects).forEach((key) => {
        if (key === "set") return;
        const change = this._formatEffectChange(key, effects[key]);
        if (change) {
          parts.push(change);
        }
      });
      if (effects.set && typeof effects.set === "object") {
        Object.entries(effects.set).forEach(([key, value]) => {
          const label = EFFECT_LABELS[key] || key.toUpperCase();
          parts.push(`${label} 设为 ${this._formatNumber(value)}`);
        });
      }
    }
    if (Array.isArray(sanitized.crewGain) && sanitized.crewGain.length) {
      const names = sanitized.crewGain.map((id) => crewTemplates[id]?.name || id);
      parts.push(`加入 ${names.join("、")}`);
    }
    if (Array.isArray(sanitized.crewLoss) && sanitized.crewLoss.length) {
      const names = sanitized.crewLoss.map((id) => crewTemplates[id]?.name || id);
      parts.push(`失去 ${names.join("、")}`);
    }
    if (Array.isArray(sanitized.itemsGain) && sanitized.itemsGain.length) {
      const names = sanitized.itemsGain.map((id) => this.itemName(id));
      parts.push(`获得 ${names.join("、")}`);
    }
    if (Array.isArray(sanitized.itemsUse) && sanitized.itemsUse.length) {
      const names = sanitized.itemsUse.map((id) => this.itemName(id));
      parts.push(`消耗 ${names.join("、")}`);
    }
    if (sanitized.preventMindDecay) {
      parts.push("心智稳定");
    }
    if (sanitized.mindShock) {
      parts.push("心智冲击");
    }
    if (sanitized.error) {
      parts.push(`异常 ${sanitized.error}`);
    }
    if (sanitized.flags && typeof sanitized.flags === "object") {
      const entries = [];
      Object.entries(sanitized.flags).forEach(([key, value]) => {
        if (key === "crewRoster") return;
        if (value === false || value == null) return;
        if (typeof value === "boolean") {
          if (value) entries.push(key);
        } else if (typeof value === "number" || typeof value === "string") {
          entries.push(`${key}:${value}`);
        }
      });
      if (entries.length) {
        const list = entries.slice(0, 3).join("、");
        parts.push(`标记 ${list}${entries.length > 3 ? "…" : ""}`);
      }
    }
    const handled = new Set(["effects", "crewGain", "crewLoss", "flags", "preventMindDecay", "mindShock", "error"]);
    Object.keys(sanitized).forEach((key) => {
      if (handled.has(key)) return;
      const value = sanitized[key];
      if (value === null || value === undefined || value === false) {
        return;
      }
      if (typeof value === "boolean") {
        if (value) {
          parts.push(key);
        }
        return;
      }
      if (typeof value === "number") {
        parts.push(`${key} ${this._formatNumber(value)}`);
        return;
      }
      if (typeof value === "string") {
        parts.push(`${key} ${value}`);
      }
    });
    if (!parts.length && outcome?.log) {
      const raw = String(outcome.log);
      const snippet = raw.length > 36 ? `${raw.slice(0, 36)}…` : raw;
      parts.push(snippet);
    }
    if (!parts.length) {
      parts.push("无显著变动");
    }
    return parts.join("；");
  },
  _formatEffectChange(key, value) {
    const label = EFFECT_LABELS[key] || key.toUpperCase();
    if (typeof value === "number") {
      return `${label} ${this._formatSignedNumber(value)}`;
    }
    if (value == null) {
      return null;
    }
    return `${label} ${value}`;
  },
  _formatSignedNumber(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    if (value === 0) {
      return "0";
    }
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
    let str = value.toFixed(digits);
    str = str.replace(/\.0$/, "");
    if (value > 0) {
      return `+${str}`;
    }
    return str;
  },
  _formatNumber(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
    return value.toFixed(digits).replace(/\.0$/, "");
  },
  _formatChance(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    if (value >= 99.95) {
      return "≈100%";
    }
    if (value <= 0.05) {
      return "<0.1%";
    }
    const digits = value >= 10 ? 1 : 1;
    const str = value.toFixed(digits).replace(/\.0$/, "");
    return `${str}%`;
  },
  renderLog() {
    if (this._locked) return;
    if (!this._els?.log || !this._state) return;
    const frag = this._state.log
      .slice()
      .reverse()
      .map((entry) => `<p class="starfall-log__item starfall-log__item--${entry.type}">${escapeHtml(entry.text)}</p>`)
      .join("");
    this._els.log.innerHTML = frag || '<p class="muted">等待你的第一条记录。</p>';
  },
  renderCodex() {
    if (this._locked) return;
    if (!this._els?.codex || !this._state) return;
    const list = Array.isArray(this._state.codex) ? this._state.codex : [];
    const badge = (tone) => {
      switch (tone) {
        case 'hope':
          return 'starfall-codex__item--hope';
        case 'mystic':
          return 'starfall-codex__item--mystic';
        case 'dark':
          return 'starfall-codex__item--dark';
        default:
          return 'starfall-codex__item--neutral';
      }
    };
    if (!list.length) {
      this._els.codex.innerHTML = `
        <h3 class="starfall-codex__title">结局图鉴</h3>
        <p class="starfall-codex__empty">旅程尚未留下结局。每一次死亡或获救，都会点亮这里的卡片。</p>
      `;
      return;
    }
    const items = list
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
      .map((entry) => `
        <article class="starfall-codex__item ${badge(entry.tone)}">
          <h4 class="starfall-codex__name">${escapeHtml(entry.title)}</h4>
          <p class="starfall-codex__summary">${escapeHtml(entry.summary)}</p>
        </article>
      `)
      .join("");
    this._els.codex.innerHTML = `
      <h3 class="starfall-codex__title">结局图鉴</h3>
      <div class="starfall-codex__grid">${items}</div>
    `;
  },
  renderOutcome() {
    if (this._locked) return;
    if (!this._els?.outcome || !this._state) return;
    const { phase, currentEnding } = this._state;
    if (phase !== "ending" || !currentEnding) {
      this._els.outcome.classList.add("is-hidden");
      this._els.outcome.innerHTML = "";
      return;
    }
    this._els.outcome.classList.remove("is-hidden");
    const score = this.formatScore(this.calculateScore(this._state, currentEnding));
    const summary = escapeHtml(currentEnding.codexSummary || currentEnding.body || "");
    const hints = this.buildEndingInsights(currentEnding);
    const hintItems = hints.length
      ? `<ul class="starfall-outcome__tips">${hints
          .map((hint) => `<li>${escapeHtml(hint)}</li>`)
          .join("")}</ul>`
      : '<p class="starfall-outcome__empty">旅程会继续延伸。尝试不同的抉择，探索更多结局。</p>';
    this._els.outcome.innerHTML = `
      <div class="starfall-outcome__card">
        <div class="starfall-outcome__section">
          <h3 class="starfall-outcome__title">结局摘要</h3>
          <p class="starfall-outcome__summary">${summary}</p>
          <div class="starfall-outcome__meta">最终得分：<strong>${score}</strong></div>
        </div>
        <div class="starfall-outcome__section">
          <h3 class="starfall-outcome__title">下一次的灵感</h3>
          ${hintItems}
        </div>
      </div>
    `;
  },
  buildEndingInsights(ending) {
    if (!ending) return [];
    const id = ending.id || "";
    const hints = [];
    const push = (...args) => {
      args.forEach((text) => {
        if (text) hints.push(text);
      });
    };
    switch (id) {
      case "cold-silence":
        push(
          "让燃料、氧气与食物保持正值；进入行星表面的事件能提供补给。",
          "信号超过 60% 后有机会触发救援或灯塔结局。"
        );
        break;
      case "mind-fracture":
        push(
          "密切关注心智值，利用陪伴事件或记录梦境来稳定心智。",
          "饱腹状态越好，心智衰减越慢；节奏地喂食同伴能减少崩溃风险。"
        );
        break;
      case "adrift":
        push(
          "尝试把信号累积到 75 以上，或在 Erevia 上建造灯塔。",
          "与商队或档案事件建立联系，会解锁全新的结局路线。"
        );
        break;
      case "ice-warden":
        push(
          "继续扩建地面设施，完成晶体和灯塔项目可以改变结局。",
          "若想重返星海，保留足够燃料并处理引擎结冰事件。"
        );
        break;
      case "ice-awakening":
      case "star-awakening":
        push(
          "记录梦境与极光事件能引导觉醒；保持高信号可以解锁希望结局。",
          "救下更多同伴，或与商队结盟，能避免独自化作星海。"
        );
        break;
      case "frozen-orbit":
        push(
          "及时修理推进器或寻找地热燃料，避免引擎被冰封。",
          "行星探索中的加热与熔解步骤会提供解冻机会。"
        );
        break;
      case "solitary-drift":
        push(
          "救援同伴并维持关系可以开启团队结局。",
          "星际商队与档案线索需要积极的呼叫与交易。"
        );
        break;
      case "human-voice":
        push(
          "继续延长航程至 75 天以上，有机会触发更大的灯塔或舰队结局。",
          "尝试在 Erevia 上完成建造项目，探索更深入的终局路线。"
        );
        break;
      case "frosthaven":
      case "frost-citadel":
        push(
          "完成灯塔或救援网络计划可以吸引更多旅人。",
          "若想离开行星，确保燃料与信号都达到高值，并关注舰队事件。"
        );
        break;
      default:
        push(
          "不同的倒计时选择会影响中后期事件，尝试保留更多专业船员。",
          "长程旅途中维持信号、饱腹与心智的平衡，可开启隐藏的终局。"
        );
        break;
    }
    return hints.slice(0, 4);
  },
};

