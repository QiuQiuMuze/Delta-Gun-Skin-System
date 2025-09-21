const AdminPage = {
  render() {
    return `
    <div class="card"><h2>管理员</h2>
      <div class="input-row"><input id="adm-key" placeholder="X-Admin-Key"/><button class="btn" id="adm-read">读取配置</button></div>
      <div id="adm-cfg"></div>
      <div class="card"><h3>Upsert 皮肤</h3>
        <p>批量 JSON：[{ "skin_id":"...", "name":"...", "rarity":"BRICK|PURPLE|BLUE|GREEN", "active":true }]</p>
        <div class="input-row"><textarea id="skins-json" style="width:100%;height:120px;background:#0b0d12;color:#e6e9ef;border:1px solid #273041;border-radius:8px;"></textarea></div>
        <div class="input-row"><button class="btn" id="adm-upsert">提交</button></div>
      </div>
      <div class="card"><h3>启用/停用皮肤</h3>
        <div class="input-row"><input id="skin-id" placeholder="skin_id"/><select id="skin-active"><option value="1">active=true</option><option value="0">active=false</option></select><button class="btn" id="adm-activate">执行</button></div>
      </div>
    </div>`;
  },
  bind() {
    byId("adm-read").onclick = async ()=>{
      const xkey = byId("adm-key").value.trim();
      const d = await API.adminGetConfig(xkey);
      byId("adm-cfg").innerHTML = `<pre>${escapeHtml(JSON.stringify(d, null, 2))}</pre>
        <div class="input-row"><textarea id="adm-cfg-json" style="width:100%;height:140px;background:#0b0d12;color:#e6e9ef;border:1px solid #273041;border-radius:8px;">${escapeHtml(JSON.stringify(d, null, 2))}</textarea></div>
        <button class="btn" id="adm-save">保存配置</button>`;
      byId("adm-save").onclick = async ()=>{
        const cfg = JSON.parse(byId("adm-cfg-json").value || "{}");
        const xkey = byId("adm-key").value.trim();
        const r = await API.adminSetConfig(xkey, cfg);
        alert(JSON.stringify(r));
      };
    };
    byId("adm-upsert").onclick = async ()=>{
      const xkey = byId("adm-key").value.trim();
      const skins = JSON.parse(byId("skins-json").value || "[]");
      const r = await API.adminUpsertSkins(xkey, skins);
      alert(JSON.stringify(r));
    };
    byId("adm-activate").onclick = async ()=>{
      const xkey = byId("adm-key").value.trim();
      const sid = byId("skin-id").value.trim();
      const active = byId("skin-active").value === "1";
      const r = await API.adminActivateSkin(xkey, sid, active);
      alert(JSON.stringify(r));
    };
  }
}
