(function(){
  const TEMPLATE_LABELS = {
    "brick_normal": "标准模板",
    "brick_white_diamond": "白钻切面",
    "brick_yellow_diamond": "黄钻切面",
    "brick_pink_diamond": "粉钻切面",
    "brick_brushed_metal": "金属拉丝",
    "brick_laser_gradient": "镭射渐变",
    // 兼容旧数据
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
    flux: "相位流动",
    bold_tracer: "显眼曳光",
    kill_counter: "击杀字数"
  };

  const TEMPLATE_CLASS_MAP = {
    brick_normal: "tmpl-brick-normal",
    brick_white_diamond: "tmpl-brick-white",
    brick_yellow_diamond: "tmpl-brick-yellow",
    brick_pink_diamond: "tmpl-brick-pink",
    brick_brushed_metal: "tmpl-brick-brushed",
    brick_laser_gradient: "tmpl-brick-laser",
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
    flux: "effect-flux",
    bold_tracer: "effect-bold-tracer",
    kill_counter: "effect-kill-counter"
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

  const PATHS = {
    body: "M174 94 L406 64 L452 70 L498 88 L528 116 L520 166 L262 192 L208 162 Z",
    bodyPanel: "M198 108 L402 78 L456 88 L498 112 L490 152 L284 176 L226 150 Z",
    bodyInset: "M210 118 L432 90 L474 104 L466 146 L286 170 L234 148 Z",
    bodyMid: "M224 134 L468 104 L470 122 L272 162 Z",
    bodyCut: "M246 126 L310 116 L440 102 L456 118 L308 152 Z",
    bodyLower: "M204 148 L470 120 L474 148 L296 178 L236 158 Z",
    bodyVentPanel: "M328 126 L452 110 L458 134 L342 156 Z",
    bodyRidge: "M240 140 L420 116 L428 130 L284 164 Z",
    upper: "M214 78 L388 48 L432 54 L452 72 L264 96 Z",
    rail: "M232 70 L382 42 L394 50 L242 78 Z",
    railInset: "M254 64 L366 44 L372 52 L260 70 Z",
    railShadow: "M238 72 L384 40 L392 48 L246 80 Z",
    railStep: "M232 76 L386 46 L396 56 L240 86 Z",
    vent: "M334 84 L440 68 L458 82 L446 102 L350 118 Z",
    ventTop: "M338 90 L436 74 L446 84 L346 100 Z",
    ejectionPort: "M330 118 L390 110 L392 130 L332 138 Z",
    chargingHandle: "M288 100 L338 92 L340 102 L290 110 Z",
    boltCarrier: "M292 112 L358 102 L362 112 L298 122 Z",
    dustCover: "M306 124 L372 114 L374 128 L310 136 Z",
    stock: "M38 146 L150 104 L182 112 L170 170 L76 206 L34 188 Z",
    stockPanel: "M64 150 L148 118 L170 124 L162 160 L84 190 L56 178 Z",
    stockButt: "M36 166 L92 140 L146 118 L158 122 L150 166 L90 198 L44 182 Z",
    stockCore: "M74 162 L136 132 L150 134 L142 166 L92 192 L68 182 Z",
    stockSpine: "M52 172 L132 134 L140 154 L76 194 Z",
    stockEdge: "M46 182 L110 150 L142 136 L146 160 L88 200 Z",
    grip: "M292 156 L334 154 L360 210 L310 216 Z",
    gripFront: "M334 154 L352 154 L374 210 L354 214 Z",
    gripInset: "M300 160 L336 158 L354 206 L320 210 Z",
    trigger: "M310 156 Q332 162 328 186 L304 186 Q296 172 310 156 Z",
    triggerGuard: "M296 160 C300 150 318 148 340 150 L348 154 C360 170 360 196 350 210 L320 214 C298 204 290 184 296 166 Z",
    triggerCut: "M320 168 L338 168 L346 184 L322 188 Z",
    mag: "M330 152 L384 150 L368 214 L314 214 Z",
    magLight: "M338 164 L364 162 L352 206 L328 208 Z",
    magPlate: "M320 206 L372 202 L360 226 L314 226 Z",
    magLatch: "M350 168 L366 166 L360 196 L346 198 Z",
    magWindow: "M340 174 L356 172 L350 198 L336 198 Z",
    fore: "M380 126 L512 110 L514 156 L392 174 Z",
    foreChamfer: "M388 122 L500 108 L506 124 L396 140 Z",
    foreLower: "M384 150 L508 132 L508 166 L394 180 Z",
    foreRail: "M396 132 L510 116 L512 144 L404 158 Z",
    foreSlots: "M402 140 L492 128 L498 150 L408 162 Z",
    barrel: "M510 126 L586 124 L602 132 L600 150 L512 158 Z",
    barrelTop: "M512 118 L584 116 L592 122 L516 130 Z",
    barrelBottom: "M514 136 L584 134 L592 140 L516 146 Z",
    barrelRidge: "M514 130 L588 128 L594 134 L520 136 Z",
    muzzle: "M586 122 L626 122 L628 152 L586 152 Z",
    muzzleCore: "M596 132 L618 132 L620 144 L596 142 Z",
    muzzleCap: "M604 128 L624 128 L626 150 L604 150 Z",
    muzzleVent: "M592 136 L620 136 L620 140 L592 140 Z",
    scopeBody: "M262 74 L332 52 L360 58 L330 86 Z",
    scopeRing: "M288 56 L344 44 L354 50 L302 68 Z",
    scopeGlass: "M296 56 L340 46 L344 54 L300 68 Z",
    scopeMount: "M250 94 L344 80 L352 90 L258 106 Z",
    scopeBracket: "M248 110 L340 96 L346 104 L254 118 Z",
    scopeKnob: "M308 70 L324 66 L328 76 L312 80 Z",
    scopeDetail: "M270 86 L334 64 L344 70 L280 92 Z",
    bolt: "M322 106 L368 98 L374 112 L328 120 Z",
    boltRail: "M310 110 L380 96 L384 106 L314 120 Z"
  };

  const RAIL_TEETH = Array.from({ length: 9 }).map((_, i) => ({
    x: 244 + i * 18,
    y: 56,
    width: 14,
    height: 8
  }));

  const RAIL_GROOVES = Array.from({ length: 8 }).map((_, i) => ({
    x1: 250 + i * 20,
    x2: 260 + i * 20,
    y1: 74,
    y2: 86
  }));

  const FORE_VENTS = [
    { x: 402, y: 132, width: 18, height: 30 },
    { x: 430, y: 128, width: 20, height: 34 },
    { x: 460, y: 126, width: 20, height: 36 },
    { x: 490, y: 124, width: 22, height: 36 }
  ];

  const GRIP_RIDGES = [
    { x1: 300, y1: 168, x2: 332, y2: 214 },
    { x1: 308, y1: 164, x2: 340, y2: 212 },
    { x1: 316, y1: 162, x2: 348, y2: 210 },
    { x1: 324, y1: 160, x2: 356, y2: 208 }
  ];

  const MAG_RIVETS = [
    { cx: 336, cy: 178 },
    { cx: 356, cy: 176 },
    { cx: 348, cy: 196 }
  ];

  const SCREWS = [
    { cx: 236, cy: 140 },
    { cx: 294, cy: 126 },
    { cx: 352, cy: 132 },
    { cx: 416, cy: 124 }
  ];

  const SPARK_POINTS = [
    { cx: 260, cy: 120, r: 4 },
    { cx: 308, cy: 108, r: 3.2 },
    { cx: 360, cy: 116, r: 4.4 },
    { cx: 412, cy: 122, r: 3.6 },
    { cx: 452, cy: 134, r: 3.2 }
  ];

  const DIAMOND_SPARKS = [
    { cx: 282, cy: 124, r: 6 },
    { cx: 332, cy: 102, r: 5 },
    { cx: 378, cy: 128, r: 5.6 },
    { cx: 428, cy: 112, r: 4.2 },
    { cx: 468, cy: 140, r: 6.8 }
  ];

  const FORE_PLATES = [
    "M398 138 L434 130 L440 150 L404 158 Z",
    "M440 132 L474 126 L480 148 L446 154 Z",
    "M480 126 L504 124 L506 142 L486 146 Z"
  ];

  const BARREL_RINGS = [
    { x: 528, y: 128, width: 8, height: 24 },
    { x: 546, y: 126, width: 6, height: 28 },
    { x: 562, y: 126, width: 6, height: 28 }
  ];

  const MUZZLE_LINES = [
    { x1: 592, y1: 128, x2: 622, y2: 128 },
    { x1: 592, y1: 146, x2: 622, y2: 146 }
  ];

  const BODY_LINES = [
    "M228 142 L436 112",
    "M236 150 L430 118",
    "M250 158 L420 126",
    "M264 166 L404 132"
  ];

  const BODY_PLATES = [
    "M220 126 L280 114 L302 150 L244 164 Z",
    "M302 112 L354 104 L362 140 L310 150 Z",
    "M360 104 L430 94 L442 128 L372 138 Z"
  ];

  const BODY_HOUSING_LINES = [
    { x1: 284, y1: 126, x2: 442, y2: 108 },
    { x1: 292, y1: 134, x2: 450, y2: 112 },
    { x1: 298, y1: 142, x2: 456, y2: 120 }
  ];

  const BODY_GROOVES = [
    "M236 136 C280 120 368 112 460 116",
    "M246 146 C300 126 384 120 468 124"
  ];

  const MAG_LINES = [
    { x1: 330, y1: 162, x2: 370, y2: 160 },
    { x1: 326, y1: 172, x2: 368, y2: 170 },
    { x1: 322, y1: 182, x2: 366, y2: 180 }
  ];

  const STOCK_RIBS = [
    { x1: 60, y1: 168, x2: 140, y2: 132 },
    { x1: 54, y1: 176, x2: 134, y2: 140 },
    { x1: 48, y1: 184, x2: 128, y2: 148 }
  ];

  const FORE_LINES = [
    { x1: 392, y1: 146, x2: 506, y2: 128 },
    { x1: 396, y1: 154, x2: 506, y2: 136 },
    { x1: 400, y1: 162, x2: 504, y2: 140 }
  ];

  const SCOPE_LINES = [
    { x1: 270, y1: 84, x2: 354, y2: 60 },
    { x1: 276, y1: 92, x2: 348, y2: 68 }
  ];

  const DETAIL_DOTS = [
    { cx: 234, cy: 138, r: 2.4 },
    { cx: 280, cy: 124, r: 2 },
    { cx: 324, cy: 120, r: 2.2 },
    { cx: 368, cy: 118, r: 2.4 },
    { cx: 406, cy: 114, r: 2.2 }
  ];

  function templatePreset(key, base){
    const k = String(key || "").toLowerCase();
    switch(k){
      case "":
        return { type: "none" };
      case "brick_normal":
        return {
          type: "bands",
          colors: [
            darken(base.bodySecondary, 0.18),
            lighten(base.bodySecondary, 0.12),
            lighten(base.bodyPrimary, 0.32)
          ],
          angle: -16,
          opacity: 0.58
        };
      case "brick_white_diamond":
        return {
          type: "diamond",
          colors: [
            "rgba(255,255,255,0.95)",
            lighten(base.bodySecondary, 0.45),
            lighten(base.attachmentSecondary, 0.6)
          ],
          opacity: 0.82
        };
      case "brick_yellow_diamond":
        return {
          type: "diamond",
          colors: [
            lighten(base.bodySecondary, 0.55),
            "rgba(255,214,102,0.95)",
            "rgba(255,240,180,0.85)"
          ],
          opacity: 0.8
        };
      case "brick_pink_diamond":
        return {
          type: "diamond",
          colors: [
            lighten(base.bodySecondary, 0.58),
            "rgba(239,71,111,0.9)",
            "rgba(255,182,193,0.85)"
          ],
          opacity: 0.8
        };
      case "brick_brushed_metal":
        return {
          type: "brushed",
          colors: [
            lighten(base.bodySecondary, 0.4),
            lighten(base.bodySecondary, 0.18),
            darken(base.bodySecondary, 0.28)
          ],
          angle: -14,
          opacity: 0.72
        };
      case "brick_laser_gradient":
        return {
          type: "laser",
          stops: [
            { offset: "0%", color: lighten(base.bodyPrimary, 0.6), opacity: 0.92 },
            { offset: "45%", color: lighten(base.attachmentSecondary, 0.55), opacity: 0.88 },
            { offset: "100%", color: lighten(base.attachmentPrimary, 0.35), opacity: 0.9 }
          ],
          accent: lighten(base.attachmentSecondary, 0.85),
          streaks: true,
          opacity: 0.78
        };
      case "prism_flux":
        return {
          type: "gradient",
          orientation: ["0%", "0%", "100%", "100%"],
          stops: [
            { offset: "0%", color: lighten(base.bodyPrimary, 0.55) },
            { offset: "45%", color: lighten(base.attachmentSecondary, 0.35) },
            { offset: "100%", color: base.attachmentSecondary }
          ],
          opacity: 0.68,
          extras: "facet"
        };
      case "ember_strata":
        return {
          type: "bands",
          colors: [
            lighten(base.bodyPrimary, 0.45),
            lighten(base.bodySecondary, 0.25),
            darken(base.bodySecondary, 0.18)
          ],
          angle: -18,
          opacity: 0.7
        };
      case "ion_tessellate":
      case "ion_glaze":
        return {
          type: "grid",
          colors: [
            lighten(base.attachmentSecondary, 0.6),
            lighten(base.bodySecondary, 0.25),
            darken(base.bodySecondary, 0.35)
          ],
          opacity: 0.68,
          grid: 48
        };
      case "aurora_matrix":
        return {
          type: "nebula",
          orbs: [
            { cx: 260, cy: 114, r: 96, color: lighten(base.bodySecondary, 0.65), opacity: 0.55 },
            { cx: 380, cy: 156, r: 110, color: lighten(base.attachmentSecondary, 0.58), opacity: 0.45 },
            { cx: 452, cy: 108, r: 82, color: lighten(base.attachmentPrimary, 0.4), opacity: 0.35 }
          ],
          opacity: 0.65
        };
      case "nebula_glass":
        return {
          type: "nebula",
          orbs: [
            { cx: 240, cy: 120, r: 88, color: lighten(base.bodySecondary, 0.7), opacity: 0.55 },
            { cx: 364, cy: 150, r: 120, color: lighten(base.attachmentSecondary, 0.62), opacity: 0.5 },
            { cx: 440, cy: 112, r: 84, color: lighten(base.attachmentPrimary, 0.48), opacity: 0.38 }
          ],
          opacity: 0.7,
          extras: "glass"
        };
      case "vapor_trace":
      case "phase_shift":
        return {
          type: "gradient",
          orientation: ["0%", "100%", "100%", "0%"],
          stops: [
            { offset: "0%", color: lighten(base.bodyPrimary, 0.4) },
            { offset: "60%", color: lighten(base.attachmentSecondary, 0.55) },
            { offset: "100%", color: darken(base.bodySecondary, 0.15) }
          ],
          opacity: 0.6,
          extras: "stream"
        };
      case "urban_mesh":
      case "fiber_wave":
        return {
          type: "grid",
          colors: [
            lighten(base.bodyPrimary, 0.3),
            lighten(base.bodySecondary, 0.12),
            darken(base.bodySecondary, 0.32)
          ],
          opacity: 0.55,
          grid: 36
        };
      case "midnight_line":
        return {
          type: "bands",
          colors: [
            lighten(base.bodySecondary, 0.35),
            darken(base.bodySecondary, 0.2),
            lighten(base.bodyPrimary, 0.15)
          ],
          angle: -10,
          opacity: 0.6,
          extras: "pulse"
        };
      case "field_classic":
      case "steel_ridge":
        return {
          type: "bands",
          colors: [
            lighten(base.bodyPrimary, 0.45),
            lighten(base.bodySecondary, 0.25),
            darken(base.bodySecondary, 0.2)
          ],
          angle: -22,
          opacity: 0.65
        };
      case "matte_guard":
        return {
          type: "gradient",
          orientation: ["0%", "0%", "100%", "0%"],
          stops: [
            { offset: "0%", color: lighten(base.bodyPrimary, 0.25) },
            { offset: "50%", color: base.bodySecondary },
            { offset: "100%", color: darken(base.bodySecondary, 0.18) }
          ],
          opacity: 0.45
        };
      case "diamond_veil":
        return {
          type: "diamond",
          colors: [
            lighten(base.bodyPrimary, 0.65),
            lighten(base.attachmentSecondary, 0.55),
            "#ffffff"
          ],
          opacity: 0.78
        };
      default:
        return {
          type: "gradient",
          orientation: ["0%", "0%", "100%", "0%"],
          stops: [
            { offset: "0%", color: lighten(base.bodyPrimary, 0.45) },
            { offset: "60%", color: base.bodySecondary },
            { offset: "100%", color: darken(base.bodySecondary, 0.22) }
          ],
          opacity: 0.55
        };
    }
  }

  function buildTemplateAssets(info, uniq, base, derived, bodyClipId){
    if (!info.template) {
      return { defs: "", overlay: "" };
    }
    const preset = templatePreset(info.template, base);
    const overlayId = `tmpl-${uniq}`;
    let defs = "";
    let overlay = "";

    if (!preset || preset.type === "none") {
      return { defs: "", overlay: "" };
    }

    if (preset.type === "gradient") {
      const [x1, y1, x2, y2] = preset.orientation || ["0%", "0%", "100%", "100%"];
      defs += `<linearGradient id="${overlayId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
        preset.stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`).join("") +
        "</linearGradient>";
      overlay += `<g class="m7-template m7-template--gradient" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${overlayId})" opacity="${preset.opacity ?? 0.58}"/></g>`;
      if (preset.extras === "facet") {
        overlay += `<g class="m7-template m7-template--facet" clip-path="url(#${bodyClipId})">` +
          `<polygon points="240,110 360,86 420,104 298,150" fill="${lighten(base.attachmentSecondary, 0.65)}" opacity="0.25"/>` +
          `<polygon points="320,100 448,82 500,118 352,160" fill="${lighten(base.bodySecondary, 0.55)}" opacity="0.18"/>` +
        "</g>";
      }
      if (preset.extras === "stream") {
        overlay += `<g class="m7-template m7-template--stream" clip-path="url(#${bodyClipId})">` +
          `<path d="M212 126 C280 92 420 80 508 122" stroke="${lighten(base.attachmentSecondary, 0.7, 0.6)}" stroke-width="6" stroke-linecap="round" opacity="0.32"/>` +
          `<path d="M220 146 C312 112 436 102 504 134" stroke="${lighten(base.bodySecondary, 0.5, 0.5)}" stroke-width="4" stroke-linecap="round" opacity="0.28"/>` +
        "</g>";
      }
    } else if (preset.type === "bands") {
      const patternId = `${overlayId}-pattern`;
      const angle = preset.angle || -20;
      defs += `<pattern id="${patternId}" width="80" height="36" patternUnits="userSpaceOnUse" patternTransform="skewX(${angle})">` +
        `<rect x="0" y="0" width="80" height="12" fill="${preset.colors[0]}" opacity="0.8"/>` +
        `<rect x="0" y="12" width="80" height="12" fill="${preset.colors[1]}" opacity="0.6"/>` +
        `<rect x="0" y="24" width="80" height="12" fill="${preset.colors[2]}" opacity="0.45"/>` +
      "</pattern>";
      overlay += `<g class="m7-template m7-template--bands" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${patternId})" opacity="${preset.opacity ?? 0.62}"/></g>`;
      if (preset.extras === "pulse") {
        overlay += `<g class="m7-template m7-template--pulse" clip-path="url(#${bodyClipId})">` +
          `<path d="M226 128 L460 100" stroke="${lighten(base.bodySecondary, 0.55, 0.7)}" stroke-width="3" stroke-linecap="round" stroke-dasharray="18 10" opacity="0.5"/>` +
        "</g>";
      }
    } else if (preset.type === "grid") {
      const patternId = `${overlayId}-grid`;
      const size = preset.grid || 40;
      defs += `<pattern id="${patternId}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">` +
        `<rect x="0" y="0" width="${size}" height="${size}" fill="${preset.colors[2]}" opacity="0.35"/>` +
        `<path d="M0 ${size/2} L${size} ${size/2}" stroke="${preset.colors[0]}" stroke-width="2" opacity="0.55"/>` +
        `<path d="M${size/2} 0 L${size/2} ${size}" stroke="${preset.colors[1]}" stroke-width="2" opacity="0.45"/>` +
        `<path d="M0 0 L${size} ${size}" stroke="${preset.colors[0]}" stroke-width="1.5" opacity="0.35"/>` +
      "</pattern>";
      overlay += `<g class="m7-template m7-template--grid" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${patternId})" opacity="${preset.opacity ?? 0.6}"/></g>`;
    } else if (preset.type === "nebula") {
      overlay += `<g class="m7-template m7-template--nebula" clip-path="url(#${bodyClipId})">` +
        preset.orbs.map(o => `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${o.color}" opacity="${o.opacity}"/>`).join("") +
      "</g>";
      if (preset.extras === "glass") {
        overlay += `<g class="m7-template m7-template--glass" clip-path="url(#${bodyClipId})">` +
          `<path d="M220 110 C300 80 420 74 500 118" stroke="${lighten(base.attachmentSecondary, 0.75, 0.6)}" stroke-width="5" opacity="0.35" stroke-linecap="round"/>` +
        "</g>";
      }
    } else if (preset.type === "diamond") {
      const patternId = `${overlayId}-diamond`;
      defs += `<pattern id="${patternId}" width="32" height="18" patternUnits="userSpaceOnUse" patternTransform="skewX(-18)">` +
        `<polygon points="0,9 8,0 16,9 8,18" fill="${preset.colors[0]}" opacity="0.7"/>` +
        `<polygon points="16,9 24,0 32,9 24,18" fill="${preset.colors[1]}" opacity="0.55"/>` +
      "</pattern>";
      overlay += `<g class="m7-template m7-template--diamond" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${patternId})" opacity="${preset.opacity ?? 0.75}"/></g>`;
    } else if (preset.type === "brushed") {
      const patternId = `${overlayId}-brushed`;
      const angle = preset.angle || -12;
      const baseTone = preset.colors?.[1] || lighten(base.bodySecondary, 0.2);
      const highlight = preset.colors?.[0] || lighten(base.bodySecondary, 0.45);
      const shadow = preset.colors?.[2] || darken(base.bodySecondary, 0.3);
      defs += `<pattern id="${patternId}" width="140" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">` +
        `<rect x="0" y="0" width="140" height="6" fill="${baseTone}" opacity="${preset.opacity ?? 0.7}"/>` +
        `<rect x="0" y="0" width="140" height="2" fill="${highlight}" opacity="0.55"/>` +
        `<rect x="0" y="3" width="140" height="1" fill="${shadow}" opacity="0.45"/>` +
        `<rect x="0" y="5" width="140" height="1" fill="${highlight}" opacity="0.3"/>` +
      "</pattern>";
      overlay += `<g class="m7-template m7-template--brushed" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${patternId})" opacity="1"/></g>`;
    } else if (preset.type === "laser") {
      const gradId = `${overlayId}-laser`;
      defs += `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        (preset.stops || []).map(s => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`).join("") +
      "</linearGradient>";
      overlay += `<g class="m7-template m7-template--laser" clip-path="url(#${bodyClipId})"><path d="${PATHS.bodyPanel}" fill="url(#${gradId})" opacity="${preset.opacity ?? 0.72}"/></g>`;
      if (preset.streaks) {
        const accent = preset.accent || lighten(base.attachmentSecondary, 0.85, 0.75);
        overlay += `<g class="m7-template m7-template--laser-streaks" clip-path="url(#${bodyClipId})">` +
          `<path d="M228 124 C312 94 448 90 520 126" stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.35"/>` +
          `<path d="M236 150 C332 118 462 108 512 140" stroke="${lighten(accent, 0.1, 0.6)}" stroke-width="4" stroke-linecap="round" opacity="0.3"/>` +
        "</g>";
      }
    }

    if (info.hidden) {
      overlay += `<g class="m7-template-hidden" clip-path="url(#${bodyClipId})">` +
        DIAMOND_SPARKS.map(s => `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${derived.sparkStrong}" opacity="0.75"/>`).join("") +
      "</g>";
    }

    return { defs, overlay };
  }

  function buildEffectLayers(effects, uniq, base, derived, bodyClipId){
    const set = new Set(effects || []);
    let defs = "";
    let overlay = "";

    if (set.has("sheen")) {
      const sheenId = `effect-sheen-${uniq}`;
      defs += `<linearGradient id="${sheenId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="rgba(255,255,255,0)"/>` +
        `<stop offset="50%" stop-color="${lighten(base.bodySecondary, 0.75, 0.85)}" stop-opacity="0.85"/>` +
        `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
      "</linearGradient>";
      overlay += `<g class="m7-effect m7-effect--sheen" clip-path="url(#${bodyClipId})"><rect x="200" y="86" width="340" height="120" fill="url(#${sheenId})"/></g>`;
    }

    if (set.has("sparkle")) {
      const sparkleId = `effect-spark-${uniq}`;
      defs += `<radialGradient id="${sparkleId}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${derived.sparkStrong}" stop-opacity="0.9"/>` +
        `<stop offset="100%" stop-color="${derived.sparkSoft}" stop-opacity="0"/>` +
      "</radialGradient>";
      overlay += `<g class="m7-effect m7-effect--sparkle" clip-path="url(#${bodyClipId})">` +
        DIAMOND_SPARKS.map(s => `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="url(#${sparkleId})"/>`).join("") +
      "</g>";
    }

    if (set.has("trail")) {
      const trailId = `effect-trail-${uniq}`;
      defs += `<linearGradient id="${trailId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${derived.accentGlow}" stop-opacity="0.85"/>` +
        `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
      "</linearGradient>";
      overlay += `<path class="m7-effect m7-effect--trail" d="M600 138 C636 146 664 140 688 134" stroke="url(#${trailId})" stroke-width="12" stroke-linecap="round" fill="none"/>`;
    }

    if (set.has("refraction")) {
      const refId = `effect-refract-${uniq}`;
      defs += `<linearGradient id="${refId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${derived.accentGlass}" stop-opacity="0.45"/>` +
        `<stop offset="100%" stop-color="${derived.accentGlow}" stop-opacity="0"/>` +
      "</linearGradient>";
      overlay += `<g class="m7-effect m7-effect--refraction" clip-path="url(#${bodyClipId})"><polygon points="220,100 470,70 520,124 300,172" fill="url(#${refId})" opacity="0.65"/></g>`;
    }

    if (set.has("bold_tracer")) {
      const tracerId = `effect-bold-${uniq}`;
      defs += `<linearGradient id="${tracerId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentSecondary, 0.75, 0.9)}" stop-opacity="0"/>` +
        `<stop offset="35%" stop-color="${lighten(base.attachmentSecondary, 0.65, 0.85)}" stop-opacity="0.85"/>` +
        `<stop offset="100%" stop-color="${lighten(base.bodySecondary, 0.45, 0.7)}" stop-opacity="0"/>` +
      "</linearGradient>";
      overlay += `<path class="m7-effect m7-effect--bold-tracer" d="M588 130 C636 128 684 120 722 110" stroke="url(#${tracerId})" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.85"/>`;
    }

    if (set.has("kill_counter")) {
      const counterId = `effect-counter-${uniq}`;
      defs += `<linearGradient id="${counterId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="rgba(20,24,36,0.9)"/>` +
        `<stop offset="100%" stop-color="rgba(48,56,72,0.9)"/>` +
      "</linearGradient>";
      overlay += `<g class="m7-effect m7-effect--kill-counter">` +
        `<rect x="420" y="96" width="68" height="32" rx="6" ry="6" fill="url(#${counterId})" stroke="${lighten(base.attachmentSecondary, 0.6)}" stroke-width="2" opacity="0.9"/>` +
        `<text x="454" y="118" fill="${lighten(base.attachmentSecondary, 0.85)}" font-size="14" font-family="'Orbitron', 'DIN', monospace" text-anchor="middle">K-99</text>` +
      "</g>";
    }

    return { defs, overlay };
  }

  function createSvg(info, base, derived){
    const uniq = Math.random().toString(36).slice(2, 9);
    const bodyGradientId = `body-${uniq}`;
    const sheenGradientId = `sheen-${uniq}`;
    const accentGradientId = `accent-${uniq}`;
    const accentEdgeId = `accent-edge-${uniq}`;
    const muzzleGradientId = `muzzle-${uniq}`;
    const glassGradientId = `glass-${uniq}`;
    const sparkGradientId = `spark-${uniq}`;
    const bodyDepthId = `body-depth-${uniq}`;
    const bodyEdgeId = `body-edge-${uniq}`;
    const stockGradientId = `stock-${uniq}`;
    const stockDetailId = `stock-detail-${uniq}`;
    const gripGradientId = `grip-${uniq}`;
    const gripDetailId = `grip-detail-${uniq}`;
    const ventGradientId = `vent-${uniq}`;
    const foreGradientId = `fore-${uniq}`;
    const barrelSteelId = `barrel-steel-${uniq}`;
    const magDetailId = `mag-detail-${uniq}`;
    const lensShineId = `lens-${uniq}`;
    const bodyClipId = `body-clip-${uniq}`;
    const foreClipId = `fore-clip-${uniq}`;
    const stockClipId = `stock-clip-${uniq}`;
    const gripClipId = `grip-clip-${uniq}`;
    const magClipId = `mag-clip-${uniq}`;

    const template = buildTemplateAssets(info, uniq, base, derived, bodyClipId);
    const effects = buildEffectLayers(info.effects, uniq, base, derived, bodyClipId);

    const defs = [
      `<linearGradient id="${bodyGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${base.bodyPrimary}"/>` +
        `<stop offset="55%" stop-color="${base.bodySecondary}"/>` +
        `<stop offset="100%" stop-color="${derived.bodyTail}"/>` +
      "</linearGradient>",
      `<linearGradient id="${bodyDepthId}" x1="8%" y1="20%" x2="92%" y2="80%">` +
        `<stop offset="0%" stop-color="${lighten(base.bodyPrimary, 0.35)}" stop-opacity="0.95"/>` +
        `<stop offset="55%" stop-color="${lighten(base.bodySecondary, 0.18)}" stop-opacity="0.7"/>` +
        `<stop offset="100%" stop-color="${darken(base.bodySecondary, 0.28)}" stop-opacity="0.55"/>` +
      "</linearGradient>",
      `<linearGradient id="${bodyEdgeId}" x1="0%" y1="0%" x2="0%" y2="100%">` +
        `<stop offset="0%" stop-color="${lighten(base.bodySecondary, 0.42)}" stop-opacity="0.8"/>` +
        `<stop offset="100%" stop-color="${darken(base.bodyPrimary, 0.42)}" stop-opacity="0.65"/>` +
      "</linearGradient>",
      `<linearGradient id="${sheenGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${derived.bodySheen}" stop-opacity="0.9"/>` +
        `<stop offset="45%" stop-color="${derived.bodyHighlight}" stop-opacity="0.7"/>` +
        `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
      "</linearGradient>",
      `<linearGradient id="${accentGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${derived.accentPrimary}"/>` +
        `<stop offset="100%" stop-color="${derived.accentSecondary}"/>` +
      "</linearGradient>",
      `<linearGradient id="${accentEdgeId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${derived.accentHighlight}"/>` +
        `<stop offset="100%" stop-color="${derived.accentShadow}"/>` +
      "</linearGradient>",
      `<linearGradient id="${stockGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${darken(base.bodyPrimary, 0.25)}"/>` +
        `<stop offset="60%" stop-color="${base.bodyPrimary}"/>` +
        `<stop offset="100%" stop-color="${lighten(base.bodySecondary, 0.18)}"/>` +
      "</linearGradient>",
      `<linearGradient id="${stockDetailId}" x1="0%" y1="0%" x2="0%" y2="100%">` +
        `<stop offset="0%" stop-color="${lighten(base.bodySecondary, 0.5)}" stop-opacity="0.6"/>` +
        `<stop offset="100%" stop-color="${darken(base.bodyPrimary, 0.4)}" stop-opacity="0.0"/>` +
      "</linearGradient>",
      `<linearGradient id="${gripGradientId}" x1="20%" y1="0%" x2="80%" y2="100%">` +
        `<stop offset="0%" stop-color="${darken(base.attachmentPrimary, 0.35)}"/>` +
        `<stop offset="60%" stop-color="${base.attachmentPrimary}"/>` +
        `<stop offset="100%" stop-color="${lighten(base.attachmentSecondary, 0.28)}"/>` +
      "</linearGradient>",
      `<linearGradient id="${gripDetailId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentSecondary, 0.55)}" stop-opacity="0.85"/>` +
        `<stop offset="100%" stop-color="${darken(base.attachmentPrimary, 0.5)}" stop-opacity="0.4"/>` +
      "</linearGradient>",
      `<linearGradient id="${ventGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentSecondary, 0.45)}" stop-opacity="0.8"/>` +
        `<stop offset="100%" stop-color="${darken(base.attachmentPrimary, 0.45)}" stop-opacity="0.6"/>` +
      "</linearGradient>",
      `<linearGradient id="${foreGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentPrimary, 0.25)}" stop-opacity="0.85"/>` +
        `<stop offset="100%" stop-color="${darken(base.attachmentPrimary, 0.4)}" stop-opacity="0.7"/>` +
      "</linearGradient>",
      `<linearGradient id="${barrelSteelId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
        `<stop offset="0%" stop-color="${darken(base.attachmentPrimary, 0.45)}" stop-opacity="0.8"/>` +
        `<stop offset="100%" stop-color="${lighten(base.attachmentSecondary, 0.4)}" stop-opacity="0.45"/>` +
      "</linearGradient>",
      `<linearGradient id="${magDetailId}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentSecondary, 0.4)}" stop-opacity="0.9"/>` +
        `<stop offset="100%" stop-color="${darken(base.attachmentPrimary, 0.35)}" stop-opacity="0.4"/>` +
      "</linearGradient>",
      `<radialGradient id="${muzzleGradientId}" cx="0%" cy="50%" r="120%">` +
        `<stop offset="0%" stop-color="${derived.muzzleHeat}" stop-opacity="0.85"/>` +
        `<stop offset="90%" stop-color="${derived.muzzleHeat}" stop-opacity="0"/>` +
      "</radialGradient>",
      `<radialGradient id="${glassGradientId}" cx="30%" cy="45%" r="90%">` +
        `<stop offset="0%" stop-color="${derived.accentGlass}" stop-opacity="0.95"/>` +
        `<stop offset="75%" stop-color="${derived.accentGlow}" stop-opacity="0.3"/>` +
        `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
      "</radialGradient>",
      `<radialGradient id="${sparkGradientId}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${derived.sparkStrong}" stop-opacity="0.75"/>` +
        `<stop offset="100%" stop-color="${derived.sparkSoft}" stop-opacity="0"/>` +
      "</radialGradient>",
      `<radialGradient id="${lensShineId}" cx="45%" cy="40%" r="65%">` +
        `<stop offset="0%" stop-color="${lighten(base.attachmentSecondary, 0.65)}" stop-opacity="0.9"/>` +
        `<stop offset="70%" stop-color="${lighten(base.attachmentSecondary, 0.2)}" stop-opacity="0.2"/>` +
        `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
      "</radialGradient>",
      `<clipPath id="${bodyClipId}"><path d="${PATHS.body}"/></clipPath>`,
      `<clipPath id="${foreClipId}"><path d="${PATHS.fore}"/></clipPath>`,
      `<clipPath id="${stockClipId}"><path d="${PATHS.stock}"/></clipPath>`,
      `<clipPath id="${gripClipId}"><path d="${PATHS.grip}"/></clipPath>`,
      `<clipPath id="${magClipId}"><path d="${PATHS.mag}"/></clipPath>`,
      template.defs,
      effects.defs
    ].join("");

    const screws = SCREWS.map(s => `<circle cx="${s.cx}" cy="${s.cy}" r="4.2" fill="${derived.detailShadow}" stroke="${derived.bodyHighlight}" stroke-width="1.6" opacity="0.85"/>`).join("");
    const sparks = SPARK_POINTS.map(p => `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="url(#${sparkGradientId})" opacity="0.35"/>`).join("");
    const railTeeth = RAIL_TEETH.map(t => `<rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" rx="1.6" fill="${darken(base.attachmentPrimary, 0.45)}" stroke="${lighten(base.attachmentSecondary, 0.4)}" stroke-width="0.8" opacity="0.65"/>`).join("");
    const railGrooves = RAIL_GROOVES.map(g => `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${darken(base.attachmentPrimary, 0.45)}" stroke-width="2" opacity="0.55"/>`).join("");
    const foreSlots = FORE_VENTS.map(v => `
        <g opacity="0.75">
          <rect x="${v.x}" y="${v.y}" width="${v.width}" height="${v.height}" rx="3.2" fill="${darken(base.attachmentPrimary, 0.55)}"/>
          <rect x="${v.x + 3}" y="${v.y + 3}" width="${Math.max(0, v.width - 6)}" height="${Math.max(0, v.height - 6)}" rx="2.4" fill="${lighten(base.attachmentSecondary, 0.55, 0.35)}"/>
        </g>`).join("");
    const forePlates = FORE_PLATES.map((d, i) => `<path d="${d}" fill="${lighten(base.attachmentSecondary, 0.35 + i * 0.08)}" opacity="0.5"/>`).join("");
    const barrelRings = BARREL_RINGS.map((r, idx) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${idx % 2 ? lighten(base.attachmentSecondary, 0.25) : darken(base.attachmentPrimary, 0.35)}" opacity="0.7"/>`).join("");
    const muzzleLines = MUZZLE_LINES.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${lighten(base.attachmentSecondary, 0.45)}" stroke-width="2" opacity="0.6"/>`).join("");
    const gripRidges = GRIP_RIDGES.map(r => `<path d="M${r.x1} ${r.y1} L${r.x2} ${r.y2}" stroke="${darken(base.attachmentPrimary, 0.4)}" stroke-width="3.4" stroke-linecap="round" opacity="0.4"/>`).join("");
    const magRivets = MAG_RIVETS.map(p => `<circle cx="${p.cx}" cy="${p.cy}" r="2.6" fill="${darken(base.attachmentPrimary, 0.45)}" stroke="${lighten(base.attachmentSecondary, 0.45)}" stroke-width="1" opacity="0.8"/>`).join("");
    const magLines = MAG_LINES.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${darken(base.attachmentPrimary, 0.45)}" stroke-width="2" opacity="0.55"/>`).join("");
    const stockRibs = STOCK_RIBS.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${lighten(base.bodySecondary, 0.4, 0.6)}" stroke-width="3" opacity="0.5"/>`).join("");
    const foreLines = FORE_LINES.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${lighten(base.attachmentSecondary, 0.45)}" stroke-width="2.4" opacity="0.45"/>`).join("");
    const scopeLines = SCOPE_LINES.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${lighten(base.attachmentSecondary, 0.55)}" stroke-width="2.4" opacity="0.55"/>`).join("");
    const bodyLines = BODY_LINES.map(d => `<path d="${d}" fill="none" stroke="${lighten(base.bodySecondary, 0.38)}" stroke-width="2.2" opacity="0.45"/>`).join("");
    const bodyPlates = BODY_PLATES.map((d, i) => `<path d="${d}" fill="${i === 0 ? lighten(base.bodySecondary, 0.4) : lighten(base.bodySecondary, 0.25 + i * 0.12)}" opacity="0.35"/>`).join("");
    const housingLines = BODY_HOUSING_LINES.map(line => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${darken(base.bodyPrimary, 0.35)}" stroke-width="2" opacity="0.42"/>`).join("");
    const bodyGrooves = BODY_GROOVES.map(d => `<path d="${d}" fill="none" stroke="${darken(base.bodyPrimary, 0.3)}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>`).join("");
    const detailDots = DETAIL_DOTS.map(dot => `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${darken(base.bodyPrimary, 0.45)}" opacity="0.65"/>`).join("");
    const panelGlow = lighten(base.bodySecondary, 0.55, 0.22);

    const stockEdge = darken(base.bodyPrimary, 0.55);
    const stockHighlight = lighten(base.bodySecondary, 0.45, 0.55);
    const gripShadow = darken(base.attachmentPrimary, 0.6);
    const muzzleCapColor = darken(base.attachmentPrimary, 0.45);

    const aria = `${info.templateLabel} · ${info.effectsLabel}${info.hidden ? " · 隐藏模板" : ""}`;

    return `
      <svg class="skin-preview__svg" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(aria)}">
        <defs>${defs}</defs>
        <g class="m7-shadow"><ellipse cx="320" cy="192" rx="228" ry="26" fill="rgba(0,0,0,0.38)"/></g>
        <g class="m7-stock">
          <path d="${PATHS.stock}" fill="url(#${stockGradientId})" stroke="${stockEdge}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${stockClipId})">
            <path d="${PATHS.stockPanel}" fill="url(#${stockDetailId})" opacity="0.85"/>
            <path d="${PATHS.stockCore}" fill="${stockHighlight}" opacity="0.28"/>
            <path d="${PATHS.stockSpine}" fill="${lighten(base.bodySecondary, 0.42, 0.45)}" opacity="0.35"/>
            <path d="${PATHS.stockEdge}" fill="${darken(base.bodyPrimary, 0.5)}" opacity="0.22"/>
          </g>
          <path d="${PATHS.stockButt}" fill="${stockEdge}" opacity="0.45"/>
          <g class="m7-stock-ribs">${stockRibs}</g>
        </g>
        <g class="m7-body">
          <path d="${PATHS.body}" fill="url(#${bodyGradientId})" stroke="${derived.bodyShadow}" stroke-width="4" stroke-linejoin="round"/>
          <path d="${PATHS.bodyInset}" fill="url(#${bodyDepthId})" opacity="0.9"/>
          <path d="${PATHS.bodyPanel}" fill="url(#${sheenGradientId})" opacity="0.65"/>
          <path d="${PATHS.bodyCut}" fill="url(#${bodyEdgeId})" opacity="0.65"/>
          <path d="${PATHS.bodyLower}" fill="${darken(base.bodyPrimary, 0.25)}" opacity="0.35"/>
          <path d="${PATHS.bodyVentPanel}" fill="${lighten(base.bodySecondary, 0.35)}" opacity="0.35"/>
          <path d="${PATHS.bodyRidge}" fill="${lighten(base.bodySecondary, 0.18)}" opacity="0.25"/>
          <path d="${PATHS.upper}" fill="${derived.bodyHighlight}" opacity="0.24"/>
          <path d="${PATHS.vent}" fill="url(#${ventGradientId})" opacity="0.5"/>
          <path d="${PATHS.ventTop}" fill="${lighten(base.bodySecondary, 0.35)}" opacity="0.45"/>
          <path d="${PATHS.ejectionPort}" fill="${darken(base.bodyPrimary, 0.4)}" stroke="${derived.bodyHighlight}" stroke-width="1.5" opacity="0.82"/>
          <path d="${PATHS.chargingHandle}" fill="${darken(base.bodyPrimary, 0.55)}" opacity="0.75"/>
          <path d="${PATHS.boltCarrier}" fill="${lighten(base.bodySecondary, 0.25)}" opacity="0.55"/>
          <path d="${PATHS.dustCover}" fill="${darken(base.bodyPrimary, 0.35)}" opacity="0.55"/>
          ${bodyPlates}
          ${housingLines}
          ${bodyGrooves}
          ${bodyLines}
          ${detailDots}
        </g>
        <g class="m7-rail">
          <path d="${PATHS.railShadow}" fill="${darken(base.attachmentPrimary, 0.55)}" opacity="0.28"/>
          <path d="${PATHS.rail}" fill="url(#${accentGradientId})" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.railInset}" fill="${derived.accentHighlight}" opacity="0.5"/>
          <path d="${PATHS.railStep}" fill="${darken(base.attachmentPrimary, 0.4)}" opacity="0.25"/>
          <g class="m7-rail-teeth">${railTeeth}</g>
          <g class="m7-rail-grooves">${railGrooves}</g>
        </g>
        <g class="m7-scope">
          <path d="${PATHS.scopeMount}" fill="${derived.scopeMetal}" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.scopeBracket}" fill="${darken(base.attachmentPrimary, 0.45)}" opacity="0.55"/>
          <path d="${PATHS.scopeBody}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.scopeDetail}" fill="${lighten(base.attachmentSecondary, 0.35)}" opacity="0.4"/>
          <path d="${PATHS.scopeRing}" fill="${derived.accentHighlight}" opacity="0.65"/>
          <path d="${PATHS.scopeKnob}" fill="${darken(base.attachmentPrimary, 0.35)}" stroke="${derived.accentHighlight}" stroke-width="1.8" opacity="0.7"/>
          <path d="${PATHS.scopeGlass}" fill="url(#${glassGradientId})" opacity="0.92"/>
          <circle cx="318" cy="64" r="12" fill="url(#${lensShineId})" opacity="0.8"/>
          <g class="m7-scope-lines">${scopeLines}</g>
        </g>
        <g class="m7-bolt">
          <path d="${PATHS.bolt}" fill="${derived.accentHighlight}" stroke="${derived.bodyShadow}" stroke-width="3" stroke-linejoin="round" opacity="0.82"/>
          <path d="${PATHS.boltRail}" fill="${darken(base.bodyPrimary, 0.45)}" opacity="0.6"/>
        </g>
        <g class="m7-body-detail" clip-path="url(#${bodyClipId})">
          <rect x="214" y="112" width="238" height="66" fill="${panelGlow}" opacity="0.16"/>
        </g>
        <g class="m7-fore" clip-path="url(#${foreClipId})">
          <path d="${PATHS.fore}" fill="url(#${accentGradientId})"/>
          <path d="${PATHS.foreChamfer}" fill="url(#${foreGradientId})" opacity="0.6"/>
          <path d="${PATHS.foreRail}" fill="${darken(base.attachmentPrimary, 0.3)}" opacity="0.35"/>
          <path d="${PATHS.foreLower}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.55"/>
          <path d="${PATHS.foreSlots}" fill="${darken(base.attachmentPrimary, 0.25)}" opacity="0.18"/>
          ${foreSlots}
          ${forePlates}
          <path d="${PATHS.fore}" fill="none" stroke="${derived.accentShadow}" stroke-width="4"/>
          <g class="m7-fore-lines">${foreLines}</g>
        </g>
        <g class="m7-mag">
          <path d="${PATHS.mag}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${magClipId})">
            <path d="${PATHS.magLight}" fill="url(#${magDetailId})" opacity="0.9"/>
            <path d="${PATHS.magWindow}" fill="${lighten(base.attachmentSecondary, 0.48)}" opacity="0.4"/>
          </g>
          <path d="${PATHS.magPlate}" fill="${darken(base.attachmentPrimary, 0.45)}" opacity="0.72"/>
          <path d="${PATHS.magLatch}" fill="${darken(base.attachmentPrimary, 0.55)}" opacity="0.82"/>
          ${magLines}
          ${magRivets}
        </g>
        <g class="m7-grip">
          <path d="${PATHS.grip}" fill="url(#${gripGradientId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${gripClipId})">
            <path d="${PATHS.gripFront}" fill="url(#${gripDetailId})" opacity="0.78"/>
            <path d="${PATHS.gripInset}" fill="${darken(base.attachmentPrimary, 0.5)}" opacity="0.28"/>
          </g>
          <g class="m7-grip-ridges">${gripRidges}</g>
        </g>
        <g class="m7-trigger">
          <path d="${PATHS.triggerGuard}" fill="${gripShadow}" stroke="${derived.accentShadow}" stroke-width="2.4" stroke-linejoin="round" opacity="0.82"/>
          <path d="${PATHS.trigger}" fill="${derived.accentShadow}" stroke="${derived.accentHighlight}" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>
          <path d="${PATHS.triggerCut}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.42"/>
        </g>
        <g class="m7-barrel">
          <path d="${PATHS.barrel}" fill="url(#${accentGradientId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <path d="${PATHS.barrelBottom}" fill="url(#${barrelSteelId})" opacity="0.65"/>
          <path d="${PATHS.barrelTop}" fill="${derived.accentHighlight}" opacity="0.5"/>
          <path d="${PATHS.barrelRidge}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.4"/>
          ${barrelRings}
        </g>
        <g class="m7-muzzle">
          <path d="${PATHS.muzzle}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <path d="${PATHS.muzzleCap}" fill="${muzzleCapColor}" opacity="0.6"/>
          <path d="${PATHS.muzzleCore}" fill="${derived.muzzleCore}" opacity="0.85"/>
          <path d="${PATHS.muzzleVent}" fill="${lighten(base.attachmentSecondary, 0.45)}" opacity="0.38"/>
          ${muzzleLines}
          <path d="${PATHS.muzzle}" fill="url(#${muzzleGradientId})" opacity="0.55"/>
        </g>
        <g class="m7-lines">
          <path d="${PATHS.bodyPanel}" fill="none" stroke="${derived.detailLine}" stroke-width="3" stroke-linejoin="round" opacity="0.6"/>
          <path d="${PATHS.bodyMid}" fill="none" stroke="${derived.detailShadow}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
          <path d="${PATHS.bodyCut}" fill="none" stroke="${derived.detailShadow}" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>
        </g>
        <g class="m7-screws">${screws}</g>
        ${template.overlay}
        <g class="m7-sparks">${sparks}</g>
        ${effects.overlay}
      </svg>
    `;
  }

  function describe(visual){
    const v = visual || {};
    const bodyRaw = ensureArray(v.body).map(normalizeColor).filter(Boolean);
    const attachRaw = ensureArray(v.attachments).map(normalizeColor).filter(Boolean);
    const templateKey = v.template ? String(v.template).toLowerCase() : "";
    const effectsRaw = ensureArray(v.effects).map(e => String(e || "").toLowerCase()).filter(Boolean);

    return {
      bodyColors: bodyRaw.length ? bodyRaw : [DEFAULT_COLOR],
      attachmentColors: attachRaw.length ? attachRaw : [DEFAULT_COLOR],
      template: templateKey,
      templateLabel: templateKey ? (TEMPLATE_LABELS[templateKey] || templateKey) : "无模板",
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

    const width = opts.width || (opts.compact ? 220 : 320);
    const height = opts.height || (opts.compact ? 78 : 110);
    const bodyPrimary = info.bodyColors[0] || DEFAULT_COLOR;
    const bodySecondary = info.bodyColors[1] || bodyPrimary;
    const attachPrimary = info.attachmentColors[0] || DEFAULT_COLOR;
    const attachSecondary = info.attachmentColors[1] || attachPrimary;
    const base = {
      bodyPrimary: bodyPrimary.hex,
      bodySecondary: bodySecondary.hex,
      attachmentPrimary: attachPrimary.hex,
      attachmentSecondary: attachSecondary.hex
    };
    const derived = {
      bodyTail: darken(base.bodySecondary, 0.25),
      bodyShadow: darken(base.bodyPrimary, 0.65),
      bodyHighlight: lighten(base.bodySecondary, 0.5),
      bodySheen: lighten(base.bodySecondary, 0.72, 0.85),
      accentPrimary: base.attachmentPrimary,
      accentSecondary: base.attachmentSecondary,
      accentHighlight: lighten(base.attachmentPrimary, 0.58),
      accentShadow: darken(base.attachmentPrimary, 0.55),
      accentSheen: lighten(base.attachmentSecondary, 0.72, 0.85),
      accentGlow: lighten(base.attachmentSecondary, 0.88, 0.62),
      accentGlass: lighten(base.attachmentSecondary, 0.85, 0.52),
      muzzleHeat: lighten(base.attachmentPrimary, 0.65, 0.78),
      muzzleCore: darken(base.attachmentPrimary, 0.1),
      sparkSoft: lighten(base.bodySecondary, 0.85, 0.45),
      sparkStrong: lighten(base.bodySecondary, 0.95, 0.85),
      templateBright: lighten(base.bodySecondary, 0.65),
      templateDark: darken(base.bodySecondary, 0.35),
      scopeMetal: darken(base.attachmentPrimary, 0.25),
      detailLine: lighten(base.bodySecondary, 0.6),
      detailShadow: darken(base.bodyPrimary, 0.35)
    };
    const canvasClasses = ["skin-preview__canvas"];
    if (info.template) {
      canvasClasses.push(`tpl-${info.template}`);
    } else {
      canvasClasses.push("tpl-none");
    }
    const canvasStyle = [
      `--preview-width:${width}px`,
      `--preview-height:${height}px`,
      `--body-primary:${base.bodyPrimary}`,
      `--body-secondary:${base.bodySecondary}`,
      `--body-shadow:${derived.bodyShadow}`,
      `--body-highlight:${derived.bodyHighlight}`,
      `--accent-primary:${base.attachmentPrimary}`,
      `--accent-secondary:${base.attachmentSecondary}`,
      `--accent-highlight:${derived.accentHighlight}`,
      `--accent-shadow:${derived.accentShadow}`,
      `--accent-glow:${derived.accentGlow}`,
      `--detail-line:${derived.detailLine}`,
      `--detail-shadow:${derived.detailShadow}`,
      `--spark-soft:${derived.sparkSoft}`,
      `--spark-strong:${derived.sparkStrong}`,
      `--template-bright:${derived.templateBright}`,
      `--template-dark:${derived.templateDark}`,
      `--glass-tone:${derived.accentGlass}`
    ].join(';');
    const containerStyle = `--preview-width:${width}px; --preview-height:${height}px;`;
    const label = opts.label ? `<div class="skin-preview__label">${esc(opts.label)}</div>` : "";
    const metaText = opts.meta === false ? "" : (opts.meta || formatMeta(visual));
    const meta = metaText ? `<div class="skin-preview__meta">${esc(metaText)}</div>` : "";

    const svg = createSvg(info, base, derived);

    return `
      <div class="${classes.join(' ')}" style="${containerStyle}">
        <div class="${canvasClasses.join(' ')}" style="${canvasStyle}">
          ${svg}
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
    templateLabel: (key) => {
      const k = String(key || "").toLowerCase();
      if (!k) return "无模板";
      return TEMPLATE_LABELS[k] || k;
    },
    effectLabel: (key) => EFFECT_LABELS[String(key || "").toLowerCase()] || key,
  };
})();
