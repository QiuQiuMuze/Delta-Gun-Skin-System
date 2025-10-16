const TrainingPage = {
  _state: null,
  _grounds: [
    {
      id: "dawn-range",
      label: "晨曦靶场",
      description: "开阔的日间靶场，提供稳定的风向与标准靶距。",
      ambient: "清晨薄雾 · 180m",
    },
    {
      id: "night-warehouse",
      label: "夜间仓库",
      description: "低光环境下的仓储区，更适合练习快速瞄准与灯光切换。",
      ambient: "低照度 · 室内回声",
    },
    {
      id: "urban-block",
      label: "城区综合训练",
      description: "模拟城区高楼掩体的复杂地形，适合移动射击训练。",
      ambient: "多掩体 · 视线遮挡",
    },
  ],
  _bulletLevels: [
    { key: "practice", label: "Lv.1 训练弹", damage: 0.78, penetration: 0.62, recoil: 0.92 },
    { key: "standard", label: "Lv.2 标准战术弹", damage: 1.0, penetration: 1.0, recoil: 1.0 },
    { key: "piercing", label: "Lv.3 穿甲强化弹", damage: 0.96, penetration: 1.28, recoil: 1.08 },
    { key: "magnum", label: "Lv.4 高爆控场弹", damage: 1.22, penetration: 1.06, recoil: 1.16 },
    { key: "titan", label: "Lv.5 赛场特供弹", damage: 1.32, penetration: 1.34, recoil: 1.24 },
  ],
  _armorLevels: [
    { key: "none", label: "无护甲", mitigation: 0, durability: 0 },
    { key: "I", label: "Ⅰ级训练甲", mitigation: 0.12, durability: 45 },
    { key: "II", label: "Ⅱ级城市甲", mitigation: 0.18, durability: 70 },
    { key: "III", label: "Ⅲ级作战甲", mitigation: 0.24, durability: 105 },
    { key: "IV", label: "Ⅳ级钛合金甲", mitigation: 0.3, durability: 150 },
    { key: "V", label: "Ⅴ级重型战术甲", mitigation: 0.36, durability: 210 },
  ],
  async render() {
    const guns = await this._loadGuns();
    const selectedGun = guns.length ? guns[0].inv_id : null;
    this._state = {
      guns,
      selectedGun,
      ground: this._grounds[0]?.id || "dawn-range",
      bulletIndex: 1,
      armorIndex: 1,
      dummyCount: 1,
      dummyPattern: "static",
      movingTarget: false,
      yaw: -22,
      pitch: -6,
      zoom: 110,
      inspectOpen: false,
    };
    const groundOptions = this._grounds.map(g => `<option value="${g.id}">${this._esc(g.label)}</option>`).join("");
    const gunOptions = guns.length
      ? guns.map(g => `<option value="${g.inv_id}">${this._esc(g.displayName)}</option>`).join("")
      : "";

    return `
      <div class="card training-card">
        <div class="training-card__header">
          <div>
            <h2>训练场模拟</h2>
            <p class="muted">像真实射击游戏一样，选择场地、枪械与弹药，体验完整的模拟射击流程。</p>
          </div>
          <button class="btn ghost" id="training-reset-view">重置视角</button>
        </div>
        <div class="training-grid">
          <section class="training-config">
            <h3>训练设置</h3>
            <label class="training-field">
              <span>训练场地</span>
              <select id="training-ground">${groundOptions}</select>
            </label>
            <div class="training-ground-desc" id="training-ground-desc"></div>
            <label class="training-field">
              <span>选择枪械</span>
              <div class="training-gun-picker">
                <select id="training-gun" ${guns.length ? "" : "disabled"}>${gunOptions}</select>
                <button class="btn" id="training-inspect-btn" ${guns.length ? "" : "disabled"}>皮肤检视</button>
              </div>
            </label>
            <div class="training-gun-meta" id="training-gun-meta"></div>
            <div class="training-slider">
              <div class="training-slider__label">
                <span>子弹等级</span>
                <span id="training-bullet-label"></span>
              </div>
              <input type="range" id="training-bullet" min="0" max="${this._bulletLevels.length - 1}" value="1"/>
            </div>
            <div class="training-slider">
              <div class="training-slider__label">
                <span>护甲等级</span>
                <span id="training-armor-label"></span>
              </div>
              <input type="range" id="training-armor" min="0" max="${this._armorLevels.length - 1}" value="1"/>
            </div>
            <div class="training-slider">
              <div class="training-slider__label">
                <span>假人数</span>
                <span id="training-dummies-label"></span>
              </div>
              <input type="range" id="training-dummies" min="1" max="5" value="1"/>
            </div>
            <label class="training-field">
              <span>靶姿态</span>
              <select id="training-pattern">
                <option value="static">静止站立</option>
                <option value="crouch">蹲姿缩小靶</option>
                <option value="advance">交错前进</option>
              </select>
            </label>
            <label class="training-toggle">
              <input type="checkbox" id="training-moving"/>
              <span>开启移动靶轨迹</span>
            </label>
            <div class="training-actions">
              <button class="btn" id="training-fire-btn" ${guns.length ? "" : "disabled"}>模拟射击</button>
            </div>
          </section>
          <section class="training-stage">
            <div class="training-viewer" id="training-viewer">
              <div class="training-viewer__ground"></div>
              <div class="training-viewer__gun" id="training-gun-model">
                <div class="gun-part stock"></div>
                <div class="gun-part body"></div>
                <div class="gun-part barrel"></div>
                <div class="gun-part muzzle"></div>
              </div>
              <div class="training-viewer__dummy" id="training-dummy">
                <div class="dummy-body"></div>
                <div class="dummy-armor"></div>
              </div>
              <div class="training-viewer__trail"></div>
            </div>
            <div class="training-stage__hud" id="training-stats"></div>
            <div class="training-stage__controls">
              <label>
                <span>水平旋转</span>
                <input type="range" id="training-yaw" min="-90" max="90" value="-22"/>
              </label>
              <label>
                <span>俯仰角</span>
                <input type="range" id="training-pitch" min="-35" max="35" value="-6"/>
              </label>
              <label>
                <span>镜头缩放</span>
                <input type="range" id="training-zoom" min="85" max="135" value="110"/>
              </label>
            </div>
          </section>
        </div>
      </div>
      <div class="card training-inspect" id="training-inspect-panel" hidden>
        <div class="training-inspect__head">
          <h3>皮肤检视</h3>
          <button class="btn ghost" id="training-close-inspect">关闭</button>
        </div>
        <div class="training-inspect__body" id="training-inspect-body"></div>
      </div>
    `;
  },
  bind() {
    const groundSel = document.getElementById("training-ground");
    groundSel?.addEventListener("change", (e) => {
      this._state.ground = e.target.value;
      this._refreshUI();
    });

    const gunSel = document.getElementById("training-gun");
    gunSel?.addEventListener("change", (e) => {
      this._state.selectedGun = e.target.value || null;
      this._refreshUI();
    });

    const bulletRange = document.getElementById("training-bullet");
    bulletRange?.addEventListener("input", (e) => {
      this._state.bulletIndex = Number(e.target.value) || 0;
      this._refreshUI();
    });

    const armorRange = document.getElementById("training-armor");
    armorRange?.addEventListener("input", (e) => {
      this._state.armorIndex = Number(e.target.value) || 0;
      this._refreshUI();
    });

    const dummyRange = document.getElementById("training-dummies");
    dummyRange?.addEventListener("input", (e) => {
      this._state.dummyCount = Number(e.target.value) || 1;
      this._refreshUI();
    });

    const patternSel = document.getElementById("training-pattern");
    patternSel?.addEventListener("change", (e) => {
      this._state.dummyPattern = e.target.value;
      this._refreshUI();
    });

    const movingToggle = document.getElementById("training-moving");
    movingToggle?.addEventListener("change", (e) => {
      this._state.movingTarget = !!e.target.checked;
      this._refreshUI();
    });

    const yawRange = document.getElementById("training-yaw");
    yawRange?.addEventListener("input", (e) => {
      this._state.yaw = Number(e.target.value) || 0;
      this._applyTransform();
    });

    const pitchRange = document.getElementById("training-pitch");
    pitchRange?.addEventListener("input", (e) => {
      this._state.pitch = Number(e.target.value) || 0;
      this._applyTransform();
    });

    const zoomRange = document.getElementById("training-zoom");
    zoomRange?.addEventListener("input", (e) => {
      this._state.zoom = Number(e.target.value) || 100;
      this._applyTransform();
    });

    const viewer = document.getElementById("training-viewer");
    if (viewer) {
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const handleMove = (clientX, clientY) => {
        if (!dragging) return;
        const dx = clientX - lastX;
        const dy = clientY - lastY;
        lastX = clientX;
        lastY = clientY;
        this._state.yaw = Math.max(-120, Math.min(120, this._state.yaw + dx * 0.35));
        this._state.pitch = Math.max(-45, Math.min(45, this._state.pitch - dy * 0.3));
        if (yawRange) yawRange.value = String(Math.round(this._state.yaw));
        if (pitchRange) pitchRange.value = String(Math.round(this._state.pitch));
        this._applyTransform();
      };
      viewer.addEventListener("pointerdown", (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        viewer.setPointerCapture(e.pointerId);
      });
      viewer.addEventListener("pointermove", (e) => handleMove(e.clientX, e.clientY));
      const stopDrag = (e) => {
        dragging = false;
        if (typeof e.pointerId === "number") {
          try { viewer.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
      };
      viewer.addEventListener("pointerup", stopDrag);
      viewer.addEventListener("pointercancel", stopDrag);
      viewer.addEventListener("pointerleave", stopDrag);
    }

    const resetBtn = document.getElementById("training-reset-view");
    resetBtn?.addEventListener("click", () => {
      this._state.yaw = -22;
      this._state.pitch = -6;
      this._state.zoom = 110;
      if (yawRange) yawRange.value = String(this._state.yaw);
      if (pitchRange) pitchRange.value = String(this._state.pitch);
      if (zoomRange) zoomRange.value = String(this._state.zoom);
      this._applyTransform();
    });

    const fireBtn = document.getElementById("training-fire-btn");
    fireBtn?.addEventListener("click", () => {
      this._playFireAnimation();
    });

    const inspectBtn = document.getElementById("training-inspect-btn");
    inspectBtn?.addEventListener("click", () => {
      this._state.inspectOpen = !this._state.inspectOpen;
      this._refreshInspectPanel();
    });

    const closeInspect = document.getElementById("training-close-inspect");
    closeInspect?.addEventListener("click", () => {
      this._state.inspectOpen = false;
      this._refreshInspectPanel();
    });

    this._refreshUI();
    this._applyTransform();
  },
  async _loadGuns() {
    const normalizeList = (items) => (items || []).map((item) => this._normalizeGun(item)).filter(Boolean);
    try {
      const byColor = await API.inventoryByColor();
      const buckets = byColor?.buckets || byColor || {};
      const list = [];
      ["BRICK", "PURPLE", "BLUE", "GREEN"].forEach((key) => {
        const arr = buckets[key] || buckets[String(key).toLowerCase()] || [];
        list.push(...normalizeList(arr));
      });
      if (list.length) return this._dedupe(list);
    } catch (err) {
      console.warn("inventoryByColor failed", err);
    }
    try {
      const flat = await API.inventory();
      const items = Array.isArray(flat?.items) ? flat.items : (Array.isArray(flat) ? flat : []);
      if (items.length) return this._dedupe(normalizeList(items));
    } catch (err) {
      console.warn("inventory fallback failed", err);
    }
    return [];
  },
  _normalizeGun(raw) {
    if (!raw) return null;
    const invId = raw.inv_id ?? raw.id ?? raw.inventory_id ?? null;
    if (!invId) return null;
    const rarity = String(raw.rarity ?? raw.color ?? "").toUpperCase();
    const grade = raw.grade ?? raw.quality ?? "";
    const wear = typeof raw.wear === "number"
      ? raw.wear
      : (typeof raw.wear_bp === "number" ? raw.wear_bp / 100 : null);
    const name = raw.name ?? raw.skin_name ?? raw.display_name ?? `藏品 #${invId}`;
    const weapon = raw.weapon ?? raw.model ?? raw.template ?? "战术步枪";
    const exquisite = raw.exquisite === true;
    const visual = raw.visual || {};
    const palette = this._derivePalette(rarity, exquisite);
    const stats = this._deriveStats({ rarity, grade, wear, exquisite });
    return {
      inv_id: invId,
      displayName: `${weapon} · ${name}`,
      name,
      weapon,
      rarity,
      grade,
      wear,
      exquisite,
      palette,
      stats,
      visual,
    };
  },
  _dedupe(list) {
    const seen = new Set();
    const result = [];
    list.forEach((item) => {
      if (!item || !item.inv_id) return;
      if (seen.has(item.inv_id)) return;
      seen.add(item.inv_id);
      result.push(item);
    });
    return result;
  },
  _derivePalette(rarity, exquisite) {
    if (exquisite) return { body: "linear-gradient(130deg, #ffb86c, #ff9f4a)", barrel: "linear-gradient(130deg, #ffe5b4, #ffaf52)" };
    switch (rarity) {
      case "BRICK":
        return { body: "linear-gradient(120deg, #ffb86c, #ff9a5f)", barrel: "linear-gradient(120deg, #ffe0c0, #ffae70)" };
      case "PURPLE":
        return { body: "linear-gradient(120deg, #d19eff, #a572ff)", barrel: "linear-gradient(120deg, #ede0ff, #b98bff)" };
      case "BLUE":
        return { body: "linear-gradient(120deg, #8ab4ff, #4f8fff)", barrel: "linear-gradient(120deg, #d6e6ff, #75a4ff)" };
      case "GREEN":
        return { body: "linear-gradient(120deg, #70e1a1, #3ec985)", barrel: "linear-gradient(120deg, #c7f5db, #58d291)" };
      default:
        return { body: "linear-gradient(120deg, #b5c4d8, #8290a5)", barrel: "linear-gradient(120deg, #d5dee9, #a0afc1)" };
    }
  },
  _deriveStats({ rarity, grade, wear, exquisite }) {
    const baseDamage = {
      BRICK: 48,
      PURPLE: 44,
      BLUE: 40,
      GREEN: 36,
    }[rarity] ?? 34;
    const baseRpm = {
      BRICK: 760,
      PURPLE: 720,
      BLUE: 690,
      GREEN: 660,
    }[rarity] ?? 650;
    const controlBase = {
      BRICK: 78,
      PURPLE: 74,
      BLUE: 70,
      GREEN: 66,
    }[rarity] ?? 64;
    const precisionBase = {
      BRICK: 82,
      PURPLE: 78,
      BLUE: 74,
      GREEN: 70,
    }[rarity] ?? 68;
    let damage = baseDamage;
    if (exquisite) damage += 4;
    if (grade === "S") damage += 3;
    if (grade === "A") damage += 1.5;
    if (wear && wear > 1.2) damage -= (wear - 1) * 2.5;
    const rpm = Math.max(540, baseRpm - (wear ? (wear - 1) * 40 : 0));
    const control = Math.max(40, controlBase - (wear ? (wear - 1) * 6 : 0) + (exquisite ? 4 : 0));
    const precision = Math.max(45, precisionBase - (wear ? (wear - 1) * 5 : 0) + (exquisite ? 3 : 0));
    const armorBreak = 22 + (damage / 2.5);
    return {
      damage: Number(damage.toFixed(1)),
      rpm: Math.round(rpm),
      control: Math.round(control),
      precision: Math.round(precision),
      armorBreak: Math.round(armorBreak),
    };
  },
  _refreshUI() {
    const groundSel = document.getElementById("training-ground");
    if (groundSel) groundSel.value = this._state.ground;
    const groundInfo = this._grounds.find((g) => g.id === this._state.ground) || this._grounds[0];
    const groundDesc = document.getElementById("training-ground-desc");
    if (groundDesc && groundInfo) {
      groundDesc.innerHTML = `<div>${this._esc(groundInfo.description)}</div><small class="muted">${this._esc(groundInfo.ambient)}</small>`;
    }

    const gunSel = document.getElementById("training-gun");
    if (gunSel) gunSel.value = this._state.selectedGun || "";

    const gun = this._currentGun();
    const fireBtn = document.getElementById("training-fire-btn");
    if (fireBtn) fireBtn.disabled = !gun;
    const inspectBtn = document.getElementById("training-inspect-btn");
    if (inspectBtn) inspectBtn.disabled = !gun;

    const viewer = document.getElementById("training-viewer");
    if (viewer && groundInfo) viewer.dataset.ground = groundInfo.id;

    const bulletLevel = this._bulletLevels[this._state.bulletIndex] || this._bulletLevels[0];
    const armorLevel = this._armorLevels[this._state.armorIndex] || this._armorLevels[0];
    const bulletLabel = document.getElementById("training-bullet-label");
    if (bulletLabel && bulletLevel) {
      bulletLabel.textContent = `${bulletLevel.label} · 穿深 ${(bulletLevel.penetration * 100).toFixed(0)}%`;
    }
    const armorLabel = document.getElementById("training-armor-label");
    if (armorLabel && armorLevel) {
      const durability = armorLevel.durability ? `${armorLevel.durability} 点耐久` : `无护甲`;
      armorLabel.textContent = `${armorLevel.label} · 减伤 ${(armorLevel.mitigation * 100).toFixed(0)}% · ${durability}`;
    }
    const dummyLabel = document.getElementById("training-dummies-label");
    if (dummyLabel) {
      dummyLabel.textContent = `${this._state.dummyCount} 个目标`;
    }
    const patternSel = document.getElementById("training-pattern");
    if (patternSel) patternSel.value = this._state.dummyPattern;
    const movingToggle = document.getElementById("training-moving");
    if (movingToggle) movingToggle.checked = !!this._state.movingTarget;

    this._updateGunMeta();
    this._updateDummyState();
    this._updateStats();
    this._refreshInspectPanel();
  },
  _currentGun() {
    return (this._state?.guns || []).find((g) => g.inv_id === this._state.selectedGun) || null;
  },
  _updateGunMeta() {
    const gunMeta = document.getElementById("training-gun-meta");
    const gun = this._currentGun();
    if (!gunMeta) return;
    if (!gun) {
      gunMeta.innerHTML = `<div class="muted">背包内暂无可用枪械，完成抽取或交易后即可在此训练。</div>`;
      return;
    }
    const wearText = typeof gun.wear === "number" ? `${gun.wear.toFixed(2)}` : "--";
    const rarityMap = {
      BRICK: "砖皮",
      PURPLE: "紫皮",
      BLUE: "蓝皮",
      GREEN: "绿皮",
    };
    gunMeta.innerHTML = `
      <div class="training-gun-meta__row">
        <span class="training-gun-meta__name">${this._esc(gun.displayName)}</span>
        <span class="badge">${this._esc(rarityMap[gun.rarity] || gun.rarity || "未知")}</span>
      </div>
      <div class="training-gun-meta__stats">
        <span>伤害 <strong>${gun.stats.damage}</strong></span>
        <span>射速 <strong>${gun.stats.rpm}</strong> RPM</span>
        <span>操控 <strong>${gun.stats.control}</strong></span>
        <span>精度 <strong>${gun.stats.precision}</strong></span>
        <span>磨损 <strong>${wearText}</strong></span>
      </div>
    `;
    const gunModel = document.getElementById("training-gun-model");
    if (gunModel) {
      gunModel.style.setProperty("--gun-body", gun.palette.body);
      gunModel.style.setProperty("--gun-barrel", gun.palette.barrel);
    }
  },
  _updateDummyState() {
    const dummy = document.getElementById("training-dummy");
    if (!dummy) return;
    dummy.dataset.pattern = this._state.dummyPattern;
    dummy.dataset.count = String(this._state.dummyCount);
    dummy.dataset.moving = this._state.movingTarget ? "1" : "0";
    const armorLevel = this._armorLevels[this._state.armorIndex] || this._armorLevels[0];
    dummy.dataset.armor = armorLevel.key;
    const armor = dummy.querySelector(".dummy-armor");
    if (armor) {
      const mitigation = (armorLevel.mitigation * 100).toFixed(0);
      armor.textContent = armorLevel.durability ? `${armorLevel.label} (${mitigation}% 减伤)` : "无护甲";
    }
  },
  _updateStats() {
    const gun = this._currentGun();
    const statsBox = document.getElementById("training-stats");
    if (!statsBox) return;
    if (!gun) {
      statsBox.innerHTML = `<div class="muted">尚未选择枪械。</div>`;
      return;
    }
    const bullet = this._bulletLevels[this._state.bulletIndex] || this._bulletLevels[0];
    const armor = this._armorLevels[this._state.armorIndex] || this._armorLevels[0];
    const effectiveDamage = gun.stats.damage * bullet.damage * (1 - armor.mitigation);
    const armorBreakPerShot = Math.max(1, gun.stats.armorBreak * bullet.penetration);
    const shotsToBreakArmor = armor.durability > 0 ? Math.ceil(armor.durability / armorBreakPerShot) : 0;
    const healthPool = armor.durability > 0 ? 100 + armor.durability * 0.25 : 100;
    const shotsToNeutralize = Math.ceil(healthPool / Math.max(1, effectiveDamage));
    const rpm = Math.max(1, gun.stats.rpm);
    const ttkSeconds = ((shotsToNeutralize - 1) / rpm) * 60;
    const controlFactor = gun.stats.control * (1 / bullet.recoil);
    const summary = `
      <div class="training-stat-line">
        <span>有效伤害</span>
        <strong>${effectiveDamage.toFixed(1)}</strong>
        <span class="muted">(已考虑弹药与护甲)</span>
      </div>
      <div class="training-stat-line">
        <span>破甲需求</span>
        <strong>${shotsToBreakArmor > 0 ? shotsToBreakArmor + " 发" : "无需破甲"}</strong>
        <span class="muted">穿深 ${Math.round(bullet.penetration * 100)}% · 甲耐 ${armor.durability}</span>
      </div>
      <div class="training-stat-line">
        <span>理论击倒</span>
        <strong>${shotsToNeutralize} 发</strong>
        <span class="muted">TTK≈${ttkSeconds.toFixed(2)}s</span>
      </div>
      <div class="training-stat-line">
        <span>后坐控制</span>
        <strong>${Math.round(controlFactor)}</strong>
        <span class="muted">弹药后坐修正 ${(bullet.recoil * 100).toFixed(0)}%</span>
      </div>
      <div class="training-stat-line">
        <span>目标设置</span>
        <strong>${this._state.dummyCount} 个</strong>
        <span class="muted">${this._state.movingTarget ? "移动靶" : "静止靶"} · ${this._patternLabel(this._state.dummyPattern)}</span>
      </div>
    `;
    statsBox.innerHTML = summary;
  },
  _patternLabel(key) {
    if (key === "crouch") return "蹲姿";
    if (key === "advance") return "交错移动";
    return "站姿";
  },
  _applyTransform() {
    const gunModel = document.getElementById("training-gun-model");
    if (!gunModel) return;
    const zoomScale = Math.max(0.6, Math.min(1.4, this._state.zoom / 100));
    gunModel.style.transform = `rotateX(${this._state.pitch}deg) rotateY(${this._state.yaw}deg) scale(${zoomScale})`;
  },
  _playFireAnimation() {
    const viewer = document.getElementById("training-viewer");
    if (!viewer) return;
    viewer.classList.remove("is-firing");
    // force reflow
    void viewer.offsetWidth;
    viewer.classList.add("is-firing");
    setTimeout(() => viewer.classList.remove("is-firing"), 520);
  },
  _refreshInspectPanel() {
    const panel = document.getElementById("training-inspect-panel");
    const body = document.getElementById("training-inspect-body");
    const gun = this._currentGun();
    if (!panel || !body) return;
    if (!this._state.inspectOpen || !gun) {
      panel.hidden = true;
      body.innerHTML = "";
      return;
    }
    panel.hidden = false;
    const wearText = typeof gun.wear === "number" ? gun.wear.toFixed(2) : "--";
    body.innerHTML = `
      <div class="training-inspect__grid">
        <div>
          <h4>${this._esc(gun.displayName)}</h4>
          <p class="muted">稀有度：${this._esc(gun.rarity || "未知")}</p>
          <p class="muted">磨损：${wearText}</p>
          <p class="muted">极品：${gun.exquisite ? "是" : "否"}</p>
        </div>
        <div class="training-inspect__preview">
          <div class="training-inspect__mock">
            <div class="mock-gun" style="background:${gun.palette.body};"></div>
            <div class="mock-barrel" style="background:${gun.palette.barrel};"></div>
          </div>
          <small class="muted">当前模拟材质</small>
        </div>
      </div>
    `;
  },
  _esc(text) {
    if (text === null || text === undefined) return "";
    return String(text).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m] || m));
  },
};
