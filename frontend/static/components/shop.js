const ShopPage = {
  async render() {
    const me = await API.me();
    return `
    <div class="card"><h2>商店</h2>
      <div class="kv"><div class="k">三角币</div><div class="v">${me.coins}</div></div>
      <div class="kv"><div class="k">钥匙</div><div class="v">${me.keys}</div></div>
      <div class="kv"><div class="k">未开砖</div><div class="v">${me.unopened_bricks}</div></div>
      <div class="input-row"><input id="k-c" type="number" placeholder="购买钥匙数量"/><button class="btn" id="buy-k">购买钥匙</button></div>
      <div class="input-row"><input id="b-c" type="number" placeholder="购买未开砖数量"/><button class="btn" id="buy-b">购买未开砖</button></div>
    </div>`;
  },
  bind() {
    byId("buy-k").onclick = async ()=>{ try{ await API.buyKeys(+byId("k-c").value); location.reload(); }catch(e){ alert(e.message); } };
    byId("buy-b").onclick = async ()=>{ try{ await API.buyBricks(+byId("b-c").value); location.reload(); }catch(e){ alert(e.message); } };
  }
}
