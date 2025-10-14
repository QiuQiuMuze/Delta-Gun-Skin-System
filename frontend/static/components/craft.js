// frontend/static/components/craft.js
const CraftPage = {
  _rarity: "GREEN",
  _data: { GREEN:[], BLUE:[], PURPLE:[] },
  _selected: new Set(),
  _indexMap: [],            // 当前“页内”序号 → inv_id
  _page: 1,
  _pageSize: 50,
  _skip: false,

  async render() {
    // 先渲染骨架，异步加载数据
    setTimeout(()=>this._load(false), 0);
    return `
      <div class="card">
        <h2>合成</h2>
        <div class="input-row">
          <button class="btn" data-r="GREEN">GREEN → BLUE</button>
          <button class="btn" data-r="BLUE">BLUE → PURPLE</button>
          <button class="btn" data-r="PURPLE">PURPLE → BRICK</button>
        </div>

        <!-- 顶部：合成摘要 + 合成按钮 + 跳过动画 -->
        <div id="craft-summary" class="card" style="position:sticky; top:64px; z-index:5;"></div>

        <!-- 顶部：动画/结果呈现区（保留，不随库存刷新而清空） -->
        <div id="craft-stage"></div>
        <div id="craft-result"></div>

        <!-- 工具栏（序号选择/自动放置/清空） -->
        <div id="craft-toolbar" class="card" style="display:none;"></div>

        <!-- 列表 + 单一分页（底部） -->
        <div id="craft-list" class="card"></div>
        <div id="craft-pagination" class="card" style="display:none;"></div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll('[data-r]').forEach(b=>{
      b.onclick = ()=> this._switchRarity(b.dataset.r);
    });
  },

  // —— 加载库存：updateOnly=true 时仅更新数据，不重置顶部结果UI —— //
  async _load(updateOnly=false) {
    let grouped = await API.inventoryByColor().catch(()=>null);
    if (!grouped || (!grouped.GREEN && !grouped.BLUE && !grouped.PURPLE)) {
      const flat = await API.inventory().catch(()=>({items:[]}));
      grouped = this._groupClientSide(flat.items || flat || []);
    }
    this._data.GREEN = (grouped.GREEN || []).map(x=>this._norm(x)).filter(x=>x.rarity==="GREEN");
    this._data.BLUE  = (grouped.BLUE  || []).map(x=>this._norm(x)).filter(x=>x.rarity==="BLUE");
    this._data.PURPLE= (grouped.PURPLE|| []).map(x=>this._norm(x)).filter(x=>x.rarity==="PURPLE");

    if (updateOnly) {
      // 仅刷新列表与分页、摘要，保留 craft-stage / craft-result
      this._renderListAndPager();
      this._renderSummary();
    } else {
      this._switchRarity(this._rarity);
    }
  },

  _groupClientSide(list){ const g={GREEN:[],BLUE:[],PURPLE:[],BRICK:[]}; for(const it of list){const r=(it.rarity||it.color||"").toUpperCase(); (g[r]||(g[r]=[])).push(it);} return g; },
  _norm(x){
    const inv_id = x.inv_id ?? x.id ?? x.inventory_id ?? "";
    const name   = x.name ?? x.skin_name ?? "";
    const rarity = (x.rarity ?? x.color ?? "").toUpperCase();
    const wear   = (x.wear !== undefined) ? Number(x.wear)
                 : (typeof x.wear_bp==="number" ? Number((x.wear_bp/100).toFixed(2)) : NaN);
    const grade  = x.grade ?? x.quality ?? "";
    const serial = x.serial ?? x.sn ?? "";
    return { inv_id, name, rarity, wear, grade, serial };
  },

  _rarityToTarget(r){ return { GREEN:"BLUE", BLUE:"PURPLE", PURPLE:"BRICK" }[r] || ""; },
  _rarityClass(r){ if(r==="BRICK")return"hl-orange"; if(r==="PURPLE")return"hl-purple"; if(r==="BLUE")return"hl-blue"; return"hl-green"; },
  _gradeClass(g){ return {S:"grade-s",A:"grade-a",B:"grade-b",C:"grade-c"}[g] || ""; },

  _renderPreviewCell(x, opts = {}) {
    if (!window.SkinVisuals) return "-";
    const visual = x.visual || {
      body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects
    };
    const html = SkinVisuals.render(visual, { compact: true, meta: opts.metaText ?? false });
    return `<div class="market-preview-cell">${html}</div>`;
  },

  _visualMeta(x) {
    if (!window.SkinVisuals) return "";
    const visual = x.visual || {
      body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects
    };
    const info = SkinVisuals.describe(visual);
    const parts = [
      `主体：${info.bodyText}`,
      `配件：${info.attachmentText}`,
      SkinVisuals.formatMeta(visual)
    ];
    return parts.join(" · ");
  },

  _switchRarity(r){
    this._rarity = r;
    this._page = 1;                // 切换时回到第 1 页
    this._selected.clear();        // 切换时清空已选
    document.querySelectorAll('[data-r]').forEach(b=> b.classList.toggle("active", b.dataset.r===r));

    // 清空顶部动画/结果（只在切换稀有度时清）
    byId("craft-stage").innerHTML = "";
    byId("craft-result").innerHTML = "";

    this._renderSummary();
    this._renderToolbar();
    this._renderListAndPager();
  },

  _renderSummary(){
    const need = 20;
    const sel = Array.from(this._selected);
    const box = byId("craft-summary");
    box.style.display = "block";
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>已选：<strong>${sel.length}</strong> / ${need}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;max-height:100px;overflow:auto;">
          ${sel.map(id=>`<span class="badge">${id}</span>`).join("") || `<span class="badge">（空）</span>`}
        </div>
        <div>
          <button class="btn" id="do-craft" ${sel.length===need?"":"disabled"}>合成</button>
          <button class="btn" id="skip" style="display:none;">跳过动画</button>
        </div>
      </div>
    `;
    byId("do-craft").onclick = ()=> this._doCraft(sel, need);
    const sk = byId("skip"); if (sk) sk.onclick = ()=> this._skip = true;
  },

  _renderToolbar(){
    const target = this._rarityToTarget(this._rarity);
    const box = byId("craft-toolbar");
    box.style.display = "block";
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <strong>从 <span class="${this._rarityClass(this._rarity)}">${this._rarity}</span> 合成 → <span class="${this._rarityClass(target)}">${target}</span></strong>
        </div>
        <div class="input-row" style="margin:0;">
          <input id="seq-input" placeholder="按序号（当前页）：如 1,3,5-12,20" style="min-width:280px"/>
          <button class="btn" id="seq-apply">添加</button>
          <button class="btn" id="auto-low">自动放置（磨损最低 20）</button>
          <button class="btn" id="auto-high">自动放置（磨损最高 20）</button>
          <button class="btn" id="auto-rand">随机 20</button>
          <button class="btn" id="sel-clear">清空选择</button>
        </div>
      </div>
    `;
    byId("seq-apply").onclick = ()=>{ const txt=(byId("seq-input").value||"").trim(); if(!txt)return;
      const idxs=this._parseSeq(txt,this._indexMap.length); idxs.forEach(i=>{const inv=this._indexMap[i-1]; if(inv)this._selected.add(inv);});
      this._renderListAndPager(); this._renderSummary(); };
    byId("auto-low").onclick = ()=>{ this._autoPick("low");  this._renderListAndPager(); this._renderSummary(); };
    byId("auto-high").onclick= ()=>{ this._autoPick("high"); this._renderListAndPager(); this._renderSummary(); };
    byId("auto-rand").onclick= ()=>{ this._autoPick("rand"); this._renderListAndPager(); this._renderSummary(); };
    byId("sel-clear").onclick = ()=>{ this._selected.clear(); this._renderListAndPager(); this._renderSummary(); };
  },

  _sortedAll() {
    // 全量排序（S>A>B>C，磨损升序）
    const arr = (this._data[this._rarity] || []).slice();
    const gradeOrder={S:0,A:1,B:2,C:3};
    arr.sort((a,b)=> (gradeOrder[a.grade]??9)-(gradeOrder[b.grade]??9) || ((isNaN(a.wear)?999:a.wear)-(isNaN(b.wear)?999:b.wear)));
    return arr;
  },

  _renderListAndPager() {
    const listBox = byId("craft-list");
    const pager = byId("craft-pagination");

    const all = this._sortedAll();
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / this._pageSize));
    this._page = Math.min(Math.max(1, this._page), totalPages);

    const start = (this._page - 1) * this._pageSize;
    const pageArr = all.slice(start, start + this._pageSize);

    // 页内索引
    this._indexMap = pageArr.map(x=>x.inv_id);

    // 表格
    const rows = pageArr.map((x,i)=>{
      const checked=this._selected.has(x.inv_id)?"checked":"";
      const rc=this._rarityClass(x.rarity);
      return `<tr>
        <td><input type="checkbox" data-inv="${x.inv_id}" ${checked}/></td>
        <td>${start + i + 1}</td>
        <td>${x.inv_id}</td>
        <td class="${rc}">${x.name}</td>
        <td class="${rc}">${x.rarity}</td>
        <td>${isNaN(x.wear)?"-":x.wear.toFixed(2)}</td>
        <td>${x.grade||"-"}</td>
        <td>${x.serial||"-"}</td>
      </tr>`;
    }).join("");

    listBox.innerHTML = `
      <h3>可选列表（共 ${total} 件，当前第 ${this._page}/${totalPages} 页；每页 ${this._pageSize}）</h3>
      <table class="table">
        <thead><tr><th>选</th><th>#</th><th>inv_id</th><th>名称</th><th>稀有度</th><th>磨损</th><th>品质</th><th>编号</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    listBox.querySelectorAll('input[type="checkbox"][data-inv]').forEach(cb=>{
      cb.onchange = ()=>{ const id=cb.dataset.inv; if(cb.checked)this._selected.add(id); else this._selected.delete(id); this._renderSummary(); };
    });

    // 单一分页条（底部）
    pager.style.display = "block";
    pager.innerHTML = this._renderPager(this._page, totalPages);

    // 绑定分页事件
    pager.querySelector('[data-act="first"]').onclick = ()=>{ this._page=1; this._renderListAndPager(); };
    pager.querySelector('[data-act="prev"]').onclick  = ()=>{ if(this._page>1){ this._page--; this._renderListAndPager(); } };
    pager.querySelector('[data-act="next"]').onclick  = ()=>{ if(this._page<totalPages){ this._page++; this._renderListAndPager(); } };
    pager.querySelector('[data-act="last"]').onclick  = ()=>{ this._page=totalPages; this._renderListAndPager(); };
    pager.querySelector('[data-act="go"]').onclick    = ()=>{
      const n = parseInt(pager.querySelector('input[data-act="page"]').value || "1", 10);
      if (!isNaN(n)) { this._page = Math.min(Math.max(1, n), totalPages); this._renderListAndPager(); }
    };
  },

  _renderPager(page, totalPages) {
    return `
      <div class="input-row" style="margin:0; align-items:center;">
        <button class="btn" data-act="first" ${page<=1?"disabled":""}>首页</button>
        <button class="btn" data-act="prev" ${page<=1?"disabled":""}>上一页</button>
        <span>第 ${page} / ${totalPages} 页</span>
        <input data-act="page" placeholder="跳转页码" style="width:110px"/>
        <button class="btn" data-act="go">跳转</button>
        <button class="btn" data-act="next" ${page>=totalPages?"disabled":""}>下一页</button>
        <button class="btn" data-act="last" ${page>=totalPages?"disabled":""}>末页</button>
      </div>
    `;
  },

  async _doCraft(sel, need){
    if (sel.length !== need) return;
    this._skip = false;

    // 覆盖上一条结果：先清空结果区
    byId("craft-result").innerHTML = "";

    // 顶部动画（不清 craft-stage，直接替换其内容）
    byId("craft-stage").innerHTML  = `<div class="glow fade-in"><span class="spinner"></span>合成中...</div>`;

    let d;
    try { d = await API.craft(this._rarity, sel.map(Number).filter(Boolean)); }
    catch(e) { byId("craft-stage").innerHTML = ""; alert(e.message); return; }

    const r = d?.result || d;
    if (!r) { byId("craft-stage").innerHTML = ""; byId("craft-result").innerHTML = `<div class="card fade-in">合成完成，但未返回结果。</div>`; return; }

    // 砖皮：动画；非砖皮：直接表格
    if (String(r.rarity).toUpperCase() === "BRICK") {
      await this._sleep(800);
      if (this._skip) return this._revealCraftAll(r);
      byId("craft-stage").innerHTML = `<div class="glow orange fade-in">光芒提示：<span class="hl-orange">橙色</span></div>`;
      const sk = byId("skip"); if (sk) sk.style.display = "inline-block";

      await this._sleep(600);
      if (this._skip) return this._revealCraftAll(r);
      const box = document.createElement("div");
      box.className = "card fade-in";
      box.innerHTML = `<h3 class="hl-orange">砖皮鉴定</h3><div id="inspect"></div>`;
      byId("craft-stage").appendChild(box);
      const inspect = byId("inspect");

      const wrap = document.createElement("div");
      wrap.className = "glow orange fade-in";
      inspect.appendChild(wrap);

      const titleRow = document.createElement("div");
      titleRow.className = "row-reveal";
      titleRow.innerHTML = `<span class="spinner"></span>发现砖皮`;
      wrap.appendChild(titleRow);

      await this._sleep(400); if (this._skip) return this._revealCraftAll(r);
      titleRow.innerHTML = `名称：<span class="hl-orange">${r.name}</span>`;

      await this._sleep(500); if (this._skip) return this._revealCraftAll(r);
      const wearRow = document.createElement("div");
      wearRow.className = "row-reveal";
      wearRow.innerHTML = `磨损：<span class="wear-value">0.000</span>`;
      wrap.appendChild(wearRow);
      const wearValue = wearRow.querySelector(".wear-value");
      this._animateWear(wearValue, r.wear);

      await this._sleep(600); if (this._skip) return this._revealCraftAll(r);
      const isDiamond = this._isDiamondTemplate(r.template) || this._isDiamondTemplate(r.hidden_template);
      const suspenseMs = isDiamond ? 8000 : (r.exquisite ? 4000 : 2500);
      const message = isDiamond ? "钻石覆盖中..." : (r.exquisite ? "极品鉴定中..." : "优品鉴定中...");
      const suspenseNode = this._buildSuspenseRow(message, { diamond: isDiamond });
      wrap.appendChild(suspenseNode);
      await this._sleep(suspenseMs); if (this._skip) return this._revealCraftAll(r);
      suspenseNode.remove();

      const judgeRow = document.createElement("div");
      judgeRow.className = "row-reveal";
      judgeRow.innerHTML = `鉴定：${r.exquisite ? `<span class="badge badge-exq">极品</span>` : `<span class="badge badge-prem">优品</span>`}`;
      wrap.appendChild(judgeRow);

      if (window.SkinVisuals) {
        await this._sleep(300); if (this._skip) return this._revealCraftAll(r);
        const meta = this._visualMeta(r);
        const previewRow = document.createElement("div");
        previewRow.className = "row-reveal";
        const visual = r.visual || {
          body: [], attachments: [], template: r.template, hidden_template: r.hidden_template, effects: r.effects
        };
        previewRow.innerHTML = SkinVisuals.render(visual, { label: r.name, meta: meta });
        wrap.appendChild(previewRow);
      }

      await this._sleep(500);
      this._revealCraftTable(r);
    } else {
      byId("craft-stage").innerHTML = "";
      this._revealCraftTable(r);
    }

    // 清选择，刷新库存但保留顶部结果
    this._selected.clear();
    const sk = byId("skip"); if (sk) sk.style.display = "none";
    await this._load(true); // 仅更新表格/分页/摘要
    this._renderSummary();  // 更新按钮状态
  },

  _revealCraftTable(r) {
    const rc = this._rarityClass(String(r.rarity).toUpperCase());
    const gc = this._gradeClass(r.grade);
    const exBadge = String(r.rarity).toUpperCase()==="BRICK"
      ? (r.exquisite ? `<span class="badge badge-exq">极品</span>` : `<span class="badge badge-prem">优品</span>`)
      : "-";
    const previewMeta = this._visualMeta(r);
    const preview = this._renderPreviewCell(r, { metaText: previewMeta });

    const wrap = document.createElement("div");
    wrap.className = "card fade-in";
    wrap.innerHTML = `
      <h3>合成结果</h3>
      <table class="table">
        <thead><tr><th>名称</th><th>外观</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th></tr></thead>
        <tbody>
          <tr>
            <td class="${rc}">${r.name}</td>
            <td>${preview}</td>
            <td class="${rc}">${r.rarity}</td>
            <td>${exBadge}</td>
            <td>${r.wear}</td>
            <td class="${gc}">${r.grade||"-"}</td>
            <td>${r.serial||"-"}</td>
          </tr>
        </tbody>
      </table>
    `;

    // 覆盖显示最新结果
    const resultBox = byId("craft-result");
    resultBox.innerHTML = "";
    resultBox.appendChild(wrap);
  },

  _buildSuspenseRow(message = "鉴定中...", opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = "row-reveal suspense-wrap";
    const diamondCls = opts.diamond ? " diamond" : "";
    wrap.innerHTML = `<div class="suspense-glow${diamondCls}"><span class="spinner"></span>${message}</div>`;
    return wrap;
  },

  _animateWear(el, value, duration = 1200) {
    if (!el) return;
    const final = typeof value === "number" ? value : parseFloat(value);
    if (!isFinite(final)) {
      el.textContent = value ?? "-";
      return;
    }
    el.textContent = "0.000";
    const start = performance.now();
    const total = Math.max(400, duration);
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    const self = this;
    const finalText = typeof value === "string" ? value : final.toFixed(3);
    const tick = (now) => {
      if (self._skip) {
        el.textContent = finalText;
        return;
      }
      const progress = Math.min(1, (now - start) / total);
      const eased = ease(progress);
      el.textContent = (final * eased).toFixed(3);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
  },

  _revealCraftAll(r){ byId("craft-stage").innerHTML = ""; this._revealCraftTable(r); const sk = byId("skip"); if (sk) sk.style.display = "none"; },

  _isDiamondTemplate(name) {
    if (!name) return false;
    const key = String(name).toLowerCase();
    return key.includes("white_diamond") || key.includes("yellow_diamond") || key.includes("pink_diamond");
  },

  _autoPick(mode){
    const arr = this._sortedAll();
    const valid = arr.filter(x=>!isNaN(x.wear));
    if(mode==="low")  valid.sort((a,b)=>a.wear-b.wear);
    if(mode==="high") valid.sort((a,b)=>b.wear-a.wear);
    if(mode==="rand") valid.sort(()=>Math.random()-0.5);
    const pick = valid.slice(0,20).map(x=>String(x.inv_id));
    this._selected = new Set(pick);
  },

  _parseSeq(text,maxN){
    const out=new Set();
    const parts=text.split(",").map(s=>s.trim()).filter(Boolean);
    for(const p of parts){
      if(/^\d+$/.test(p)){ const n=+p; if(n>=1 && n<=maxN) out.add(n); }
      else if(/^\d+\s*-\s*\d+$/.test(p)){ let [a,b]=p.split("-").map(s=>+s.trim()); if(a>b)[a,b]=[b,a]; for(let i=a;i<=b;i++) if(i>=1 && i<=maxN) out.add(i); }
    }
    return Array.from(out).sort((a,b)=>a-b);
  },

  _sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
};
