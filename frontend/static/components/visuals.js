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

  const win = typeof window !== "undefined" ? window : undefined;
  const doc = typeof document !== "undefined" ? document : undefined;

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

  function rgbToHex(r, g, b){
    const toHex = (n) => {
      const clamped = Math.max(0, Math.min(255, Math.round(n)));
      return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function toRgba(hex, alpha){
    const { r, g, b } = hexToRgb(hex);
    const a = typeof alpha === 'number' ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function adjustHex(hex, amount){
    const { r, g, b } = hexToRgb(hex);
    const t = Math.max(-1, Math.min(1, amount || 0));
    const adjust = (value) => {
      if (t >= 0) {
        return value + (255 - value) * t;
      }
      return value * (1 + t);
    };
    return rgbToHex(adjust(r), adjust(g), adjust(b));
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function hashString(str){
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createRng(seed){
    let s = (seed || 0) >>> 0;
    return function(){
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function degToRad(deg){
    return deg * Math.PI / 180;
  }

  function normalizeVec(v){
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function dot(a, b){
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  const LIGHT_DIR = normalizeVec({ x: -0.35, y: 0.62, z: 0.7 });

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

  function vec(x, y, z){
    return { x, y, z };
  }

  function rotatePoint(v, rotation){
    let { x, y, z } = v;
    if (rotation.y) {
      const cy = Math.cos(rotation.y), sy = Math.sin(rotation.y);
      const nx = x * cy - z * sy;
      const nz = x * sy + z * cy;
      x = nx; z = nz;
    }
    if (rotation.x) {
      const cx = Math.cos(rotation.x), sx = Math.sin(rotation.x);
      const ny = y * cx - z * sx;
      const nz = y * sx + z * cx;
      y = ny; z = nz;
    }
    if (rotation.z) {
      const cz = Math.cos(rotation.z), sz = Math.sin(rotation.z);
      const nx = x * cz - y * sz;
      const ny = x * sz + y * cz;
      x = nx; y = ny;
    }
    return { x, y, z };
  }

  function rotateNormal(normal, rotation){
    return rotatePoint(normal, rotation);
  }

  function shadeFace(color, normal){
    const base = hexToRgb(color || DEFAULT_COLOR.hex);
    const n = normalizeVec(normal);
    const intensity = 0.32 + Math.max(0, dot(n, LIGHT_DIR)) * 0.68;
    const ambient = 0.18;
    const r = clamp(Math.round(base.r * intensity + 255 * ambient * (1 - intensity)), 0, 255);
    const g = clamp(Math.round(base.g * intensity + 255 * ambient * (1 - intensity)), 0, 255);
    const b = clamp(Math.round(base.b * intensity + 255 * ambient * (1 - intensity)), 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function createBox(center, size, colors){
    colors = colors || {};
    const faces = [];
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
    const verts = [
      vec(center.x - hx, center.y - hy, center.z - hz),
      vec(center.x + hx, center.y - hy, center.z - hz),
      vec(center.x + hx, center.y + hy, center.z - hz),
      vec(center.x - hx, center.y + hy, center.z - hz),
      vec(center.x - hx, center.y - hy, center.z + hz),
      vec(center.x + hx, center.y - hy, center.z + hz),
      vec(center.x + hx, center.y + hy, center.z + hz),
      vec(center.x - hx, center.y + hy, center.z + hz)
    ];

    function add(indices, normal, color, stroke){
      const baseColor = sanitizeHex(color || colors.color || DEFAULT_COLOR.hex);
      const strokeColor = stroke || colors.stroke || adjustHex(baseColor, -0.45);
      faces.push({
        vertices: indices.map(i => verts[i]),
        normal,
        color: baseColor,
        stroke: sanitizeHex(strokeColor),
        strokeWidth: colors.strokeWidth || 0.9
      });
    }

    add([0, 1, 2, 3], { x: 0, y: 0, z: -1 }, colors.front);
    add([5, 4, 7, 6], { x: 0, y: 0, z: 1 }, colors.back);
    add([4, 0, 3, 7], { x: -1, y: 0, z: 0 }, colors.left);
    add([1, 5, 6, 2], { x: 1, y: 0, z: 0 }, colors.right);
    add([4, 5, 1, 0], { x: 0, y: -1, z: 0 }, colors.bottom);
    add([3, 2, 6, 7], { x: 0, y: 1, z: 0 }, colors.top);
    return faces;
  }

  function createGrip(center, size, colors){
    colors = colors || {};
    const faces = [];
    const hw = size.width / 2;
    const hh = size.height / 2;
    const hd = size.depth / 2;
    const slant = size.slant || size.width * 0.45;

    const verts = [
      vec(center.x - hw, center.y + hh, center.z - hd),
      vec(center.x + hw, center.y + hh, center.z - hd),
      vec(center.x + hw * 0.8, center.y - hh, center.z - hd + slant * 0.18),
      vec(center.x - hw * 0.35, center.y - hh, center.z - hd + slant * 0.22),
      vec(center.x - hw, center.y + hh, center.z + hd),
      vec(center.x + hw, center.y + hh, center.z + hd),
      vec(center.x + hw * 0.8, center.y - hh, center.z + hd - slant * 0.18),
      vec(center.x - hw * 0.35, center.y - hh, center.z + hd - slant * 0.22)
    ];

    function add(indices, normal, color, stroke){
      const baseColor = sanitizeHex(color || colors.color || DEFAULT_COLOR.hex);
      const strokeColor = stroke || colors.stroke || adjustHex(baseColor, -0.45);
      faces.push({
        vertices: indices.map(i => verts[i]),
        normal,
        color: baseColor,
        stroke: sanitizeHex(strokeColor),
        strokeWidth: colors.strokeWidth || 0.85
      });
    }

    add([0, 1, 2, 3], { x: 0, y: 0, z: -1 }, colors.front);
    add([5, 4, 7, 6], { x: 0, y: 0, z: 1 }, colors.back);
    add([4, 0, 3, 7], { x: -1, y: 0, z: 0 }, colors.left);
    add([1, 5, 6, 2], { x: 1, y: 0, z: 0 }, colors.right);
    add([4, 5, 1, 0], { x: 0, y: -1, z: 0 }, colors.bottom);
    add([3, 2, 6, 7], { x: 0, y: 1, z: 0 }, colors.top);
    return faces;
  }

  function buildModel(palette){
    const faces = [];
    faces.push(...createBox({ x: -4, y: 0, z: 0 }, { x: 52, y: 12, z: 12 }, {
      color: palette.bodyMain,
      top: palette.bodyPanel,
      bottom: palette.bodyEdge,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: 10, y: 8, z: 0 }, { x: 36, y: 8, z: 10 }, {
      color: palette.bodySecondary,
      top: palette.bodyPanel,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: 12, y: 13, z: 0 }, { x: 30, y: 4, z: 8 }, {
      color: palette.bodyPanel,
      top: palette.bodyPanel,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: 30, y: 1, z: 0 }, { x: 24, y: 10, z: 12 }, {
      color: palette.attachMain,
      top: palette.attachBright,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 32, y: 8, z: 0 }, { x: 24, y: 6, z: 10 }, {
      color: palette.attachSecondary,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 40, y: 5, z: 0 }, { x: 38, y: 4, z: 4 }, {
      color: palette.attachEdge,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 60, y: 4, z: 0 }, { x: 12, y: 6, z: 6 }, {
      color: palette.muzzle,
      stroke: adjustHex(palette.muzzle, -0.35)
    }));
    faces.push(...createBox({ x: 32, y: 5, z: 0 }, { x: 10, y: 5, z: 8 }, {
      color: palette.attachSecondary,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: -36, y: 2, z: 0 }, { x: 24, y: 12, z: 10 }, {
      color: palette.bodySecondary,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: -22, y: 5, z: 0 }, { x: 16, y: 6, z: 6 }, {
      color: palette.bodyMain,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: -48, y: 2, z: 0 }, { x: 8, y: 13, z: 11 }, {
      color: palette.bodyRidge,
      stroke: adjustHex(palette.bodyRidge, -0.2)
    }));
    faces.push(...createBox({ x: -6, y: 6, z: 0 }, { x: 16, y: 8, z: 10 }, {
      color: palette.bodySecondary,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: 0, y: -4, z: 0 }, { x: 20, y: 14, z: 12 }, {
      color: palette.bodyMain,
      stroke: palette.bodyRidge
    }));
    faces.push(...createBox({ x: 6, y: -16, z: 0 }, { x: 12, y: 20, z: 8 }, {
      color: palette.attachMain,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 6, y: -26, z: 0 }, { x: 12, y: 4, z: 8 }, {
      color: palette.attachEdge,
      stroke: palette.attachEdge
    }));
    faces.push(...createGrip({ x: -10, y: -6, z: 0 }, { width: 12, height: 18, depth: 10, slant: 6 }, {
      color: palette.attachSecondary,
      back: palette.attachMain,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: -10, y: 10, z: 0 }, { x: 18, y: 6, z: 10 }, {
      color: palette.attachSecondary,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: -14, y: 14, z: 0 }, { x: 16, y: 6, z: 8 }, {
      color: palette.attachBright,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: -18, y: 14, z: 0 }, { x: 8, y: 6, z: 6 }, {
      color: palette.glass,
      stroke: adjustHex(palette.glass, -0.3)
    }));
    faces.push(...createBox({ x: 28, y: -6, z: 0 }, { x: 12, y: 6, z: 10 }, {
      color: palette.attachSecondary,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 32, y: -10, z: 0 }, { x: 10, y: 6, z: 8 }, {
      color: palette.attachBright,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 24, y: -12, z: 0 }, { x: 10, y: 5, z: 8 }, {
      color: palette.attachMain,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 36, y: 2, z: 6.5 }, { x: 18, y: 8, z: 3 }, {
      color: palette.attachBright,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: 36, y: 2, z: -6.5 }, { x: 18, y: 8, z: 3 }, {
      color: palette.attachBright,
      stroke: palette.attachEdge
    }));
    faces.push(...createBox({ x: -4, y: -10, z: 0 }, { x: 10, y: 6, z: 10 }, {
      color: palette.bodyRidge,
      stroke: palette.bodyEdge
    }));
    return faces;
  }

  function projectVertex(vertex, rotation, camera){
    const rotated = rotatePoint(vertex, rotation);
    const shifted = {
      x: rotated.x + camera.offset.x,
      y: rotated.y + camera.offset.y,
      z: rotated.z + camera.offset.z
    };
    const depth = camera.distance + shifted.z;
    const scale = camera.distance / (camera.distance + shifted.z);
    return {
      sx: camera.centerX + shifted.x * scale * camera.scale,
      sy: camera.centerY - shifted.y * scale * camera.scale,
      depth,
      z: shifted.z
    };
  }

  function renderModel(ctx, faces, view){
    const rng = createRng(view.seed ^ 0x9e3779b9);
    const rotation = {
      y: degToRad(-30 + (rng() - 0.5) * 12),
      x: degToRad(-10 + (rng() - 0.5) * 6),
      z: degToRad(-4 + (rng() - 0.5) * 4)
    };
    const camera = {
      distance: 340,
      offset: { x: -6, y: -4, z: 140 },
      centerX: view.width * (view.compact ? 0.52 : 0.5),
      centerY: view.height * (view.compact ? 0.66 : 0.7),
      scale: view.compact ? 1.25 : 1.36
    };

    const projected = faces.map(face => {
      const normal = rotateNormal(face.normal, rotation);
      const pts = face.vertices.map(v => projectVertex(v, rotation, camera));
      const depth = pts.reduce((acc, p) => acc + p.z, 0) / pts.length;
      return {
        points: pts,
        depth,
        fill: shadeFace(face.color, normal),
        stroke: shadeFace(face.stroke || face.color, normal),
        strokeWidth: face.strokeWidth || 0.9
      };
    });

    projected.sort((a, b) => a.depth - b.depth);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    projected.forEach(face => {
      ctx.beginPath();
      face.points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      });
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      ctx.strokeStyle = face.stroke;
      ctx.lineWidth = face.strokeWidth;
      ctx.stroke();
    });
  }

  function drawBackground(ctx, view){
    const base = ctx.createLinearGradient(0, 0, 0, view.height);
    base.addColorStop(0, 'rgba(12, 16, 26, 0.95)');
    base.addColorStop(1, 'rgba(6, 10, 18, 0.96)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, view.width, view.height);

    const accent = ctx.createLinearGradient(0, 0, view.width, 0);
    accent.addColorStop(0, toRgba(view.palette.bodySecondary, 0.08));
    accent.addColorStop(0.6, 'rgba(0,0,0,0)');
    accent.addColorStop(1, toRgba(view.palette.attachBright, 0.08));
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, view.width, view.height);

    const halo = ctx.createRadialGradient(view.width * 0.22, view.height * 0.18, 10, view.width * 0.22, view.height * 0.18, view.width * 0.9);
    halo.addColorStop(0, 'rgba(255,255,255,0.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, view.width, view.height);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(view.width * 0.5, view.height * 0.8, view.width * 0.34, view.height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const TEMPLATE_PAINTERS = {
    diamond_veil(ctx, view, palette, rng){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(0, 0, view.width, view.height);
      grad.addColorStop(0, 'rgba(180, 220, 255, 0.14)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(120, 180, 255, 0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, view.width, view.height);

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let x = -view.height; x < view.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + view.height, view.height);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(140,200,255,0.18)';
      for (let x = 0; x < view.width + view.height; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, view.height);
        ctx.lineTo(x - view.height, 0);
        ctx.stroke();
      }

      for (let i = 0; i < 26; i++) {
        const x = view.width * rng();
        const y = view.height * (0.25 + 0.5 * rng());
        const r = 1.2 + rng() * 2.4;
        const sparkle = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        sparkle.addColorStop(0, 'rgba(255,255,255,0.95)');
        sparkle.addColorStop(0.5, 'rgba(200,240,255,0.45)');
        sparkle.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sparkle;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    prism_flux(ctx, view, palette, rng){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const start = (i / bands) * view.height;
        const end = start + view.height * 0.28;
        const gradient = ctx.createLinearGradient(0, start, view.width, end);
        gradient.addColorStop(0, toRgba(palette.attachBright, 0.14));
        gradient.addColorStop(0.6, 'rgba(255,255,255,0.0)');
        gradient.addColorStop(1, toRgba(palette.bodyPanel, 0.1));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(-view.width * 0.15, start);
        ctx.lineTo(view.width * 1.05, start + view.height * 0.12 + rng() * 6);
        ctx.lineTo(view.width * 1.05, end + view.height * 0.12 + rng() * 6);
        ctx.lineTo(-view.width * 0.15, end);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    ember_strata(ctx, view, palette){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
      gradient.addColorStop(0, toRgba(palette.attachMain, 0.2));
      gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, toRgba(palette.attachSecondary, 0.18));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.strokeStyle = toRgba(palette.attachBright, 0.25);
      ctx.lineWidth = 1.2;
      for (let y = view.height * 0.25; y < view.height * 0.85; y += 14) {
        ctx.beginPath();
        ctx.moveTo(view.width * 0.1, y);
        ctx.lineTo(view.width * 0.9, y - 6);
        ctx.stroke();
      }
      ctx.restore();
    },
    urban_mesh(ctx, view, palette){
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.strokeStyle = toRgba(palette.bodyPanel, 0.35);
      ctx.lineWidth = 1;
      const step = 18;
      for (let x = -view.width * 0.2; x < view.width * 1.2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + view.height * 0.2, view.height);
        ctx.stroke();
      }
      for (let y = -view.height * 0.2; y < view.height * 1.2; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(view.width, y + view.width * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    },
    fiber_wave(ctx, view, palette, rng){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = toRgba(palette.attachBright, 0.35);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const phase = rng() * Math.PI * 2;
        ctx.beginPath();
        for (let x = 0; x <= view.width; x += 6) {
          const y = view.height * 0.5 + Math.sin((x / view.width) * Math.PI * 2 + phase) * view.height * 0.08;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    midnight_line(ctx, view, palette){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gradient = ctx.createLinearGradient(0, 0, view.width, 0);
      gradient.addColorStop(0, toRgba(palette.bodySecondary, 0.15));
      gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, toRgba(palette.attachBright, 0.12));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    },
    field_classic(ctx, view, palette){
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = toRgba(palette.bodySecondary, 0.22);
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    },
    steel_ridge(ctx, view, palette){
      TEMPLATE_PAINTERS.field_classic(ctx, view, palette);
    },
    matte_guard(ctx, view){
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(40, 50, 60, 0.18)';
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    },
    default(ctx, view, palette){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gradient = ctx.createLinearGradient(0, view.height * 0.2, view.width, view.height * 0.8);
      gradient.addColorStop(0, toRgba(palette.attachBright, 0.12));
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }
  };

  function drawTemplateOverlay(ctx, view, rng){
    const painter = TEMPLATE_PAINTERS[view.template] || TEMPLATE_PAINTERS.default;
    painter(ctx, view, view.palette, rng);
    if (view.hidden && view.template !== 'diamond_veil') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const x = view.width * rng();
        const y = view.height * (0.28 + 0.52 * rng());
        const radius = 1 + rng() * 1.8;
        const sparkle = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        sparkle.addColorStop(0, 'rgba(255,255,255,0.9)');
        sparkle.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sparkle;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEffects(ctx, view, rng){
    if (!view.effects || !view.effects.length) return;
    const effects = new Set(view.effects);

    if (effects.has('glow')) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(view.width * 0.82, view.height * 0.6, 6, view.width * 0.82, view.height * 0.6, 60);
      glow.addColorStop(0, toRgba(view.palette.glow, 0.4));
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }

    if (effects.has('pulse')) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = toRgba(view.palette.glow, 0.32);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const radius = 30 + i * 14;
        ctx.beginPath();
        ctx.ellipse(view.width * 0.5, view.height * 0.72, radius * 1.1, radius * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (effects.has('trail')) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gradient = ctx.createLinearGradient(view.width * 0.6, view.height * 0.6, view.width, view.height * 0.55);
      gradient.addColorStop(0, toRgba(view.palette.glow, 0.35));
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(view.width * 0.58, view.height * 0.64);
      ctx.lineTo(view.width * 0.98, view.height * 0.58);
      ctx.lineTo(view.width * 0.98, view.height * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (effects.has('sheen')) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sheen = ctx.createLinearGradient(0, 0, view.width, view.height);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }

    if (effects.has('sparkle')) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const x = view.width * rng();
        const y = view.height * (0.3 + 0.5 * rng());
        const r = 0.8 + rng() * 1.8;
        const sparkle = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        sparkle.addColorStop(0, 'rgba(255,255,255,0.9)');
        sparkle.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sparkle;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (effects.has('refraction')) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const prism = ctx.createLinearGradient(view.width * 0.6, view.height * 0.4, view.width * 0.95, view.height * 0.7);
      prism.addColorStop(0, 'rgba(180,240,255,0.35)');
      prism.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = prism;
      ctx.beginPath();
      ctx.moveTo(view.width * 0.58, view.height * 0.46);
      ctx.lineTo(view.width * 0.96, view.height * 0.36);
      ctx.lineTo(view.width * 0.96, view.height * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (effects.has('flux')) {
      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge';
      const gradient = ctx.createLinearGradient(0, 0, view.width, 0);
      gradient.addColorStop(0, 'rgba(160,120,255,0.12)');
      gradient.addColorStop(0.5, 'rgba(120,220,255,0.18)');
      gradient.addColorStop(1, 'rgba(255,180,220,0.12)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }
  }

  function computePalette(info){
    const bodyMain = info.bodyColors[0].hex;
    const bodySecondary = (info.bodyColors[1] || info.bodyColors[0]).hex;
    const attachMain = info.attachmentColors[0].hex;
    const attachSecondary = (info.attachmentColors[1] || info.attachmentColors[0]).hex;
    return {
      bodyMain,
      bodySecondary,
      bodyPanel: adjustHex(bodySecondary, 0.18),
      bodyEdge: adjustHex(bodyMain, -0.3),
      bodyRidge: adjustHex(bodyMain, -0.45),
      attachMain,
      attachSecondary,
      attachBright: adjustHex(attachSecondary, 0.28),
      attachEdge: adjustHex(attachMain, -0.35),
      muzzle: adjustHex(attachMain, 0.5),
      glass: adjustHex(attachSecondary, 0.6),
      glow: adjustHex(attachSecondary, 0.65)
    };
  }

  function hashVisual(info){
    const data = [
      info.template,
      info.hidden ? '1' : '0',
      info.bodyColors.map(c => c.hex).join(','),
      info.attachmentColors.map(c => c.hex).join(','),
      info.effects.join(',')
    ].join('|');
    return hashString(data);
  }

  function drawSkin(canvas, view){
    if (!canvas) return;
    const ratio = win && win.devicePixelRatio ? win.devicePixelRatio : 1;
    const width = Math.max(10, Math.floor(view.width));
    const height = Math.max(10, Math.floor(view.height));
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    drawBackground(ctx, view);
    const faces = buildModel(view.palette);
    renderModel(ctx, faces, view);
    drawTemplateOverlay(ctx, view, createRng(view.seed ^ 0x85ebca6b));
    drawEffects(ctx, view, createRng(view.seed ^ 0xc2b2ae35));
    ctx.restore();
  }

  const pending = new Map();
  let flushQueued = false;
  let counter = 0;

  function scheduleFlush(){
    if (flushQueued) return;
    flushQueued = true;
    const runner = () => flushPending();
    if (win && typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(runner);
    } else {
      setTimeout(runner, 16);
    }
  }

  function flushPending(){
    flushQueued = false;
    if (!doc) return;
    let missing = false;
    pending.forEach((view, id) => {
      const canvas = doc.querySelector(`canvas[data-skin-visual="${id}"]`);
      if (!canvas) {
        missing = true;
        return;
      }
      drawSkin(canvas, view);
      pending.delete(id);
    });
    if (missing) scheduleFlush();
  }

  if (doc) {
    doc.addEventListener('DOMContentLoaded', flushPending);
    if (win && typeof win.MutationObserver === 'function') {
      const observer = new win.MutationObserver(() => scheduleFlush());
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
  }

  function prepareView(info, opts){
    const width = Math.round(opts.width || (opts.compact ? 260 : 340));
    const height = Math.round(opts.height || (opts.compact ? 130 : 160));
    const palette = computePalette(info);
    const seed = hashVisual(info);
    return {
      width,
      height,
      palette,
      template: info.template,
      hidden: info.hidden,
      effects: info.effects.slice(),
      seed,
      compact: !!opts.compact
    };
  }

  function render(visual, opts){
    opts = opts || {};
    const info = describe(visual);
    const view = prepareView(info, opts);
    const classes = ["skin-preview"];
    if (opts.compact) classes.push("skin-preview--compact");
    if (info.hidden) classes.push("is-hidden-template");
    const tmplCls = TEMPLATE_CLASS_MAP[info.template];
    if (tmplCls) classes.push(tmplCls);
    info.effects.forEach(e => {
      const cls = EFFECT_CLASS_MAP[e];
      if (cls) classes.push(cls);
    });

    const width = view.width;
    const height = view.height;
    const label = opts.label ? `<div class="skin-preview__label">${esc(opts.label)}</div>` : "";
    const metaText = opts.meta === false ? "" : (opts.meta || formatMeta(visual));
    const meta = metaText ? `<div class="skin-preview__meta">${esc(metaText)}</div>` : "";
    const containerStyle = `--preview-width:${width}px; --preview-height:${height}px;`;
    const canvasStyle = `width:${width}px; height:${height}px; --accent-glow:${view.palette.glow};`;
    const id = `sv-${++counter}`;

    pending.set(id, view);
    scheduleFlush();

    const aria = `role="img" aria-label="${esc(info.templateLabel)}"`;

    return `
      <div class="${classes.join(' ')}" style="${containerStyle}">
        <div class="skin-preview__canvas" style="${canvasStyle}">
          <canvas class="skin-preview__render" data-skin-visual="${id}" ${aria}></canvas>
        </div>
        ${label}
        ${meta}
      </div>
    `;
  }

  const api = {
    render,
    describe,
    formatMeta,
    templateLabel: (key) => TEMPLATE_LABELS[String(key || "").toLowerCase()] || key,
    effectLabel: (key) => EFFECT_LABELS[String(key || "").toLowerCase()] || key
  };

  if (win) {
    win.SkinVisuals = api;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.SkinVisuals = api;
  }
})();
