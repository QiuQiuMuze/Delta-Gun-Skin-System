(function(){
  const TEMPLATE_LABELS = {
    "brick_normal": "标准模板",
    "brick_white_diamond": "白钻切面",
    "brick_yellow_diamond": "黄钻切面",
    "brick_pink_diamond": "粉钻切面",
    "brick_brushed_metal": "金属拉丝",
    "brick_laser_gradient": "镭射渐变",
    "brick_prism_spectrum": "棱镜光谱",
    "brick_medusa_relic": "蛇神遗痕",
    "brick_arcade_crystal": "水晶贪吃蛇",
    "brick_arcade_serpent": "贪吃蛇",
    "brick_arcade_blackhawk": "黑鹰坠落",
    "brick_arcade_champion": "拳王",
    "brick_arcade_default": "普通模板",
    "brick_blade_royal": "王牌镶嵌",
    "brick_fate_blueberry": "蓝莓玉",
    "brick_fate_brass": "黄铜",
    "brick_fate_default": "正常模板",
    "brick_fate_gold": "黄金",
    "brick_fate_goldenberry": "金莓",
    "brick_fate_gradient": "渐变（色彩随机）",
    "brick_fate_jade": "翡翠绿",
    "brick_fate_metal": "金属拉丝",
    "brick_fate_strawberry": "草莓金",
    "brick_fate_whitepeach": "白桃",
    "brick_prism2_flux": "棱镜攻势2",
    "brick_weather_clathrate": "可燃冰",
    "brick_weather_default": "普通模板",
    "brick_weather_gradient": "气象渐变",
    "brick_weather_gundam": "高达气象",
    "brick_weather_purplebolt": "紫电",
    "brick_weather_redbolt": "红电",
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
    prism_flux: "棱镜流光",
    bold_tracer: "显眼曳光",
    kill_counter: "击杀计数",
    arcade_core: "街机核心",
    arcade_glass: "街机玻璃",
    arcade_glow: "街机辉光",
    arcade_pulse: "街机脉冲",
    arcade_trail: "街机拖尾",
    blade_glow: "王牌辉光",
    chromatic_flame: "彩焰",
    fate_glow: "命运辉光",
    fate_gradient: "命运渐变",
    medusa_glare: "美杜莎凝视",
    weather_bolt: "天气闪电",
    weather_frost: "气象霜华",
    weather_glow: "气象辉光",
    weather_gradient: "气象渐变"
  };

  const TEMPLATE_CLASS_MAP = {
    brick_normal: "tmpl-brick-normal",
    brick_white_diamond: "tmpl-brick-white",
    brick_yellow_diamond: "tmpl-brick-yellow",
    brick_pink_diamond: "tmpl-brick-pink",
    brick_brushed_metal: "tmpl-brick-brushed",
    brick_laser_gradient: "tmpl-brick-laser",
    brick_prism_spectrum: "tmpl-prism",
    brick_medusa_relic: "tmpl-urban",
    brick_arcade_crystal: "tmpl-aurora",
    brick_arcade_serpent: "tmpl-aurora",
    brick_arcade_blackhawk: "tmpl-urban",
    brick_arcade_champion: "tmpl-prism",
    brick_arcade_default: "tmpl-prism",
    brick_blade_royal: "tmpl-field",
    brick_fate_blueberry: "tmpl-field",
    brick_fate_brass: "tmpl-field",
    brick_fate_default: "tmpl-field",
    brick_fate_gold: "tmpl-field",
    brick_fate_goldenberry: "tmpl-field",
    brick_fate_gradient: "tmpl-laser",
    brick_fate_jade: "tmpl-field",
    brick_fate_metal: "tmpl-brick-brushed",
    brick_fate_strawberry: "tmpl-laser",
    brick_fate_whitepeach: "tmpl-prism",
    brick_prism2_flux: "tmpl-prism",
    brick_weather_clathrate: "tmpl-aurora",
    brick_weather_default: "tmpl-prism",
    brick_weather_gradient: "tmpl-laser",
    brick_weather_gundam: "tmpl-prism",
    brick_weather_purplebolt: "tmpl-prism",
    brick_weather_redbolt: "tmpl-ember",
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
    kill_counter: "effect-kill-counter",
    arcade_core: "effect-glow",
    arcade_glass: "effect-sheen",
    arcade_glow: "effect-glow",
    arcade_pulse: "effect-pulse",
    arcade_trail: "effect-trail",
    blade_glow: "effect-glow",
    chromatic_flame: "effect-sparkle",
    fate_glow: "effect-glow",
    fate_gradient: "effect-sheen",
    medusa_glare: "effect-glow",
    weather_bolt: "effect-trail",
    weather_frost: "effect-sheen",
    weather_glow: "effect-glow",
    weather_gradient: "effect-sheen"
  };

  const ATTRIBUTE_LABELS = {
    "affinity:weather:acid_rain": "酸雨",
    "affinity:weather:thunder": "雷电",
    "affinity:weather:flame": "火焰",
    "affinity:weather:frost": "冰霜"
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

  function rgbToHsl(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function resolveHueName(h){
    const table = [
      { max: 15, name: "猩红" },
      { max: 45, name: "暮橙" },
      { max: 75, name: "琥金" },
      { max: 105, name: "嫩绿" },
      { max: 135, name: "翠绿" },
      { max: 165, name: "青翠" },
      { max: 195, name: "湖蓝" },
      { max: 225, name: "霁蓝" },
      { max: 255, name: "靛青" },
      { max: 285, name: "暮紫" },
      { max: 315, name: "绛紫" },
      { max: 345, name: "玫红" },
      { max: 360, name: "猩红" }
    ];
    const hue = ((h % 360) + 360) % 360;
    for (const entry of table) {
      if (hue <= entry.max) return entry.name;
    }
    return "多彩";
  }

  function buildTonePrefix(s, l){
    if (s < 0.12) {
      if (l < 0.12) return "深邃";
      if (l < 0.25) return "玄";
      if (l < 0.4) return "暗";
      if (l < 0.6) return "中性";
      if (l < 0.78) return "浅";
      return "莹";
    }
    if (l < 0.2) return "深";
    if (l < 0.35) return "暗";
    if (l > 0.82) return "极浅";
    if (l > 0.65) return "浅";
    if (s > 0.65 && l > 0.5) return "亮";
    return "";
  }

  function grayscaleName(l){
    if (l < 0.08) return "墨黑";
    if (l < 0.18) return "夜黑";
    if (l < 0.32) return "玄灰";
    if (l < 0.5) return "石墨灰";
    if (l < 0.68) return "钛银";
    if (l < 0.82) return "月白";
    return "雪白";
  }

  function autoColorName(hex){
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const light = Math.max(0, Math.min(1, l));
    const sat = Math.max(0, Math.min(1, s));
    if (sat < 0.12) {
      return grayscaleName(light);
    }
    const tone = buildTonePrefix(sat, light);
    const base = resolveHueName(h);
    return `${tone ? tone : ""}${base}`;
  }

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
      return { hex, name: COLOR_LOOKUP[hex] || autoColorName(hex) };
    }
    const hex = sanitizeHex(entry.hex || entry.color || entry.value);
    let name = entry.name || entry.label || "";
    if (name) name = String(name).trim();
    if (!name || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)) {
      name = COLOR_LOOKUP[hex] || autoColorName(hex);
    }
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


const BASE_VARIANTS = {
  assault: { label: "突击步枪", transforms: {} },
  battle: {
    label: "战斗步枪",
    transforms: {
      stock: "translate(-10,0) scale(1.05,1)",
      body: "scale(1.02,1) translate(6,-2)",
      fore: "translate(12,-2)",
      barrel: "translate(24,-2) scale(1.12,1)",
      muzzle: "translate(28,-2) scale(1.08,1.05)",
      scope: "translate(4,-4)"
    },
    extras: {
      barrel: ({ base, darken }) => `<path d="520 118 L616 110 L624 118 L624 158 L520 150 Z" fill="${darken(base.attachmentPrimary, 0.38)}" opacity="0.42"/>`,
      muzzle: ({ base, lighten }) => `<path d="602 112 L642 112 L642 160 L602 160 Z" fill="${lighten(base.attachmentSecondary, 0.25)}" opacity="0.55"/>`
    }
  },
  vector: {
    label: "冲锋枪",
    hide: ["stock", "scope"],
    transforms: {
      body: "scale(0.82,0.9) translate(62,24)",
      fore: "scale(0.78,0.86) translate(96,46)",
      barrel: "scale(0.62,0.7) translate(218,90)",
      muzzle: "scale(0.6,0.65) translate(220,94)",
      grip: "translate(-36,18)",
      mag: "translate(12,14) scale(0.92,0.9)",
      rail: "scale(0.85) translate(66,34)",
      trigger: "translate(-14,8)"
    },
    extras: {
      grip: ({ base, darken }) => `<rect x="338" y="212" width="20" height="44" rx="6" fill="${darken(base.attachmentPrimary,0.35)}" opacity="0.78"/>`,
      body: ({ base, lighten }) => `<path d="M226 152 L344 136 L348 160 L232 180 Z" fill="${lighten(base.bodyPrimary, 0.25)}" opacity="0.32"/>`
    }
  },
  bullpup: {
    label: "无托步枪",
    transforms: {
      stock: "translate(22,0)",
      body: "translate(16,0)",
      fore: "translate(-34,0)",
      barrel: "translate(-26,0)",
      muzzle: "translate(-26,0)",
      grip: "translate(-70,0)",
      mag: "translate(-94,0)",
      trigger: "translate(-22,0)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M184 160 L272 126 L308 130 L300 182 L192 206 Z" fill="${lighten(base.bodySecondary, 0.18)}" opacity="0.32"/>`,
      stock: ({ base, lighten }) => `<path d="M68 188 L160 144 L188 148 L178 204 L104 228 L70 214 Z" fill="${lighten(base.bodyPrimary, 0.2)}" opacity="0.3"/>`
    }
  },
  futuristic: {
    label: "能量武器",
    transforms: {
      stock: "scale(1.08,0.94) translate(-12,-8)",
      body: "skewX(-4) scale(1.06,0.95) translate(16,-6)",
      fore: "scale(1.15,0.9) translate(20,-16)",
      barrel: "scale(1.18,1.05) translate(28,-12)",
      muzzle: "scale(1.16,1.12) translate(30,-12)",
      scope: "translate(14,-18) scale(1.12)",
      rail: "scale(1.05,0.96) translate(6,-8)",
      trigger: "translate(4,-2)"
    },
    extras: {
      body: ({ lighten }) => `<path d="M240 96 L520 62 L548 80 L336 148 Z" fill="${lighten('#3fa9f5', 0.1)}" opacity="0.18"/>`,
      effects: () => `<g class="m7-variant-energy"><path d="M420 126 C460 110 500 118 540 102" stroke="rgba(150,230,255,0.55)" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/><path d="M430 150 C470 134 502 142 544 128" stroke="rgba(120,200,255,0.45)" stroke-width="3" fill="none" stroke-dasharray="10 6"/></g>`
    },
    classes: ['skin-preview--futuristic']
  }
};

  function mergeVariantArrays(baseArr, extraArr) {
    const base = Array.isArray(baseArr) ? baseArr : [];
    const extras = Array.isArray(extraArr) ? extraArr : [];
    if (!extras.length) return base.slice();
    const set = new Set(base);
    extras.forEach(item => {
      if (typeof item === "string" && item.startsWith("!")) {
        set.delete(item.slice(1));
      } else if (item) {
        set.add(item);
      }
    });
    return Array.from(set);
  }

function mergeVariantExtras(baseExtras, configExtras) {
  const next = Object.assign({}, baseExtras || {});
  if (!configExtras) return next;
  Object.keys(configExtras).forEach(key => {
    const value = configExtras[key];
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  });
  return next;
}

const MODEL_VARIANTS = (() => {
  const variants = Object.assign({}, BASE_VARIANTS);

    const extendVariant = (baseKey, config) => {
      const base = variants[baseKey] || BASE_VARIANTS[baseKey] || {};
      const hide = mergeVariantArrays(base.hide, config.hide);
      const extras = mergeVariantExtras(base.extras, config.extras);
      const classes = mergeVariantArrays(base.classes, config.classes);
      return {
        label: config.label || base.label,
        transforms: Object.assign({}, base.transforms || {}, config.transforms || {}),
        hide: hide.length ? hide : undefined,
        extras: Object.keys(extras).length ? extras : undefined,
        classes: classes.length ? classes : undefined
      };
    };

  variants.carbine_m4 = extendVariant('assault', {
    label: "M4 平台",
    transforms: {
      stock: "translate(-14,-4) scale(0.98,0.96)",
      body: "translate(-6,-4)",
      fore: "scale(0.96,0.96) translate(16,4)",
      barrel: "translate(16,-4)",
      muzzle: "translate(22,-4) scale(0.96,0.98)",
      rail: "translate(-6,-6)",
      scope: "translate(-8,-6)",
      mag: "translate(6,-6)"
    },
    extras: {
      barrel: ({ base, darken }) => `<path d="540 120 L566 112 L574 120 L574 158 L538 152 Z" fill="${darken(base.attachmentPrimary, 0.22)}" opacity="0.45"/>`,
      body: ({ base, lighten }) => `<path d="M218 102 L268 84 L296 90 L260 118 Z" fill="${lighten(base.bodyPrimary, 0.3)}" opacity="0.28"/>`,
      rail: ({ base, darken }) => `<path d="M232 64 L278 50 L284 56 L238 72 Z" fill="${darken(base.bodyPrimary, 0.2)}" opacity="0.5"/>`
    }
  });

  variants.carbine_classic = extendVariant('carbine_m4', {
    label: "M16 平台",
    transforms: {
      stock: "scale(1.08,1.02) translate(-24,-6)",
      body: "scale(1.04,1.02) translate(-14,-8)",
      fore: "scale(1.12,0.96) translate(0,-8)",
      barrel: "scale(1.24,1) translate(16,-6)",
      muzzle: "scale(1.22,1) translate(20,-6)",
      scope: "translate(-18,-12)",
      rail: "translate(-18,-10)"
    },
    extras: {
      fore: ({ base, lighten }) => `<path d="M392 124 L504 104 L512 140 L400 160 Z" fill="${lighten(base.bodyPrimary, 0.12)}" opacity="0.32"/>`,
      barrel: ({ base, darken }) => `<path d="560 116 L610 108 L620 116 L620 160 L560 152 Z" fill="${darken(base.attachmentPrimary, 0.28)}" opacity="0.4"/>`
    }
  });

  variants.m16 = extendVariant('carbine_classic', {
    label: "M16",
    transforms: {
      stock: "scale(1.1,1.04) translate(-28,-8)",
      body: "scale(1.06,1.02) translate(-16,-10)",
      fore: "scale(1.14,0.98) translate(-2,-10)",
      barrel: "scale(1.28,1.02) translate(12,-8)",
      muzzle: "scale(1.24,1.02) translate(16,-8)",
      scope: "translate(-20,-14)",
      rail: "translate(-20,-12)"
    },
    extras: {
      fore: ({ base, lighten }) => `<path d="M384 122 L512 100 L520 138 L392 162 Z" fill="${lighten(base.bodyPrimary,0.1)}" opacity="0.34"/>`
    }
  });

  variants.carbine_honey = extendVariant('carbine_m4', {
    label: "Honey Badger 平台",
    transforms: {
      stock: "scale(0.9,0.88) translate(8,20)",
      body: "scale(0.9,0.9) translate(28,18)",
      fore: "scale(0.88,0.9) translate(72,28)",
      barrel: "scale(0.8,0.82) translate(134,42)",
      muzzle: "scale(1.32,0.72) translate(126,84)",
      mag: "scale(0.9,0.92) translate(18,16)",
      rail: "scale(0.88,0.9) translate(28,22)",
      scope: "translate(-12,6)",
      grip: "translate(-26,16)",
      trigger: "translate(-8,12)"
    },
    extras: {
      muzzle: ({ base, darken }) => `<rect x="560" y="130" width="62" height="24" rx="10" fill="${darken(base.attachmentPrimary, 0.3)}" opacity="0.75"/>`,
      body: ({ base, lighten }) => `<path d="M222 148 L312 124 L340 132 L252 168 Z" fill="${lighten(base.bodyPrimary, 0.18)}" opacity="0.28"/>`
    }
  });

  variants.m4a1 = extendVariant('carbine_m4', {
    label: "M4A1",
    transforms: {
      stock: "translate(-6,-6) scale(1.02,1)",
      body: "translate(-2,-4) scale(1.02,1)",
      rail: "translate(-8,-4)",
      scope: "translate(-6,-6)",
      fore: "translate(8,-2)",
      barrel: "translate(12,-4)",
      muzzle: "translate(18,-6)",
      mag: "translate(2,-2)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M214 128 L284 108 L312 118 L260 150 Z" fill="${lighten(base.bodySecondary, 0.16)}" opacity="0.34"/>`,
      rail: ({ base, darken }) => `<rect x="212" y="70" width="120" height="18" rx="6" fill="${darken(base.bodyPrimary,0.28)}" opacity="0.55"/>`
    }
  });

  variants.k416 = extendVariant('carbine_m4', {
    label: "HK416",
    transforms: {
      stock: "translate(-12,-2) scale(1.04,0.98)",
      body: "translate(-6,-2) scale(1.04,0.98)",
      rail: "translate(-10,-6)",
      scope: "translate(-10,-8)",
      fore: "translate(4,-4) scale(1.02,1)",
      barrel: "translate(10,-6)",
      muzzle: "translate(14,-6)",
      grip: "translate(-12,0)",
      mag: "translate(-2,-2)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M224 134 L324 104 L340 114 L236 158 Z" fill="${darken(base.bodyPrimary, 0.15)}" opacity="0.4"/>`,
      grip: ({ base, darken }) => `<path d="M320 192 L346 194 L328 240 L300 236 Z" fill="${darken(base.attachmentPrimary,0.25)}" opacity="0.65"/>`
    }
  });

  variants.mcx = extendVariant('carbine_m4', {
    label: "MCX",
    transforms: {
      stock: "translate(-8,-4) scale(1.02,0.98)",
      body: "translate(-2,-2) scale(1.02,0.98)",
      rail: "translate(-6,-6)",
      scope: "translate(-6,-8)",
      fore: "translate(10,-4) scale(1.02,0.96)",
      barrel: "translate(16,-4) scale(1.06,0.96)",
      muzzle: "translate(20,-4) scale(1.04,0.98)",
      grip: "translate(-16,0)",
      mag: "translate(0,-2) scale(1.02,1.02)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M216 134 L316 108 L334 118 L232 156 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.34"/>`
    }
  });

  variants.mk18 = extendVariant('carbine_m4', {
    label: "MK18",
    transforms: {
      stock: "translate(-4,4) scale(0.98,0.96)",
      body: "translate(4,2) scale(0.96,0.96)",
      rail: "translate(-4,-6)",
      scope: "translate(-6,-8)",
      fore: "scale(0.92,0.92) translate(40,28)",
      barrel: "scale(0.86,0.88) translate(68,40)",
      muzzle: "scale(0.9,0.9) translate(70,44)",
      mag: "scale(0.94,0.94) translate(10,12)",
      grip: "translate(-22,10)"
    },
    extras: {
      barrel: ({ base, darken }) => `<rect x="520" y="140" width="66" height="18" rx="6" fill="${darken(base.attachmentPrimary,0.32)}" opacity="0.6"/>`,
      fore: ({ base, darken }) => `<path d="M380 148 L458 130 L466 152 L388 170 Z" fill="${darken(base.bodyPrimary,0.2)}" opacity="0.45"/>`
    }
  });

  variants.scar_l = extendVariant('battle', {
    label: "SCAR-L",
    transforms: {
      stock: "translate(-18,-6) scale(1.12,0.96)",
      body: "translate(-10,-8) scale(1.08,0.98)",
      fore: "translate(6,-10) scale(1.06,0.94)",
      barrel: "translate(20,-10) scale(1.18,0.94)",
      muzzle: "translate(24,-10) scale(1.12,0.96)",
      rail: "translate(-12,-10) scale(1.04,1)",
      scope: "translate(-14,-12)",
      grip: "translate(-20,-2)",
      mag: "translate(-4,-4) scale(1.04,1.04)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M60 188 L156 138 L196 142 L180 198 L96 226 Z" fill="${darken(base.bodyPrimary,0.18)}" opacity="0.32"/>`,
      body: ({ base, lighten }) => `<path d="M210 120 L320 92 L344 102 L232 148 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.38"/>`,
      fore: ({ base, darken }) => `<path d="M360 140 L488 118 L498 146 L370 170 Z" fill="${darken(base.attachmentPrimary,0.18)}" opacity="0.52"/>`,
      mag: ({ base, darken }) => `<path d="M320 160 L360 160 L350 230 L310 226 Z" fill="${darken(base.attachmentPrimary,0.35)}" opacity="0.65"/>`
    }
  });

  variants.sig_552 = extendVariant('carbine_m4', {
    label: "SIG 552",
    transforms: {
      stock: "translate(10,10) scale(0.92,0.92)",
      body: "translate(14,8) scale(0.92,0.92)",
      rail: "translate(6,2)",
      scope: "translate(6,-2)",
      fore: "scale(0.94,0.92) translate(40,22)",
      barrel: "scale(0.96,0.92) translate(52,24)",
      muzzle: "scale(0.92,0.9) translate(60,28)",
      mag: "scale(0.9,0.92) translate(20,18)",
      grip: "translate(-10,12)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M120 188 L178 162 L182 210 L126 228 Z" fill="${lighten(base.bodyPrimary,0.18)}" opacity="0.35"/>`,
      body: ({ base, lighten }) => `<path d="M230 140 L302 118 L316 134 L240 166 Z" fill="${lighten(base.bodySecondary,0.24)}" opacity="0.32"/>`
    }
  });

  variants.g36 = extendVariant('carbine_m4', {
    label: "G36",
    hide: ['scope', 'rail'],
    transforms: {
      stock: "translate(16,-4) scale(0.94,0.94)",
      body: "translate(12,-4) scale(0.98,0.96)",
      fore: "translate(-8,-6) scale(0.98,0.94)",
      barrel: "translate(-2,-6) scale(1.02,0.94)",
      muzzle: "translate(0,-6) scale(1.02,0.94)",
      grip: "translate(-24,0)",
      mag: "translate(-12,-4) scale(1.08,1.04)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M180 120 L304 84 L344 100 L212 156 Z" fill="${lighten(base.bodySecondary,0.22)}" opacity="0.36"/>`,
      body_detail: ({ base, lighten }) => `<path d="M200 82 L332 54 L360 70 L228 112 Z" fill="${lighten(base.bodyPrimary,0.26)}" opacity="0.4"/>`,
      stock: ({ base, darken }) => `<path d="M56 172 L148 128 L174 134 L154 198 L72 222 Z" fill="${darken(base.bodyPrimary,0.16)}" opacity="0.36"/>`
    }
  });

  variants.g36c = extendVariant('g36', {
    label: "G36C",
    transforms: {
      stock: "scale(0.88,0.9) translate(30,26)",
      body: "scale(0.9,0.92) translate(42,26)",
      fore: "scale(0.88,0.9) translate(60,36)",
      barrel: "scale(0.86,0.88) translate(84,50)",
      muzzle: "scale(0.84,0.86) translate(90,54)",
      mag: "scale(0.88,0.92) translate(24,22)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M230 148 L312 122 L328 138 L240 174 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.42"/>`
    }
  });

  variants.aug = extendVariant('bullpup_modern', {
    label: "AUG",
    hide: ['scope'],
    transforms: {
      stock: "translate(16,-4) scale(1,0.96)",
      body: "translate(22,-6) scale(1.02,0.96)",
      fore: "translate(-12,-12) scale(1.02,0.92)",
      barrel: "translate(-6,-12) scale(1.1,0.94)",
      muzzle: "translate(-6,-12) scale(1.16,0.94)",
      grip: "translate(-54,-12)",
      mag: "translate(-64,-12) rotate(-6,318,184) scale(1.1,1.06)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M168 142 L300 96 L348 110 L216 168 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.4"/>`,
      rail: ({ base, darken }) => `<path d="M256 74 L352 48 L366 58 L270 88 Z" fill="${darken(base.bodyPrimary,0.2)}" opacity="0.45"/>`,
      body_detail: ({ base, lighten }) => `<path d="M210 72 L340 40 L360 54 L228 100 Z" fill="${lighten(base.bodyPrimary,0.24)}" opacity="0.35"/>`
    }
  });

  variants.famas = extendVariant('bullpup_modern', {
    label: "FAMAS",
    hide: ['scope'],
    transforms: {
      stock: "translate(12,-2) scale(1,0.96)",
      body: "translate(20,-4) scale(1.04,0.96)",
      fore: "translate(-28,-6) scale(1.08,0.94)",
      barrel: "translate(-24,-6) scale(1.12,0.94)",
      muzzle: "translate(-22,-6) scale(1.14,0.94)",
      grip: "translate(-72,-4)",
      mag: "translate(-86,-8) rotate(-10,310,182) scale(1.14,1.08)",
      trigger: "translate(-30,0)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M168 160 L288 114 L332 128 L204 186 Z" fill="${lighten(base.bodySecondary,0.22)}" opacity="0.36"/>`,
      body_detail: ({ base, darken }) => `<path d="M166 96 L284 68 L312 78 L196 120 Z" fill="${darken(base.bodyPrimary,0.1)}" opacity="0.42"/>`,
      stock: ({ base, darken }) => `<path d="M60 200 L148 146 L182 150 L168 210 L86 238 Z" fill="${darken(base.bodyPrimary,0.2)}" opacity="0.34"/>`
    }
  });

  variants.tavor = extendVariant('bullpup_modern', {
    label: "Tavor",
    hide: ['scope'],
    transforms: {
      stock: "translate(20,2) scale(1.04,0.96)",
      body: "translate(28,0) scale(1.06,0.98)",
      fore: "translate(-32,-2) scale(1.04,0.94)",
      barrel: "translate(-26,-2) scale(1.08,0.94)",
      muzzle: "translate(-24,-2) scale(1.1,0.94)",
      grip: "translate(-66,4)",
      mag: "translate(-80,6) rotate(-8,314,186) scale(1.12,1.06)",
      trigger: "translate(-28,4)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M184 156 L304 120 L328 132 L210 180 Z" fill="${lighten(base.bodySecondary,0.24)}" opacity="0.34"/>`,
      body_detail: ({ base, darken }) => `<path d="M220 114 L332 90 L344 104 L228 140 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.4"/>`
    }
  });

  variants.qbz_95 = extendVariant('bullpup_modern', {
    label: "QBZ-95",
    hide: ['scope'],
    transforms: {
      stock: "translate(28,0) scale(1.08,0.98)",
      body: "translate(34,-4) scale(1.1,0.96)",
      fore: "translate(-36,-10) scale(1.1,0.92)",
      barrel: "translate(-32,-10) scale(1.16,0.92)",
      muzzle: "translate(-30,-10) scale(1.2,0.92)",
      grip: "translate(-72,-2)",
      mag: "translate(-88,-6) rotate(-6,316,182) scale(1.18,1.08)",
      trigger: "translate(-32,-2)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M188 142 L318 102 L356 118 L224 168 Z" fill="${lighten(base.bodySecondary,0.22)}" opacity="0.38"/>`,
      body_detail: ({ base, darken }) => `<path d="M228 90 L356 62 L372 78 L244 124 Z" fill="${darken(base.bodyPrimary,0.14)}" opacity="0.42"/>`
    }
  });

  variants.qbz95_1 = extendVariant('qbz_95', {
    label: "QBZ-95-1",
    transforms: {
      fore: "scale(1.06,0.94) translate(-34,-6)",
      barrel: "scale(1.12,0.94) translate(-30,-6)",
      muzzle: "scale(1.18,0.94) translate(-28,-6)",
      mag: "rotate(-4,316,184) scale(1.14,1.08) translate(-10,-4)",
      grip: "translate(-68,2)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M198 150 L332 112 L360 126 L228 176 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.36"/>`
    }
  });

  variants.fn_f2000 = extendVariant('bullpup_modern', {
    label: "F2000",
    hide: ['scope'],
    transforms: {
      stock: "translate(24,6) scale(1.12,0.98)",
      body: "translate(30,2) scale(1.16,0.98)",
      fore: "translate(-24,-2) scale(1.14,0.96)",
      barrel: "translate(-20,-2) scale(1.22,0.96)",
      muzzle: "translate(-20,-2) scale(1.26,0.96)",
      grip: "translate(-60,8)",
      mag: "translate(-74,10) rotate(-4,320,188) scale(1.16,1.1)",
      trigger: "translate(-24,6)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M200 150 L328 116 L356 130 L224 182 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.36"/>`,
      fore: ({ base, darken }) => `<path d="M336 148 L468 126 L480 150 L344 174 Z" fill="${darken(base.attachmentPrimary,0.18)}" opacity="0.5"/>`
    }
  });

  variants.ak_classic = extendVariant('assault', {
    label: "AK 平台",
    transforms: {
      stock: "translate(18,6) scale(0.94,0.96)",
      body: "skewX(3) translate(10,-2)",
      fore: "scale(1.06,0.96) translate(-26,6)",
      barrel: "scale(1.04,0.96) translate(-28,8)",
      muzzle: "translate(-30,10) scale(0.94,0.92)",
      mag: "rotate(12,342,172) scale(1.1,1.12)",
      grip: "translate(-20,10)",
      trigger: "translate(-8,6)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M204 148 L320 110 L342 120 L220 172 Z" fill="${lighten(base.bodySecondary, 0.16)}" opacity="0.34"/>`,
      barrel: ({ base, darken }) => `<path d="M518 134 L556 126 L560 140 L522 148 Z" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.5"/>`,
      mag: ({ base, darken }) => `<path d="M324 156 C338 206 362 220 380 224 L342 224 C322 204 314 176 310 150 Z" fill="${darken(base.attachmentPrimary, 0.28)}" opacity="0.6"/>`
    }
  });

  variants.ak_modern = extendVariant('ak_classic', {
    label: "AK 现代化",
    transforms: {
      stock: "translate(10,4) scale(0.96,0.94)",
      fore: "scale(1.12,0.94) translate(-36,4)",
      barrel: "scale(1.06,0.94) translate(-34,6)",
      muzzle: "translate(-34,8) scale(0.96,0.94)",
      mag: "rotate(10,340,170) scale(1.08,1.08)",
      rail: "translate(-12,-6)",
      scope: "translate(-12,-6)"
    },
    extras: {
      fore: ({ base, darken }) => `<path d="M376 140 L480 118 L486 140 L384 160 Z" fill="${darken(base.bodyPrimary, 0.18)}" opacity="0.45"/>`,
      barrel: ({ base, darken }) => `<path d="M520 138 L592 126 L600 140 L528 154 Z" fill="${darken(base.attachmentPrimary, 0.32)}" opacity="0.55"/>`
    }
  });

  variants.ak_compact = extendVariant('ak_modern', {
    label: "AK 紧凑型",
    transforms: {
      stock: "scale(0.82,0.88) translate(28,22)",
      body: "scale(0.9,0.9) translate(42,16)",
      fore: "scale(0.82,0.9) translate(72,28)",
      barrel: "scale(0.78,0.86) translate(128,46)",
      muzzle: "scale(0.74,0.82) translate(140,50)",
      mag: "rotate(10,348,176) scale(0.96,0.98)",
      grip: "translate(-12,18)",
      trigger: "translate(0,12)",
      rail: "scale(0.86,0.9) translate(46,18)",
      scope: "translate(-8,4)"
    }
  });

  variants.ak_47 = extendVariant('ak_classic', {
    label: "AK-47",
    extras: {
      stock: ({ base, lighten }) => `<path d="M92 200 L184 154 L208 158 L184 214 L110 242 Z" fill="${lighten(base.bodyPrimary,0.18)}" opacity="0.32"/>`,
      body: ({ base, lighten }) => `<path d="M204 152 L318 110 L336 122 L220 170 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.34"/>`,
      mag: ({ base, darken }) => `<path d="M320 168 C332 210 354 224 374 232 L334 232 C314 208 304 182 302 152 Z" fill="${darken(base.attachmentPrimary,0.32)}" opacity="0.62"/>`
    }
  });

  variants.ak_74 = extendVariant('ak_modern', {
    label: "AK-74",
    transforms: {
      rail: "translate(-10,-8)",
      scope: "translate(-10,-10)",
      mag: "rotate(10,342,170) scale(1.06,1.06) translate(-4,-2)",
      fore: "translate(-30,2) scale(1.08,0.94)",
      barrel: "translate(-32,4) scale(1.06,0.94)",
      muzzle: "translate(-34,6) scale(0.96,0.92)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M212 150 L322 112 L340 122 L228 174 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.32"/>`
    }
  });

  variants.ak_74m = extendVariant('ak_74', {
    label: "AK-74M",
    transforms: {
      stock: "translate(10,2) scale(0.96,0.96)",
      fore: "translate(-36,0) scale(1.06,0.94)",
      mag: "rotate(9,344,172) scale(1.08,1.08)",
      grip: "translate(-18,6)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M96 194 L170 152 L192 156 L176 210 L112 236 Z" fill="${darken(base.bodyPrimary,0.18)}" opacity="0.34"/>`
    }
  });

  variants.ak_12 = extendVariant('ak_modern', {
    label: "AK-12",
    transforms: {
      rail: "translate(-16,-12)",
      scope: "translate(-16,-14)",
      fore: "translate(-34,-6) scale(1.08,0.94)",
      barrel: "translate(-36,-4) scale(1.08,0.94)",
      muzzle: "translate(-38,-2) scale(0.98,0.94)",
      mag: "rotate(8,340,168) scale(1.08,1.08) translate(-2,-4)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M216 140 L326 108 L346 120 L232 164 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.4"/>`,
      fore: ({ base, darken }) => `<path d="M362 140 L474 118 L486 140 L368 168 Z" fill="${darken(base.attachmentPrimary,0.2)}" opacity="0.52"/>`
    }
  });

  variants.ak117 = extendVariant('ak_12', {
    label: "AK-117",
    transforms: {
      stock: "translate(8,6) scale(0.94,0.94)",
      fore: "translate(-28,-2) scale(1.06,0.92)",
      barrel: "translate(-30,-2) scale(1.08,0.92)",
      muzzle: "translate(-32,0) scale(1,0.92)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M220 150 L330 118 L348 130 L236 168 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.34"/>`
    }
  });

  variants.galil = extendVariant('ak_modern', {
    label: "Galil",
    transforms: {
      stock: "translate(22,10) scale(0.92,0.94)",
      fore: "translate(-22,8) scale(1.04,0.96)",
      barrel: "translate(-26,8) scale(1.06,0.96)",
      muzzle: "translate(-28,10) scale(0.96,0.94)",
      mag: "rotate(12,340,174) scale(1.08,1.1)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M120 206 L192 162 L214 168 L198 220 L138 246 Z" fill="${lighten(base.bodyPrimary,0.18)}" opacity="0.32"/>`
    }
  });

  variants.type81 = extendVariant('ak_modern', {
    label: "Type 81",
    transforms: {
      stock: "translate(20,8) scale(0.94,0.96)",
      fore: "translate(-24,4) scale(1.06,0.96)",
      barrel: "translate(-28,6) scale(1.06,0.96)",
      muzzle: "translate(-30,8) scale(0.96,0.94)",
      mag: "rotate(12,340,176) scale(1.08,1.1)",
      grip: "translate(-14,8)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M108 206 L186 166 L206 172 L192 224 L132 250 Z" fill="${darken(base.bodyPrimary,0.18)}" opacity="0.34"/>`,
      body: ({ base, lighten }) => `<path d="M216 152 L326 116 L344 128 L232 176 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.32"/>`
    }
  });

  variants.as_val = extendVariant('ak_compact', {
    label: "AS VAL",
    hide: ['muzzle'],
    transforms: {
      barrel: "scale(1.1,0.94) translate(-24,-2)",
      fore: "scale(1.02,0.94) translate(-18,-2)",
      mag: "scale(0.92,0.94) translate(16,10)",
      grip: "translate(-16,12)"
    },
    extras: {
      barrel: ({ base, darken }) => `<rect x="456" y="126" width="140" height="28" rx="18" fill="${darken(base.attachmentPrimary,0.28)}" opacity="0.58"/>`,
      body: ({ base, lighten }) => `<path d="M232 150 L310 126 L328 138 L244 170 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.34"/>`
    }
  });

  variants.aks_74u = extendVariant('ak_compact', {
    label: "AKS-74U",
    transforms: {
      stock: "scale(0.82,0.84) translate(46,40)",
      body: "scale(0.88,0.86) translate(54,38)",
      fore: "scale(0.86,0.86) translate(70,46)",
      barrel: "scale(0.84,0.86) translate(92,58)",
      muzzle: "scale(0.82,0.84) translate(96,60)",
      mag: "scale(0.86,0.88) translate(36,32)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M230 154 L310 130 L324 142 L240 174 Z" fill="${darken(base.bodyPrimary,0.1)}" opacity="0.42"/>`
    }
  });


  variants.bullpup_modern = extendVariant('bullpup', {
    label: "现代无托",
    transforms: {
      stock: "translate(26,4) scale(1.02,0.98)",
      body: "translate(20,2)",
      fore: "translate(-20,-2)",
      barrel: "translate(-14,-2)",
      muzzle: "translate(-12,-2)",
      mag: "translate(-80,-4)",
      rail: "translate(6,-8)",
      scope: "translate(6,-8)"
    },
    extras: {
      fore: ({ base, lighten }) => `<path d="M392 130 L496 116 L500 154 L398 170 Z" fill="${lighten(base.bodyPrimary, 0.24)}" opacity="0.32"/>`
    }
  });

  variants.smg_vector = extendVariant('vector', {
    label: "Vector 平台",
    classes: ['skin-preview--smg']
  });

  variants.smg_modern = extendVariant('vector', {
    label: "现代冲锋枪",
    transforms: {
      body: "scale(0.78,0.86) translate(82,30)",
      fore: "scale(0.74,0.82) translate(112,44)",
      barrel: "scale(0.7,0.76) translate(186,76)",
      muzzle: "scale(0.68,0.74) translate(190,80)",
      grip: "translate(-24,20)",
      mag: "translate(20,18) scale(0.88,0.9)",
      trigger: "translate(-6,12)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M238 158 L330 138 L336 162 L242 184 Z" fill="${lighten(base.bodyPrimary, 0.22)}" opacity="0.3"/>`
    }
  });

    variants.smg_classic = extendVariant('vector', {
      label: "传统冲锋枪",
      hide: ['!stock'],
      transforms: {
        body: "scale(0.86,0.92) translate(52,26)",
        fore: "scale(0.88,0.92) translate(68,28)",
        barrel: "scale(0.78,0.86) translate(148,60)",
      muzzle: "scale(0.76,0.84) translate(152,62)",
      mag: "translate(4,12) scale(0.94,0.94)",
      grip: "translate(-40,14)",
      trigger: "translate(-18,10)"
    },
    extras: {
      barrel: ({ base, darken }) => `<path d="M520 140 L560 132 L564 144 L524 152 Z" fill="${darken(base.attachmentPrimary, 0.28)}" opacity="0.45"/>`
    }
  });

  variants.smg_compact = extendVariant('vector', {
    label: "袖珍冲锋枪",
    transforms: {
      body: "scale(0.74,0.8) translate(106,44)",
      fore: "scale(0.68,0.78) translate(142,60)",
      barrel: "scale(0.6,0.7) translate(232,96)",
      muzzle: "scale(0.58,0.68) translate(236,100)",
      mag: "scale(0.82,0.86) translate(42,22)",
      grip: "translate(-12,26)",
      trigger: "translate(2,18)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M250 170 L320 148 L324 170 L254 190 Z" fill="${lighten(base.bodyPrimary, 0.18)}" opacity="0.26"/>`
    }
  });

    variants.smg_pdw = extendVariant('vector', {
      label: "个人防卫武器",
      hide: ['!stock'],
      transforms: {
        body: "scale(0.78,0.84) translate(92,34)",
        fore: "scale(0.76,0.82) translate(120,42)",
        barrel: "scale(0.72,0.78) translate(188,64)",
      muzzle: "scale(0.7,0.76) translate(194,66)",
      grip: "translate(-20,18)",
      trigger: "translate(-6,12)",
      rail: "scale(0.84,0.88) translate(72,24)"
    }
  });

    variants.smg_helical = extendVariant('vector', {
      label: "螺旋弹匣冲锋枪",
      hide: ['!stock'],
      transforms: {
        body: "scale(0.84,0.9) translate(64,30)",
        fore: "scale(0.78,0.86) translate(102,48)",
        barrel: "scale(0.7,0.8) translate(196,82)",
      muzzle: "scale(0.68,0.78) translate(202,84)",
      mag: "translate(-6,20) scale(1.05,1)",
      grip: "translate(-34,18)",
      trigger: "translate(-16,14)"
    },
    extras: {
      mag: ({ base, darken }) => `<ellipse cx="326" cy="206" rx="42" ry="26" fill="${darken(base.attachmentPrimary, 0.38)}" opacity="0.55"/>`
    }
  });

  variants.smg_p90 = extendVariant('bullpup', {
    label: "P90 平台",
    transforms: {
      stock: "translate(24,6) scale(1.02,0.98)",
      body: "translate(18,4) scale(0.98,0.96)",
      fore: "scale(0.92,0.94) translate(-8,12)",
      barrel: "scale(0.86,0.9) translate(40,22)",
      muzzle: "scale(0.82,0.88) translate(46,24)",
      mag: "translate(-90,-6) scale(0.8,0.7)",
      grip: "translate(-60,10)",
      trigger: "translate(-36,12)",
      rail: "translate(8,-6) scale(1.08,0.92)",
      scope: "translate(6,-6) scale(1.06)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M220 150 L316 126 L340 134 L252 172 Z" fill="${lighten(base.bodyPrimary, 0.24)}" opacity="0.3"/>`,
      rail: ({ base, darken }) => `<path d="M240 74 L332 58 L340 66 L248 82 Z" fill="${darken(base.bodyPrimary, 0.28)}" opacity="0.55"/>`
    },
    hide: ["stock"]
  });

  variants.mp5 = extendVariant('smg_classic', {
    label: "MP5",
    transforms: {
      body: "scale(0.9,0.94) translate(42,20)",
      fore: "scale(0.88,0.92) translate(62,24)",
      barrel: "scale(0.8,0.86) translate(140,54)",
      muzzle: "scale(0.78,0.84) translate(146,56)",
      mag: "translate(8,10) scale(0.96,0.98) rotate(4,320,190)",
      grip: "translate(-36,12)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M238 168 L320 146 L328 164 L240 188 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.32"/>`
    }
  });

  variants.mp5k = extendVariant('smg_compact', {
    label: "MP5K",
    transforms: {
      body: "scale(0.72,0.78) translate(118,52)",
      fore: "scale(0.66,0.74) translate(150,70)",
      barrel: "scale(0.58,0.66) translate(230,102)",
      muzzle: "scale(0.56,0.64) translate(236,104)",
      grip: "translate(-8,28)",
      mag: "translate(48,24) scale(0.8,0.84) rotate(6,320,204)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M248 178 L310 160 L316 180 L252 198 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.36"/>`
    }
  });

  variants.mp5pdw = extendVariant('smg_pdw', {
    label: "MP5 PDW",
    transforms: {
      body: "scale(0.8,0.86) translate(86,30)",
      fore: "scale(0.78,0.84) translate(108,36)",
      barrel: "scale(0.72,0.8) translate(184,58)",
      muzzle: "scale(0.7,0.78) translate(190,60)",
      grip: "translate(-26,18)",
      mag: "translate(18,16) scale(0.86,0.9) rotate(4,320,192)"
    }
  });

  variants.mp7 = extendVariant('smg_pdw', {
    label: "MP7",
    transforms: {
      body: "scale(0.76,0.82) translate(98,32)",
      fore: "scale(0.74,0.8) translate(120,38)",
      barrel: "scale(0.68,0.76) translate(194,60)",
      muzzle: "scale(0.66,0.74) translate(200,62)",
      grip: "translate(-18,20)",
      mag: "translate(28,18) scale(0.84,0.9)",
      trigger: "translate(-4,14)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M250 170 L320 150 L326 168 L254 190 Z" fill="${lighten(base.bodySecondary,0.16)}" opacity="0.3"/>`
    }
  });

  variants.mp9 = extendVariant('smg_modern', {
    label: "MP9",
    transforms: {
      body: "scale(0.76,0.84) translate(94,32)",
      fore: "scale(0.7,0.8) translate(126,46)",
      barrel: "scale(0.64,0.74) translate(206,78)",
      muzzle: "scale(0.62,0.72) translate(210,80)",
      mag: "translate(18,18) scale(0.84,0.9)",
      grip: "translate(-28,22)",
      trigger: "translate(-10,14)"
    }
  });

  variants.pp_2000 = extendVariant('smg_pdw', {
    label: "PP-2000",
    transforms: {
      body: "scale(0.74,0.82) translate(100,36)",
      fore: "scale(0.7,0.78) translate(132,46)",
      barrel: "scale(0.66,0.74) translate(206,74)",
      muzzle: "scale(0.64,0.72) translate(212,76)",
      mag: "translate(32,26) scale(0.76,0.86) rotate(-10,318,208)",
      grip: "translate(-18,20)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M244 176 L312 156 L318 176 L248 196 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.32"/>`
    }
  });

  variants.sig_mpx = extendVariant('smg_modern', {
    label: "SIG MPX",
    transforms: {
      body: "scale(0.8,0.86) translate(86,28)",
      fore: "scale(0.76,0.82) translate(114,40)",
      barrel: "scale(0.7,0.78) translate(192,68)",
      muzzle: "scale(0.68,0.76) translate(198,70)",
      mag: "translate(12,14) scale(0.9,0.94)",
      grip: "translate(-30,20)",
      trigger: "translate(-12,12)",
      rail: "translate(58,18) scale(0.88,0.9)"
    }
  });

  variants.uzi = extendVariant('smg_classic', {
    label: "Uzi",
    transforms: {
      body: "scale(0.84,0.9) translate(72,30)",
      fore: "scale(0.82,0.88) translate(92,34)",
      barrel: "scale(0.74,0.82) translate(164,64)",
      muzzle: "scale(0.72,0.8) translate(170,66)",
      grip: "translate(-32,18)",
      mag: "translate(24,22) scale(0.88,0.94)",
      trigger: "translate(-14,12)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M240 174 L316 152 L322 170 L244 192 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.34"/>`
    }
  });

  variants.pp_19 = extendVariant('smg_helical', {
    label: "PP-19",
    transforms: {
      body: "scale(0.86,0.92) translate(64,28)",
      fore: "scale(0.8,0.88) translate(100,44)",
      barrel: "scale(0.74,0.82) translate(188,74)",
      muzzle: "scale(0.72,0.8) translate(194,76)",
      mag: "translate(-14,18) scale(1.08,1.02)",
      grip: "translate(-34,18)"
    }
  });

  variants.pp_19_01 = extendVariant('pp_19', {
    label: "PP-19-01",
    transforms: {
      body: "scale(0.84,0.9) translate(70,30)",
      fore: "scale(0.78,0.86) translate(108,44)",
      barrel: "scale(0.72,0.8) translate(196,74)",
      muzzle: "scale(0.7,0.78) translate(202,76)",
      mag: "translate(-12,22) scale(1.08,1.04)",
      grip: "translate(-30,20)"
    }
  });

  variants.kriss = extendVariant('smg_vector', {
    label: "KRISS",
    transforms: {
      body: "scale(0.8,0.88) translate(76,30)",
      fore: "scale(0.78,0.86) translate(106,40)",
      barrel: "scale(0.7,0.78) translate(188,70)",
      muzzle: "scale(0.68,0.76) translate(194,72)",
      mag: "translate(18,18) scale(0.9,0.94)",
      grip: "translate(-30,22)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M236 168 L310 150 L318 170 L240 192 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.3"/>`
    }
  });

  variants.vector = extendVariant('smg_vector', {
    label: "Vector",
    transforms: {
      body: "scale(0.82,0.88) translate(70,28)",
      fore: "scale(0.8,0.86) translate(100,38)",
      barrel: "scale(0.72,0.78) translate(182,66)",
      muzzle: "scale(0.7,0.76) translate(188,68)",
      mag: "translate(16,16) scale(0.92,0.94)",
      grip: "translate(-28,22)",
      trigger: "translate(-12,14)"
    }
  });

  variants.p90 = extendVariant('smg_p90', {
    label: "P90",
    transforms: {
      body: "translate(16,6) scale(0.96,0.96)",
      fore: "translate(-10,10) scale(0.94,0.94)",
      barrel: "translate(36,20) scale(0.88,0.92)",
      muzzle: "translate(42,22) scale(0.86,0.9)",
      mag: "translate(-92,-8) scale(0.78,0.68)",
      grip: "translate(-58,12)",
      trigger: "translate(-34,12)",
      rail: "translate(4,-6) scale(1.04,0.9)",
      scope: "translate(2,-6) scale(1.02)"
    }
  });

    variants.pistol_service = extendVariant('vector', {
      label: "制式手枪",
      hide: ["stock", "fore", "scope", "rail"],
      transforms: {
        body: "scale(0.62,0.72) translate(182,78)",
      barrel: "scale(0.5,0.64) translate(270,110)",
      muzzle: "scale(0.48,0.62) translate(276,114)",
      grip: "translate(30,20) scale(0.94,0.9)",
      mag: "translate(60,26) scale(0.58,0.74)",
        trigger: "translate(30,18)"
      },
      extras: {
        grip: null,
        body: ({ base, darken }) => `<path d="M252 154 L324 134 L330 150 L258 172 Z" fill="${darken(base.bodyPrimary, 0.22)}" opacity="0.4"/>`,
        barrel: ({ base, darken }) => `<rect x="448" y="140" width="56" height="18" rx="6" fill="${darken(base.attachmentPrimary, 0.3)}" opacity="0.7"/>`
      }
    });

  variants.pistol_heavy = extendVariant('pistol_service', {
    label: "大型手枪",
    transforms: {
      body: "scale(0.68,0.76) translate(168,74)",
      barrel: "scale(0.58,0.68) translate(252,106)",
      muzzle: "scale(0.56,0.66) translate(258,110)",
      mag: "translate(62,28) scale(0.64,0.78)",
      grip: "scale(1,1) translate(24,18)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M246 150 L332 126 L338 144 L252 170 Z" fill="${lighten(base.bodyPrimary, 0.12)}" opacity="0.34"/>`
    }
  });

  variants.pistol_compact = extendVariant('pistol_service', {
    label: "紧凑手枪",
    transforms: {
      body: "scale(0.56,0.68) translate(202,86)",
      barrel: "scale(0.44,0.58) translate(306,122)",
      muzzle: "scale(0.42,0.56) translate(312,126)",
      grip: "translate(40,24) scale(0.86,0.88)",
      mag: "translate(72,32) scale(0.5,0.68)",
      trigger: "translate(36,22)"
    }
  });

  variants.usp = extendVariant('pistol_service', {
    label: "USP",
    transforms: {
      body: "scale(0.64,0.74) translate(186,80)",
      barrel: "scale(0.52,0.64) translate(270,112)",
      muzzle: "scale(0.5,0.62) translate(276,116)",
      grip: "translate(26,18) scale(0.96,0.94)",
      mag: "translate(58,26) scale(0.62,0.76)",
      trigger: "translate(30,20)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M250 150 L332 130 L338 146 L256 168 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.38"/>`
    }
  });

  variants.glock = extendVariant('pistol_service', {
    label: "Glock",
    transforms: {
      body: "scale(0.6,0.72) translate(196,84)",
      barrel: "scale(0.48,0.6) translate(290,120)",
      muzzle: "scale(0.46,0.58) translate(296,124)",
      grip: "translate(32,20) scale(0.9,0.92)",
      mag: "translate(66,30) scale(0.56,0.72)",
      trigger: "translate(32,20)"
    }
  });

  variants.p226 = extendVariant('pistol_service', {
    label: "P226",
    transforms: {
      body: "scale(0.62,0.74) translate(190,82)",
      barrel: "scale(0.5,0.62) translate(282,118)",
      muzzle: "scale(0.48,0.6) translate(288,122)",
      grip: "translate(28,18) scale(0.94,0.94)",
      mag: "translate(60,28) scale(0.6,0.76)"
    }
  });

  variants.m9 = extendVariant('pistol_service', {
    label: "M9",
    transforms: {
      body: "scale(0.64,0.76) translate(184,78)",
      barrel: "scale(0.52,0.64) translate(270,114)",
      muzzle: "scale(0.5,0.62) translate(276,118)",
      grip: "translate(24,16) scale(0.98,0.96)",
      mag: "translate(56,26) scale(0.64,0.78)"
    }
  });

  variants.m1911 = extendVariant('pistol_heavy', {
    label: "M1911",
    transforms: {
      body: "scale(0.66,0.76) translate(180,76)",
      barrel: "scale(0.54,0.66) translate(266,112)",
      muzzle: "scale(0.52,0.64) translate(272,116)",
      grip: "translate(24,14) scale(1,0.96)",
      mag: "translate(54,24) scale(0.66,0.8)"
    }
  });

  variants.five_seven = extendVariant('pistol_service', {
    label: "Five-Seven",
    transforms: {
      body: "scale(0.62,0.74) translate(192,82)",
      barrel: "scale(0.5,0.62) translate(284,118)",
      muzzle: "scale(0.48,0.6) translate(290,122)",
      grip: "translate(30,18) scale(0.94,0.94)",
      mag: "translate(64,28) scale(0.6,0.78)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M246 148 L332 128 L338 144 L252 168 Z" fill="${lighten(base.bodySecondary,0.16)}" opacity="0.32"/>`
    }
  });

  variants.deserteagle = extendVariant('pistol_heavy', {
    label: "Desert Eagle",
    transforms: {
      body: "scale(0.7,0.78) translate(166,70)",
      barrel: "scale(0.58,0.68) translate(248,108)",
      muzzle: "scale(0.56,0.66) translate(254,112)",
      grip: "translate(18,12) scale(1.04,1)",
      mag: "translate(50,22) scale(0.68,0.82)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M238 146 L328 126 L336 140 L246 166 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.36"/>`
    }
  });

  variants.deserteaglehandgun = extendVariant('deserteagle', {
    label: "Desert Eagle 手枪"
  });

  variants.ruger = extendVariant('pistol_compact', {
    label: "Ruger",
    transforms: {
      body: "scale(0.54,0.66) translate(214,92)",
      barrel: "scale(0.42,0.56) translate(318,130)",
      muzzle: "scale(0.4,0.54) translate(324,134)",
      grip: "translate(44,28) scale(0.82,0.86)",
      mag: "translate(74,34) scale(0.48,0.64)"
    }
  });

  variants.shotgun_pump = extendVariant('battle', {
    label: "泵动霰弹枪",
    transforms: {
      stock: "scale(1.08,1.04) translate(-20,6)",
      body: "scale(1.06,1.02) translate(-14,8)",
      fore: "scale(1.22,1.02) translate(-34,12)",
      barrel: "scale(1.34,1.02) translate(-30,16)",
      muzzle: "scale(1.22,1) translate(-24,18)",
      mag: "translate(-28,8) scale(1.12,1.04)",
      grip: "translate(-16,8)"
    },
    extras: {
      fore: ({ base, darken }) => `<rect x="388" y="142" width="112" height="36" rx="14" fill="${darken(base.bodyPrimary, 0.24)}" opacity="0.55"/>`,
      barrel: ({ base, darken }) => `<rect x="518" y="138" width="120" height="18" rx="8" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.6"/>`
    }
  });

  variants.shotgun_auto = extendVariant('shotgun_pump', {
    label: "半自动霰弹枪",
    transforms: {
      fore: "scale(1.16,1) translate(-24,16)",
      barrel: "scale(1.28,1) translate(-18,20)",
      muzzle: "scale(1.2,1) translate(-12,20)",
      mag: "translate(-12,12) scale(1.08,1.02)"
    },
    extras: {
      barrel: ({ base, lighten }) => `<path d="M522 142 L636 138 L640 150 L528 156 Z" fill="${lighten(base.attachmentSecondary, 0.18)}" opacity="0.45"/>`
    }
  });

  variants.shotgun_mag = extendVariant('shotgun_auto', {
    label: "弹匣霰弹枪",
    extras: {
      mag: ({ base, darken }) => `<path d="M300 180 L360 176 L348 232 L288 230 Z" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.7"/>`
    }
  });

  variants.mp_153 = extendVariant('shotgun_auto', {
    label: "MP-153",
    transforms: {
      stock: "translate(-8,4) scale(1.08,1.02)",
      fore: "scale(1.2,1.02) translate(-18,18)",
      barrel: "scale(1.32,1.02) translate(-12,22)",
      muzzle: "scale(1.26,1.02) translate(-8,22)",
      mag: "translate(-18,16) scale(1.12,1.04)"
    },
    extras: {
      barrel: ({ base, darken }) => `<rect x="518" y="140" width="150" height="20" rx="10" fill="${darken(base.attachmentPrimary,0.28)}" opacity="0.6"/>`
    }
  });

  variants.saiga = extendVariant('shotgun_mag', {
    label: "Saiga",
    transforms: {
      stock: "translate(4,8) scale(1.02,1.02)",
      fore: "scale(1.14,1) translate(-10,12)",
      barrel: "scale(1.26,1) translate(-4,16)",
      muzzle: "scale(1.2,1) translate(0,16)",
      mag: "translate(-10,18) scale(1.2,1.12)",
      grip: "translate(-12,12)"
    },
    extras: {
      mag: ({ base, darken }) => `<path d="M304 190 L368 186 L358 246 L296 244 Z" fill="${darken(base.attachmentPrimary,0.38)}" opacity="0.7"/>`
    }
  });

  variants.m870 = extendVariant('shotgun_pump', {
    label: "M870",
    transforms: {
      stock: "translate(-12,6) scale(1.12,1.04)",
      fore: "scale(1.18,1) translate(10,12)",
      barrel: "scale(1.28,1) translate(18,16)",
      muzzle: "scale(1.24,1) translate(22,16)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M36 200 L150 150 L184 158 L170 214 L80 244 Z" fill="${lighten(base.bodyPrimary,0.24)}" opacity="0.32"/>`
    }
  });

  variants.m590 = extendVariant('shotgun_pump', {
    label: "M590",
    transforms: {
      stock: "translate(-10,4) scale(1.1,1.02)",
      fore: "scale(1.16,1) translate(8,10)",
      barrel: "scale(1.26,1) translate(16,14)",
      muzzle: "scale(1.22,1) translate(20,14)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M220 158 L332 134 L344 148 L230 176 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.34"/>`
    }
  });

  variants.m500 = extendVariant('shotgun_pump', {
    label: "M500",
    transforms: {
      stock: "translate(-8,8) scale(1.1,1.04)",
      fore: "scale(1.18,1) translate(6,12)",
      barrel: "scale(1.26,1) translate(16,16)",
      muzzle: "scale(1.22,1) translate(20,16)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M44 206 L160 156 L194 164 L180 220 L92 248 Z" fill="${darken(base.bodyPrimary,0.16)}" opacity="0.34"/>`
    }
  });

  variants.spas_12 = extendVariant('shotgun_auto', {
    label: "SPAS-12",
    transforms: {
      stock: "translate(-6,6) scale(1.1,1.02)",
      fore: "scale(1.22,1) translate(-16,16)",
      barrel: "scale(1.3,1) translate(-10,18)",
      muzzle: "scale(1.24,1) translate(-6,18)",
      mag: "translate(-12,18) scale(1.08,1.02)",
      grip: "translate(-6,12)"
    },
    extras: {
      fore: ({ base, darken }) => `<path d="M360 168 L454 150 L462 176 L368 194 Z" fill="${darken(base.bodyPrimary,0.16)}" opacity="0.45"/>`
    }
  });

  variants.dmr_modern = extendVariant('battle', {
    label: "现代精确步枪",
    transforms: {
      stock: "translate(-6,-2) scale(1.06,1)",
      body: "scale(1.04,1) translate(0,-4)",
      fore: "translate(18,-6)",
      barrel: "translate(32,-6) scale(1.16,1)",
      muzzle: "translate(36,-6) scale(1.12,1.04)",
      scope: "translate(10,-8) scale(1.08)",
      rail: "translate(-2,-8)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M210 130 L338 104 L354 124 L226 156 Z" fill="${lighten(base.bodyPrimary, 0.22)}" opacity="0.34"/>`
    }
  });

  variants.dmr_classic = extendVariant('battle', {
    label: "经典精确步枪",
    transforms: {
      stock: "translate(-4,4) scale(1.04,1.02)",
      body: "scale(1.02,1) translate(4,2)",
      fore: "translate(10,4)",
      barrel: "translate(20,4) scale(1.12,1)",
      muzzle: "translate(24,4) scale(1.08,1.02)",
      scope: "translate(-2,-6)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M42 182 L150 134 L180 140 L170 198 L90 230 Z" fill="${lighten(base.bodyPrimary, 0.26)}" opacity="0.32"/>`
    }
  });

  variants.dmr_bullpup = extendVariant('bullpup_modern', {
    label: "无托精确步枪",
    transforms: {
      scope: "translate(18,-12) scale(1.12)",
      barrel: "translate(-8,-4) scale(1.12,1.02)",
      muzzle: "translate(-6,-4) scale(1.12,1.02)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M212 150 L320 118 L340 124 L248 170 Z" fill="${darken(base.bodyPrimary, 0.18)}" opacity="0.32"/>`
    }
  });

  variants.ptr_32 = extendVariant('dmr_modern', {
    label: "PTR-32",
    transforms: {
      stock: "translate(-10,4) scale(1.08,1)",
      fore: "translate(20,-2)",
      barrel: "translate(38,-2) scale(1.2,1)",
      muzzle: "translate(42,-2) scale(1.16,1.04)",
      scope: "translate(6,-10) scale(1.12)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M220 140 L340 112 L356 128 L236 162 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.34"/>`
    }
  });

  variants.mk14 = extendVariant('dmr_classic', {
    label: "MK14",
    transforms: {
      stock: "translate(-2,6) scale(1.06,1.02)",
      barrel: "translate(26,4) scale(1.18,1)",
      muzzle: "translate(30,4) scale(1.12,1.02)",
      scope: "translate(-4,-4)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M208 150 L332 116 L352 128 L226 172 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.36"/>`
    }
  });

  variants.scar_h = extendVariant('dmr_modern', {
    label: "SCAR-H",
    transforms: {
      stock: "translate(-12,0) scale(1.12,0.98)",
      body: "translate(-6,-2) scale(1.08,0.98)",
      fore: "translate(18,-6) scale(1.08,0.96)",
      barrel: "translate(34,-6) scale(1.2,0.96)",
      muzzle: "translate(38,-6) scale(1.16,0.98)",
      mag: "translate(-6,6) scale(1.12,1.12)",
      scope: "translate(-6,-10)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M212 136 L330 106 L350 120 L230 160 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.36"/>`,
      mag: ({ base, darken }) => `<path d="M306 170 L360 166 L352 232 L298 230 Z" fill="${darken(base.attachmentPrimary,0.34)}" opacity="0.64"/>`
    }
  });

  variants.m110 = extendVariant('dmr_modern', {
    label: "M110",
    transforms: {
      fore: "translate(24,-4)",
      barrel: "translate(40,-4) scale(1.22,1)",
      muzzle: "translate(44,-4) scale(1.18,1.04)",
      scope: "translate(12,-10) scale(1.1)",
      rail: "translate(-4,-10)"
    },
    extras: {
      barrel: ({ base, darken }) => `<rect x="522" y="132" width="150" height="18" rx="8" fill="${darken(base.attachmentPrimary,0.3)}" opacity="0.52"/>`
    }
  });

  variants.m7 = extendVariant('dmr_modern', {
    label: "M7",
    transforms: {
      stock: "translate(-4,2) scale(1.02,1)",
      fore: "translate(16,-4)",
      barrel: "translate(30,-4) scale(1.18,1)",
      muzzle: "translate(34,-4) scale(1.14,1.04)",
      scope: "translate(8,-12) scale(1.14)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M220 142 L338 112 L354 126 L236 168 Z" fill="${lighten(base.bodySecondary,0.22)}" opacity="0.34"/>`
    }
  });

  variants.fn_fal = extendVariant('dmr_classic', {
    label: "FN FAL",
    transforms: {
      stock: "translate(6,8) scale(1.02,1.02)",
      fore: "translate(6,6)",
      barrel: "translate(18,6) scale(1.16,1)",
      muzzle: "translate(22,6) scale(1.12,1.02)",
      scope: "translate(-6,-2)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M58 190 L160 144 L188 150 L176 206 L90 238 Z" fill="${lighten(base.bodyPrimary,0.22)}" opacity="0.34"/>`
    }
  });

  variants.m14 = extendVariant('dmr_classic', {
    label: "M14",
    transforms: {
      stock: "translate(2,10) scale(1.04,1.04)",
      barrel: "translate(16,8) scale(1.12,1)",
      muzzle: "translate(20,8) scale(1.1,1.02)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M212 150 L332 118 L350 130 L230 172 Z" fill="${lighten(base.bodySecondary,0.2)}" opacity="0.34"/>`
    }
  });

  variants.sks = extendVariant('dmr_classic', {
    label: "SKS",
    transforms: {
      stock: "translate(8,12) scale(1.06,1.06)",
      fore: "translate(8,10)",
      barrel: "translate(18,10) scale(1.14,1)",
      muzzle: "translate(22,10) scale(1.1,1.02)",
      scope: "translate(-8,0)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M68 200 L170 154 L198 160 L182 214 L96 246 Z" fill="${lighten(base.bodyPrimary,0.24)}" opacity="0.34"/>`
    }
  });

  variants.qbu_88 = extendVariant('dmr_bullpup', {
    label: "QBU-88",
    transforms: {
      stock: "translate(24,6) scale(1.08,1)",
      body: "translate(30,2) scale(1.1,0.98)",
      fore: "translate(-18,-4) scale(1.12,0.96)",
      barrel: "translate(-12,-4) scale(1.18,0.96)",
      muzzle: "translate(-10,-4) scale(1.18,0.98)",
      scope: "translate(18,-14) scale(1.14)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M210 150 L330 118 L354 130 L234 174 Z" fill="${lighten(base.bodySecondary,0.22)}" opacity="0.34"/>`
    }
  });

  variants.sniper_bolt = extendVariant('battle', {
    label: "栓动狙击枪",
    transforms: {
      stock: "translate(-8,2) scale(1.08,1)",
      body: "scale(1.08,1) translate(-6,-4)",
      fore: "translate(20,-6)",
      barrel: "translate(44,-6) scale(1.3,1)",
      muzzle: "translate(48,-6) scale(1.26,1.02)",
      scope: "translate(16,-10) scale(1.16)",
      mag: "translate(-16,0) scale(0.92,0.92)",
      grip: "translate(-6,0)"
    },
    extras: {
      body: ({ base, lighten }) => `<path d="M214 138 L336 104 L356 116 L232 160 Z" fill="${lighten(base.bodyPrimary, 0.18)}" opacity="0.32"/>`,
      barrel: ({ base, darken }) => `<rect x="520" y="136" width="150" height="18" rx="8" fill="${darken(base.attachmentPrimary, 0.32)}" opacity="0.55"/>`
    }
  });

  variants.sniper_dragunov = extendVariant('sniper_bolt', {
    label: "半自动狙击枪",
    transforms: {
      stock: "translate(0,6) scale(1.02,0.98)",
      barrel: "translate(32,-2) scale(1.18,1)",
      muzzle: "translate(36,-2) scale(1.14,1)",
      mag: "translate(-10,6) scale(0.98,1.04)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M60 178 L150 140 L182 150 L164 204 L100 230 Z" fill="${darken(base.bodyPrimary, 0.22)}" opacity="0.4"/>`
    }
  });

  variants.svd = extendVariant('sniper_dragunov', {
    label: "SVD",
    transforms: {
      stock: "translate(2,8) scale(1.04,0.98)",
      barrel: "translate(34,0) scale(1.22,1)",
      muzzle: "translate(38,0) scale(1.18,1)",
      mag: "translate(-8,8) scale(1.02,1.08)"
    },
    extras: {
      mag: ({ base, darken }) => `<path d="M300 178 L354 174 L344 232 L292 230 Z" fill="${darken(base.attachmentPrimary,0.36)}" opacity="0.62"/>`
    }
  });

  variants.m24 = extendVariant('sniper_bolt', {
    label: "M24",
    transforms: {
      stock: "translate(-6,6) scale(1.1,1)",
      fore: "translate(24,-4)",
      barrel: "translate(48,-4) scale(1.32,1)",
      muzzle: "translate(52,-4) scale(1.28,1.04)",
      scope: "translate(14,-12) scale(1.18)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M40 190 L148 148 L176 156 L162 208 L84 240 Z" fill="${lighten(base.bodyPrimary,0.24)}" opacity="0.34"/>`
    }
  });

  variants.m700 = extendVariant('sniper_bolt', {
    label: "M700",
    transforms: {
      stock: "translate(-2,8) scale(1.08,1)",
      barrel: "translate(46,-2) scale(1.3,1)",
      muzzle: "translate(50,-2) scale(1.26,1.04)",
      scope: "translate(18,-12) scale(1.16)"
    },
    extras: {
      body: ({ base, darken }) => `<path d="M220 142 L348 110 L364 122 L236 168 Z" fill="${darken(base.bodyPrimary,0.12)}" opacity="0.34"/>`
    }
  });

  variants.mosin = extendVariant('sniper_bolt', {
    label: "Mosin",
    transforms: {
      stock: "translate(4,12) scale(1.12,1.02)",
      fore: "translate(18,6)",
      barrel: "translate(34,6) scale(1.26,1)",
      muzzle: "translate(38,6) scale(1.22,1.02)",
      scope: "translate(-6,-2)"
    },
    extras: {
      stock: ({ base, lighten }) => `<path d="M52 200 L162 154 L188 160 L176 216 L96 248 Z" fill="${lighten(base.bodyPrimary,0.26)}" opacity="0.34"/>`
    }
  });

  variants.lmg_heavy = extendVariant('battle', {
    label: "机枪",
    transforms: {
      stock: "scale(1.04,1.02) translate(-12,4)",
      body: "scale(1.06,1.02) translate(-6,2)",
      fore: "translate(26,0)",
      barrel: "translate(42,0) scale(1.22,1)",
      muzzle: "translate(46,0) scale(1.2,1.06)",
      mag: "translate(-6,10) scale(1.14,1.16)",
      scope: "translate(6,-4)",
      rail: "translate(2,-4)"
    },
    extras: {
      mag: ({ base, darken }) => `<path d="M316 164 L386 160 L380 232 L300 232 Z" fill="${darken(base.attachmentPrimary, 0.32)}" opacity="0.66"/>`,
      body: ({ base, darken }) => `<path d="M248 150 L448 120 L452 150 L256 178 Z" fill="${darken(base.bodyPrimary, 0.2)}" opacity="0.35"/>`
    }
  });

  variants.m249 = extendVariant('lmg_heavy', {
    label: "M249",
    transforms: {
      stock: "translate(-16,2) scale(1.08,1)",
      fore: "translate(32,-2)",
      barrel: "translate(48,-2) scale(1.28,1)",
      muzzle: "translate(52,-2) scale(1.24,1.04)",
      mag: "translate(-12,12) scale(1.2,1.18)",
      rail: "translate(-6,-8)",
      scope: "translate(-2,-8)"
    },
    extras: {
      mag: ({ base, darken }) => `<path d="M300 166 L384 160 L374 240 L292 240 Z" fill="${darken(base.attachmentPrimary,0.36)}" opacity="0.68"/>`,
      body: ({ base, lighten }) => `<path d="M236 150 L420 120 L430 150 L244 180 Z" fill="${lighten(base.bodySecondary,0.18)}" opacity="0.36"/>`
    }
  });

  variants.pkm = extendVariant('lmg_heavy', {
    label: "PKM",
    transforms: {
      stock: "translate(6,10) scale(0.98,0.98)",
      body: "translate(2,6) scale(1.02,1)",
      fore: "translate(10,6) scale(1.08,1)",
      barrel: "translate(24,6) scale(1.32,1.02)",
      muzzle: "translate(30,6) scale(1.28,1.08)",
      mag: "translate(-4,16) scale(1.24,1.22)",
      grip: "translate(-6,10)"
    },
    extras: {
      stock: ({ base, darken }) => `<path d="M30 196 L148 144 L188 150 L170 208 L76 240 Z" fill="${darken(base.bodyPrimary,0.22)}" opacity="0.38"/>`,
      mag: ({ base, darken }) => `<path d="M308 180 L388 176 L376 246 L296 242 Z" fill="${darken(base.attachmentPrimary,0.4)}" opacity="0.7"/>`
    }
  });

  variants.futuristic = variants.futuristic || BASE_VARIANTS.futuristic;

  return variants;
})();

