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
        {
          key: "medkit",
          label: "扛走医疗箱",
          detail: "抓起绷带与止痛剂。",
          resolve() {
            return {
              log: "你踢开药柜，拖出一只半融化的医疗箱。里面还有几枚注射剂。",
              effects: { food: 2, mind: 6, o2: 4 },
              flags: { medkit: true },
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
              effects: { crew: crewGain ? crewGain : 0, mind: crewGain ? 8 : -4, time: extraTime },
              flags: crewGain ? { savedCrew: true } : {},
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
        {
          key: "stabilize",
          label: "固定氧气罐",
          detail: "利用挂带让罐体随你滑行。",
          resolve(state) {
            const bonus = state.flags.supportDrone ? 6 : 3;
            return {
              log: "你把挂带勾在罐阀上，让它跟着你滑向舱门。",
              effects: { o2: 8 + bonus, time: -1 },
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
          key: "stagger",
          label: "分批转移",
          detail: "把重物交给无人机拖行，其余人依次进入。",
          resolve(state) {
            const drone = state.flags.supportDrone;
            const crewBoost = drone ? 1 : 0;
            return {
              log: drone
                ? "无人机抓起两箱燃料，沿着轨道滑向救生舱后方。你们依次挤进座位。"
                : "你安排人手按顺序登舱，最后时刻仍有人留在原地。",
              effects: { fuel: drone ? 6 : 2, food: 2, mind: drone ? 6 : 0, crew: crewBoost },
              flags: drone ? { convoy: true } : {},
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
          <section class=\"starfall-codex\" id=\"starfall-codex\"></section>
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
      codex: document.getElementById("starfall-codex"),
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
                  resolve: () => {
                    const free = Math.max(0, 3 - (r.crew || 0));
                    const joined = free > 0 ? 1 : 0;
                    const updateFlags = { allyAwaiting: false, guidedCrew: false };
                    if (joined) {
                      updateFlags.savedCrew = true;
                    }
                    return {
                      effects: { crew: joined, food: joined ? -1 : 0, mind: joined ? 12 : 6 },
                      log: joined
                        ? "你打开外舱闸门。一名焦黑的船员跌入舱内，喃喃地说着谢谢。"
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
    if (res.day > 12) {
      this.checkEnding();
      return;
    }
    this.showDayEvent();
  },
  checkEnding() {
    const state = this._state;
    if (!state) return false;
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
    } else if (r.day > 12) {
      if (flags.surfaceAscended) {
        ending = {
          id: "erevia-ascent",
          title: "霜壳升空",
          body: "逃生舱冲出 Erevia 的冰层，极光在舷窗外拉出金色尾焰。你重新拾起星际航道。",
          codexTone: "hope",
          codexSummary: "从冰封行星起飞，带着晶体燃料返回星海。",
        };
      } else if (flags.surfaceBeacon && r.signal >= 60) {
        ending = {
          id: "ice-beacon",
          title: "极地灯塔",
          body: "晶体网络闪耀。几小时后，回收船的灯光穿透雪雾，你在冰原上举起求救信号。",
          codexTone: "hope",
          codexSummary: "在行星表面点亮信标，引来救援。",
        };
      } else if (flags.surfaceAwaken) {
        ending = {
          id: "ice-awakening",
          title: "冰原归一",
          body: "你在极夜中静坐，意识沿着冰晶传播。星海的低语与你同频。",
          codexTone: "mystic",
          codexSummary: "留在 Erevia，让意识成为冰原的一部分。",
        };
      } else if (r.signal >= 70 || (flags.rescuePulse && r.signal >= 60)) {
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
    if (!ending) {
      return false;
    }
    this.unlockEnding(ending);
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
    this.renderCodex();
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
      build("DAY", Math.min(res.day, 12)),
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
  renderCodex() {
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
};

