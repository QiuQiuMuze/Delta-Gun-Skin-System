// 简易路由与页面调度
const $page = () => document.getElementById("page");
const $nav = () => document.getElementById("nav");
const $notify = () => document.getElementById("global-notify");
const byId = (id) => document.getElementById(id);
const escapeHtml = (s)=> String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

// ★★★ 关键：让 API 使用“每标签页独立会话”并迁移旧 token
API.initSession();

const OrientationHelper = {
  _initialized: false,
  _autoTried: false,
  _dismissed: false,
  _fallbackActive: false,
  _baseScale: 1,
  _contentRect: { width: 0, height: 0 },
  _resolutionMode: "auto",
  _resolutionScale: 1,
  _lastEffectiveScale: 1,
  _resolutionOptions: [
    { value: "auto", label: "自适应 · 推荐" },
    { value: 1, label: "100% · 默认" },
    { value: 0.95, label: "95% · 高清" },
    { value: 0.9, label: "90% · 标准" },
    { value: 0.85, label: "85% · 舒适" },
    { value: 0.8, label: "80% · 紧凑" },
    { value: 0.75, label: "75% · 精简" },
    { value: 0.7, label: "70% · 超紧凑" },
    { value: 0.65, label: "65% · 进阶" },
    { value: 0.6, label: "60% · 极限" },
    { value: 0.55, label: "55% · 口袋" },
    { value: 0.5, label: "50% · 紧凑视图" },
    { value: 0.45, label: "45% · 极致浓缩" },
    { value: 0.4, label: "40% · 全景" }
  ],
  _resolutionPanel: null,
  _resolutionSelect: null,
  _resolutionValueEl: null,
  _resolutionModeEl: null,
  _resolutionCollapseBtn: null,
  _resolutionCloseBtn: null,
  _resolutionTrigger: null,
  _resolutionHidden: false,
  _resolutionExpanded: false,
  _contentObserver: null,
  _suppressObserver: false,
  _observerReleaseTask: 0,
  _pendingViewportTask: 0,
  _landscapeLike: false,
  _landscapeScale: 1,
  _dragGroups: {},
  button: null,
  hint: null,
  wrapper: null,
  inner: null,
  init() {
    if (this._initialized) return;
    if (!document || !document.body) {
      document.addEventListener("DOMContentLoaded", () => this.init(), { once: true });
      return;
    }
    this._initialized = true;
    this.ensureWrapper();
    this.updateBaseScale(true);
    this.createUI();
    this.createResolutionUI();
    this.updateResolutionSummary(1);
    this.syncResolutionVariable(1);
    this.syncResolutionShell(false);
    this.update();
    window.addEventListener("resize", () => this.update());
    window.addEventListener("orientationchange", () => this.update());
    document.addEventListener("fullscreenchange", () => this.update());
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.handleViewportResize());
    }
  },
  isMobile() {
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) return true;
    if (window.matchMedia) {
      const mq = window.matchMedia("(max-width: 900px)");
      if (mq && typeof mq.matches === "boolean" && mq.matches) return true;
    }
    return false;
  },
  isPortrait() {
    if (window.matchMedia) {
      const mq = window.matchMedia("(orientation: portrait)");
      if (mq && typeof mq.matches === "boolean") return mq.matches;
    }
    return window.innerHeight >= window.innerWidth;
  },
  supportsLock() {
    return !!(window.screen && window.screen.orientation && typeof window.screen.orientation.lock === "function");
  },
  ensureWrapper() {
    if (this.wrapper || !document || !document.body) return;
    const wrapper = document.createElement("div");
    wrapper.className = "orientation-content";
    const inner = document.createElement("div");
    inner.className = "orientation-content__inner";
    const nodes = Array.from(document.body.childNodes);
    nodes.forEach((node) => {
      if (node !== wrapper) {
        inner.appendChild(node);
      }
    });
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);
    this.wrapper = wrapper;
    this.inner = inner;
    this.measureContent(true);
    if (typeof ResizeObserver === "function" && !this._contentObserver) {
      this._contentObserver = new ResizeObserver(() => {
        if (this._suppressObserver) {
          return;
        }
        if (this._pendingViewportTask) {
          cancelAnimationFrame(this._pendingViewportTask);
        }
        this._pendingViewportTask = requestAnimationFrame(() => {
          this._pendingViewportTask = 0;
          this._contentRect = { width: 0, height: 0 };
          if (this._fallbackActive) {
            this.applyFallbackScale(true);
          } else {
            this.measureContent(true);
            this.updateBaseScale(true);
            const scale = this._fallbackActive ? this._lastEffectiveScale : 1;
            this.syncResolutionVariable(scale);
            this.updateResolutionSummary(scale);
          }
        });
      });
      try {
        this._contentObserver.observe(inner);
      } catch (_) {
        this._contentObserver = null;
      }
    }
  },
  measureContent(force = false) {
    if (!this.wrapper || !this.inner) return this._contentRect;
    if (!force && this._contentRect.width && this._contentRect.height) {
      return this._contentRect;
    }
    const prevSuppress = this._suppressObserver;
    this._suppressObserver = true;
    this.wrapper.classList.add("orientation-content--measuring");
    const width = Math.max(1,
      this.inner.scrollWidth,
      this.inner.offsetWidth,
      this.inner.clientWidth
    );
    const height = Math.max(1,
      this.inner.scrollHeight,
      this.inner.offsetHeight,
      this.inner.clientHeight
    );
    this.wrapper.classList.remove("orientation-content--measuring");
    this._suppressObserver = prevSuppress;
    this._contentRect = { width, height };
    return this._contentRect;
  },
  createUI() {
    if (this.button || !document.body) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "orientation-toggle";
    btn.innerHTML = `<span class="orientation-toggle__icon">📱</span><span class="orientation-toggle__label">横屏模式</span>`;
    btn.addEventListener("click", async () => {
      if (this._fallbackActive) {
        this.setFallback(false);
        this.update();
        return;
      }
      this._dismissed = false;
      await this.lockLandscape(true);
    });
    document.body.appendChild(btn);
    this.button = btn;
    this.makeDraggable(btn, { key: "orientation-toggle", margin: 8 });

    const hint = document.createElement("div");
    hint.className = "orientation-hint";
    hint.innerHTML = `
      <div class="orientation-hint__card">
        <div class="orientation-hint__title">推荐横屏游玩</div>
        <p class="orientation-hint__text">为了在手机上获得更好的操作体验，我们建议使用横屏。可以点击“一键横屏”尝试自动切换，或手动旋转设备。</p>
        <div class="orientation-hint__actions">
          <button type="button" class="btn primary orientation-hint__apply">一键横屏</button>
          <button type="button" class="btn ghost orientation-hint__dismiss">我知道了</button>
        </div>
      </div>
    `;
    const applyBtn = hint.querySelector(".orientation-hint__apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", async () => {
        if (this._fallbackActive) {
          this.setFallback(false);
          this.update();
          return;
        }
        this._dismissed = false;
        await this.lockLandscape(true);
      });
    }
    const dismissBtn = hint.querySelector(".orientation-hint__dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        this._dismissed = true;
        this.hideHint();
      });
    }
    document.body.appendChild(hint);
    this.hint = hint;
    this.updateButtonState();
  },
  createResolutionUI() {
    if (this._resolutionPanel || !document.body) return;
    const panel = document.createElement("div");
    panel.className = "orientation-resolution";
    const selectId = "orientation-resolution-select";
    panel.innerHTML = `
      <div class="orientation-resolution__head">
        <div class="orientation-resolution__label">横屏视图</div>
        <div class="orientation-resolution__actions">
          <div class="orientation-resolution__status" aria-live="polite">
            <span class="orientation-resolution__value">100%</span>
            <span class="orientation-resolution__mode"></span>
          </div>
          <button type="button" class="orientation-resolution__collapse" aria-expanded="false" aria-controls="${selectId}-body">
            <span class="orientation-resolution__collapse-text">展开设置</span>
            <span class="orientation-resolution__collapse-icon" aria-hidden="true">▾</span>
          </button>
          <button type="button" class="orientation-resolution__close" aria-label="隐藏横屏视图设置">×</button>
        </div>
      </div>
      <div class="orientation-resolution__body" id="${selectId}-body">
        <label class="sr-only" for="${selectId}">横屏视图模式</label>
        <select id="${selectId}" class="orientation-resolution__select" aria-label="横屏分辨率">
          ${this._resolutionOptions.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
        </select>
        <div class="orientation-resolution__tip">“自适应”会自动压缩内容到屏幕内，若想手动放大或缩小，可选择具体百分比。</div>
      </div>
    `;
    const select = panel.querySelector("select");
    if (select) {
      select.value = this._resolutionMode === "auto" ? "auto" : String(this._resolutionScale);
      select.addEventListener("change", () => {
        const raw = select.value;
        if (raw === "auto") {
          this._resolutionMode = "auto";
          this.applyFallbackScale(true);
          const scale = this.getCurrentScale();
          this.syncResolutionVariable(scale);
          this.updateResolutionSummary(scale);
          return;
        }
        const val = parseFloat(raw);
        if (!isFinite(val) || val <= 0) return;
        this._resolutionMode = "manual";
        this._resolutionScale = Math.min(1, Math.max(0.3, val));
        this.applyFallbackScale(true);
        const scale = this.getCurrentScale();
        this.syncResolutionVariable(scale);
        this.updateResolutionSummary(scale);
      });
      this._resolutionSelect = select;
    }
    this._resolutionValueEl = panel.querySelector(".orientation-resolution__value");
    this._resolutionModeEl = panel.querySelector(".orientation-resolution__mode");
    this._resolutionCollapseBtn = panel.querySelector(".orientation-resolution__collapse");
    this._resolutionCloseBtn = panel.querySelector(".orientation-resolution__close");
    if (this._resolutionCollapseBtn) {
      this._resolutionCollapseBtn.addEventListener("click", () => {
        this.setResolutionExpanded(!this._resolutionExpanded);
      });
    }
    if (this._resolutionCloseBtn) {
      this._resolutionCloseBtn.addEventListener("click", () => {
        this.setResolutionHidden(true);
      });
    }
    document.body.appendChild(panel);
    this._resolutionPanel = panel;
    this.makeDraggable(panel, { key: "resolution-control", handleSelector: ".orientation-resolution__head", margin: 8 });

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "orientation-resolution-trigger";
    trigger.setAttribute("aria-label", "显示横屏视图设置");
    trigger.innerHTML = `<span class="orientation-resolution-trigger__icon" aria-hidden="true">🎛️</span>`;
    trigger.addEventListener("click", () => {
      this.setResolutionHidden(false);
      this.setResolutionExpanded(false);
    });
    document.body.appendChild(trigger);
    this._resolutionTrigger = trigger;
    this.makeDraggable(trigger, { key: "resolution-control", margin: 8 });
  },
  applyDragPosition(element, position) {
    if (!element || !position) return;
    element.style.left = `${position.left}px`;
    element.style.top = `${position.top}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  },
  computeDragBounds(width, height, margin = 12) {
    const winWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const winHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
    const maxX = Math.max(margin, winWidth - width - margin);
    const maxY = Math.max(margin, winHeight - height - margin);
    return { minX: margin, minY: margin, maxX, maxY };
  },
  refreshDragBoundsForGroup(groupOrKey) {
    const group = typeof groupOrKey === "string" ? this._dragGroups?.[groupOrKey] : groupOrKey;
    if (!group || !group.position) return;
    const margin = typeof group.margin === "number" ? group.margin : 12;
    const elements = Array.from(group.elements || []).filter((el) => el && el.isConnected);
    if (!elements.length) {
      group.elements = new Set();
      return;
    }
    group.elements = new Set(elements);
    const sample = elements[0];
    const rect = sample.getBoundingClientRect();
    const bounds = this.computeDragBounds(rect.width, rect.height, margin);
    const left = Math.min(bounds.maxX, Math.max(bounds.minX, group.position.left));
    const top = Math.min(bounds.maxY, Math.max(bounds.minY, group.position.top));
    group.position = { left, top, width: rect.width, height: rect.height, margin };
    elements.forEach((el) => this.applyDragPosition(el, group.position));
  },
  refreshDragBounds() {
    if (!this._dragGroups) return;
    Object.keys(this._dragGroups).forEach((key) => this.refreshDragBoundsForGroup(key));
  },
  makeDraggable(element, options = {}) {
    if (!element || !window || typeof window.addEventListener !== "function") return;
    const key = typeof options.key === "string" && options.key ? options.key : null;
    if (!key) return;
    if (!this._dragGroups[key]) {
      this._dragGroups[key] = {
        position: null,
        elements: new Set(),
        margin: typeof options.margin === "number" ? options.margin : 12
      };
    }
    const group = this._dragGroups[key];
    if (typeof options.margin === "number") {
      group.margin = options.margin;
    }
    if (!group.elements) {
      group.elements = new Set();
    }
    if (!group.elements.has(element)) {
      group.elements.add(element);
    }
    element.classList.add("orientation-draggable");
    element.dataset.orientationDraggable = key;
    if (!element.__orientationDragClickGuard) {
      element.addEventListener("click", (ev) => {
        if (element.__orientationDragSuppressClick) {
          element.__orientationDragSuppressClick = false;
          ev.preventDefault();
          ev.stopImmediatePropagation();
        }
      }, true);
      element.__orientationDragClickGuard = true;
    }
    const handle = options.handleSelector ? element.querySelector(options.handleSelector) : element;
    if (!handle) return;
    if (handle !== element) {
      handle.classList.add("orientation-drag-handle");
      handle.style.touchAction = "none";
    } else {
      element.style.touchAction = "none";
    }
    if (handle.__orientationDragAttached) {
      return;
    }
    const onPointerDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      const pointerId = event.pointerId;
      const rect = element.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const margin = typeof group.margin === "number" ? group.margin : 12;
      const basePosition = group.position || { left: rect.left, top: rect.top };
      const width = rect.width;
      const height = rect.height;
      let dragging = false;
      const activeElements = () => Array.from(group.elements || []).filter((el) => el && el.isConnected);
      const updateElements = (position) => {
        activeElements().forEach((el) => this.applyDragPosition(el, position));
      };
      const onPointerMove = (ev) => {
        if (pointerId != null && ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging) {
          if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
            return;
          }
          dragging = true;
          activeElements().forEach((el) => el.classList.add("is-dragging"));
        }
        ev.preventDefault();
        const bounds = this.computeDragBounds(width, height, margin);
        let left = basePosition.left + dx;
        let top = basePosition.top + dy;
        left = Math.min(bounds.maxX, Math.max(bounds.minX, left));
        top = Math.min(bounds.maxY, Math.max(bounds.minY, top));
        const position = { left, top, width, height, margin };
        group.position = position;
        updateElements(position);
      };
      const onPointerUp = (ev) => {
        if (pointerId != null && ev.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", onPointerMove, true);
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("pointercancel", onPointerUp, true);
        if (handle.releasePointerCapture && pointerId != null) {
          try { handle.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        }
        const elements = activeElements();
        elements.forEach((el) => el.classList.remove("is-dragging"));
        if (dragging) {
          ev.preventDefault();
          ev.stopPropagation();
          element.__orientationDragSuppressClick = true;
          setTimeout(() => {
            if (element) element.__orientationDragSuppressClick = false;
          }, 0);
          if (group.position) {
            group.position.width = width;
            group.position.height = height;
            group.position.margin = margin;
            this.refreshDragBoundsForGroup(group);
          }
        }
      };
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerUp, true);
      if (handle.setPointerCapture && pointerId != null) {
        try { handle.setPointerCapture(pointerId); } catch (_) { /* ignore */ }
      }
    };
    handle.addEventListener("pointerdown", onPointerDown, { passive: true });
    handle.__orientationDragAttached = true;
    if (group.position) {
      this.applyDragPosition(element, group.position);
    }
  },
  updateResolutionSummary(scale) {
    const effective = typeof scale === "number" && isFinite(scale) ? scale : this.getCurrentScale();
    const percent = Math.round(Math.max(0.1, effective) * 100);
    if (this._resolutionValueEl) {
      this._resolutionValueEl.textContent = `${percent}%`;
    }
    if (this._resolutionModeEl) {
      this._resolutionModeEl.textContent = this._resolutionMode === "auto" ? "自适应" : "手动";
    }
    if (this._resolutionPanel) {
      this._resolutionPanel.classList.toggle("is-auto", this._resolutionMode === "auto");
    }
    if (this._resolutionCollapseBtn) {
      const expanded = this._resolutionExpanded;
      this._resolutionCollapseBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
      const textEl = this._resolutionCollapseBtn.querySelector(".orientation-resolution__collapse-text");
      const iconEl = this._resolutionCollapseBtn.querySelector(".orientation-resolution__collapse-icon");
      if (textEl) {
        textEl.textContent = expanded ? "收起设置" : "展开设置";
      }
      if (iconEl) {
        iconEl.textContent = expanded ? "▴" : "▾";
      }
    }
  },
  showHint() {
    if (!this.hint || this._dismissed) return;
    this.hint.classList.add("show");
  },
  hideHint() {
    if (!this.hint) return;
    this.hint.classList.remove("show");
  },
  setFallback(active) {
    if (this._fallbackActive === active) return;
    this.ensureWrapper();
    this._fallbackActive = !!active;
    if (this._fallbackActive) {
      this.hideHint();
      this.measureContent(true);
      this.updateBaseScale(true);
      this.applyFallbackScale(true);
    } else {
      if (this.wrapper) {
        this.wrapper.style.removeProperty("--orientation-fallback-scale");
        this.wrapper.style.removeProperty("--orientation-fallback-width");
        this.wrapper.style.removeProperty("--orientation-fallback-height");
      }
      if (this._observerReleaseTask) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(this._observerReleaseTask);
        } else {
          clearTimeout(this._observerReleaseTask);
        }
        this._observerReleaseTask = 0;
      }
      this._lastEffectiveScale = 1;
      this._suppressObserver = false;
      this._contentRect = { width: 0, height: 0 };
      this.syncResolutionVariable(1);
      this.updateResolutionSummary(1);
      this.syncResolutionShell();
    }
    this.updateButtonState();
    this.applyDocumentState(this.isMobile(), this.isPortrait());
    this.syncResolutionShell();
  },
  updateButtonState() {
    if (!this.button) return;
    const active = this._fallbackActive;
    this.button.classList.toggle("is-active", active);
    this.button.setAttribute("aria-pressed", active ? "true" : "false");
    const label = this.button.querySelector(".orientation-toggle__label");
    if (label) {
      label.textContent = active ? "退出横屏" : "横屏模式";
    }
  },
  applyDocumentState(mobile, portrait) {
    const docEl = document.documentElement;
    if (!docEl) return;
    const landscapeLike = mobile && (!portrait || this._fallbackActive);
    this._landscapeLike = !!landscapeLike;
    docEl.classList.toggle("orientation-mobile", !!mobile);
    docEl.classList.toggle("orientation-portrait", !!mobile && !!portrait);
    docEl.classList.toggle("orientation-fallback-active", this._fallbackActive);
    docEl.classList.toggle("mobile-landscape", !!landscapeLike);
    if (this.wrapper) {
      this.wrapper.classList.toggle("orientation-content--fallback", this._fallbackActive);
      if (this._fallbackActive) {
        this.applyFallbackScale();
      } else {
        this.wrapper.style.removeProperty("--orientation-fallback-scale");
        this.wrapper.style.removeProperty("--orientation-fallback-width");
        this.wrapper.style.removeProperty("--orientation-fallback-height");
      }
    }
    this.updateFloatingRotation();
    const currentScale = this.getCurrentScale();
    this.syncResolutionVariable(currentScale);
    this.updateResolutionSummary(currentScale);
  },
  computeLandscapeScale() {
    if (!this._landscapeLike || this._fallbackActive) {
      this._landscapeScale = 1;
      return 1;
    }
    const viewport = window.visualViewport;
    const vw = Math.max(1, viewport ? viewport.width : window.innerWidth || 1);
    const vh = Math.max(1, viewport ? viewport.height : window.innerHeight || 1);
    const referenceWidth = 1100;
    const referenceHeight = 620;
    const referenceArea = referenceWidth * referenceHeight;
    const widthScale = Math.min(1, vw / referenceWidth);
    const heightScale = Math.min(1, vh / referenceHeight);
    const areaScale = Math.min(1, Math.sqrt((vw * vh) / referenceArea));
    const computed = Math.min(widthScale * 1.05, heightScale * 1.08, areaScale * 1.02);
    const clamped = Math.min(1, Math.max(0.48, computed));
    this._landscapeScale = clamped;
    return clamped;
  },
  getCurrentScale() {
    if (this._fallbackActive) {
      return Math.min(1, Math.max(0.2, this._lastEffectiveScale || 1));
    }
    const base = this._landscapeLike ? this.computeLandscapeScale() : 1;
    const factor = this._resolutionMode === "manual" ? this._resolutionScale : 1;
    return Math.min(1, Math.max(0.2, base * factor));
  },
  computeBaseScale() {
    const viewport = window.visualViewport;
    const vw = Math.max(1, viewport ? viewport.width : window.innerWidth || 1);
    const vh = Math.max(1, viewport ? viewport.height : window.innerHeight || 1);
    const rect = this._contentRect.width && this._contentRect.height
      ? this._contentRect
      : this.measureContent(true);
    const contentWidth = Math.max(1, rect.width);
    const contentHeight = Math.max(1, rect.height);
    const auto = Math.min(vw / contentHeight, vh / contentWidth);
    return Math.min(1, Math.max(0.2, auto));
  },
  updateBaseScale(force = false) {
    if (force) {
      this.measureContent(true);
    }
    const next = this.computeBaseScale();
    if (force || Math.abs(next - this._baseScale) > 0.01) {
      this._baseScale = next;
    }
  },
  applyFallbackScale(forceBase = false) {
    if (!this.wrapper || !this._fallbackActive) return;
    this._suppressObserver = true;
    if (this._observerReleaseTask) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this._observerReleaseTask);
      } else {
        clearTimeout(this._observerReleaseTask);
      }
      this._observerReleaseTask = 0;
    }
    if (forceBase) {
      this.updateBaseScale(true);
    } else {
      this.updateBaseScale(false);
    }
    const resolutionFactor = this._resolutionMode === "auto" ? 1 : this._resolutionScale;
    const effectiveScale = Math.min(1, Math.max(0.18, this._baseScale * resolutionFactor));
    this._lastEffectiveScale = effectiveScale;
    const rect = this.measureContent(false);
    if (rect && rect.width && rect.height) {
      this.wrapper.style.setProperty("--orientation-fallback-width", `${rect.height}px`);
      this.wrapper.style.setProperty("--orientation-fallback-height", `${rect.width}px`);
    }
    this.wrapper.style.setProperty("--orientation-fallback-scale", effectiveScale.toFixed(4));
    this.syncResolutionVariable(effectiveScale);
    this.updateResolutionSummary(effectiveScale);
    const release = () => {
      this._observerReleaseTask = 0;
      this._suppressObserver = false;
    };
    if (typeof requestAnimationFrame === "function") {
      this._observerReleaseTask = requestAnimationFrame(release);
    } else {
      this._observerReleaseTask = setTimeout(release, 16);
    }
  },
  updateResolutionVisibility(landscapeLike) {
    this.syncResolutionShell(landscapeLike);
    if (this._resolutionSelect) {
      this._resolutionSelect.value = this._resolutionMode === "auto" ? "auto" : String(this._resolutionScale);
    }
    const currentScale = this.getCurrentScale();
    this.syncResolutionVariable(currentScale);
    this.updateResolutionSummary(currentScale);
  },
  handleViewportResize() {
    if (!this._fallbackActive) return;
    if (this._pendingViewportTask) {
      cancelAnimationFrame(this._pendingViewportTask);
    }
    this._pendingViewportTask = requestAnimationFrame(() => {
      this._pendingViewportTask = 0;
      this._contentRect = { width: 0, height: 0 };
      this.applyFallbackScale(true);
    });
  },
  syncResolutionVariable(effectiveScale = null) {
    const docEl = document.documentElement;
    if (!docEl) return;
    let baseScale;
    if (typeof effectiveScale === "number" && isFinite(effectiveScale)) {
      baseScale = effectiveScale;
    } else if (this._fallbackActive) {
      baseScale = this._lastEffectiveScale || 1;
    } else {
      baseScale = this.getCurrentScale();
    }
    const safeEffective = Math.min(1, Math.max(0.2, baseScale));
    let typographySource;
    if (this._fallbackActive) {
      typographySource = safeEffective;
    } else {
      const landscapeBase = this._landscapeLike ? this._landscapeScale : 1;
      const factor = this._resolutionMode === "manual" ? this._resolutionScale : 1;
      typographySource = Math.min(1, Math.max(0.3, landscapeBase * factor));
    }
    const resolutionValue = Math.min(1, Math.max(0.2, typographySource));
    const inverse = resolutionValue > 0.001 ? Math.min(5, 1 / resolutionValue) : 1;
    docEl.style.setProperty("--orientation-resolution", resolutionValue.toFixed(2));
    docEl.style.setProperty("--orientation-resolution-inverse", inverse.toFixed(3));
    docEl.style.setProperty("--orientation-effective-scale", safeEffective.toFixed(3));
  },
  updateFloatingRotation() {
    const rotation = this._fallbackActive ? "-90deg" : "0deg";
    if (this.button) {
      this.button.style.setProperty("--orientation-rotation", rotation);
    }
    if (this._resolutionPanel) {
      this._resolutionPanel.style.setProperty("--orientation-rotation", rotation);
    }
    if (this._resolutionTrigger) {
      this._resolutionTrigger.style.setProperty("--orientation-rotation", rotation);
    }
  },
  setResolutionHidden(hidden, landscapeLikeOverride = null) {
    this._resolutionHidden = !!hidden;
    if (hidden) {
      this._resolutionExpanded = false;
    }
    if (!hidden && !this._resolutionExpanded) {
      const scale = this.getCurrentScale();
      this.updateResolutionSummary(scale);
    }
    this.syncResolutionShell(landscapeLikeOverride);
  },
  setResolutionExpanded(expanded, landscapeLikeOverride = null) {
    this._resolutionExpanded = !!expanded;
    const scale = this.getCurrentScale();
    this.updateResolutionSummary(scale);
    this.syncResolutionShell(landscapeLikeOverride);
  },
  syncResolutionShell(landscapeLikeOverride = null) {
    const landscapeLike = typeof landscapeLikeOverride === "boolean" ? landscapeLikeOverride : this._landscapeLike;
    const panel = this._resolutionPanel;
    const trigger = this._resolutionTrigger;
    const showPanel = !!landscapeLike && !this._resolutionHidden;
    if (panel) {
      panel.classList.toggle("show", showPanel);
      panel.classList.toggle("is-collapsed", showPanel && !this._resolutionExpanded);
      panel.setAttribute("aria-hidden", showPanel ? "false" : "true");
      panel.setAttribute("data-expanded", this._resolutionExpanded ? "true" : "false");
      panel.style.setProperty("--orientation-rotation", this._fallbackActive ? "-90deg" : "0deg");
    }
    if (trigger) {
      trigger.classList.toggle("show", !!landscapeLike && this._resolutionHidden);
      trigger.setAttribute("aria-hidden", !!landscapeLike && this._resolutionHidden ? "false" : "true");
      trigger.style.setProperty("--orientation-rotation", this._fallbackActive ? "-90deg" : "0deg");
    }
    if (this._resolutionCollapseBtn) {
      const expanded = showPanel && this._resolutionExpanded;
      this._resolutionCollapseBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
      const textEl = this._resolutionCollapseBtn.querySelector(".orientation-resolution__collapse-text");
      const iconEl = this._resolutionCollapseBtn.querySelector(".orientation-resolution__collapse-icon");
      if (textEl) {
        textEl.textContent = expanded ? "收起设置" : "展开设置";
      }
      if (iconEl) {
        iconEl.textContent = expanded ? "▴" : "▾";
      }
    }
    if (this._resolutionModeEl) {
      this._resolutionModeEl.setAttribute("aria-hidden", showPanel ? "false" : "true");
    }
    this.refreshDragBoundsForGroup("resolution-control");
  },
  async lockLandscape(fromUser = false) {
    if (!this.isMobile() || !this.supportsLock()) {
      this.showHint();
      if (fromUser) {
        this.setFallback(true);
      }
      return false;
    }
    try {
      const orientation = window.screen.orientation;
      if (fromUser && !document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (_) {
          /* 忽略全屏失败，继续尝试锁定 */
        }
      }
      const targets = fromUser ? ["landscape-primary", "landscape-secondary", "landscape"] : ["landscape"];
      let locked = false;
      let lastError = null;
      for (const type of targets) {
        try {
          await orientation.lock(type);
          locked = true;
          break;
        } catch (lockErr) {
          lastError = lockErr;
        }
      }
      if (!locked) {
        throw lastError || new Error("orientation lock failed");
      }
      this.hideHint();
      this._autoTried = true;
      this.setFallback(false);
      return true;
    } catch (err) {
      console.warn("orientation lock failed", err);
      this.showHint();
      if (fromUser) {
        this.setFallback(true);
      }
      return false;
    }
  },
  update() {
    const mobile = this.isMobile();
    if (this.button) {
      if (mobile) {
        this.button.classList.add("show");
      } else {
        this.button.classList.remove("show");
      }
    }
    if (!mobile) {
      this.hideHint();
      this.setFallback(false);
      this.applyDocumentState(false, false);
      return;
    }
    const portrait = this.isPortrait();
    if (!portrait && this._fallbackActive) {
      this.setFallback(false);
    }
    this.applyDocumentState(mobile, portrait);
    if (this._fallbackActive) {
      this.applyFallbackScale();
    }
    const scale = this.getCurrentScale();
    this.syncResolutionVariable(scale);
    this.updateResolutionSummary(scale);
    this.syncResolutionShell();
    this.refreshDragBounds();
    if (portrait) {
      if (this._fallbackActive) {
        this.hideHint();
      } else {
        this.showHint();
        if (!this._autoTried) {
          this._autoTried = true;
          this.lockLandscape(false);
        }
      }
    } else {
      this.hideHint();
    }
  }
};

OrientationHelper.init();
window.OrientationHelper = OrientationHelper;

const PresenceTracker = {
  _route: "home",
  _activity: null,
  _details: {},
  _timer: null,
  _lastSent: 0,
  init() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = setInterval(() => this.ping(false), 20000);
    window.addEventListener("focus", () => this.ping(true));
    window.addEventListener("beforeunload", () => {
      try { this.ping(true); } catch (_) { /* 忽略 */ }
    });
  },
  setPage(route, pageObj) {
    this._route = route || "home";
    let info = null;
    try {
      if (pageObj && typeof pageObj.presence === "function") {
        info = pageObj.presence();
      }
    } catch (_) {
      info = null;
    }
    this.updateDetails(info || {});
  },
  updateDetails(info) {
    if (!info || typeof info !== "object") info = {};
    const activity = typeof info.activity === "string" ? info.activity.trim() : "";
    this._activity = activity || null;
    this._details = info.details && typeof info.details === "object" ? info.details : {};
    this.ping(true);
  },
  compose() {
    if (!API.token) {
      this._lastSent = 0;
      return null;
    }
    const page = this._route || "home";
    const activity = this._activity || `page:${page}`;
    return { page, activity, details: this._details || {} };
  },
  async ping(force = false) {
    if (!API.token) {
      this._lastSent = 0;
      return;
    }
    const now = Date.now();
    const minGap = force ? 0 : 15000;
    if (!force && now - this._lastSent < minGap) {
      return;
    }
    const payload = this.compose();
    if (!payload) return;
    this._lastSent = now;
    try {
      const resp = await API.updatePresence(payload);
      if (resp && resp.announcement) {
        try { window.AnnouncementCenter?.show?.(resp.announcement); } catch (_) { /* ignore */ }
      }
    } catch (_) {
      /* 忽略错误，保持静默 */
    }
  },
};

PresenceTracker.init();
window.PresenceTracker = PresenceTracker;

const Notifier = {
  pushDiamond(payload = {}) {
    const wrap = $notify();
    if (!wrap) return;
    const username = escapeHtml(payload.username || "玩家");
    const item = payload.item || {};
    const name = escapeHtml(item.name || "未知皮肤");
    const rarity = escapeHtml(item.rarity || "");
    const node = document.createElement("div");
    node.className = "notify-card diamond";
    node.innerHTML = `
      <div class="notify-title">🎉 ${username}</div>
      <div class="notify-body">抽出了钻石模板 <span>${name}</span>${rarity ? ` · ${rarity}` : ""}</div>
    `;
    wrap.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 320);
    }, 10000);
  }
};

window.Notifier = Notifier;

const AnnouncementCenter = {
  _displayed: new Set(),
  show(payload = {}) {
    if (!payload) return;
    const message = (payload.message || "").trim();
    if (!message) return;
    const id = payload.id || `announcement-${Date.now()}`;
    if (this._displayed.has(id)) return;
    const expiresAt = Number(payload.expires_at || 0);
    if (expiresAt && expiresAt * 1000 < Date.now()) return;
    const wrap = $notify();
    if (!wrap) return;
    this._displayed.add(id);
    const node = document.createElement("div");
    node.className = "notify-card notice";
    node.innerHTML = `
      <button type="button" class="notify-close" aria-label="关闭公告">×</button>
      <div class="notify-title">📢 全服公告</div>
      <div class="notify-body">${escapeHtml(message)}</div>
    `;
    wrap.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    const seconds = Math.max(5, Math.min(Number(payload.duration || 60), 60));
    let dismissed = false;
    const hide = () => {
      if (dismissed) return;
      dismissed = true;
      node.classList.remove("show");
      setTimeout(() => node.remove(), 320);
    };
    const timer = setTimeout(hide, seconds * 1000);
    const closeBtn = node.querySelector(".notify-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        clearTimeout(timer);
        hide();
      });
    }
  }
};

window.AnnouncementCenter = AnnouncementCenter;

let maintenanceNotifiedKey = null;
window.addEventListener('app-maintenance', (event) => {
  const info = (event && event.detail) || {};
  const message = info.message || "网站进入维护模式，请稍后再试。";
  const updated = info.updated_at ? Number(info.updated_at) : Date.now();
  const key = info.updated_at ? `maintenance-${info.updated_at}` : `maintenance-${message}`;
  if (maintenanceNotifiedKey === key) return;
  maintenanceNotifiedKey = key;
  AnnouncementCenter.show({ id: `maintenance-${updated}`, message, duration: 60 });
  try { alert(message); } catch (_) { /* ignore */ }
  location.hash = "#/auth";
});

const Pages = {
  home: { render: () => `<div class="card"><h2>欢迎</h2><p>这是三角洲砖皮模拟器的网站版。</p></div>`, bind: ()=>{} },
  auth: AuthPage,
  me: {
    async render() {
      const [d, mailboxRaw, seasonCatalog] = await Promise.all([
        API.me(),
        API.mailbox().catch(() => ({ brick: { buy: [], sell: [] }, skin: { buy: [], sell: [] } })),
        API.seasonCatalog().catch(() => ({ seasons: [] })),
      ]);
      const seasonMap = {};
      if (seasonCatalog?.seasons) {
        seasonCatalog.seasons.forEach(season => {
          if (!season?.id) return;
          seasonMap[season.id] = season.name;
          seasonMap[String(season.id).toUpperCase()] = season.name;
        });
      }
      const mail = mailboxRaw || { brick: { buy: [], sell: [] }, skin: { buy: [], sell: [] } };
      const formatTs = (ts) => {
        if (!ts) return "-";
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString("zh-CN", { hour12: false });
      };
      const renderList = (items, mode) => {
        if (!items || !items.length) {
          return `<div class="muted">暂无记录</div>`;
        }
        return items.map(item => {
          const name = escapeHtml(item.item_name || "未知物品");
          const qty = item.quantity || 0;
          const total = item.total_amount || 0;
          const unit = item.unit_price || 0;
          const net = item.net_amount || 0;
          const time = formatTs(item.created_at);
          const seasonId = item.season || "";
          const seasonLabelRaw = seasonMap[seasonId] || seasonMap[String(seasonId).toUpperCase()] || seasonId;
          const seasonLabel = seasonId ? (seasonLabelRaw || seasonId) : "";
          const meta = mode === "buy"
            ? `花费 <b>${total}</b> 三角币 · 均价 ${unit}`
            : `售出金额 <b>${total}</b> 三角币 · 实得 <b>${net}</b>`;
          const seasonMeta = seasonLabel ? ` · 赛季 ${escapeHtml(seasonLabel)}` : "";
          return `
            <div class="mail-entry">
              <div class="mail-entry__head">
                <span class="mail-entry__time">${time}</span>
                <span class="mail-entry__qty">×${qty}</span>
              </div>
              <div class="mail-entry__body">
                <span class="mail-entry__name">${name}</span>
                <span class="mail-entry__meta">${meta}${seasonMeta}</span>
              </div>
            </div>`;
        }).join("");
      };
      const brickBuy = renderList(mail?.brick?.buy || [], "buy");
      const brickSell = renderList(mail?.brick?.sell || [], "sell");
      const skinBuy = renderList(mail?.skin?.buy || [], "buy");
      const skinSell = renderList(mail?.skin?.sell || [], "sell");
      return `<div class="card"><h2>我的信息</h2>
        <div class="grid cols-3">
          <div class="kv"><div class="k">用户ID</div><div class="v">${d.user_id}</div></div>
          <div class="kv"><div class="k">用户名</div><div class="v">${d.username}</div></div>
          <div class="kv"><div class="k">手机号</div><div class="v">${d.phone}</div></div>
          <div class="kv"><div class="k">三角币</div><div class="v">${d.coins}</div></div>
          <div class="kv"><div class="k">法币</div><div class="v">${d.fiat}</div></div>
          <div class="kv"><div class="k">钥匙</div><div class="v">${d.keys}</div></div>
          <div class="kv"><div class="k">未开砖</div><div class="v">${d.unopened_bricks}</div></div>
          <div class="kv"><div class="k">是否管理员</div><div class="v">${d.is_admin ? '是' : '否'}</div></div>
        </div>
        <div class="mailbox">
          <div class="mailbox-header">
            <h3>交易邮箱</h3>
            <div class="mailbox-tabs">
              <button class="mailbox-tab active" data-mail-tab="brick">砖交易</button>
              <button class="mailbox-tab" data-mail-tab="skin">枪皮交易</button>
            </div>
          </div>
          <div class="mailbox-panels">
            <div class="mailbox-panel active" data-mail-panel="brick">
              <div class="mailbox-sub">
                <h4>购买记录</h4>
                <div class="mailbox-list" id="mail-brick-buy">${brickBuy}</div>
              </div>
              <div class="mailbox-sub">
                <h4>售出记录</h4>
                <div class="mailbox-list" id="mail-brick-sell">${brickSell}</div>
              </div>
            </div>
            <div class="mailbox-panel" data-mail-panel="skin">
              <div class="mailbox-sub">
                <h4>购买记录</h4>
                <div class="mailbox-list" id="mail-skin-buy">${skinBuy}</div>
              </div>
              <div class="mailbox-sub">
                <h4>售出记录</h4>
                <div class="mailbox-list" id="mail-skin-sell">${skinSell}</div>
              </div>
            </div>
          </div>
        </div></div>`;
    },
    bind() {
      const tabs = document.querySelectorAll('[data-mail-tab]');
      const panels = document.querySelectorAll('[data-mail-panel]');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.mailTab;
          tabs.forEach(btn => btn.classList.toggle('active', btn === tab));
          panels.forEach(panel => panel.classList.toggle('active', panel.dataset.mailPanel === target));
        });
      });
    }
  },
  wallet: WalletPage,
  shop: ShopPage,
  gacha: GachaPage,
  cookie: CookieFactoryPage,
  starfall: StarfallPage,
  cultivation: CultivationPage,
  dungeon: DungeonCrawlerPage,
  friends: FriendsPage,
  inventory: InventoryPage,
  craft: CraftPage,
  market: MarketPage,
  odds: {
    async render(){ const o = await API.odds(); return `<div class="card"><h2>当前概率</h2><pre>${escapeHtml(JSON.stringify(o,null,2))}</pre></div>`; },
    bind:()=>{}
  },
  admin: AdminPage,
  logout: {
    render(){ return `<div class="card"><h2>退出</h2><p>已退出。</p></div>`; },
    bind(){ API.setToken(null); setTimeout(()=>location.hash="#/home", 300); }
  }
};

let _currentRouteKey = null;
let _currentPageObj = null;

function renderNav() {
  const navNode = $nav();
  if (!navNode) return;
  navNode.innerHTML = Nav.render();
  Nav.bind();
  window.AudioEngine?.decorateArea?.(navNode);
}

async function renderRoute() {
  const r = (location.hash.replace(/^#\//,"") || "home");
  const nextPage = Pages[r] || Pages.home;
  const prevRoute = _currentRouteKey;
  const prevPage = _currentPageObj;

  if (prevPage && prevRoute && prevRoute !== r) {
    try { prevPage.teardown?.(); } catch (_) {}
  }
  if (prevRoute && prevRoute !== r) {
    window.AudioEngine?.stopAllSfx?.();
  }

  _currentRouteKey = r;
  _currentPageObj = nextPage;

  if (API.token) {
    try { await API.me(); } catch(e) { /* 忽略 */ }
  } else {
    API._me = null;
  }

  if (r === "admin" && !API._me?.is_admin) {
    location.hash = "#/home";
    return;
  }

  renderNav();
  window.AudioEngine?.setRoute?.(r);
  const p = nextPage;
  PresenceTracker.setPage(r, p);
  const html = await (p.render?.() ?? "");
  $page().innerHTML = html;
  p.bind?.();
  window.AudioEngine?.decorateArea?.($page());
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("load", renderRoute);