const MODEL_ALIAS_MAP = {
  assault: 'assault',
  battle: 'battle',
  vector: 'smg_vector',
  bullpup: 'bullpup',
  futuristic: 'futuristic',
  m4a1: 'm4a1',
  mcx: 'mcx',
  k416: 'k416',
  g36: 'g36',
  g36c: 'g36c',
  mk18: 'mk18',
  scar_l: 'scar_l',
  sig_552: 'sig_552',
  sg552: 'sig_552',
  ptr_32: 'ptr_32',
  m16: 'm16',
  aug: 'aug',
  famas: 'famas',
  tavor: 'tavor',
  qbz_95: 'qbz_95',
  qbz95_1: 'qbz95_1',
  fn_f2000: 'fn_f2000',
  honey_badger: 'carbine_honey',
  honeybadger: 'carbine_honey',
  ak_47: 'ak_47',
  ak47: 'ak_47',
  ak_74: 'ak_74',
  ak74: 'ak_74',
  ak_74m: 'ak_74m',
  ak74m: 'ak_74m',
  ak_12: 'ak_12',
  ak12: 'ak_12',
  ak117: 'ak117',
  galil: 'galil',
  as_val: 'as_val',
  aks_74u: 'aks_74u',
  '81': 'type81',
  type81: 'type81',
  m249: 'm249',
  pkm: 'pkm',
  mk14: 'mk14',
  scar_h: 'scar_h',
  m110: 'm110',
  m7: 'm7',
  fn_fal: 'fn_fal',
  m14: 'm14',
  sks: 'sks',
  qbu_88: 'qbu_88',
  svd: 'svd',
  m24: 'm24',
  m700: 'm700',
  mosin: 'mosin',
  mp5: 'mp5',
  mp5k: 'mp5k',
  mp5pdw: 'mp5pdw',
  mp7: 'mp7',
  mp9: 'mp9',
  mp_153: 'mp_153',
  mp153: 'mp_153',
  pp_2000: 'pp_2000',
  sig_mpx: 'sig_mpx',
  uzi: 'uzi',
  pp_19: 'pp_19',
  pp_19_01: 'pp_19_01',
  pp19: 'pp_19',
  kriss: 'kriss',
  vector: 'vector',
  p90: 'p90',
  saiga: 'saiga',
  m870: 'm870',
  m590: 'm590',
  m500: 'm500',
  spas_12: 'spas_12',
  usp: 'usp',
  glock: 'glock',
  p226: 'p226',
  m9: 'm9',
  m1911: 'm1911',
  five_seven: 'five_seven',
  deserteagle: 'deserteagle',
  deserteaglehandgun: 'deserteaglehandgun',
  ruger: 'ruger',
  tenglong: 'futuristic'
};

