// frontend/static/components/market.js
(function () {
  // ===== 工具函数 =====
  function $id(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function rarityClass(r) {
    r = String(r || "").toUpperCase();
    if (r === "BRICK") return "hl-orange";
    if (r === "PURPLE") return "hl-purple";
    if (r === "BLUE")   return "hl-blue";
    return "hl-green";
  }
  function gradeClass(g) { var m={S:"grade-s",A:"grade-a",B:"grade-b",C:"grade-c"}; return m[g]||""; }

  function previewCell(item, opts){
    if (!window.SkinVisuals) return '';
    const visual = item.visual || { body: [], attachments: [], template: item.template, hidden_template: item.hidden_template, effects: item.effects };
    const meta = (opts && opts.meta === false) ? false : (opts && opts.meta) || SkinVisuals.formatMeta(visual);
    return `<div class="market-preview-cell">${SkinVisuals.render(visual, { compact:true, meta })}</div>`;
  }

  function mapRarity(v){
    const s = String(v || "").trim();
    const up = s.toUpperCase();
    const cn = { "砖":"BRICK", "砖皮":"BRICK", "紫":"PURPLE", "蓝":"BLUE", "绿":"GREEN" };
    if (cn[s]) return cn[s];
    if (["BRICK","PURPLE","BLUE","GREEN"].includes(up)) return up;
    return up || "GREEN";
  }

  function isExq(x){
    if (typeof x?.exquisite    !== "undefined") return !!x.exquisite;
    if (typeof x?.is_exquisite !== "undefined") return !!x.is_exquisite;
    if (typeof x?.exq          !== "undefined") return !!x.exq;
    return false;
  }

  // 数值 & 磨损归一化（支持 wear / wear_bp / float 等）
  function num(v){
    if (v == null || v === "") return NaN;
    if (typeof v === "number" && isFinite(v)) return v;
    const n = Number(String(v).replace(/[^\d.\-]/g,""));
    return isFinite(n) ? n : NaN;
  }
  function normalizeWear(x){
    const cand = [
      x.wear, x.wear_bp, x.bp_wear,
      x.abrasion, x.abrasion_bp,
      x.float, x.float_value, x.float_bp,
      x["磨损"], x["磨损度"]
    ];
    for (let i=0;i<cand.length;i++){
      let v = num(cand[i]);
      if (!isNaN(v)) {
        if (v > 1.5) {               // 大概率是“基点” => /100 或 /10000
          if (v <= 10000) v = v / 100;
          else            v = v / 10000;
        }
        return Number(v.toFixed(2));
      }
    }
    return NaN;
  }

  // 背包项归一化（保留 on_market，只展示可上架）
  function normInv(x){
    const inv_id    = x.inv_id ?? x.id ?? x.inventory_id ?? "";
    const name      = x.name ?? x.skin_name ?? x.cn_name ?? "";
    const rarity    = mapRarity(x.rarity ?? x.color ?? x.tier ?? x.rank ?? x.rarity_cn);
    const wear      = normalizeWear(x);
    const grade     = x.grade ?? x.quality ?? x.grade_cn ?? "";
    const serial    = x.serial ?? x.sn ?? "";
    const exquisite = isExq(x);
    const on_market = !!x.on_market;
    const template = x.template ?? x.visual?.template;
    const hidden_template = x.hidden_template ?? x.visual?.hidden_template ?? false;
    const effects = x.effects ?? x.visual?.effects ?? [];
    const visual = x.visual || { body: [], attachments: [], template, hidden_template, effects };
    const season = x.season || "";
    const model = x.model || visual.model || "";
    return { inv_id, name, rarity, wear, grade, serial, exquisite, on_market, template, hidden_template, effects, visual, season, model };
  }

  function btn(label, active, attrs){
    return '<button class="btn '+(active?'active':'')+'" '+(attrs||'')+'>'+esc(label)+'</button>';
  }

  var MarketPage = {
    _tab: "browse", // browse | sell | mine

    // 浏览筛选（英文保留）
    _filters: { rarity:"ALL", skin_id:"", exquisite:"ANY", grade:"ANY", order:"price_asc", season:"ALL" },
    _seasonCatalog: [],
    _seasonMap: {},

    _seasonLabel: function(id){
      var key = String(id == null ? "" : id).toUpperCase();
      if (!key || key === "UNASSIGNED") {
        if (this._seasonCatalog && this._seasonCatalog.length) {
          var latest = this._seasonCatalog[this._seasonCatalog.length - 1];
          return (latest && latest.name) || latest?.id || "最新赛季";
        }
        return "最新赛季";
      }
      var entry = this._seasonMap[key] || this._seasonMap[key.toUpperCase()];
      if (entry && entry.name) return entry.name;
      var fallback = (this._seasonCatalog || []).find(function(season){
        return String(season.id).toUpperCase() === key;
      });
      return (fallback && fallback.name) || key;
    },

    _modelLabel: function(model){
      var key = String(model || "").toLowerCase();
      var map = {
        assault: "突击步枪",
        battle: "战斗步枪",
        vector: "冲锋枪",
        bullpup: "无托步枪",
        futuristic: "能量武器"
      };
      if (!key) return "-";
      return map[key] || model || key;
    },

    // 上架筛选（中文 UI）
    _sellView: { rarity:"BRICK", exqMode:"ANY", sortWear:"asc" },

    _inventoryAll: [],  // 所有未上架
    _inventory: [],     // 筛选后
    _sellSelected: null,
    _me: {},

    async render() {
      var self = this;
      const catalog = await API.seasonCatalog().catch(() => ({ seasons: [], latest: null }));
      self._seasonCatalog = Array.isArray(catalog?.seasons) ? catalog.seasons : [];
      self._seasonMap = {};
      self._seasonCatalog.forEach(season => {
        if (!season?.id) return;
        self._seasonMap[season.id] = season;
        self._seasonMap[String(season.id).toUpperCase()] = season;
      });
      const seasonOptions = ['<option value="ALL">赛季(全部)</option>']
        .concat(self._seasonCatalog.map(season => {
          const selected = self._filters.season === season.id ? 'selected' : '';
          return `<option value="${season.id}" ${selected}>${season.name}</option>`;
        }))
        .join("");

      setTimeout(function(){
        API.me().then(u => { self._me = u || {}; }).catch(()=>{});
        self._loadInventory();
        self._loadBrowse();
        self._loadMine();
      },0);

      return ''+
      '<div class="card">'+
        '<h2>交易行</h2>'+ 
        '<div class="input-row">'+
          '<button class="btn '+(this._tab==='browse'?'active':'')+'" data-tab="browse">浏览 / 购买</button>'+
          '<button class="btn '+(this._tab==='sell'?'active':'')+'" data-tab="sell">上架</button>'+
          '<button class="btn '+(this._tab==='mine'?'active':'')+'" data-tab="mine">我的挂单</button>'+
        '</div>'+
      '</div>'+

      // 浏览/购买
      '<div id="mk-browse" class="card" style="'+(this._tab==='browse'?'':'display:none;')+'">'+
        '<h3>筛选 / 排序</h3>'+
        '<div class="input-row">'+
          '<select id="f-rarity">'+
            '<option value="ALL">稀有度(全部)</option>'+
            '<option value="BRICK">BRICK</option>'+
            '<option value="PURPLE">PURPLE</option>'+
            '<option value="BLUE">BLUE</option>'+
            '<option value="GREEN">GREEN</option>'+
          '</select>'+
          '<select id="f-season">'+ seasonOptions +'</select>'+
          '<input id="f-skin" placeholder="skin_id (可选)">'+
          '<select id="f-exq">'+
            '<option value="ANY">是否极品(任意)</option>'+
            '<option value="EXQ">只看极品</option>'+
            '<option value="PREM">只看优品</option>'+
          '</select>'+
          '<select id="f-grade">'+
            '<option value="ANY">品质(全部)</option>'+
            '<option value="S">S</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>'+
          '</select>'+
          '<select id="f-order">'+
            '<option value="price_asc">价格 ↑</option>'+
            '<option value="price_desc">价格 ↓</option>'+
            '<option value="wear_asc">磨损 ↑</option>'+
            '<option value="wear_desc">磨损 ↓</option>'+
            '<option value="newest">最新</option>'+
            '<option value="oldest">最早</option>'+
          '</select>'+
          '<button class="btn" id="f-apply">浏览</button>'+
        '</div>'+
        '<div id="mk-browse-list" class="card"></div>'+
      '</div>'+

      // 上架（中文按钮筛选）
      '<div id="mk-sell" class="card" style="'+(this._tab==='sell'?'':'display:none;')+'">'+
        '<h3>上架</h3>'+
        '<div id="sell-filter" class="input-row"></div>'+
        '<div id="sell-inv-list" class="card"></div>'+
        '<div class="input-row">'+
          '<input id="sell-price" placeholder="价格（三角币）">'+
          '<button class="btn" id="sell-submit" disabled>上架</button>'+
        '</div>'+
      '</div>'+

      // 我的挂单
      '<div id="mk-mine" class="card" style="'+(this._tab==='mine'?'':'display:none;')+'">'+
        '<h3>我的挂单</h3>'+
        '<div id="mk-mine-list" class="card"></div>'+
      '</div>';
    },

    bind: function () {
      var self=this;

      // Tab
      document.querySelectorAll('[data-tab]').forEach(function(btn){
        btn.onclick=function(){
          self._tab = this.getAttribute('data-tab');
          $id('mk-browse').style.display = (self._tab==='browse')?'':'none';
          $id('mk-sell').style.display   = (self._tab==='sell')  ?'':'none';
          $id('mk-mine').style.display   = (self._tab==='mine')  ?'':'none';
          document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
          this.classList.add('active');
          if (self._tab==='sell')   { self._applySellFilters(); self._renderSellBar(); self._renderSellList(); }
          if (self._tab==='browse') self._loadBrowse();
          if (self._tab==='mine')   self._loadMine();
        };
      });

      // 浏览筛选
      $id('f-rarity').value=this._filters.rarity;
      var seasonSelect = $id('f-season');
      if (seasonSelect) seasonSelect.value = this._filters.season;
      $id('f-skin').value=this._filters.skin_id;
      $id('f-exq').value=this._filters.exquisite;
      $id('f-grade').value=this._filters.grade;
      $id('f-order').value=this._filters.order;
      $id('f-apply').onclick=()=>{
        this._filters={
          rarity:$id('f-rarity').value,
          season: seasonSelect ? seasonSelect.value : this._filters.season,
          skin_id:($id('f-skin').value||"").trim(),
          exquisite:$id('f-exq').value,
          grade:$id('f-grade').value,
          order:$id('f-order').value
        };
        this._loadBrowse();
      };

      // 上架事件
      $id('sell-submit').onclick=()=>this._doSell();
      $id('sell-price').oninput=()=>{
        $id('sell-submit').disabled = !this._sellSelected || !($id('sell-price').value.trim());
      };
    },

    // ===== 加载库存（优先 by-color；失败回退 /inventory） =====
    _loadInventory: function(){
      const fill = (flat)=>{
        this._inventoryAll = (flat || []).map(normInv).filter(it => !it.on_market);
        this._applySellFilters();
        this._renderSellBar();
        this._renderSellList();
      };

      API.inventoryByColor()
        .then(by=>{
          const buckets = by?.buckets && typeof by.buckets === "object" ? by.buckets : by;
          const get = (k)=> (buckets?.[k] || buckets?.[k?.toUpperCase?.()] || buckets?.[k?.toLowerCase?.()] || []);
          const flat = [].concat(get("BRICK"), get("PURPLE"), get("BLUE"), get("GREEN"));
          fill(flat);
        })
        .catch(()=>{
          API.inventory()
            .then(res=>{ const flat=(res && (res.items||res)) || []; fill(flat); })
            .catch(()=>fill([]));
        });
    },

    // ===== 上架筛选逻辑 =====
    _applySellFilters: function(){
      const v = this._sellView;
      let list = this._inventoryAll.filter(it => it.rarity === v.rarity);

      if (v.rarity === "BRICK") {
        if (v.exqMode === "EXQ")  list = list.filter(it => it.exquisite === true);
        if (v.exqMode === "PREM") list = list.filter(it => it.exquisite === false);
      }

      list.sort((a,b)=>{
        const va=isNaN(a.wear)?999:a.wear, vb=isNaN(b.wear)?999:b.wear;
        return v.sortWear==="asc" ? (va-vb) : (vb-va);
      });

      this._inventory = list;
    },

    // 上架筛选栏（中文按钮）
    _renderSellBar: function(){
      const host = $id('sell-filter'); if (!host) return;
      const v = this._sellView;

      const row1 =
        btn('砖皮', v.rarity==='BRICK',  'data-sel="rarity" data-val="BRICK"') +
        btn('紫皮', v.rarity==='PURPLE', 'data-sel="rarity" data-val="PURPLE"') +
        btn('蓝皮', v.rarity==='BLUE',  'data-sel="rarity" data-val="BLUE"') +
        btn('绿皮', v.rarity==='GREEN', 'data-sel="rarity" data-val="GREEN"');

      const row2 = (v.rarity==='BRICK')
        ? ('<span style="margin-left:8px;">' +
             btn('全部', v.exqMode==='ANY',  'data-sel="exq" data-val="ANY"') +
             btn('极品', v.exqMode==='EXQ',  'data-sel="exq" data-val="EXQ"') +
             btn('优品', v.exqMode==='PREM', 'data-sel="exq" data-val="PREM"') +
           '</span>')
        : '';

      const row3 =
        '<span style="margin-left:8px;">排序：</span>' +
        btn('磨损 ↑', v.sortWear==='asc',  'data-sel="sort" data-val="asc"') +
        btn('磨损 ↓', v.sortWear==='desc', 'data-sel="sort" data-val="desc"');

      host.innerHTML = row1 + row2 + row3;

      host.querySelectorAll('[data-sel]').forEach(el=>{
        el.onclick = ()=>{
          const type = el.getAttribute('data-sel');
          const val  = el.getAttribute('data-val');
          if (type === 'rarity') {
            this._sellView.rarity = val;
            if (val !== 'BRICK') this._sellView.exqMode = 'ANY';
          }
          if (type === 'exq')   this._sellView.exqMode = val;
          if (type === 'sort')  this._sellView.sortWear = val;

          this._applySellFilters();
          this._renderSellBar();
          this._renderSellList();
        };
      });
    },

    _renderSellList: function(){
      const host = $id('sell-inv-list');
      if (!host) return;

      if (!this._inventory.length){
        host.innerHTML = '<div class="muted">没有满足条件的可上架物品。</div>';
        $id('sell-submit').disabled = true;
        return;
      }

      let rows = '';
      for (let i=0;i<this._inventory.length;i++){
        const it=this._inventory[i];
        const rc = rarityClass(it.rarity);
        const ex = (it.rarity==="BRICK") ? (it.exquisite?'<span class="badge badge-exq">极品</span>':'<span class="badge badge-prem">优品</span>') : '-';
        const checked = (this._sellSelected && String(this._sellSelected)===String(it.inv_id)) ? 'checked' : '';
        const seasonLabel = this._seasonLabel(it.season);
        const modelLabel = this._modelLabel(it.model);
        rows += '<tr>'+
          '<td><input type="radio" name="sellPick" data-inv="'+it.inv_id+'" '+checked+'></td>'+
          '<td>'+esc(it.inv_id)+'</td>'+
          '<td class="'+rc+'">'+esc(it.name)+'</td>'+
          '<td>'+esc(seasonLabel)+'</td>'+
          '<td>'+esc(modelLabel)+'</td>'+
          '<td class="'+rc+'">'+esc(it.rarity)+'</td>'+
          '<td>'+ex+'</td>'+
          '<td>'+(isNaN(it.wear)?'-':it.wear)+'</td>'+
          '<td class="'+gradeClass(it.grade)+'">'+(it.grade||'-')+'</td>'+
          '<td>'+(it.serial||'-')+'</td>'+
        '</tr>';
      }
      host.innerHTML =
        '<div class="muted">已选：'+(this._sellSelected?esc(this._sellSelected):'无')+'</div>'+
        '<table class="table">'+
        '<thead><tr><th>选</th><th>inv_id</th><th>名称</th><th>赛季</th><th>类型</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table>';

      host.querySelectorAll('[data-inv]').forEach(el=>{
        el.onchange=()=>{
          if (el.checked) this._sellSelected = el.getAttribute('data-inv');
          $id('sell-submit').disabled = !this._sellSelected || !($id('sell-price').value.trim());
        };
      });
      $id('sell-submit').disabled = !this._sellSelected || !($id('sell-price').value.trim());
    },

    _doSell: function(){
      const inv=this._sellSelected;
      const price=parseInt(($id('sell-price').value||"").trim(),10);
      if (!inv){ alert("请先从列表中选择一把要上架的枪。"); return; }
      if (!price || price<=0){ alert("请填写有效价格。"); return; }

      API.marketList(Number(inv), Number(price))
        .then((ret)=>{
          // 后端返回: { ok: true, market_id, msg }
          const msg = (ret && (ret.msg || ret.detail)) || "上架成功！";
          alert(msg);
          this._sellSelected=null; $id('sell-price').value=""; $id('sell-submit').disabled=true;
          this._loadInventory(); this._loadMine(); this._loadBrowse();
        })
        .catch(e=>{
          alert(e.message || "上架失败");
        });
    },

    // ===== 浏览 / 购买 =====
    _loadBrowse: function () {
      var self=this;
      var f=this._filters, qs={
        sort: {price_asc:"price_asc",price_desc:"price_desc",wear_asc:"wear_asc",wear_desc:"wear_desc",newest:"newest",oldest:"oldest"}[f.order] || "newest"
      };
      if (f.rarity && f.rarity!=="ALL") qs.rarity = f.rarity;
      if (f.skin_id) qs.skin_id = f.skin_id;
      if (f.exquisite==="EXQ") qs.is_exquisite = "true";
      if (f.exquisite==="PREM") qs.is_exquisite = "false";
      if (f.grade!=="ANY") qs.grade = f.grade;
      if (f.season && f.season !== "ALL") qs.season = f.season;

      API.marketBrowse(qs)
        .then(data=>{
          var items=(data.items||[]).map(function(x){
            return {
              id: x.id || x.market_id || x.listing_id,
              inv_id: x.inv_id,
              seller: x.seller || x.seller_name || x.owner_name,
              price: x.price,
              name: x.name || x.skin_name || x.cn_name,
              skin_id: x.skin_id,
              rarity: mapRarity(x.rarity || x.color || x.tier || x.rank || x.rarity_cn),
              exquisite: isExq(x),
              grade: x.grade ?? x.quality ?? "",
              wear: normalizeWear(x),
              serial: x.serial,
              template: x.template ?? x.visual?.template,
              hidden_template: x.hidden_template ?? x.visual?.hidden_template ?? false,
              effects: x.effects ?? x.visual?.effects ?? [],
              visual: x.visual || { body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects },
              season: x.season || x.season_id || "",
              model: x.model || x.visual?.model || ""
            };
          });

          var rows='';
          for (var i=0;i<items.length;i++){
            var x=items[i], rc=rarityClass(x.rarity);
            var ex=(x.rarity==="BRICK") ? (x.exquisite?'<span class="badge badge-exq">极品</span>':'<span class="badge badge-prem">优品</span>') : '-';
            var preview = previewCell(x);
            var seasonLabel = self._seasonLabel(x.season);
            var modelLabel = self._modelLabel(x.model);
            rows += '<tr>'+
              '<td>'+esc(x.seller||"玩家")+'</td>'+
              '<td class="'+rc+'">'+esc(x.name)+'</td>'+
              '<td>'+esc(seasonLabel)+'</td>'+
              '<td>'+esc(modelLabel)+'</td>'+
              '<td>'+preview+'</td>'+
              '<td class="'+rc+'">'+esc(x.rarity)+'</td>'+
              '<td>'+ex+'</td>'+
              '<td>'+(isNaN(x.wear)?'-':x.wear)+'</td>'+
              '<td class="'+gradeClass(x.grade)+'">'+(x.grade||'-')+'</td>'+
              '<td>'+(x.serial||'-')+'</td>'+
              '<td>'+x.price+'</td>'+
              '<td><button class="btn" data-buy="'+x.id+'">购买</button></td>'+
            '</tr>';
          }
          $id('mk-browse-list').innerHTML =
            '<table class="table">'+
            '<thead><tr><th>上架玩家</th><th>名称</th><th>赛季</th><th>类型</th><th>外观</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th><th>价格</th><th>操作</th></tr></thead>'+
            '<tbody>'+rows+'</tbody></table>';

          $id('mk-browse-list').querySelectorAll('[data-buy]').forEach((btn)=>{
            const id=btn.getAttribute('data-buy');
            btn.onclick=function(){
              API.marketBuy(id)
                .then((ret)=>{
                  alert((ret && (ret.msg||ret.detail)) || "购买成功！");
                  MarketPage._loadBrowse(); MarketPage._loadMine(); MarketPage._loadInventory();
                })
                .catch(e=>alert(e.message||"购买失败"));
            };
          });
        })
        .catch(()=>{ $id('mk-browse-list').innerHTML='<div class="muted">加载失败</div>'; });
    },

    // ===== 我的挂单 =====
    _loadMine: function(){
      var self=this;
      API.marketMine()
        .then(data=>{
          var rows='';
          var list=(data.items||[]).map(function(x){
            return {
              market_id: x.market_id || x.id,
              price: x.price,
              name: x.name || x.skin_name || x.cn_name,
              rarity: mapRarity(x.rarity || x.color || x.rarity_cn),
              exquisite: isExq(x),
              grade: x.grade ?? x.quality ?? "",
              wear: normalizeWear(x),
              serial: x.serial,
              template: x.template ?? x.visual?.template,
              hidden_template: x.hidden_template ?? x.visual?.hidden_template ?? false,
              effects: x.effects ?? x.visual?.effects ?? [],
              visual: x.visual || { body: [], attachments: [], template: x.template, hidden_template: x.hidden_template, effects: x.effects },
              season: x.season || x.season_id || "",
              model: x.model || x.visual?.model || ""
            };
          });
          for (var i=0;i<list.length;i++){
            var x=list[i], rc=rarityClass(x.rarity);
            var ex=(x.rarity==="BRICK")?(x.exquisite?'<span class="badge badge-exq">极品</span>':'<span class="badge badge-prem">优品</span>'):'-';
            var preview = previewCell(x);
            var seasonLabel = self._seasonLabel ? self._seasonLabel(x.season) : (x.season || "默认奖池");
            var modelLabel = self._modelLabel ? self._modelLabel(x.model) : (x.model || "-");
            rows+='<tr>'+
              '<td class="'+rc+'">'+esc(x.name)+'</td>'+
              '<td>'+esc(seasonLabel)+'</td>'+
              '<td>'+esc(modelLabel)+'</td>'+
              '<td>'+preview+'</td>'+
              '<td class="'+rc+'">'+esc(x.rarity)+'</td>'+
              '<td>'+ex+'</td>'+
              '<td>'+(isNaN(x.wear)?'-':x.wear)+'</td>'+
              '<td class="'+gradeClass(x.grade)+'">'+(x.grade||'-')+'</td>'+
              '<td>'+(x.serial||'-')+'</td>'+
              '<td>'+x.price+'</td>'+
              '<td><button class="btn" data-off="'+x.market_id+'">撤下</button></td>'+
            '</tr>';
          }
          $id('mk-mine-list').innerHTML =
            '<table class="table"><thead><tr><th>名称</th><th>赛季</th><th>类型</th><th>外观</th><th>稀有度</th><th>极品/优品</th><th>磨损</th><th>品质</th><th>编号</th><th>价格</th><th>操作</th></tr></thead>'+
            '<tbody>'+rows+'</tbody></table>';

          $id('mk-mine-list').querySelectorAll('[data-off]').forEach((btn)=>{
            const id=btn.getAttribute('data-off');
            btn.onclick=function(){
              API.marketDelist(id)
                .then((ret)=>{ alert((ret && (ret.msg||ret.detail)) || "已撤下。"); MarketPage._loadMine(); MarketPage._loadBrowse(); MarketPage._loadInventory(); })
                .catch(e=>alert(e.message||"撤下失败"));
            };
          });
        })
        .catch(()=>{ $id('mk-mine-list').innerHTML='<div class="muted">加载失败</div>'; });
    }
  };

  window.MarketPage = MarketPage;
})();
