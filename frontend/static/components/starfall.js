const StarfallData = (() => {
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
            const crewGain = state.resources.crew >= 3 ? 0 : 1;
            const log = crewGain
              ? "你撬开安全门，把浑身冒烟的工程师拖进走廊。"
              : "门后是空荡的舱室，警报声在里面回旋。";
            return {
              log,
              effects: { crew: crewGain ? crewGain : 0, mind: crewGain ? 6 : -6, time: extraTime },
              flags: crewGain ? { savedCrew: true } : {},
            };
          },
        },
        {
          key: "ignore",
          label: "无视",
          detail: "转身离开，把时间留给自己。",
          resolve() {
            return {
              log: "你咬紧牙关，没有回头。呼救声最终被爆炸吞没。",
              effects: { mind: -14, time: 2 },
              flags: { guilt: true },
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
          key: "skip",
          label: "放弃",
          detail: "继续奔跑，争取几秒。",
          resolve() {
            return {
              log: "你越过氧气罐，靴底划出火花。你告诉自己：下一口气还够。",
              effects: { time: 4, mind: -4 },
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
          key: "leave",
          label: "放弃",
          detail: "让系统烧毁，别浪费时间。",
          resolve() {
            return {
              log: "你掠过失火的控制台。警告灯最后闪烁一次就熄灭。",
              flags: { consoleDamaged: true },
              effects: { mind: -6 },
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
            const rescued = Math.min(2, freeSlots);
            const effects = { crew: rescued ? rescued : 0, food: rescued ? -4 : -2, fuel: -6, mind: rescued ? 10 : -4 };
            const log = rescued
              ? "你把箱子扔出舱门，扶起两名满身灰烬的船员。他们虚弱地说了声谢谢。"
              : "救生舱里已经没有其他人。你意识到自己还是一个人。";
            return {
              log,
              effects,
              flags: rescued ? { savedCrew: true } : {},
            };
          },
        },
        {
          key: "solo",
          label: "只身逃离",
          detail: "清空舱室，独自起航。",
          resolve(state) {
            const crewLost = state.resources.crew;
            return {
              log: "你关上舱门。嘈杂的声音被隔绝在另一侧。",
              effects: { crew: crewLost ? -crewLost : 0, fuel: 5, mind: -22 },
              flags: { loner: true },
            };
          },
        },
      ],
    },
  ];

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return {
    countdownEvents,
    randomInt,
  };
})();

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
    }
    return { activity: `game:starfall:${phase}`, details };
  },
  render() {
    return `
      <div class=\"card starfall-card\">
        <h2 class=\"starfall-title\">星际余生 · Starfall 60</h2>
        <p class=\"starfall-sub\">倒计时、抉择与孤独求生。每个选项都会在之后的十日里留下痕迹。</p>
      </div>
      <div class=\"card starfall-card\">
        <div class=\"starfall-layout\">
          <section class=\"starfall-stats\" id=\"starfall-stats\"></section>
          <section class=\"starfall-story\" id=\"starfall-story\"></section>
          <section class=\"starfall-choices\" id=\"starfall-choices\"></section>
          <section class=\"starfall-log\" id=\"starfall-log\" aria-live=\"polite\"></section>
        </div>
        <div class=\"starfall-actions\">
          <button class=\"btn ghost\" id=\"starfall-restart\">重置旅程</button>
        </div>
      </div>
    `;
  },
  bind() {
    this._els = {
      stats: document.getElementById("starfall-stats"),
      story: document.getElementById("starfall-story"),
      choices: document.getElementById("starfall-choices"),
      log: document.getElementById("starfall-log"),
      restart: document.getElementById("starfall-restart"),
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
        this.initState();
        this.renderState();
      },
    };
    this._els.choices.addEventListener("click", this._handlers.onChoice);
    this._els.restart.addEventListener("click", this._handlers.onRestart);
    this.initState();
    this.renderState();
  },
  teardown() {
    if (this._els?.choices && this._handlers?.onChoice) {
      this._els.choices.removeEventListener("click", this._handlers.onChoice);
    }
    if (this._els?.restart && this._handlers?.onRestart) {
      this._els.restart.removeEventListener("click", this._handlers.onRestart);
    }
    this._state = null;
    this._els = null;
    this._handlers = null;
  },
  initState() {
    this._state = {
      phase: "intro",
      countdownIndex: 0,
      resources: {
        day: 0,
        fuel: 30,
        food: 10,
        o2: 40,
        mind: 100,
        crew: 0,
        signal: 0,
      },
      time: 60,
      flags: {},
      log: [],
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
          body: r.crew > 0
            ? "食物只剩下一周的量。船员们争论是否要节省配给。"
            : "你计算着自己的消耗。舱内飘着烤焦塑料的味道。",
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
                resolve: () => {
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
                      outcome.effects.crew = r.crew >= 3 ? 0 : 1;
                      outcome.effects.mind = 8;
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
                key: "ignore",
                label: "忽略信号",
                detail: "保持航向，心智会承受代价。",
                resolve: () => ({
                  effects: { mind: -10 },
                  log: "你关闭通道。静电在耳边噼啪作响。",
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
              resolve: () => {
                const success = Math.random() < 0.6;
                if (success) {
                  return {
                    effects: { fuel: 15, mind: 6 },
                    log: "你重新焊接电极，能量流恢复平稳。仪表提示：‘探测到行星 Erevia。’",
                    flags: { ereviaHint: true },
                    preventMindDecay: true,
                  };
                }
                const crewLost = r.crew > 0;
                const effects = { fuel: -5, mind: crewLost ? -18 : -22 };
                if (crewLost) {
                  effects.crew = -1;
                }
                return {
                  effects,
                  log: crewLost
                    ? "火花炸裂。你把手上的工具甩开，却没能拉住跌倒的同伴。"
                    : "电流在你掌心炸开。空气焦灼的味道久久不散。",
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
              resolve: () => {
                const success = Math.random() < 0.6 && r.crew > 0;
                if (success) {
                  return {
                    effects: { mind: 4, fuel: 10 },
                    log: "船员 Rae 挽起袖子，十分钟后系统重新点亮。",
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
            {
              key: "endure",
              label: "不作为",
              detail: "让寒冷自行过去。",
              resolve: () => {
                const crewLost = r.crew > 0 && Math.random() < 0.4;
                const effects = { mind: -30 };
                if (crewLost) {
                  effects.crew = -1;
                }
                return {
                  effects,
                  log: crewLost
                    ? "清晨时 Rae 没有醒来。她的手还紧抓着空水袋。"
                    : "你整晚没睡。肌肉僵硬得像铁。",
                  mindShock: true,
                };
              },
            },
          ],
        };
      case 7:
        return {
          title: "Day 7 · 遗体",
          body: r.crew > 0
            ? "Rae 的身体躺在储物舱旁。她的指甲掐进水袋。"
            : "空气闻起来像铁。你想起那些没能逃出来的人。",
          options: [
            {
              key: "bury",
              label: "安葬",
              detail: "把她送入星海。",
              resolve: () => ({
                effects: { mind: 10, food: -1 },
                log: "你打开外舱闸门。她缓慢漂离，像一颗温顺的卫星。",
                preventMindDecay: true,
              }),
            },
            {
              key: "preserve",
              label: "保留遗体",
              detail: "让身体成为隔热屏障。",
              resolve: () => ({
                effects: { fuel: 5, mind: -18 },
                log: "你把身体固定在舱壁，让它替你挡住寒气。",
                mindShock: true,
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
                  log: "你闭上眼睛。齿间传来的味道在记忆里盘旋。",
                  flags: { cannibal: true },
                  mindShock: true,
                };
              },
            },
          ],
        };
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
                const success = Math.random() < 0.6 && !flags.engineFrozen;
                if (success) {
                  return {
                    effects: { fuel: 10, o2: 15, mind: 6 },
                    log: "你钻入冰层下的裂隙。能量晶体在手套里发光。",
                    preventMindDecay: true,
                  };
                }
                return {
                  effects: { fuel: -10, o2: -5, mind: -14 },
                  log: "冰霜锁死推进器。你差点被困在轨道。",
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
                effects: { mind: -6 },
                log: "你保持轨道飞行。星球的阴影吞没了舱室。",
              }),
            },
            {
              key: "beacon",
              label: "投放信标",
              detail: "让信号穿透冰壳。",
              resolve: () => ({
                effects: { signal: 30, fuel: -5 },
                log: "你释放一个信标，蓝色光束划开夜色。",
                preventMindDecay: true,
              }),
            },
          ],
        };
      case 9:
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
          ],
        };
      default:
        return null;
    }
  },
  handleChoice(key) {
    if (!this._state) return;
    if (this._state.phase === "intro") {
      this.startCountdown();
      return;
    }
    if (this._state.phase === "ending") {
      return;
    }
    const story = this._state.pendingStory;
    if (!story) return;
    const option = story.options?.find((opt) => opt.key === key);
    if (!option) return;
    const outcome = option.resolve ? option.resolve(this._state) : option;
    this.applyOutcome(outcome);
  },
  applyOutcome(outcome = {}) {
    const state = this._state;
    if (!state) return;
    if (outcome.log) {
      this.pushLog(outcome.log);
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
    ["fuel", "food", "o2", "mind", "signal"].forEach((key) => {
      if (res[key] !== undefined) {
        res[key] = Math.round(res[key] * 100) / 100;
      }
    });
    if (res.crew !== undefined) {
      res.crew = Math.max(0, Math.min(3, Math.round(res.crew)));
    }
  },
  endOfDay(outcome = {}) {
    const state = this._state;
    if (!state) return;
    const res = state.resources;
    const summary = [];
    res.fuel -= 3;
    summary.push("燃料 -3");
    res.o2 -= 5;
    summary.push("O₂ -5");
    const mouths = 1 + Math.max(0, res.crew || 0);
    const foodCost = 2 * mouths;
    res.food -= foodCost;
    summary.push(`食物 -${foodCost}`);
    if (outcome.preventMindDecay) {
      summary.push("心智 稳定");
    } else {
      const minLoss = outcome.mindShock ? 12 : 6;
      const maxLoss = outcome.mindShock ? 22 : 15;
      const loss = StarfallData.randomInt(minLoss, maxLoss);
      res.mind -= loss;
      summary.push(`心智 -${loss}`);
    }
    this.renderStats();
    this.pushLog(`日终结算：${summary.join(" · ")}`, "system");
    if (this.checkEnding()) {
      return;
    }
    res.day += 1;
    if (res.day > 10) {
      this.checkEnding();
      return;
    }
    this.showDayEvent();
  },
  checkEnding() {
    const state = this._state;
    if (!state) return false;
    const r = state.resources;
    let ending = null;
    if (r.fuel <= 0 || r.o2 <= 0 || r.food <= 0) {
      ending = {
        title: "冷寂",
        body: "飞船静止。你的呼吸在舱壁上结霜，星光成为最后的灯。",
      };
    } else if (r.mind <= 0) {
      if (state.flags.awakenChance || state.flags.dreamLogged) {
        ending = {
          title: "觉醒",
          body: "一切安静。你意识到自己不再需要呼吸。亿万颗星星在耳边低语：欢迎归来。",
        };
      } else {
        ending = {
          title: "断裂",
          body: "意识在寂静中崩塌。你忘记了自己的名字，只剩潮湿的冷雾。",
        };
      }
    } else if (r.day > 10) {
      if (r.signal >= 60) {
        ending = {
          title: "人类之声",
          body: "远处的蓝光靠近，一艘回收船在雾霭里伸出机械臂。你终于放下日志。",
        };
      } else if (state.flags.engineFrozen) {
        ending = {
          title: "轨道囚徒",
          body: "推进器被冰霜锁死，你在寒冷的行星阴影里做永恒的卫星。",
        };
      } else if (state.flags.loner) {
        ending = {
          title: "孤航",
          body: "你保持沉默，穿越无人回应的航道。只有自己的呼吸陪伴你。",
        };
      } else {
        ending = {
          title: "漂流",
          body: "求救信标最终熄灭。你继续漂向未知的暗带，等待下一次醒来。",
        };
      }
    }
    if (!ending) {
      return false;
    }
    state.phase = "ending";
    state.pendingStory = {
      title: `结局 · ${ending.title}`,
      body: ending.body,
      options: [],
    };
    this.renderState();
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
    this.renderStats();
    this.renderStory();
    this.renderChoices();
    this.renderLog();
  },
  renderStats() {
    if (!this._els?.stats || !this._state) return;
    const { phase, resources, time } = this._state;
    const build = (label, value, cls = "") => `
      <div class="starfall-stat ${cls}">
        <div class="starfall-stat__label">${escapeHtml(label)}</div>
        <div class="starfall-stat__value">${escapeHtml(String(value))}</div>
      </div>
    `;
    if (phase === "intro") {
      this._els.stats.innerHTML = build("状态", "等待启动");
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
      ].join("");
      return;
    }
    const res = resources;
    const warn = (key, threshold) => (res[key] <= threshold ? "is-warning" : "");
    const items = [
      build("DAY", Math.min(res.day, 10)),
      build("燃料", Math.round(res.fuel), warn("fuel", 15)),
      build("食物", Math.round(res.food), warn("food", 6)),
      build("O₂", Math.round(res.o2), warn("o2", 20)),
      build("心智", Math.round(res.mind), warn("mind", 50)),
      build("信号", Math.round(res.signal)),
      build("人员", res.crew),
    ];
    this._els.stats.innerHTML = items.join("");
  },
  renderStory() {
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
    const html = pendingStory.options.map((opt) => {
      const label = escapeHtml(opt.label || "选项");
      const detail = opt.detail ? `<span class="starfall-option__detail">${escapeHtml(opt.detail)}</span>` : "";
      return `
        <button class="btn starfall-option" data-choice="${escapeHtml(opt.key)}">
          <span class="starfall-option__label">${label}</span>
          ${detail}
        </button>
      `;
    }).join("");
    this._els.choices.innerHTML = html;
  },
  renderLog() {
    if (!this._els?.log || !this._state) return;
    const frag = this._state.log
      .slice()
      .reverse()
      .map((entry) => `<p class="starfall-log__item starfall-log__item--${entry.type}">${escapeHtml(entry.text)}</p>`)
      .join("");
    this._els.log.innerHTML = frag || '<p class="muted">等待你的第一条记录。</p>';
  },
};

