// Gear Ledger — app logic. Plain JS, no build step.
(() => {
  const STORE_KEY = "gearLedger.v1";
  const TIER_NAMES = ["Starter", "Mid", "Endgame"];
  const INV_CELLS = 40; // 10 x 4 inventory
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byName = new Map(ITEMS.map((i) => [i.name, i]));
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ---------- state ----------
  let state = load();
  let tab = "gear";

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return { chars: [], current: null };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  const cur = () => state.chars.find((c) => c.id === state.current) || null;
  const buildOf = (c) => BUILDS.find((b) => b.id === c.build) || null;

  function newChar() {
    const name = prompt("Character name?", "New hero");
    if (name === null) return;
    const c = { id: uid(), name: name.trim() || "New hero", cls: "Sorceress", level: 1, build: "blizz-sorc", budget: 1, mode: "Softcore", extraFcr: 0, gear: {}, charms: [] };
    state.chars.push(c);
    state.current = c.id;
    save(); render();
  }

  // ---------- tiers & recommendations ----------
  const listKey = (slotKey) => (slotKey === "ring1" || slotKey === "ring2" ? "ring" : slotKey);

  function tierOf(build, slotKey, itemName) {
    if (!build || !itemName) return null;
    const tiers = build.tiers[listKey(slotKey)];
    if (!tiers) return null;
    for (let t = 2; t >= 0; t--) if (tiers[t].includes(itemName)) return t;
    return -1;
  }

  function recommendations(c, slotKey) {
    const b = buildOf(c);
    if (!b) return { status: "nobuild", items: [] };
    const tiers = b.tiers[listKey(slotKey)];
    if (!tiers) return { status: "none", items: [] };
    const target = Math.min(c.budget, 2);
    const curName = c.gear[slotKey]?.item;
    const t = curName ? tierOf(b, slotKey, curName) : -2; // -2 empty, -1 off-build
    if (t >= target) return { status: "ok", tier: t, items: [] };
    const seen = new Set();
    const items = [];
    for (let k = target; k > Math.max(t, -1); k--) {
      for (const n of tiers[k]) {
        if (n === curName || seen.has(n)) continue;
        const it = byName.get(n);
        if (!it || !fitsLevel(it, c)) continue;
        seen.add(n);
        items.push({ item: it, tier: k });
      }
    }
    // if level gates everything, still show the target tier as goals
    if (!items.length) for (const n of tiers[target]) { const it = byName.get(n); if (it && n !== curName) items.push({ item: it, tier: target, gated: true }); }
    return { status: t === -2 ? "empty" : t === -1 ? "off" : "below", tier: t, gap: target - t, items };
  }
  const fitsLevel = (it, c) => !c.level || !it.req || it.req <= Number(c.level);

  function fcrTotal(c) {
    let total = Number(c.extraFcr) || 0;
    for (const s of GEAR_SLOTS) {
      if (s.key === "swap") continue;
      const it = byName.get(c.gear[s.key]?.item);
      if (it?.fcr) total += it.fcr;
    }
    return total;
  }

  function cellsUsed(c) {
    return c.charms.reduce((n, ch) => n + (byName.get(ch.item)?.size || 1), 0);
  }

  // ---------- render ----------
  function render() {
    renderRoster();
    const c = cur();
    const app = $("#app");
    if (!c) {
      app.innerHTML = `<div class="card empty"><h2>No characters yet</h2><p>Add one to start tracking gear, charms and your mercenary.</p><button class="btn" id="emptyNew">+ New character</button></div>`;
      $("#emptyNew").onclick = newChar;
      return;
    }
    const builds = BUILDS.filter((b) => b.cls === c.cls);
    app.innerHTML = `
      <section class="card char-head">
        <div class="field"><label>Name</label><input type="text" id="fName" value="${esc(c.name)}"></div>
        <div class="field"><label>Class</label><select id="fCls">${CLASSES.map((k) => `<option ${k === c.cls ? "selected" : ""}>${k}</option>`).join("")}</select></div>
        <div class="field"><label>Level</label><input type="number" id="fLvl" min="1" max="99" value="${esc(c.level)}"></div>
        <div class="field"><label>Build</label><select id="fBuild">${builds.length ? builds.map((b) => `<option value="${b.id}" ${b.id === c.build ? "selected" : ""}>${esc(b.name)}</option>`).join("") : `<option value="">No guide yet for ${c.cls}</option>`}</select></div>
        <div class="field"><label>Budget target</label><select id="fBudget">${TIER_NAMES.map((n, i) => `<option value="${i}" ${i === Number(c.budget) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="field"><label>Mode</label><select id="fMode">${["Softcore", "Hardcore", "SC Ladder", "HC Ladder"].map((m) => `<option ${m === c.mode ? "selected" : ""}>${m}</option>`).join("")}</select></div>
      </section>
      <nav class="tabs" role="tablist">
        ${[["gear", "Gear"], ["merc", "Mercenary"], ["charms", "Charms"], ["upgrades", "Upgrades"]].map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}
      </nav>
      <section id="tabBody"></section>`;

    $("#fName").oninput = (e) => { c.name = e.target.value; save(); renderRoster(); };
    $("#fCls").onchange = (e) => {
      c.cls = e.target.value;
      const first = BUILDS.find((b) => b.cls === c.cls);
      c.build = first ? first.id : "";
      save(); render();
    };
    $("#fLvl").onchange = (e) => { c.level = Math.max(1, Math.min(99, Number(e.target.value) || 1)); save(); render(); };
    $("#fBuild").onchange = (e) => { c.build = e.target.value; save(); render(); };
    $("#fBudget").onchange = (e) => { c.budget = Number(e.target.value); save(); render(); };
    $("#fMode").onchange = (e) => { c.mode = e.target.value; save(); };
    app.querySelectorAll(".tab").forEach((t) => (t.onclick = () => { tab = t.dataset.tab; render(); }));

    const body = $("#tabBody");
    if (tab === "gear") renderSlots(body, c, GEAR_SLOTS);
    else if (tab === "merc") renderSlots(body, c, MERC_SLOTS);
    else if (tab === "charms") renderCharms(body, c);
    else renderUpgrades(body, c);
  }

  function renderRoster() {
    const sel = $("#charSelect");
    sel.innerHTML = state.chars.length
      ? state.chars.map((c) => `<option value="${c.id}" ${c.id === state.current ? "selected" : ""}>${esc(c.name)} — ${esc(c.cls)} ${esc(c.level)}</option>`).join("")
      : `<option>No characters</option>`;
    sel.disabled = !state.chars.length;
  }

  function itemOptions(c, slot, selected) {
    const b = buildOf(c);
    const dualWield = slot.key === "offhand" && c.cls === "Barbarian";
    const pool = ITEMS.filter((i) => (i.slot === slot.list || (dualWield && i.slot === "weapon")) &&(!i.cls || i.cls === c.cls || slot.key.startsWith("merc")) && (!slot.mercOnly || i.merc));
    const mercClsOk = (i) => !(slot.key.startsWith("merc") && i.cls); // mercs can't use class items
    const usable = pool.filter(mercClsOk);
    const opt = (i) => `<option value="${esc(i.name)}" ${i.name === selected ? "selected" : ""}>${esc(i.name)}${i.alias ? ` (${esc(i.alias)})` : ""} · lvl ${i.req}</option>`;
    let html = `<option value="">— empty —</option>`;
    const recNames = new Set();
    if (b && b.tiers[listKey(slot.key)]) {
      const tiers = b.tiers[listKey(slot.key)];
      html += `<optgroup label="Recommended for ${esc(b.name)}">`;
      for (let t = 2; t >= 0; t--) for (const n of tiers[t]) {
        if (recNames.has(n)) continue;
        const it = byName.get(n);
        if (it && usable.includes(it)) { recNames.add(n); html += opt(it); }
      }
      html += `</optgroup>`;
    }
    const groups = [["unique", "Uniques"], ["set", "Set items"], ["runeword", "Runewords"], ["rare", "Rare / crafted / magic"]];
    for (const [type, label] of groups) {
      const list = usable.filter((i) => i.type === type && !recNames.has(i.name)).sort((a, z) => a.req - z.req);
      if (list.length) html += `<optgroup label="${label}">${list.map(opt).join("")}</optgroup>`;
    }
    return html;
  }

  function tierBadge(c, slotKey, name) {
    if (!name) return `<span class="badge">empty</span>`;
    const t = tierOf(buildOf(c), slotKey, name);
    if (t === null) return "";
    if (t === -1) return `<span class="badge off">off-build</span>`;
    return `<span class="badge t${t}">${TIER_NAMES[t]}</span>`;
  }

  function itemLine(it) {
    if (!it) return "";
    return `<span class="n-${it.type}">${esc(it.name)}</span>${it.runes ? ` <span class="runes">(${esc(it.runes)})</span>` : ""}`;
  }

  function renderSlots(body, c, slots) {
    body.innerHTML = `<div class="grid">${slots.map((s) => {
      const g = c.gear[s.key] || {};
      const it = byName.get(g.item);
      return `<div class="card slot" data-slot="${s.key}">
        <h3><span>${s.label}</span>${tierBadge(c, s.key, g.item)}</h3>
        <select class="pick" aria-label="${s.label}">${itemOptions(c, s, g.item)}</select>
        <div class="stats">${it ? `${it.runes ? `<span class="runes">${esc(it.runes)} · </span>` : ""}${esc(it.stats)}` : ""}</div>
        <input type="text" class="note" placeholder="Notes: sockets, rolls, base…" value="${esc(g.note)}">
      </div>`;
    }).join("")}</div>`;
    body.querySelectorAll(".slot").forEach((el) => {
      const key = el.dataset.slot;
      $(".pick", el).onchange = (e) => {
        c.gear[key] = { ...(c.gear[key] || {}), item: e.target.value };
        if (!e.target.value) delete c.gear[key].item;
        save(); render();
      };
      $(".note", el).oninput = (e) => { c.gear[key] = { ...(c.gear[key] || {}), note: e.target.value }; save(); };
    });
  }

  function renderCharms(body, c) {
    const used = cellsUsed(c);
    const charmItems = ITEMS.filter((i) => i.slot === "charm");
    const counts = {};
    c.charms.forEach((ch) => (counts[ch.item] = (counts[ch.item] || 0) + 1));
    const dupes = Object.keys(counts).filter((n) => byName.get(n)?.unique1 && counts[n] > 1);
    let cells = "";
    for (let i = 0; i < Math.max(INV_CELLS, used); i++) cells += `<i class="${i < used ? (i >= INV_CELLS ? "over" : "f") : ""}"></i>`;
    body.innerHTML = `
      <div class="card">
        <h3>Inventory space</h3>
        <div class="inv">${cells}</div>
        <div class="notes">${used} of ${INV_CELLS} cells used by charms${used > INV_CELLS ? ` — <b style="color:var(--bad)">over capacity</b>` : `, ${INV_CELLS - used} free for loot`}.
        ${dupes.length ? `<br><b style="color:var(--bad)">Only one of each can be active:</b> ${dupes.map(esc).join(", ")}` : ""}</div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Charms</h3>
        <div id="charmList">${c.charms.length ? c.charms.map((ch) => {
          const it = byName.get(ch.item);
          return `<div class="charm-row" data-id="${ch.id}">
            <div>${itemLine(it)} <span class="runes">${it ? `${it.size}×1` : ""}</span>
              <div class="stats" style="font-size:13px;color:var(--muted)">${esc(it?.stats)}</div>
              <input type="text" class="note" placeholder="Rolls: e.g. +1 Cold Skills, 45 life" value="${esc(ch.note)}">
            </div>
            <button class="btn ghost small rm" aria-label="Remove">✕</button>
          </div>`;
        }).join("") : `<p class="notes">No charms yet.</p>`}</div>
        <div class="add-row">
          <select id="addCharm">${charmItems.map((i) => `<option value="${esc(i.name)}">${esc(i.name)} (${i.size} cell${i.size > 1 ? "s" : ""})</option>`).join("")}</select>
          <button class="btn" id="addCharmBtn">Add</button>
        </div>
      </div>`;
    $("#addCharmBtn").onclick = () => { c.charms.push({ id: uid(), item: $("#addCharm").value, note: "" }); save(); render(); };
    body.querySelectorAll(".charm-row").forEach((row) => {
      const ch = c.charms.find((x) => x.id === row.dataset.id);
      $(".note", row).oninput = (e) => { ch.note = e.target.value; save(); };
      $(".rm", row).onclick = () => { c.charms = c.charms.filter((x) => x !== ch); save(); render(); };
    });
  }

  function renderUpgrades(body, c) {
    const b = buildOf(c);
    if (!b) { body.innerHTML = `<div class="card"><p>No build guide for ${esc(c.cls)} yet — gear tracking still works.</p></div>`; return; }
    const target = Number(c.budget);
    const allSlots = [...GEAR_SLOTS, ...MERC_SLOTS];
    const recs = allSlots.map((s) => ({ s, r: recommendations(c, s.key) })).filter((x) => x.r.status !== "none");
    // Priority: bigger gap first; main gear before weapon swap before merc.
    const prio = ({ s, r }) => (r.gap ?? 3) * 10 - (s.key.startsWith("merc") ? 4 : s.key === "swap" ? 6 : 0);
    const done = recs.filter((x) => x.r.status === "ok").length;
    const pct = recs.length ? Math.round((done / recs.length) * 100) : 0;
    const todo = recs.filter((x) => x.r.status !== "ok").sort((a, z) => prio(z) - prio(a));

    // FCR panel
    let fcrHtml = "";
    if (b.caster) {
      const fcr = fcrTotal(c);
      const bps = FCR_BREAKPOINTS[c.cls] || [];
      const next = bps.find((v) => v > fcr);
      fcrHtml = `<div class="card">
        <h3>Faster Cast Rate</h3>
        <div class="stat-big">${fcr}%</div>
        <div class="notes">Target ${b.fcrTarget}% · ${fcr >= b.fcrTarget ? `<span class="ok">target reached</span>` : `${b.fcrTarget - fcr}% short`}${next !== undefined ? ` · next breakpoint ${next}%` : ""}</div>
        <div class="bps">${bps.map((v) => `<span class="${v <= fcr ? "hit" : ""} ${v === b.fcrTarget ? "target" : ""}">${v}</span>`).join("")}</div>
        <div class="field" style="margin-top:10px"><label>Extra FCR from rares, rolls, charms</label><input type="number" id="extraFcr" min="0" max="200" value="${esc(c.extraFcr || 0)}"></div>
      </div>`;
    }

    // charm checklist
    const have = new Set(c.charms.map((ch) => ch.item));
    const missingCharms = b.charms.filter((n) => !have.has(n));

    body.innerHTML = `
      <div class="summary">
        <div class="card">
          <h3>${esc(b.name)}</h3>
          <div class="stat-big">${done}/${recs.length}</div>
          <div class="notes">slots at ${TIER_NAMES[target]} target</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>
        ${fcrHtml}
        <div class="card">
          <h3>Charms</h3>
          ${missingCharms.length ? `<div class="notes">Still to get:</div><ul class="sugg">${missingCharms.map((n) => `<li><span>${itemLine(byName.get(n))}</span><span class="runes">lvl ${byName.get(n)?.req}</span></li>`).join("")}</ul>` : `<p class="ok">All recommended charms in inventory.</p>`}
          <div class="notes">${cellsUsed(c)}/${INV_CELLS} cells used</div>
        </div>
      </div>
      <div class="card notes" style="margin-bottom:12px">${esc(b.notes)}</div>
      ${todo.length ? todo.map(({ s, r }) => {
        const curIt = byName.get(c.gear[s.key]?.item);
        const now = r.status === "empty" ? "Empty slot" : r.status === "off" ? `Has ${curIt ? esc(curIt.name) : "item"} — not on this build's list` : `Has ${esc(curIt.name)} (${TIER_NAMES[r.tier]})`;
        return `<div class="card up">
          <h3>${s.label}</h3>
          <div class="now">${now}</div>
          <ul class="sugg">${r.items.slice(0, 4).map((x) => `<li><div>${itemLine(x.item)}<div class="s-stats">${esc(x.item.stats)}</div></div><span class="badge t${x.tier}">${x.gated ? `lvl ${x.item.req}` : TIER_NAMES[x.tier]}</span></li>`).join("")}</ul>
        </div>`;
      }).join("") : `<div class="card"><p class="ok">Every slot meets your ${TIER_NAMES[target]} target. Raise the budget target to see the next step.</p></div>`}`;

    const ef = $("#extraFcr");
    if (ef) ef.onchange = (e) => { c.extraFcr = Number(e.target.value) || 0; save(); render(); };
  }

  // ---------- header actions ----------
  $("#charSelect").onchange = (e) => { state.current = e.target.value; save(); render(); };
  $("#newChar").onclick = newChar;
  $("#deleteChar").onclick = () => {
    const c = cur();
    if (!c || !confirm(`Delete ${c.name}? This can't be undone.`)) return;
    state.chars = state.chars.filter((x) => x !== c);
    state.current = state.chars[0]?.id || null;
    save(); render();
    $(".menu").open = false;
  };
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gear-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $(".menu").open = false;
  };
  $("#importFile").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.chars)) throw new Error("bad file");
      const replace = state.chars.length ? confirm("Replace current characters? (Cancel = merge)") : true;
      if (replace) state = data;
      else { const ids = new Set(state.chars.map((c) => c.id)); state.chars.push(...data.chars.filter((c) => !ids.has(c.id))); }
      state.current = state.current || state.chars[0]?.id || null;
      save(); render();
    } catch (err) { alert("That file isn't a Gear Ledger backup."); }
    e.target.value = "";
    $(".menu").open = false;
  };

  if (!state.current && state.chars.length) state.current = state.chars[0].id;
  render();
})();