function resolveModelVariant(key){
  const normalized = String(key || "").toLowerCase();
  if (!normalized) return 'assault';
  return MODEL_ALIAS_MAP[normalized] || normalized;
}

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

  function createSvg(info, base, derived, modelKey){
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
    const rawVariantKey = String(modelKey || info.model || "").toLowerCase();
    const variantKey = resolveModelVariant(rawVariantKey);
    const variant = MODEL_VARIANTS[variantKey] || MODEL_VARIANTS.assault;
    const context = { base, derived, lighten, darken };
    const transformAttr = (name) => {
      const value = variant.transforms && variant.transforms[name];
      return value ? ` transform="${value}"` : "";
    };
    const hidden = (name) => Array.isArray(variant.hide) && variant.hide.includes(name);
    const extra = (name) => {
      const entry = variant.extras && variant.extras[name];
      if (!entry) return "";
      return typeof entry === "function" ? entry(context) : entry;
    };

    const stockGroup = hidden("stock") ? "" : `
        <g class="m7-stock"${transformAttr("stock")}>
          <path d="${PATHS.stock}" fill="url(#${stockGradientId})" stroke="${stockEdge}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${stockClipId})">
            <path d="${PATHS.stockPanel}" fill="url(#${stockDetailId})" opacity="0.85"/>
            <path d="${PATHS.stockCore}" fill="${stockHighlight}" opacity="0.28"/>
            <path d="${PATHS.stockSpine}" fill="${lighten(base.bodySecondary, 0.42, 0.45)}" opacity="0.35"/>
            <path d="${PATHS.stockEdge}" fill="${darken(base.bodyPrimary, 0.5)}" opacity="0.22"/>
          </g>
          <path d="${PATHS.stockButt}" fill="${stockEdge}" opacity="0.45"/>
          <g class="m7-stock-ribs">${stockRibs}</g>
          ${extra("stock")}
        </g>`;

    const bodyGroup = hidden("body") ? "" : `
        <g class="m7-body"${transformAttr("body")}>
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
          ${extra("body")}
        </g>`;

    const railGroup = hidden("rail") ? "" : `
        <g class="m7-rail"${transformAttr("rail")}>
          <path d="${PATHS.railShadow}" fill="${darken(base.attachmentPrimary, 0.55)}" opacity="0.28"/>
          <path d="${PATHS.rail}" fill="url(#${accentGradientId})" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.railInset}" fill="${derived.accentHighlight}" opacity="0.5"/>
          <path d="${PATHS.railStep}" fill="${darken(base.attachmentPrimary, 0.4)}" opacity="0.25"/>
          <g class="m7-rail-teeth">${railTeeth}</g>
          <g class="m7-rail-grooves">${railGrooves}</g>
          ${extra("rail")}
        </g>`;

    const scopeGroup = hidden("scope") ? "" : `
        <g class="m7-scope"${transformAttr("scope")}>
          <path d="${PATHS.scopeMount}" fill="${derived.scopeMetal}" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.scopeBracket}" fill="${darken(base.attachmentPrimary, 0.45)}" opacity="0.55"/>
          <path d="${PATHS.scopeBody}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="3" stroke-linejoin="round"/>
          <path d="${PATHS.scopeDetail}" fill="${lighten(base.attachmentSecondary, 0.35)}" opacity="0.4"/>
          <path d="${PATHS.scopeRing}" fill="${derived.accentHighlight}" opacity="0.65"/>
          <path d="${PATHS.scopeKnob}" fill="${darken(base.attachmentPrimary, 0.35)}" stroke="${derived.accentHighlight}" stroke-width="1.8" opacity="0.7"/>
          <path d="${PATHS.scopeGlass}" fill="url(#${glassGradientId})" opacity="0.92"/>
          <circle cx="318" cy="64" r="12" fill="url(#${lensShineId})" opacity="0.8"/>
          <g class="m7-scope-lines">${scopeLines}</g>
          ${extra("scope")}
        </g>`;

    const boltGroup = hidden("body") ? "" : `
        <g class="m7-bolt"${transformAttr("body")}>
          <path d="${PATHS.bolt}" fill="${derived.accentHighlight}" stroke="${derived.bodyShadow}" stroke-width="3" stroke-linejoin="round" opacity="0.82"/>
          <path d="${PATHS.boltRail}" fill="${darken(base.bodyPrimary, 0.45)}" opacity="0.6"/>
          ${extra("bolt")}
        </g>`;

    const bodyDetailGroup = hidden("body") ? "" : `
        <g class="m7-body-detail" clip-path="url(#${bodyClipId})"${transformAttr("body")}>
          <rect x="214" y="112" width="238" height="66" fill="${panelGlow}" opacity="0.16"/>
          ${extra("body_detail")}
        </g>`;

    const foreGroup = hidden("fore") ? "" : `
        <g class="m7-fore" clip-path="url(#${foreClipId})"${transformAttr("fore")}>
          <path d="${PATHS.fore}" fill="url(#${accentGradientId})"/>
          <path d="${PATHS.foreChamfer}" fill="url(#${foreGradientId})" opacity="0.6"/>
          <path d="${PATHS.foreRail}" fill="${darken(base.attachmentPrimary, 0.3)}" opacity="0.35"/>
          <path d="${PATHS.foreLower}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.55"/>
          <path d="${PATHS.foreSlots}" fill="${darken(base.attachmentPrimary, 0.25)}" opacity="0.18"/>
          ${foreSlots}
          ${forePlates}
          <path d="${PATHS.fore}" fill="none" stroke="${derived.accentShadow}" stroke-width="4"/>
          <g class="m7-fore-lines">${foreLines}</g>
          ${extra("fore")}
        </g>`;

    const magGroup = hidden("mag") ? "" : `
        <g class="m7-mag"${transformAttr("mag")}>
          <path d="${PATHS.mag}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${magClipId})">
            <path d="${PATHS.magLight}" fill="url(#${magDetailId})" opacity="0.9"/>
            <path d="${PATHS.magWindow}" fill="${lighten(base.attachmentSecondary, 0.48)}" opacity="0.4"/>
          </g>
          <path d="${PATHS.magPlate}" fill="${darken(base.attachmentPrimary, 0.45)}" opacity="0.72"/>
          <path d="${PATHS.magLatch}" fill="${darken(base.attachmentPrimary, 0.55)}" opacity="0.82"/>
          ${magLines}
          ${magRivets}
          ${extra("mag")}
        </g>`;

    const gripGroup = hidden("grip") ? "" : `
        <g class="m7-grip"${transformAttr("grip")}>
          <path d="${PATHS.grip}" fill="url(#${gripGradientId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <g clip-path="url(#${gripClipId})">
            <path d="${PATHS.gripFront}" fill="url(#${gripDetailId})" opacity="0.78"/>
            <path d="${PATHS.gripInset}" fill="${darken(base.attachmentPrimary, 0.5)}" opacity="0.28"/>
          </g>
          <g class="m7-grip-ridges">${gripRidges}</g>
          ${extra("grip")}
        </g>`;

    const triggerGroup = hidden("trigger") ? "" : `
        <g class="m7-trigger"${transformAttr("trigger")}>
          <path d="${PATHS.triggerGuard}" fill="${gripShadow}" stroke="${derived.accentShadow}" stroke-width="2.4" stroke-linejoin="round" opacity="0.82"/>
          <path d="${PATHS.trigger}" fill="${derived.accentShadow}" stroke="${derived.accentHighlight}" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>
          <path d="${PATHS.triggerCut}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.42"/>
          ${extra("trigger")}
        </g>`;

    const barrelGroup = hidden("barrel") ? "" : `
        <g class="m7-barrel"${transformAttr("barrel")}>
          <path d="${PATHS.barrel}" fill="url(#${accentGradientId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <path d="${PATHS.barrelBottom}" fill="url(#${barrelSteelId})" opacity="0.65"/>
          <path d="${PATHS.barrelTop}" fill="${derived.accentHighlight}" opacity="0.5"/>
          <path d="${PATHS.barrelRidge}" fill="${darken(base.attachmentPrimary, 0.35)}" opacity="0.4"/>
          ${barrelRings}
          ${extra("barrel")}
        </g>`;

    const muzzleGroup = hidden("muzzle") ? "" : `
        <g class="m7-muzzle"${transformAttr("muzzle")}>
          <path d="${PATHS.muzzle}" fill="url(#${accentEdgeId})" stroke="${derived.accentShadow}" stroke-width="4" stroke-linejoin="round"/>
          <path d="${PATHS.muzzleCap}" fill="${muzzleCapColor}" opacity="0.6"/>
          <path d="${PATHS.muzzleCore}" fill="${derived.muzzleCore}" opacity="0.85"/>
          <path d="${PATHS.muzzleVent}" fill="${lighten(base.attachmentSecondary, 0.45)}" opacity="0.38"/>
          ${muzzleLines}
          <path d="${PATHS.muzzle}" fill="url(#${muzzleGradientId})" opacity="0.55"/>
          ${extra("muzzle")}
        </g>`;

    const linesGroup = hidden("body") ? "" : `
        <g class="m7-lines"${transformAttr("body")}>
          <path d="${PATHS.bodyPanel}" fill="none" stroke="${derived.detailLine}" stroke-width="3" stroke-linejoin="round" opacity="0.6"/>
          <path d="${PATHS.bodyMid}" fill="none" stroke="${derived.detailShadow}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
          <path d="${PATHS.bodyCut}" fill="none" stroke="${derived.detailShadow}" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>
          ${extra("lines")}
        </g>`;

    const screwsGroup = hidden("body") ? "" : `
        <g class="m7-screws"${transformAttr("body")}>${screws}${extra("screws")}</g>`;

    const templateGroup = template.overlay ? `
        <g class="m7-template-wrap"${transformAttr("body")}>${template.overlay}</g>` : "";

    const sparksGroup = hidden("body") ? "" : `
        <g class="m7-sparks"${transformAttr("body")}>${sparks}</g>`;

    const effectsGroup = effects.overlay ? `
        <g class="m7-effects-wrap"${transformAttr("body")}>${effects.overlay}</g>` : "";

    const variantEffects = extra("effects");

    return `
      <svg class="skin-preview__svg" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(aria)}">
        <defs>${defs}</defs>
        <g class="m7-shadow"><ellipse cx="320" cy="192" rx="228" ry="26" fill="rgba(0,0,0,0.38)"/></g>
        ${stockGroup}
        ${bodyGroup}
        ${railGroup}
        ${scopeGroup}
        ${boltGroup}
        ${bodyDetailGroup}
        ${foreGroup}
        ${magGroup}
        ${gripGroup}
        ${triggerGroup}
        ${barrelGroup}
        ${muzzleGroup}
        ${linesGroup}
        ${screwsGroup}
        ${templateGroup}
        ${sparksGroup}
        ${effectsGroup}
        ${variantEffects ? `<g class="m7-variant-extras"${transformAttr("body")}>${variantEffects}</g>` : ""}
      </svg>
    `;
  }

  function describe(visual){
    const v = visual || {};
    const bodyRaw = ensureArray(v.body).map(normalizeColor).filter(Boolean);
    const attachRaw = ensureArray(v.attachments).map(normalizeColor).filter(Boolean);
    const templateKey = v.template ? String(v.template).toLowerCase() : "";
    const effectsRaw = ensureArray(v.effects).map(e => String(e || "").toLowerCase()).filter(Boolean);
    const templateLabelRaw = v.template_label || v.templateLabel || "";
    const providedEffectLabels = Array.isArray(v.effect_labels)
      ? v.effect_labels.map(lbl => String(lbl || "").trim()).filter(Boolean)
      : null;
    const modelKey = v.model ? String(v.model) : "";
    const affinityInfo = v.affinity && typeof v.affinity === "object" ? v.affinity : null;

    const attrTags = [];
    const effectTags = [];
    effectsRaw.forEach((tag, idx) => {
      if (typeof tag === "string" && tag.startsWith("affinity:")) {
        attrTags.push({ tag, index: idx });
      } else {
        effectTags.push({ tag, index: idx });
      }
    });

    let effectLabels = [];
    let attributeLabels = [];
    if (providedEffectLabels && providedEffectLabels.length === effectsRaw.length) {
      providedEffectLabels.forEach((label, idx) => {
        const tag = effectsRaw[idx];
        if (tag && tag.startsWith("affinity:")) {
          const clean = label.replace(/属性$/u, "").trim();
          if (clean) attributeLabels.push(clean);
        } else if (label) {
          effectLabels.push(label);
        }
      });
    } else {
      effectTags.forEach(({ tag }) => {
        if (!tag) return;
        effectLabels.push(EFFECT_LABELS[tag] || tag);
      });
      attrTags.forEach(({ tag }) => {
        if (!tag) return;
        attributeLabels.push(ATTRIBUTE_LABELS[tag] || tag.split(":").pop());
      });
    }

    if ((!attributeLabels || attributeLabels.length === 0) && affinityInfo && affinityInfo.label) {
      attributeLabels = [String(affinityInfo.label)];
    }

    return {
      bodyColors: bodyRaw.length ? bodyRaw : [DEFAULT_COLOR],
      attachmentColors: attachRaw.length ? attachRaw : [DEFAULT_COLOR],
      template: templateKey,
      templateLabel: templateLabelRaw
        ? templateLabelRaw
        : (templateKey ? (TEMPLATE_LABELS[templateKey] || templateKey) : "无模板"),
      hidden: !!v.hidden_template,
      effects: effectsRaw,
      effectsLabel: effectLabels.length ? effectLabels.join("、") : "无特效",
      bodyText: (bodyRaw.length ? bodyRaw : [DEFAULT_COLOR]).map(c => c.name).join(" / "),
      attachmentText: (attachRaw.length ? attachRaw : [DEFAULT_COLOR]).map(c => c.name).join(" / "),
      model: modelKey,
      attributes: attributeLabels,
      attributeText: attributeLabels.length ? attributeLabels.join(" / ") : "",
    };
  }

  function formatMeta(visual){
    const info = describe(visual);
    const parts = [
      `主体：${info.bodyText}`,
      `配件：${info.attachmentText}`,
      `模板：${info.templateLabel}`,
      `特效：${info.effectsLabel}`
    ];
    if (info.attributeText) parts.push(`属性：${info.attributeText}`);
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
    const rawModelKey = String(info.model || (visual && visual.model) || (opts && opts.model) || "").toLowerCase();
    const resolvedModelKey = resolveModelVariant(rawModelKey);
    if (rawModelKey) {
      classes.push(`skin-preview--${rawModelKey}`);
    }
    if (resolvedModelKey && resolvedModelKey !== rawModelKey) {
      classes.push(`skin-preview--${resolvedModelKey}`);
    }
    if (resolvedModelKey) {
      const variant = MODEL_VARIANTS[resolvedModelKey];
      if (variant && Array.isArray(variant.classes)) {
        variant.classes.forEach(cls => classes.push(cls));
      }
    }

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

    const svg = createSvg(info, base, derived, resolvedModelKey);

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
    modelLabel: (key) => {
      const normalized = String(key || "").toLowerCase();
      if (!normalized) return "";
      const resolved = resolveModelVariant(normalized);
      const variant = MODEL_VARIANTS[resolved];
      if (variant && variant.label) return variant.label;
      if (MODEL_VARIANTS[normalized] && MODEL_VARIANTS[normalized].label) {
        return MODEL_VARIANTS[normalized].label;
      }
      return normalized;
    }
  };
})();
