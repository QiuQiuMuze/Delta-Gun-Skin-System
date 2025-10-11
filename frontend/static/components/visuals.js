(function(){
  const TEMPLATE_LABELS = {
    "prism_flux": "棱镜流光",
    "ember_strata": "余烬分层",
    "ion_tessellate": "离子镶嵌",
    "diamond_veil": "钻石面纱",
    "aurora_matrix": "极光矩阵",
    "nebula_glass": "星云玻璃",
    "ion_glaze": "离子釉彩",
    "vapor_trace": "雾态轨迹",
    "phase_shift": "相位位移",
    "urban_mesh": "都市网格",
    "fiber_wave": "纤维波纹",
    "midnight_line": "午夜线条",
    "field_classic": "野战经典",
    "steel_ridge": "钢脊纹",
    "matte_guard": "哨卫磨砂"
  };

  const EFFECT_LABELS = {
    glow: "辉光涌动",
    pulse: "能量脉冲",
    sheen: "流光泛映",
    sparkle: "星火闪烁",
    trail: "残影拖尾",
    refraction: "晶体折射",
    flux: "相位流动"
  };

  const TEMPLATE_CLASS_MAP = {
    prism_flux: "tmpl-prism",
    ember_strata: "tmpl-ember",
    ion_tessellate: "tmpl-ion",
    diamond_veil: "tmpl-diamond",
    aurora_matrix: "tmpl-aurora",
    nebula_glass: "tmpl-nebula",
    ion_glaze: "tmpl-ion",
    vapor_trace: "tmpl-vapor",
    phase_shift: "tmpl-vapor",
    urban_mesh: "tmpl-urban",
    fiber_wave: "tmpl-urban",
    midnight_line: "tmpl-midnight",
    field_classic: "tmpl-field",
    steel_ridge: "tmpl-field",
    matte_guard: "tmpl-matte"
  };

  const EFFECT_CLASS_MAP = {
    glow: "effect-glow",
    pulse: "effect-pulse",
    sheen: "effect-sheen",
    sparkle: "effect-sparkle",
    trail: "effect-trail",
    refraction: "effect-refraction",
    flux: "effect-flux"
  };

  const COLOR_LOOKUP = {
    "#f06449": "熔岩橙",
    "#f9a620": "流金黄",
    "#ffd166": "暖阳金",
    "#ff6b6b": "燃焰红",
    "#ef476f": "曦粉",
    "#5b5f97": "紫曜蓝",
    "#577590": "风暴蓝",
    "#118ab2": "极地蓝",
    "#06d6a0": "量子绿",
    "#0ead69": "热带绿",
    "#26547c": "暗夜蓝",
    "#4cc9f0": "星辉青",
    "#845ec2": "霓虹紫",
    "#ff9671": "霞光橘",
    "#ffc75f": "琥珀金",
    "#d65db1": "星云粉",
    "#4b8b3b": "密林绿",
    "#8c7ae6": "暮光紫",
    "#2f4858": "石墨蓝"
  };

  const DEFAULT_COLOR = { hex: "#889199", name: "军械灰" };

  function esc(str){
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureArray(v){
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    return [v];
  }

  function sanitizeHex(hex){
    if (!hex) return DEFAULT_COLOR.hex;
    const s = String(hex).trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s.toLowerCase();
    const withHash = s.startsWith("#") ? s : "#" + s;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return withHash.toLowerCase();
    return DEFAULT_COLOR.hex;
  }

  function normalizeColor(entry){
    if (!entry) return DEFAULT_COLOR;
    if (typeof entry === "string" || typeof entry === "number") {
      const hex = sanitizeHex(entry);
      return { hex, name: COLOR_LOOKUP[hex] || hex };
    }
    const hex = sanitizeHex(entry.hex || entry.color || entry.value);
    const name = entry.name || COLOR_LOOKUP[hex] || hex;
    return { hex, name };
  }

  function hexToRgb(hex){
    const sanitized = sanitizeHex(hex).replace('#', '');
    const str = sanitized.length === 3
      ? sanitized.split('').map(ch => ch + ch).join('')
      : sanitized.padEnd(6, '0').slice(0, 6);
    const r = parseInt(str.slice(0, 2), 16);
    const g = parseInt(str.slice(2, 4), 16);
    const b = parseInt(str.slice(4, 6), 16);
    return {
      r: Number.isFinite(r) ? r : 0,
      g: Number.isFinite(g) ? g : 0,
      b: Number.isFinite(b) ? b : 0
    };
  }

  function toCssColor(rgb, alpha){
    const a = typeof alpha === 'number' ? Math.max(0, Math.min(1, alpha)) : 1;
    const { r, g, b } = rgb;
    if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function mixRgb(a, b, ratio){
    const t = Math.max(0, Math.min(1, ratio));
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
  }

  function mixWith(hex, targetRgb, ratio, alpha){
    const base = hexToRgb(hex);
    const mixed = mixRgb(base, targetRgb, ratio);
    return toCssColor(mixed, alpha);
  }

  function lighten(hex, ratio, alpha){
    return mixWith(hex, { r: 255, g: 255, b: 255 }, ratio, alpha);
  }

  function darken(hex, ratio, alpha){
    return mixWith(hex, { r: 0, g: 0, b: 0 }, ratio, alpha);
  }

  function gradientFrom(list){
    const colors = list.map(c => c.hex);
    if (colors.length === 0) return DEFAULT_COLOR.hex;
    if (colors.length === 1) return colors[0];
    return `linear-gradient(135deg, ${colors.join(', ')})`;
  }

  function describe(visual){
    const v = visual || {};
    const bodyRaw = ensureArray(v.body).map(normalizeColor).filter(Boolean);
    const attachRaw = ensureArray(v.attachments).map(normalizeColor).filter(Boolean);
    const templateKey = String(v.template || "matte_guard").toLowerCase();
    const effectsRaw = ensureArray(v.effects).map(e => String(e || "").toLowerCase()).filter(Boolean);

    return {
      bodyColors: bodyRaw.length ? bodyRaw : [DEFAULT_COLOR],
      attachmentColors: attachRaw.length ? attachRaw : [DEFAULT_COLOR],
      template: templateKey,
      templateLabel: TEMPLATE_LABELS[templateKey] || templateKey || "标准涂装",
      hidden: !!v.hidden_template,
      effects: effectsRaw,
      effectsLabel: effectsRaw.length ? effectsRaw.map(e => EFFECT_LABELS[e] || e).join("、") : "无特效",
      bodyText: (bodyRaw.length ? bodyRaw : [DEFAULT_COLOR]).map(c => c.name).join(" / "),
      attachmentText: (attachRaw.length ? attachRaw : [DEFAULT_COLOR]).map(c => c.name).join(" / "),
    };
  }

  function formatMeta(visual){
    const info = describe(visual);
    const parts = [
      `模板：${info.templateLabel}`,
      `特效：${info.effectsLabel}`
    ];
    if (info.hidden) parts.push("隐藏模板");
    return parts.join(" · ");
  }

  function render(visual, opts){
    opts = opts || {};
    const info = describe(visual);
    const classes = ["skin-preview"];
    if (opts.compact) classes.push("skin-preview--compact");
    if (info.hidden) classes.push("is-hidden-template");
    const tmplCls = TEMPLATE_CLASS_MAP[info.template];
    if (tmplCls) classes.push(tmplCls);
    info.effects.forEach(e => {
      const cls = EFFECT_CLASS_MAP[e];
      if (cls) classes.push(cls);
    });

    const width = opts.width || (opts.compact ? 168 : 240);
    const height = opts.height || (opts.compact ? 58 : 86);
    const bodyGradient = gradientFrom(info.bodyColors);
    const bodyPrimary = info.bodyColors[0] || DEFAULT_COLOR;
    const bodySecondary = info.bodyColors[1] || bodyPrimary;
    const attachPrimary = info.attachmentColors[0] || DEFAULT_COLOR;
    const attachSecondary = info.attachmentColors[1] || attachPrimary;
    const accentGradient = gradientFrom([attachPrimary, attachSecondary]);
    const canvasClasses = ["skin-preview__canvas", `tpl-${info.template}`];
    const canvasStyle = [
      `--preview-width:${width}px`,
      `--preview-height:${height}px`,
      `--body-gradient:${bodyGradient}`,
      `--body-secondary:${bodySecondary.hex}`,
      `--body-highlight:${lighten(bodySecondary.hex, 0.45, 0.85)}`,
      `--body-edge:${darken(bodyPrimary.hex, 0.55)}`,
      `--body-glow:${lighten(bodyPrimary.hex, 0.35, 0.42)}`,
      `--body-depth:${darken(bodyPrimary.hex, 0.65)}`,
      `--body-panel:${lighten(bodySecondary.hex, 0.25)}`,
      `--body-specular:${lighten(bodySecondary.hex, 0.75, 0.82)}`,
      `--body-shadow:${darken(bodyPrimary.hex, 0.8, 0.85)}`,
      `--accent-color:${attachPrimary.hex}`,
      `--accent-secondary:${attachSecondary.hex}`,
      `--accent-gradient:${accentGradient}`,
      `--accent-highlight:${lighten(attachPrimary.hex, 0.6, 0.88)}`,
      `--accent-shadow:${darken(attachPrimary.hex, 0.62)}`,
      `--accent-metal:${darken(attachPrimary.hex, 0.48)}`,
      `--accent-gloss:${lighten(attachSecondary.hex, 0.7, 0.92)}`,
      `--accent-emissive:${lighten(attachSecondary.hex, 0.8, 0.65)}`,
      `--detail-line:${lighten(bodySecondary.hex, 0.58, 0.72)}`,
      `--detail-engrave:${darken(bodySecondary.hex, 0.25)}`,
      `--scope-glass:${lighten(attachPrimary.hex, 0.4, 0.52)}`,
      `--scope-glow:${lighten(attachSecondary.hex, 0.85, 0.48)}`,
      `--scope-metal:${darken(attachPrimary.hex, 0.35)}`,
      `--muzzle-heat:${lighten(attachPrimary.hex, 0.45, 0.65)}`,
      `--muzzle-inner:${darken(attachPrimary.hex, 0.15)}`,
      `--bolt-metal:${lighten(bodyPrimary.hex, 0.22)}`,
      `--bolt-shadow:${darken(bodyPrimary.hex, 0.45)}`,
      `--accent-stripe:${lighten(attachSecondary.hex, 0.45)}`
    ].join(';');
    const label = opts.label ? `<div class="skin-preview__label">${esc(opts.label)}</div>` : "";
    const metaText = opts.meta === false ? "" : (opts.meta || formatMeta(visual));
    const meta = metaText ? `<div class="skin-preview__meta">${esc(metaText)}</div>` : "";

    return `
      <div class="${classes.join(' ')}">
        <div class="${canvasClasses.join(' ')}" style="${canvasStyle}">
          <div class="skin-preview__gun">
            <div class="skin-preview__layer skin-preview__layer--shadow"></div>
            <div class="skin-preview__layer skin-preview__layer--backglow"></div>
            <div class="skin-preview__layer skin-preview__layer--body"></div>
            <div class="skin-preview__layer skin-preview__layer--body-panel"></div>
            <div class="skin-preview__layer skin-preview__layer--receiver"></div>
            <div class="skin-preview__layer skin-preview__layer--vent"></div>
            <div class="skin-preview__layer skin-preview__layer--spine"></div>
            <div class="skin-preview__layer skin-preview__layer--stock"></div>
            <div class="skin-preview__layer skin-preview__layer--stock-pad"></div>
            <div class="skin-preview__layer skin-preview__layer--grip"></div>
            <div class="skin-preview__layer skin-preview__layer--trigger-guard"></div>
            <div class="skin-preview__layer skin-preview__layer--trigger"></div>
            <div class="skin-preview__layer skin-preview__layer--mag"></div>
            <div class="skin-preview__layer skin-preview__layer--mag-light"></div>
            <div class="skin-preview__layer skin-preview__layer--fore"></div>
            <div class="skin-preview__layer skin-preview__layer--rail"></div>
            <div class="skin-preview__layer skin-preview__layer--rail-sight"></div>
            <div class="skin-preview__layer skin-preview__layer--bolt"></div>
            <div class="skin-preview__layer skin-preview__layer--barrel"></div>
            <div class="skin-preview__layer skin-preview__layer--barrel-core"></div>
            <div class="skin-preview__layer skin-preview__layer--muzzle"></div>
            <div class="skin-preview__layer skin-preview__layer--muzzle-inner"></div>
            <div class="skin-preview__layer skin-preview__layer--scope"></div>
            <div class="skin-preview__layer skin-preview__layer--scope-ring"></div>
            <div class="skin-preview__layer skin-preview__layer--scope-glass"></div>
            <div class="skin-preview__layer skin-preview__layer--detail"></div>
            <div class="skin-preview__layer skin-preview__layer--panel-lines"></div>
            <div class="skin-preview__layer skin-preview__layer--spark"></div>
            <div class="skin-preview__layer skin-preview__layer--accent-line"></div>
            <div class="skin-preview__layer skin-preview__layer--screws"></div>
          </div>
        </div>
        ${label}
        ${meta}
      </div>
    `;
  }

  window.SkinVisuals = {
    render,
    describe,
    formatMeta,
    templateLabel: (key) => TEMPLATE_LABELS[String(key || "").toLowerCase()] || key,
    effectLabel: (key) => EFFECT_LABELS[String(key || "").toLowerCase()] || key,
  };
})();
