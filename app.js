// Perfect Roll — app logic. Plain JS, no build step.
(() => {
  const STORE_KEY = "gearLedger.v1";
  const TIER_NAMES = ["Starter", "Mid", "Endgame"];
  const INV_CELLS = 40; // 10 x 4 inventory
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byName = new Map(ITEMS.map((i) => [i.name, i]));
  const DUAL_WIELD = ["Barbarian", "Assassin"]; // classes that can hold a weapon in the off-hand
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ---------- accounts (encrypted on this device) ----------
  // Each account: { id, name, salt, iv, data } — data is AES-GCM ciphertext of
  // { chars, stash, current }, keyed by PBKDF2 of the account password.
  const ACCTS_KEY = "gearLedger.accounts.v2";
  const MAX_CHARS = 10;
  const PBKDF2_ITERS = 250000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => {
    const u = new Uint8Array(buf); let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

  let accounts = loadAccounts();
  let session = null; // { acct, key } while unlocked
  let state = null;   // decrypted { chars, stash, current } of the unlocked account
  let tab = "gear";
  let pickedAcct = null;
  let stashType = "helm"; // last gear type used when adding to the stash
  let stashFind = ""; // filter text for the stash list (kept while you remove items)
  // Newest first: entries carry `added`; older ones without it keep their saved order.
  const newestFirst = (list) => list.map((e, i) => ({ e, k: e.added || i })).sort((a, b) => b.k - a.k).map((x) => x.e);
  const latestAdded = (list) => list.reduce((m, e) => Math.max(m, e.added || 0), 0);
  let flashId = null; // entry to highlight and scroll to after adding
  function showFlash(body) {
    const el = flashId && body.querySelector(".charm-row.flash");
    flashId = null;
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function loadAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCTS_KEY)) || []; } catch (e) { return []; }
  }
  function writeAccounts() {
    try { localStorage.setItem(ACCTS_KEY, JSON.stringify(accounts)); return true; }
    catch (e) { alert("Couldn't save — browser storage is unavailable or full."); return false; }
  }
  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function sealInto(acct, key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
    acct.iv = b64(iv); acct.data = b64(ct);
  }
  async function openAcct(acct, password) {
    const key = await deriveKey(password, unb64(acct.salt));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(acct.iv) }, key, unb64(acct.data)); // throws on wrong password
    return { key, data: JSON.parse(dec.decode(pt)) };
  }
  async function createAccount(name, password, data) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const acct = { id: uid(), name, salt: b64(salt), created: Date.now() };
    const key = await deriveKey(password, salt);
    await sealInto(acct, key, data);
    accounts.push(acct);
    if (!writeAccounts()) { accounts.pop(); return null; }
    return { acct, key };
  }
  function normalize(d) {
    d = d || {};
    if (!Array.isArray(d.custom)) d.custom = []; // user-defined items not in the database
    if (!Array.isArray(d.chars)) d.chars = [];
    if (!Array.isArray(d.stash)) d.stash = [];
    if (!d.current && d.chars.length) d.current = d.chars[0].id;
    return d;
  }

  // Saves are encrypted asynchronously; queue so writes land in order.
  let saveChain = Promise.resolve();
  function save() {
    if (!session) return;
    const { acct, key } = session;
    const snapshot = JSON.parse(JSON.stringify(state));
    saveChain = saveChain.then(async () => { await sealInto(acct, key, snapshot); writeAccounts(); }).catch(() => {});
  }
  function lock() { unregisterCustom(); tzOnline = { at: 0, data: null, error: "", loading: false }; session = null; state = null; pickedAcct = null; tab = "gear"; render(); }

  // ---------- old photo cleanup ----------
  // Photos used to be stored with items; they no longer are. Remove any left in
  // IndexedDB for this account and strip the references from its entries.
  function purgePhotos() {
    let changed = false;
    const strip = (en) => { if (en && en.photo) { delete en.photo; changed = true; } };
    state.chars.forEach((c) => { Object.values(c.gear).forEach(strip); c.charms.forEach(strip); });
    state.stash.forEach(strip);
    if (changed) save();
    try {
      const r = indexedDB.open("gearLedger");
      r.onupgradeneeded = () => r.transaction.abort(); // never existed — nothing to clean
      r.onsuccess = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("photos")) { d.close(); return; }
        const tx = d.transaction("photos", "readwrite");
        const req = tx.objectStore("photos").index("acct").getAllKeys(session.acct.id);
        req.onsuccess = () => req.result.forEach((k) => tx.objectStore("photos").delete(k));
        tx.oncomplete = () => d.close();
      };
    } catch (e) { /* ignore */ }
  }


  // ---------- custom items (per account) ----------
  // Stored as { name, slot, type, stats } and merged into the item catalog while unlocked.
  let customLoaded = [];
  function registerCustom() {
    unregisterCustom();
    for (const ci of state.custom || []) {
      const it = { name: ci.name, slot: ci.slot, type: ci.type || "misc", stats: ci.stats || "", custom: true };
      ITEMS.push(it); byName.set(it.name, it); SEARCH_INDEX.push(indexEntry(it)); customLoaded.push(it);
    }
  }
  function unregisterCustom() {
    for (const it of customLoaded) {
      const i = ITEMS.indexOf(it); if (i >= 0) ITEMS.splice(i, 1);
      if (byName.get(it.name) === it) byName.delete(it.name);
      const j = SEARCH_INDEX.findIndex((e) => e.it === it); if (j >= 0) SEARCH_INDEX.splice(j, 1);
    }
    customLoaded = [];
  }
  // Drop custom definitions nothing refers to any more.
  function pruneCustom() {
    const used = new Set([...state.stash.map((e) => e.item), ...state.chars.flatMap((c) => [...Object.values(c.gear).map((g) => g?.item), ...c.charms.map((x) => x.item)])]);
    const before = state.custom.length;
    state.custom = state.custom.filter((ci) => used.has(ci.name));
    if (state.custom.length !== before) registerCustom();
  }

  // Characters saved by the earlier single-user version (plain, unencrypted).
  function legacyData() {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? normalize(JSON.parse(raw)) : null; } catch (e) { return null; }
  }

  const SLOT_LABELS = { helm: "Helms", amulet: "Amulets", ring: "Rings", weapon: "Weapons", offhand: "Shields & off-hands", armor: "Armor", gloves: "Gloves", belt: "Belts", boots: "Boots", charm: "Charms", rune: "Runes", gem: "Gems", jewel: "Jewels & facets", misc: "Keys, organs & other" };
  const inStash = (name) => state.stash.some((s) => s.item === name);
  // Runes, gems, keys, essences etc. stack: one stash entry with a count.
  const STACKABLE = ["rune", "gem", "misc"];
  const qtyOf = (e) => Math.max(1, Number(e.qty) || 1);
  const stackable = (name) => STACKABLE.includes(byName.get(name)?.slot);
  const stashCount = () => state.stash.reduce((n, e) => n + qtyOf(e), 0);
  // Add to the stash; a stackable item you already hold (same notes) just goes up by one.
  function addToStash(item, note = "") {
    if (stackable(item)) {
      const same = state.stash.find((e) => e.item === item && (e.note || "") === (note || ""));
      if (same) { same.qty = qtyOf(same) + 1; same.added = Date.now(); return same.id; }
    }
    const id = uid();
    state.stash.push({ id, added: Date.now(), item, note: note || "" });
    return id;
  }
  // Older stashes may hold the same rune several times: fold those into one entry with a count.
  function mergeStacks() {
    const seen = new Map(); let changed = false;
    state.stash = state.stash.filter((e) => {
      if (!stackable(e.item)) return true;
      const k = e.item + "|" + (e.note || "");
      const first = seen.get(k);
      if (!first) { seen.set(k, e); return true; }
      first.qty = qtyOf(first) + qtyOf(e); first.added = Math.max(first.added || 0, e.added || 0); changed = true;
      return false;
    });
    return changed;
  }
  // Traderie search link; generic rare/crafted entries have no single listing.
  function traderieLink(it) {
    if (!it || it.type === "rare" || (it.type === "charm" && !it.unique1)) return "";
    const q = it.name.replace(/ \((sword|shield|helm)\)$/, "");
    return `<a class="ext" href="https://traderie.com/diablo2resurrected/products?search=${encodeURIComponent(q)}" target="_blank" rel="noopener">Traderie ↗</a>`;
  }

  const cur = () => state.chars.find((c) => c.id === state.current) || null;
  const buildOf = (c) => BUILDS.find((b) => b.id === c.build) || null;

  function newChar() {
    if (state.chars.length >= MAX_CHARS) { alert(`An account holds up to ${MAX_CHARS} characters. Delete one or use another account.`); return; }
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
    // Items already in the shared stash come first.
    items.forEach((x) => (x.stash = inStash(x.item.name) && !x.gated));
    items.sort((a, z) => (z.stash ? 1 : 0) - (a.stash ? 1 : 0));
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

  // Items kept in the inventory besides charms (all on unless turned off for this character).
  const KEPT = [
    { key: "id", label: "Tome of Identify", size: 2 },
    { key: "tp", label: "Tome of Town Portal", size: 2 },
    { key: "cube", label: "Horadric Cube", size: 4 },
  ];
  const keptOn = (c, k) => !(c.kept && c.kept[k] === false);
  const keptCells = (c) => KEPT.reduce((n, k) => n + (keptOn(c, k.key) ? k.size : 0), 0);
  const charmCells = (c) => c.charms.reduce((n, ch) => n + (byName.get(ch.item)?.size || 1), 0);
  function cellsUsed(c) { return keptCells(c) + charmCells(c); }

  // ---------- render ----------
  function render() {
    if (tzTimer) { clearInterval(tzTimer); tzTimer = null; }
    document.body.classList.toggle("locked", !session);
    if (!session) { $("#acctName").textContent = "D2R inventory & upgrades"; renderLogin(); return; }
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
        ${[["gear", "Gear"], ["merc", "Mercenary"], ["charms", "Charms"], ["stash", `Stash (${stashCount()})`], ["runewords", "Runewords"], ["cube", "Gems & Cube"], ["skills", "Skills"], ["upgrades", "Upgrades"], ["tz", "Terror Zones"]].map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}
      </nav>
      ${!["upgrades", "skills", "runewords", "cube", "tz"].includes(tab) ? `<div class="scan-row"><label class="btn scan-btn">📷 Take photo of gear<input type="file" id="scanCam" accept="image/*" capture="environment"></label><label class="btn ghost scan-btn">🖼 From gallery<input type="file" id="scanInput" accept="image/*" multiple></label><span class="notes">Point at the item tooltip in the game — straight on, whole box in frame.</span></div>` : ""}
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
    ["#scanInput", "#scanCam"].forEach((sel) => {
      const si = $(sel);
      if (si) si.onchange = (e) => { const files = [...e.target.files]; e.target.value = ""; scanPhotos(c, files); };
    });

    // Keep the open tab in view in the scrolling tab bar (phones).
    const nav = $(".tabs"), selTab = nav && $(".tab[aria-selected=true]", nav);
    if (selTab && (selTab.offsetLeft < nav.scrollLeft || selTab.offsetLeft + selTab.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = selTab.offsetLeft - 16;

    const body = $("#tabBody");
    if (tab === "gear") renderSlots(body, c, GEAR_SLOTS);
    else if (tab === "merc") renderSlots(body, c, MERC_SLOTS);
    else if (tab === "charms") renderCharms(body, c);
    else if (tab === "stash") renderStash(body, c);
    else if (tab === "skills") renderSkills(body, c);
    else if (tab === "runewords") renderRunewords(body, c);
    else if (tab === "cube") renderCube(body, c);
    else if (tab === "tz") renderTerror(body, c);
    else renderUpgrades(body, c);
  }

  function renderRoster() {
    const sel = $("#charSelect");
    sel.innerHTML = state.chars.length
      ? state.chars.map((c) => `<option value="${c.id}" ${c.id === state.current ? "selected" : ""}>${esc(c.name)} — ${esc(c.cls)} ${esc(c.level)}</option>`).join("")
      : `<option>No characters</option>`;
    sel.disabled = !state.chars.length;
    $("#acctName").textContent = `${session.acct.name} · ${state.chars.length}/${MAX_CHARS}`;
    $("#newChar").disabled = state.chars.length >= MAX_CHARS;
  }

  // ---------- README shown on the landing page ----------
  let readmeHtml = null; // null = not fetched yet, "" = unavailable
  let readmeOpen = null; // user's expand/collapse choice; null = open only when there are no accounts yet
  const mdInline = (t) => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener"><img src="$2" alt="$1" loading="lazy"></a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  function mdToHtml(md) {
    const out = []; let list = false, para = [];
    const flush = () => { if (para.length) out.push(`<p>${mdInline(para.join(" "))}</p>`); para = []; if (list) { out.push("</ul>"); list = false; } };
    for (const line of md.split(/\r?\n/)) {
      const h = line.match(/^(#{1,3})\s+(.*)/), li = line.match(/^\s*[-*]\s+(.*)/);
      if (h) { flush(); out.push(`<h${h[1].length + 1}>${mdInline(h[2])}</h${h[1].length + 1}>`); }
      else if (li) { if (para.length) { out.push(`<p>${mdInline(para.join(" "))}</p>`); para = []; } if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${mdInline(li[1])}</li>`); }
      else if (!line.trim()) flush();
      else { if (list) { out.push("</ul>"); list = false; } para.push(line.trim()); }
    }
    flush();
    return out.join("");
  }
  function loadReadme() {
    if (readmeHtml !== null) return;
    readmeHtml = "";
    fetch("README.md", { cache: "no-cache" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((md) => { readmeHtml = md ? mdToHtml(md.replace(/^#\s.*\n/, "")) : ""; const el = $("#readme"); if (el) { el.innerHTML = readmeHtml; $("#readmeBox").hidden = !readmeHtml; } })
      .catch(() => {});
  }

  // ---------- login / account screens ----------
  function renderLogin() {
    const app = $("#app");
    const legacy = legacyData();
    const list = accounts.map((a) => `<button class="acct ${pickedAcct === a.id ? "on" : ""}" data-id="${a.id}"><span class="acct-ico">🔒</span>${esc(a.name)}</button>`).join("");
    const picked = accounts.find((a) => a.id === pickedAcct);
    app.innerHTML = `
      <div class="login">
        <details class="card readme" id="readmeBox" ${readmeHtml ? "" : "hidden"} ${(readmeOpen ?? !accounts.length) ? "open" : ""}><summary>About Perfect Roll</summary><div id="readme">${readmeHtml || ""}</div></details>
        ${accounts.length ? `<section class="card">
          <h2>Accounts</h2>
          <div class="acct-list">${list}</div>
          ${picked ? `<form id="unlockForm" class="stack">
            <label class="field"><span>Password for ${esc(picked.name)}</span><input type="password" id="unlockPw" autocomplete="current-password" required></label>
            <button class="btn" type="submit">Unlock</button>
            <p class="err" id="unlockErr"></p>
          </form>` : `<p class="notes">Pick an account to unlock it.</p>`}
        </section>` : ""}
        <section class="card">
          <h2>${accounts.length ? "New account" : "Create your first account"}</h2>
          <p class="notes">Each account holds up to ${MAX_CHARS} characters and its own shared stash, locked with its password on this device. <b>A forgotten password can't be recovered.</b></p>
          <form id="createForm" class="stack">
            <label class="field"><span>Account name</span><input type="text" id="newName" placeholder="e.g. Main, Ladder, Hardcore" required maxlength="40"></label>
            <label class="field"><span>Password</span><input type="password" id="newPw" autocomplete="new-password" required minlength="4"></label>
            <label class="field"><span>Confirm password</span><input type="password" id="newPw2" autocomplete="new-password" required></label>
            ${legacy && legacy.chars.length ? `<label class="check"><input type="checkbox" id="moveLegacy" checked> Move my ${legacy.chars.length} existing character${legacy.chars.length > 1 ? "s" : ""} and stash into this account</label>` : ""}
            <button class="btn" type="submit">Create account</button>
            <p class="err" id="createErr"></p>
          </form>
        </section>
        <section class="card">
          <h2>Restore</h2>
          <p class="notes">Import an account backup exported from another device. You'll unlock it with its original password.</p>
          <label class="btn ghost file-btn">Import account backup<input type="file" id="loginImport" accept="application/json"></label>
        </section>
      </div>`;

    loadReadme();
    $("#readmeBox").ontoggle = (e) => { readmeOpen = e.target.open; };
    app.querySelectorAll(".acct").forEach((b) => (b.onclick = () => { pickedAcct = b.dataset.id; renderLogin(); $("#unlockPw")?.focus(); }));
    const uf = $("#unlockForm");
    if (uf) uf.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button", uf); btn.disabled = true; btn.textContent = "Unlocking…";
      try {
        const { key, data } = await openAcct(picked, $("#unlockPw").value);
        session = { acct: picked, key }; state = normalize(data); registerCustom(); purgePhotos(); render();
      } catch (err) {
        btn.disabled = false; btn.textContent = "Unlock";
        $("#unlockErr").textContent = "Wrong password.";
        $("#unlockPw").select();
      }
    };
    $("#createForm").onsubmit = async (e) => {
      e.preventDefault();
      const name = $("#newName").value.trim(), pw = $("#newPw").value;
      const errEl = $("#createErr");
      if (pw !== $("#newPw2").value) { errEl.textContent = "Passwords don't match."; return; }
      if (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) { errEl.textContent = "There's already an account with that name."; return; }
      const move = $("#moveLegacy")?.checked;
      let data = normalize(move ? legacy : null);
      if (data.chars.length > MAX_CHARS) { errEl.textContent = `You have ${data.chars.length} existing characters; only the first ${MAX_CHARS} will be moved.`; data.chars = data.chars.slice(0, MAX_CHARS); }
      const s = await createAccount(name, pw, data);
      if (!s) return;
      if (move) { try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ } }
      session = s; state = data; registerCustom(); render();
    };
    $("#loginImport").onchange = (e) => importFile(e);
  }

  function addImportedAccount(rec) {
    let name = rec.name || "Imported", n = 2;
    while (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) name = `${rec.name} (${n++})`;
    const acct = { id: uid(), name, salt: rec.salt, iv: rec.iv, data: rec.data, created: Date.now() };
    accounts.push(acct);
    writeAccounts();
    return acct;
  }

  async function importFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    $(".menu").open = false;
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (err) { alert("That file isn't a Perfect Roll backup."); return; }
    if (data.format === "gear-ledger-account" && data.salt && data.iv && data.data) {
      const acct = addImportedAccount(data);
      alert(`Added account "${acct.name}". Unlock it with its password.`);
      if (session) lock(); else { pickedAcct = acct.id; render(); }
      return;
    }
    if (Array.isArray(data.chars)) {
      if (!session) { alert("That's an older single-list backup. Unlock or create an account first, then import it from the ⋯ menu."); return; }
      const ids = new Set(state.chars.map((c) => c.id));
      const incoming = data.chars.filter((c) => !ids.has(c.id));
      const room = MAX_CHARS - state.chars.length;
      state.chars.push(...incoming.slice(0, room));
      const sids = new Set(state.stash.map((s) => s.id));
      state.stash.push(...(data.stash || []).filter((s) => !sids.has(s.id)));
      state.current = state.current || state.chars[0]?.id || null;
      save(); render();
      if (incoming.length > room) alert(`Only ${room} character${room === 1 ? "" : "s"} fit (limit ${MAX_CHARS} per account).`);
      return;
    }
    alert("That file isn't a Perfect Roll backup.");
  }

  // Small password dialog (change password).
  function pwDialog() {
    return new Promise((resolve) => {
      const d = $("#pwDialog");
      const f = $("form", d);
      f.reset(); $("#pwErr").textContent = "";
      d.showModal();
      f.onsubmit = (e) => {
        e.preventDefault();
        if (e.submitter?.value === "cancel") { d.close(); resolve(null); return; }
        const a = $("#pw1").value, b = $("#pw2").value;
        if (a.length < 4) { $("#pwErr").textContent = "Use at least 4 characters."; return; }
        if (a !== b) { $("#pwErr").textContent = "Passwords don't match."; return; }
        d.close(); resolve(a);
      };
    });
  }

  function itemOptions(c, slot, selected) {
    const b = buildOf(c);
    const dualWield = slot.key === "offhand" && DUAL_WIELD.includes(c.cls);
    const pool = ITEMS.filter((i) => (i.slot === slot.list || (dualWield && i.slot === "weapon")) &&(!i.cls || i.cls === c.cls || slot.key.startsWith("merc")) && (!slot.mercOnly || i.merc));
    const mercClsOk = (i) => !(slot.key.startsWith("merc") && i.cls); // mercs can't use class items
    const usable = pool.filter(mercClsOk);
    const opt = (i) => `<option value="${esc(i.name)}" ${i.name === selected ? "selected" : ""}>${esc(i.name)}${i.alias ? ` (${esc(i.alias)})` : ""} · lvl ${i.req ?? "?"}</option>`;
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
    const b = buildOf(c);
    if (b && !b.tiers[listKey(slotKey)]) return `<span class="badge">not used by build</span>`;
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

  const TYPE_LABEL = { unique: "Unique", set: "Set item", runeword: "Runeword", rare: "Rare / crafted", magic: "Magic", charm: "Charm", rune: "Rune", gem: "Gem", jewel: "Jewel", misc: "Other" };
  // Split "a, b (x, y), c" into stat lines without breaking inside parentheses.
  const statLines = (s) => String(s || "").split(/,\s+(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
  const noteLines = (s) => String(s || "").split(/\n|\s·\s/).map((x) => x.trim()).filter(Boolean);

  // Original line icons per item class (icons.js), tinted by item rarity.
  const itemIcon = (it) => `<span class="item-ico n-${it.type}" aria-hidden="true">${ItemIcons.svg(it)}</span>`;

  // ---------- item search ----------
  const SLOT_NAME = { helm: "Helm", armor: "Armor", weapon: "Weapon", offhand: "Shield / off-hand", gloves: "Gloves", belt: "Belt", boots: "Boots", amulet: "Amulet", ring: "Ring", charm: "Charm", rune: "Rune", gem: "Gem", jewel: "Jewel", misc: "Other" };
  const sNorm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const indexEntry = (it) => ({ it, hay: sNorm([it.name, it.alias, it.runes, it.cls, it.base, it.set].filter(Boolean).join(" ")), name: sNorm(it.name) });
  const SEARCH_INDEX = ITEMS.map(indexEntry);
  // Rank: name starts with query > a word starts with it > contains it anywhere (incl. alias, runes).
  function searchItems(q, filter, limit = 8) {
    const n = sNorm(q);
    if (!n) return [];
    const words = n.split(" ");
    // Each typed word must start a word in the item's name/alias/runes; fall back to anywhere-in-text.
    const collect = (test) => {
      const out = [];
      for (const e of SEARCH_INDEX) {
        if (filter && !filter(e.it)) continue;
        if (!words.every((w) => test(e.hay, w))) continue;
        out.push({ it: e.it, score: e.name.startsWith(n) ? 0 : 1 });
      }
      return out;
    };
    let out = collect((hay, w) => (" " + hay).includes(" " + w));
    if (!out.length) out = collect((hay, w) => hay.includes(w));
    return out.sort((a, z) => a.score - z.score || a.it.name.localeCompare(z.it.name)).slice(0, limit).map((x) => x.it);
  }
  const searchHTML = (placeholder) => `<div class="isearch"><input type="search" class="isearch-in" placeholder="🔍 ${esc(placeholder)}" autocomplete="off" enterkeyhint="search"><ul class="isearch-res" hidden></ul></div>`;
  // Wire a search box: filter(it) limits results, onPick(it) handles the choice.
  function wireSearch(box, filter, onPick, ctx) {
    if (!box) return;
    const inp = $(".isearch-in", box), res = $(".isearch-res", box);
    const show = () => {
      const hits = searchItems(inp.value, filter);
      res.hidden = !inp.value.trim();
      res.innerHTML = hits.length
        ? hits.map((it) => `<li><button type="button" data-name="${esc(it.name)}">${itemIcon(it)}<span><span class="n-${it.type}">${esc(it.name)}</span><small>${esc([SLOT_NAME[it.slot], TYPE_LABEL[it.type], it.cls ? it.cls + " only" : ""].filter(Boolean).join(" · "))}</small></span></button></li>`).join("")
        : `<li class="none">No items match "${esc(inp.value)}"</li>`;
      res.querySelectorAll("button").forEach((b) => (b.onclick = () => { inp.value = ""; res.hidden = true; onPick(byName.get(b.dataset.name)); }));
    };
    inp.oninput = show;
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("button", res)?.click(); } if (e.key === "Escape") { inp.value = ""; res.hidden = true; } };
  }

  // Tooltip-style item block: icon, typical stats, then your item's actual stats.
  // opts.noteKey marks the entry for wiring (see wireEntries).
  function entryHTML(entry, it, opts = {}) {
    if (!it) return opts.empty ? `<div class="tip empty-tip">${opts.empty}</div>` : "";
    const mine = noteLines(entry.note);
    const typical = statLines(it.stats);
    const sub = [it.custom ? "Custom" : "", TYPE_LABEL[it.type], it.base || (it.custom ? SLOT_NAME[it.slot] : ""), it.set ? `${it.set} set` : "", it.req ? `lvl ${it.req}` : "", it.cls ? `${it.cls} only` : ""].filter(Boolean).join(" · ");
    return `<div class="tip" data-entry="${opts.noteKey || ""}">
      <div class="tip-top">
        ${itemIcon(it)}
        <div class="tip-head">
          <div class="tip-name n-${it.type}">${esc(it.name)}</div>
          <div class="tip-sub">${esc(sub)}</div>
          ${it.runes ? `<div class="tip-runes">'${esc(it.runes.replace(/ /g, ""))}'</div>` : ""}
        </div>
      </div>
      ${typical.length ? `<div class="tip-h">Typical stats</div><ul class="tip-stats">${typical.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      ${mine.length ? `<hr class="tip-divider" ${typical.length ? "" : "hidden"}><div class="tip-h">Actual stats</div><ul class="tip-stats mine">${mine.map((l) => /\(check\)$/.test(l) ? `<li class="check-line" title="Not read from the photo — tap Edit stats to enter your roll">${esc(l.replace(/\s*\(check\)$/, ""))}<span class="chk">check</span></li>` : `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <div class="tip-actions">
        <label class="link">📷 Scan stats<input type="file" class="scan-in" accept="image/*" capture="environment" hidden></label>
        <label class="link">🖼 From gallery<input type="file" class="scan-in" accept="image/*" hidden></label>
        <button class="link edit-note" type="button">✎ ${mine.length ? "Edit stats" : "Type stats"}</button>
      </div>
      <textarea class="note" rows="4" hidden placeholder="One stat per line, e.g. +35% Faster Cast Rate">${esc(mine.join("\n"))}</textarea>
    </div>`;
  }

  // Read actual stats for one item from a photo (the photo isn't kept).
  async function scanInto(en) {
    const status = $("#scanStatus");
    const progress = (m) => { status.textContent = m; status.hidden = false; };
    return async (file) => {
      try {
        const worker = await getWorker(progress);
        progress("Reading stats from photo…");
        const text = await readPhoto(worker, file);
        status.hidden = true;
        const lines = statNotes(text, byName.get(en.item));
        if (!lines) { alert("Couldn't find any stat lines in that photo. Try again straight on, closer to the tooltip."); return; }
        if (!en.note || confirm(`Replace the actual stats with these?\n\n${lines}`)) { en.note = lines; save(); render(); }
      } catch (err) { status.hidden = true; alert("Couldn't read the photo — the text reader needs an internet connection the first time it loads."); }
    };
  }

  // Hook up stat editing and per-item scanning for every .tip under root.
  function wireEntries(root, lookup) {
    root.querySelectorAll(".tip[data-entry]").forEach((tip) => {
      const k = tip.dataset.entry;
      if (!k) return;
      const get = () => lookup(k);
      const ta = $(".note", tip);
      const editBtn = $(".edit-note", tip);
      if (editBtn) editBtn.onclick = () => { ta.hidden = !ta.hidden; if (!ta.hidden) ta.focus(); };
      if (ta) {
        ta.oninput = () => { const en = get(); if (en) { en.note = ta.value; save(); } };
        ta.onblur = () => render();
      }
      tip.querySelectorAll(".scan-in").forEach((inp) => inp.onchange = async () => {
        const f = inp.files[0]; inp.value = "";
        const en = get(); if (!f || !en) return;
        (await scanInto(en))(f);
      });
    });
  }

  function renderSlots(body, c, slots) {
    body.innerHTML = `<div class="grid">${slots.map((s) => {
      const g = c.gear[s.key] || {};
      const it = byName.get(g.item);
      return `<div class="card slot" data-slot="${s.key}">
        <h3><span>${s.label}</span>${tierBadge(c, s.key, g.item)}</h3>
        ${searchHTML(`Search ${s.label.toLowerCase()}…`)}
        <select class="pick" aria-label="${s.label}">${itemOptions(c, s, g.item)}</select>
        ${entryHTML(g, it, { noteKey: s.key })}
      </div>`;
    }).join("")}</div>`;
    body.querySelectorAll(".slot").forEach((el) => {
      const key = el.dataset.slot;
      $(".pick", el).onchange = (e) => {
        const old = c.gear[key] || {};
        // A different item: its old photo and rolls no longer apply.
        c.gear[key] = e.target.value ? { item: e.target.value, note: "" } : {};
        save(); render();
      };
      const slot = slots.find((s) => s.key === key);
      wireSearch($(".isearch", el), (it) => slotsFor(c, it).some((s) => s.key === key), (it) => {
        if (c.gear[key]?.item !== it.name) c.gear[key] = { item: it.name, note: "" };
        save(); render();
      });
    });
    wireEntries(body, (k) => c.gear[k]);
  }

  function renderCharms(body, c) {
    const used = cellsUsed(c);
    const charmItems = ITEMS.filter((i) => i.slot === "charm");
    const counts = {};
    c.charms.forEach((ch) => (counts[ch.item] = (counts[ch.item] || 0) + 1));
    const dupes = Object.keys(counts).filter((n) => byName.get(n)?.unique1 && counts[n] > 1);
    let cells = "";
    const kept = keptCells(c), charmsUsed = used - kept;
    for (let i = 0; i < Math.max(INV_CELLS, used); i++) cells += `<i class="${i >= INV_CELLS ? "over" : i < kept ? "k" : i < used ? "f" : ""}"></i>`;
    body.innerHTML = `
      <div class="card">
        <h3>Inventory space</h3>
        <div class="inv">${cells}</div>
        <div class="kept-row">${KEPT.map((k) => `<label class="kept"><input type="checkbox" data-kept="${k.key}" ${keptOn(c, k.key) ? "checked" : ""}> ${k.label} <span class="runes">${k.size} cells</span></label>`).join("")}</div>
        <div class="notes">${(() => {
          const n = { 3: 0, 2: 0, 1: 0 };
          c.charms.forEach((ch) => { const z = byName.get(ch.item)?.size || 1; n[z] = (n[z] || 0) + 1; });
          return `Charms: ${n[3]} grand · ${n[2]} large · ${n[1]} small`;
        })()}<br>${used} of ${INV_CELLS} cells used: ${charmsUsed} by charms${kept ? `, ${kept} by tomes &amp; cube` : ""}${used > INV_CELLS ? ` — <b style="color:var(--bad)">over capacity</b>` : `, ${INV_CELLS - used} free for loot`}.
        ${dupes.length ? `<br><b style="color:var(--bad)">Only one of each can be active:</b> ${dupes.map(esc).join(", ")}` : ""}</div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Charms</h3>
        <div id="charmList">${c.charms.length ? newestFirst(c.charms).map((ch) => {
          const it = byName.get(ch.item);
          return `<div class="charm-row ${ch.id === flashId ? "flash" : ""}" data-id="${ch.id}">
            ${entryHTML(ch, it, { noteKey: ch.id })}
            <div class="row-btns"><span class="runes">${it ? `${it.size} cell${it.size > 1 ? "s" : ""}` : ""}</span><button class="btn ghost small rm" aria-label="Remove">✕</button></div>
          </div>`;
        }).join("") : `<p class="notes">No charms yet.</p>`}</div>
        <div class="add-row">
          <select id="addCharm">${charmItems.map((i) => `<option value="${esc(i.name)}">${esc(i.name)} (${i.size} cell${i.size > 1 ? "s" : ""})</option>`).join("")}</select>
          <button class="btn" id="addCharmBtn">Add</button>
        </div>
      </div>`;
    body.querySelectorAll("[data-kept]").forEach((cb) => (cb.onchange = () => {
      c.kept = { ...(c.kept || {}), [cb.dataset.kept]: cb.checked }; save(); render();
    }));
    $("#addCharmBtn").onclick = () => { const id = uid(); c.charms.push({ id, added: Date.now(), item: $("#addCharm").value, note: "" }); flashId = id; save(); render(); };
    body.querySelectorAll(".charm-row").forEach((row) => {
      const ch = c.charms.find((x) => x.id === row.dataset.id);
      $(".rm", row).onclick = () => { c.charms = c.charms.filter((x) => x !== ch); save(); render(); };
    });
    wireEntries(body, (k) => c.charms.find((x) => x.id === k));
    showFlash(body);
  }

  // Slots on this character (and merc) a given item could go into.
  function slotsFor(c, it) {
    return [...GEAR_SLOTS, ...MERC_SLOTS].filter((s) => {
      const isMerc = s.key.startsWith("merc");
      const listOk = it.slot === s.list || (s.key === "offhand" && DUAL_WIELD.includes(c.cls) && it.slot === "weapon");
      if (!listOk) return false;
      if (isMerc) return !it.cls && (!s.mercOnly || it.merc);
      return !it.cls || it.cls === c.cls;
    });
  }

  // Stash items that beat what this character (or merc) has now.
  function stashUpgrades(c) {
    const b = buildOf(c);
    if (!b) return [];
    const out = [];
    const haveCharms = new Set(c.charms.map((ch) => ch.item));
    for (const entry of state.stash) {
      const it = byName.get(entry.item);
      if (!it) continue;
      if (it.slot === "charm") {
        if (b.charms.includes(it.name) && !haveCharms.has(it.name) && fitsLevel(it, c)) out.push({ entry, it, label: "Charm inventory", why: "Recommended for this build" });
        continue;
      }
      let best = null;
      for (const s of slotsFor(c, it)) {
        const t = tierOf(b, s.key, it.name);
        if (t === null || t < 0) continue;
        const curName = c.gear[s.key]?.item;
        const ct = curName ? tierOf(b, s.key, curName) : -2;
        if (t > ct && fitsLevel(it, c) && (!best || ct < best.ct)) best = { s, t, ct, curName };
      }
      if (best) out.push({ entry, it, slotKey: best.s.key, label: best.s.label, tier: best.t, why: best.curName ? `Replaces ${best.curName}` : "Slot is empty" });
    }
    return out;
  }

  function equipFromStash(c, entry, slotKey) {
    const it = byName.get(entry.item);
    if (!it) return;
    if (qtyOf(entry) > 1) entry.qty = qtyOf(entry) - 1;
    else state.stash = state.stash.filter((x) => x !== entry);
    if (it.slot === "charm") {
      c.charms.push({ id: uid(), added: Date.now(), item: it.name, note: entry.note || "" });
    } else {
      const old = c.gear[slotKey];
      if (old?.item) addToStash(old.item, old.note || "");
      c.gear[slotKey] = { item: it.name, note: entry.note || "" };
    }
    save(); render();
  }

  // ---------- runewords from the runes in the shared stash ----------
  const RUNE_ORDER = ["El", "Eld", "Tir", "Nef", "Eth", "Ith", "Tal", "Ral", "Ort", "Thul", "Amn", "Sol", "Shael", "Dol", "Hel", "Io", "Lum", "Ko", "Fal", "Lem", "Pul", "Um", "Mal", "Ist", "Gul", "Vex", "Ohm", "Lo", "Sur", "Ber", "Jah", "Cham", "Zod"];
  const runeRank = (r) => RUNE_ORDER.indexOf(r);
  let rwFilter = "all";
  function stashRunes() {
    const have = {};
    for (const e of state.stash) {
      const it = byName.get(e.item);
      if (it?.slot !== "rune") continue;
      const r = e.item.replace(/ Rune$/, "");
      if (runeRank(r) >= 0) have[r] = (have[r] || 0) + qtyOf(e);
    }
    return have;
  }
  // One entry per runeword (Fortitude weapon/armor share runes), with what's missing.
  function runewordStatus(have) {
    const groups = new Map();
    for (const it of ITEMS) {
      if (it.type !== "runeword" || !it.runes) continue;
      const name = it.name.replace(/ \((sword|shield|helm|weapon|armor)\)$/, "");
      const g = groups.get(name) || { name, items: [], runes: it.runes.split(" "), bases: new Set(), req: it.req };
      g.items.push(it); if (it.bases) g.bases.add(it.bases);
      groups.set(name, g);
    }
    const out = [];
    for (const g of groups.values()) {
      const need = {}; g.runes.forEach((r) => (need[r] = (need[r] || 0) + 1));
      const missing = [];
      for (const [r, n] of Object.entries(need)) for (let k = (have[r] || 0); k < n; k++) missing.push(r);
      missing.sort((a, b) => runeRank(a) - runeRank(b));
      const owned = g.runes.length - missing.length;
      // How many you could make with the runes you hold (each counted on its own).
      const qty = Math.min(...Object.entries(need).map(([r, n]) => Math.floor((have[r] || 0) / n)));
      out.push({ ...g, missing, owned, qty, hardest: missing.length ? Math.max(...missing.map(runeRank)) : -1 });
    }
    return out;
  }
  function renderRunewords(body, c) {
    const have = stashRunes();
    const total = Object.values(have).reduce((a, b) => a + b, 0);
    const b = buildOf(c);
    const inBuild = new Set(b ? Object.values(b.tiers).flat(2).map((n) => String(n).replace(/ \((sword|shield|helm|weapon|armor)\)$/, "")) : []);
    let all = runewordStatus(have);
    if (rwFilter === "build") all = all.filter((g) => inBuild.has(g.name));
    const ready = all.filter((g) => !g.missing.length).sort((x, y) => (inBuild.has(y.name) - inBuild.has(x.name)) || (y.req || 0) - (x.req || 0));
    // "Close": you own at least half the runes and are missing at most two.
    const close = all.filter((g) => g.missing.length && g.missing.length <= 2 && g.owned >= Math.ceil(g.runes.length / 2))
      .sort((x, y) => x.missing.length - y.missing.length || (inBuild.has(y.name) - inBuild.has(x.name)) || x.hardest - y.hardest);
    const chip = (r, ok) => `<span class="rune-chip ${ok ? "have" : "need"}">${esc(r)}</span>`;
    const card = (g) => {
      const it = g.items[0];
      const used = {}; // mark which of the recipe's runes you already hold
      const chips = g.runes.map((r) => { used[r] = (used[r] || 0) + 1; return chip(r, used[r] <= (have[r] || 0)); }).join("");
      return `<div class="rw-card">
        <div class="rw-head"><span class="n-runeword rw-name">${esc(g.name)}</span>${g.qty ? `<span class="rw-qty" title="How many you can make from your stash runes">×${g.qty} <small>can make</small></span>` : ""}${inBuild.has(g.name) ? `<span class="badge t2">★ ${esc(b.name)}</span>` : ""}</div>
        <div class="rw-runes">${chips}</div>
        <div class="notes">${esc([...g.bases].join(" · ") || "")}${g.req ? ` · lvl ${g.req}` : ""}</div>
        ${g.missing.length ? `<div class="notes rw-miss">Need: ${g.missing.map((r) => `<a class="ext" href="https://traderie.com/diablo2resurrected/products?search=${encodeURIComponent(r + " Rune")}" target="_blank" rel="noopener">${esc(r)} ↗</a>`).join(" ")}</div>` : ""}
        <details class="rw-stats"><summary>Stats</summary><ul class="tip-stats">${statLines(it.stats).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>
      </div>`;
    };
    body.innerHTML = `
      <div class="card">
        <h3>Runes in your stash</h3>
        ${total ? `<div class="rw-runes">${RUNE_ORDER.filter((r) => have[r]).map((r) => `<span class="rune-chip have">${r}${have[r] > 1 ? ` ×${have[r]}` : ""}</span>`).join("")}</div>
          <p class="notes">${total} rune${total === 1 ? "" : "s"}. Add or remove runes on the Stash tab (Gear type: Rune).</p>`
        : `<p class="notes">No runes in your stash yet. Add them on the Stash tab (Gear type: Rune) and this page shows what you can make.</p>`}
        <div class="seg" role="group" aria-label="Which runewords">
          <button class="btn small ${rwFilter === "all" ? "" : "ghost"}" data-rwf="all">All runewords</button>
          <button class="btn small ${rwFilter === "build" ? "" : "ghost"}" data-rwf="build" ${b ? "" : "disabled"}>${b ? `Only ${esc(b.name)}` : "No build picked"}</button>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Ready to make (${ready.length})</h3>
        ${ready.length ? ready.map(card).join("") : `<p class="notes">${total ? "Nothing complete yet — see what you're close to below." : "Add runes to see what you can make."}</p>`}
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Almost there (${close.length})</h3>
        <p class="notes" style="margin-top:4px">Missing one or two runes, with at least half the recipe in your stash. Easiest to finish first.</p>
        ${close.length ? close.map(card).join("") : `<p class="notes">Nothing within two runes yet.</p>`}
      </div>`;
    body.querySelectorAll("[data-rwf]").forEach((btn) => (btn.onclick = () => { rwFilter = btn.dataset.rwf; render(); }));
  }

  // ---------- gems & Horadric Cube upgrades ----------
  const GEM_TYPES = ["Topaz", "Amethyst", "Sapphire", "Ruby", "Emerald", "Diamond", "Skull"];
  const GEM_GRADES = ["Chipped", "Flawed", "", "Flawless", "Perfect"];
  const gemName = (grade, type) => (grade ? `${grade} ${type}` : type);
  const gradeLabel = (g) => g || "Normal";
  // Game cube recipes: El–Ort take 3 runes; Thul–Lem 3 runes + a gem; Pul–Cham 2 runes + a gem.
  // The gem cycles Topaz, Amethyst, Sapphire, Ruby, Emerald, Diamond and steps up a grade every six runes.
  function runeRecipe(i) {
    const from = RUNE_ORDER[i], to = RUNE_ORDER[i + 1];
    if (!to) return null;
    const qty = i >= RUNE_ORDER.indexOf("Pul") ? 2 : 3;
    const k = i - RUNE_ORDER.indexOf("Thul");
    const gem = k >= 0 ? gemName(GEM_GRADES[Math.floor(k / 6)], GEM_TYPES[k % 6]) : null;
    return { from, to, qty, gem };
  }
  function stashCounts(slot) {
    const have = {};
    for (const e of state.stash) if (byName.get(e.item)?.slot === slot) have[e.item] = (have[e.item] || 0) + qtyOf(e);
    return have;
  }
  function renderCube(body, c) {
    const runes = stashRunes();
    const gems = stashCounts("gem");
    const gemTotal = Object.values(gems).reduce((a, b) => a + b, 0);
    const now = [], needGem = [];
    for (let i = 0; i < RUNE_ORDER.length - 1; i++) {
      const r = runeRecipe(i);
      const n = Math.floor((runes[r.from] || 0) / r.qty);
      if (!n) continue;
      if (!r.gem) { now.push({ ...r, times: n }); continue; }
      const g = gems[r.gem] || 0;
      if (g) now.push({ ...r, times: Math.min(n, g) });
      else {
        // Could the missing gem be cubed from three of the grade below?
        const [grade, type] = (() => { for (const gr of GEM_GRADES) for (const t of GEM_TYPES) if (gemName(gr, t) === r.gem) return [gr, t]; return ["", ""]; })();
        const lower = GEM_GRADES.indexOf(grade) > 0 ? gemName(GEM_GRADES[GEM_GRADES.indexOf(grade) - 1], type) : null;
        needGem.push({ ...r, times: n, lower, lowerHave: lower ? gems[lower] || 0 : 0 });
      }
    }
    now.sort((a, b) => runeRank(b.to) - runeRank(a.to));
    needGem.sort((a, b) => runeRank(b.to) - runeRank(a.to));
    const gemUps = [];
    for (const t of GEM_TYPES) for (let gi = 0; gi < GEM_GRADES.length - 1; gi++) {
      const from = gemName(GEM_GRADES[gi], t), to = gemName(GEM_GRADES[gi + 1], t);
      const n = Math.floor((gems[from] || 0) / 3);
      if (n) gemUps.push({ from, to, times: n });
    }
    const runeChip = (r, cls = "have") => `<span class="rune-chip ${cls}">${esc(r)}</span>`;
    const gemChip = (g, cls) => `<span class="gem-chip ${cls} gem-${(g.split(" ").pop() || "").toLowerCase()}">${esc(g)}</span>`;
    const recipeRow = (r, extra = "") => `<div class="cube-row">
        <div class="cube-recipe">${r.qty} × ${runeChip(r.from)}${r.gem ? ` + ${gemChip(r.gem, extra ? "need" : "have")}` : ""} <span class="arrow">→</span> ${runeChip(r.to, "out")}</div>
        <div class="cube-meta">${extra || `<span class="rw-qty">×${r.times} <small>can do</small></span>`}</div>
      </div>`;
    const gemGrid = gemTotal ? `<div class="gem-grid" role="table" aria-label="Gems in your stash">
        <div class="gg-h" role="row"><span></span>${GEM_GRADES.map((g) => `<span role="columnheader">${gradeLabel(g)}</span>`).join("")}</div>
        ${GEM_TYPES.filter((t) => GEM_GRADES.some((g) => gems[gemName(g, t)])).map((t) => `<div class="gg-r" role="row"><span class="gem-name gem-${t.toLowerCase()}" role="rowheader">${t}</span>${GEM_GRADES.map((g) => { const n = gems[gemName(g, t)] || 0; return `<span class="${n ? "n" : "z"}" role="cell">${n || "·"}</span>`; }).join("")}</div>`).join("")}
      </div>` : `<p class="notes">No gems in your stash yet. Add them on the Stash tab (Gear type: Gem).</p>`;
    body.innerHTML = `
      <div class="card">
        <h3>Gems in your stash</h3>
        ${gemGrid}
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Rune upgrades you can cube now (${now.length})</h3>
        <p class="notes" style="margin-top:4px">From the runes and gems in your stash. Best result first. Each recipe is counted on its own, so two recipes can be counting the same gem.</p>
        ${now.length ? now.map((r) => recipeRow(r)).join("") : `<p class="notes">${Object.keys(runes).length ? "None yet — you need 3 of a rune (2 from Pul up), plus the right gem from Thul up." : "Add runes on the Stash tab to see upgrades."}</p>`}
      </div>
      ${needGem.length ? `<div class="card" style="margin-top:12px">
        <h3>Missing only the gem (${needGem.length})</h3>
        ${needGem.map((r) => recipeRow(r, `Need ${esc(r.gem)}${r.lower && r.lowerHave >= 3 ? ` — or cube 3 of your ${r.lowerHave} ${esc(r.lower)}` : r.lower ? ` <span class="notes">(3 ${esc(r.lower)} make one; you have ${r.lowerHave})</span>` : ""}`)).join("")}
      </div>` : ""}
      <div class="card" style="margin-top:12px">
        <h3>Gem upgrades (${gemUps.length})</h3>
        <p class="notes" style="margin-top:4px">3 gems of the same kind and grade make one of the next grade.</p>
        ${gemUps.length ? gemUps.map((g) => `<div class="cube-row"><div class="cube-recipe">3 × ${gemChip(g.from, "have")} <span class="arrow">→</span> ${gemChip(g.to, "out")}</div><div class="cube-meta"><span class="rw-qty">×${g.times} <small>can do</small></span></div></div>`).join("") : `<p class="notes">Nothing to combine — you need 3 of the same gem.</p>`}
      </div>
      <details class="card cube-ref" style="margin-top:12px">
        <summary>All rune recipes</summary>
        ${RUNE_ORDER.slice(0, -1).map((_, i) => { const r = runeRecipe(i); return `<div class="cube-ref-row">${r.qty} ${esc(r.from)}${r.gem ? ` + ${esc(r.gem)}` : ""} → <b>${esc(r.to)}</b></div>`; }).join("")}
      </details>`;
  }

  function renderStash(body, c) {
    if (mergeStacks()) save();
    const groups = Object.keys(SLOT_LABELS);
    if (!STASH_TYPES.some(([g]) => g === stashType)) stashType = "helm";
    const ups = new Map(stashUpgrades(c).map((u) => [u.entry.id, u]));
    const orderedGroups = groups.slice().sort((x, y) => latestAdded(state.stash.filter((e) => byName.get(e.item)?.slot === y)) - latestAdded(state.stash.filter((e) => byName.get(e.item)?.slot === x)));
    const sections = orderedGroups.map((g) => {
      const entries = newestFirst(state.stash.filter((e) => byName.get(e.item)?.slot === g));
      if (!entries.length) return "";
      return `<section class="sgrp"><h3 class="grp">${SLOT_LABELS[g]}</h3>${entries.map((e) => {
        const it = byName.get(e.item);
        const u = ups.get(e.id);
        const target = u ? u.slotKey : slotsFor(c, it)[0]?.key;
        const canEquip = it.slot === "charm" || target;
        const hay = [e.item, it.alias, it.runes, it.base, e.note, SLOT_LABELS[g]].filter(Boolean).join(" ").toLowerCase();
        return `<div class="charm-row ${e.id === flashId ? "flash" : ""}" data-id="${e.id}" data-find="${esc(hay)}">
          <div>
            ${u ? `<div class="ok up-flag">▲ Upgrade for ${esc(c.name)}: ${esc(u.label)} — ${esc(u.why)}</div>` : ""}
            ${entryHTML(e, it, { noteKey: e.id })}
          </div>
          <div class="row-btns">
            ${stackable(e.item) || qtyOf(e) > 1 ? `<div class="qty" aria-label="Quantity"><button class="btn ghost small qminus" aria-label="One fewer">−</button><span class="qn">${qtyOf(e)}</span><button class="btn ghost small qplus" aria-label="One more">+</button></div>` : ""}
            ${canEquip ? `<button class="btn small eq" data-slot="${target || ""}">Equip</button>` : ""}
            <button class="btn ghost small rm" aria-label="Remove">✕</button>
          </div>
        </div>`;
      }).join("")}</section>`;
    }).join("");
    body.innerHTML = `
      <div class="card">
        <h3>Shared stash</h3>
        <p class="notes" style="margin-top:4px">Items here are shared by all your characters. Upgrades for ${esc(c.name)} are flagged, and the Upgrades tab checks them first. Equip swaps the worn item back into the stash.</p>
        <div class="add-row">
          <div class="stack add-pick">
            ${searchHTML("Search any item…")}
            <label class="field"><span>Gear type</span><select id="addStashType">${STASH_TYPES.map(([g, l]) => `<option value="${g}" ${g === stashType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field"><span>Item</span><select id="addStash">${itemsOfType(c, stashType)}</select></label>
          </div>
          <button class="btn" id="addStashBtn">Add</button>
        </div>
        <details class="custom-add">
          <summary>Not in the list? Add a custom item</summary>
          <div class="stack">
            <label class="field"><span>Item name</span><input type="text" id="cuName" maxlength="60" placeholder="e.g. Hellfire Torch (Paladin), 15 IAS jewel, eth Thresher base"></label>
            <label class="field"><span>Gear type</span><select id="cuSlot">${STASH_TYPES.map(([g, l]) => `<option value="${g}" ${g === stashType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field"><span>Rarity</span><select id="cuType">${[["unique", "Unique"], ["set", "Set"], ["runeword", "Runeword"], ["rare", "Rare / crafted"], ["magic", "Magic"], ["misc", "Normal / other"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
            <label class="field"><span>Stats (optional, one per line)</span><textarea id="cuStats" rows="3"></textarea></label>
            <p class="err" id="cuErr"></p>
            <button class="btn" id="cuAdd" type="button">Add custom item to stash</button>
          </div>
        </details>
      </div>
      <div class="card" style="margin-top:12px">
        ${state.stash.length ? `<label class="field stash-find"><span>Find in your stash (${stashCount()} item${stashCount() === 1 ? "" : "s"})</span>
          <input type="search" id="stashFind" placeholder="Name, rune, base or stat…" value="${esc(stashFind)}" autocomplete="off"></label>
          <p class="notes" id="stashNone" hidden>Nothing in your stash matches.</p>` : ""}
        ${sections || `<p class="notes">Stash is empty. Add the items you're holding onto.</p>`}</div>`;
    const applyFind = () => {
      const q = stashFind.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      body.querySelectorAll(".sgrp").forEach((sec) => {
        let n = 0;
        sec.querySelectorAll(".charm-row").forEach((row) => {
          const hit = q.every((w) => row.dataset.find.includes(w));
          row.hidden = !hit; if (hit) n++;
        });
        sec.hidden = !n; shown += n;
      });
      const none = $("#stashNone", body); if (none) none.hidden = shown > 0 || !q.length;
    };
    const findBox = $("#stashFind", body);
    if (findBox) { findBox.oninput = () => { stashFind = findBox.value; applyFind(); }; applyFind(); }
    $("#addStashType").onchange = (ev) => { stashType = ev.target.value; $("#addStash").innerHTML = itemsOfType(c, stashType); };
    wireSearch($(".add-pick .isearch", body), null, (it) => {
      stashType = it.slot;
      $("#addStashType").value = stashType;
      $("#addStash").innerHTML = itemsOfType(c, stashType);
      $("#addStash").value = it.name;
      $("#addStashBtn").focus();
    });
    $("#addStashBtn").onclick = () => { flashId = addToStash($("#addStash").value); save(); render(); };
    $("#cuAdd").onclick = () => {
      let name = $("#cuName").value.trim().replace(/\s+/g, " ");
      if (!name) { $("#cuErr").textContent = "Give the item a name."; return; }
      const existing = byName.get(name);
      if (existing && !existing.custom) { $("#cuErr").textContent = `"${name}" is already in the list — use the search box above.`; return; }
      const slot = $("#cuSlot").value;
      if (!existing) state.custom.push({ name, slot, type: $("#cuType").value, stats: "" });
      registerCustom();
      const nid = uid(); flashId = nid;
      state.stash.push({ id: nid, added: Date.now(), item: name, note: $("#cuStats").value.trim() });
      stashType = slot;
      save(); render();
    };
    body.querySelectorAll(".charm-row").forEach((row) => {
      const e = state.stash.find((x) => x.id === row.dataset.id);
      $(".rm", row).onclick = () => { state.stash = state.stash.filter((x) => x !== e); pruneCustom(); save(); render(); };
      const qm = $(".qminus", row), qp = $(".qplus", row);
      if (qp) qp.onclick = () => { e.qty = qtyOf(e) + 1; save(); render(); };
      if (qm) qm.onclick = () => {
        if (qtyOf(e) > 1) e.qty = qtyOf(e) - 1;
        else { state.stash = state.stash.filter((x) => x !== e); pruneCustom(); }
        save(); render();
      };
      const eq = $(".eq", row);
      if (eq) eq.onclick = () => equipFromStash(c, e, eq.dataset.slot);
    });
    wireEntries(body, (k) => state.stash.find((x) => x.id === k));
    showFlash(body);
  }

  // ---------- skill plan ----------
  const ptsMin = (p) => (p === "rest" ? 0 : Number(String(p).match(/\d+/)?.[0] || 0));
  function renderSkills(body, c) {
    const b = buildOf(c);
    const plan = b && SKILL_PLANS[b.id];
    if (!plan) { body.innerHTML = `<div class="card"><p class="notes">No skill plan for this build yet.</p></div>`; return; }
    const lvl = Number(c.level) || 1;
    const quest = lvl >= 75 ? 12 : lvl >= 40 ? 8 : lvl >= 8 ? 4 : 0; // Den of Evil, Radament, Izual ×3 difficulties (rough)
    const have = Math.max(0, lvl - 1) + quest;
    const fixed = plan.skills.reduce((n, [name, p]) => n + (name === "Prerequisites" ? 0 : ptsMin(p)), 0);
    const rows = plan.skills.map(([name, p, note], i) => {
      const n = ptsMin(p), w = p === "rest" ? 100 : Math.min(100, (n / 20) * 100);
      return `<li class="sk-row ${name === "Prerequisites" ? "sk-pre" : ""}">
        <span class="sk-n">${name === "Prerequisites" ? "•" : i}</span>
        <div class="sk-main"><div class="sk-name">${esc(name)}</div>${note ? `<div class="sk-note">${esc(note)}</div>` : ""}
          <div class="sk-bar"><i style="width:${w}%" class="${p === "rest" ? "rest" : ""}"></i></div></div>
        <span class="sk-pts">${p === "rest" ? "rest" : esc(p)}</span>
      </li>`;
    }).join("");
    const st = plan.stats;
    body.innerHTML = `
      <div class="card">
        <h3>${esc(b.name)} — skill points</h3>
        <p class="notes">Max them in this order. At level ${lvl} you have about <b>${have}</b> points (${Math.max(0, lvl - 1)} from levels + ${quest} from quests: Den of Evil, Radament and Izual in each difficulty). This plan places about ${fixed} points plus prerequisites; "rest" takes whatever is left.</p>
        ${plan.note ? `<p class="notes" style="color:var(--text)">${esc(plan.note)}</p>` : ""}
        <ol class="sk-list">${rows}</ol>
        <p class="notes sk-src">${plan.src === "iv" ? "Matches the current Icy Veins skill guide for this build." : "Long-standing community allocation for this build — if a patch changed its synergies, check a current guide."} These are the points you spend yourself — +skills from gear add on top.</p>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Stat points</h3>
        <dl class="stat-plan">
          <dt>Strength</dt><dd>${esc(st.str)}</dd>
          <dt>Dexterity</dt><dd>${esc(st.dex)}</dd>
          <dt>Vitality</dt><dd>${esc(st.vit)}</dd>
          <dt>Energy</dt><dd>${esc(st.enr)}</dd>
        </dl>
      </div>`;
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
          ${missingCharms.length ? `<div class="notes">Still to get:</div><ul class="sugg">${missingCharms.map((n) => `<li><span>${itemLine(byName.get(n))}</span><span class="runes">lvl ${byName.get(n)?.req ?? "?"}</span></li>`).join("")}</ul>` : `<p class="ok">All recommended charms in inventory.</p>`}
          <div class="notes">${cellsUsed(c)}/${INV_CELLS} cells used</div>
        </div>
      </div>
      ${(() => {
        const su = stashUpgrades(c);
        if (!su.length) return "";
        return `<div class="card up stash-card"><h3>From your stash</h3><div class="now">Already yours — free upgrades for ${esc(c.name)}</div>
          <ul class="sugg">${su.map((u) => `<li data-id="${u.entry.id}" data-slot="${u.slotKey || ""}"><div>${itemLine(u.it)}<div class="s-stats">${esc(u.label)} · ${esc(u.why)}</div></div><button class="btn small eq">Equip</button></li>`).join("")}</ul></div>`;
      })()}
      <div class="card notes" style="margin-bottom:12px">${esc(b.notes)}</div>
      ${todo.length ? todo.map(({ s, r }) => {
        const curIt = byName.get(c.gear[s.key]?.item);
        const now = r.status === "empty" ? "Empty slot" : r.status === "off" ? `Has ${curIt ? esc(curIt.name) : "item"} — not on this build's list` : `Has ${esc(curIt.name)} (${TIER_NAMES[r.tier]})`;
        return `<div class="card up">
          <h3>${s.label}</h3>
          <div class="now">${now}</div>
          <ul class="sugg">${r.items.slice(0, 4).map((x) => `<li><div>${itemLine(x.item)}<div class="s-stats">${esc(x.item.stats)}</div>${x.stash ? "" : traderieLink(x.item)}</div><div class="badges">${x.stash ? `<span class="badge stash">In stash</span>` : ""}<span class="badge t${x.tier}">${x.gated ? `lvl ${x.item.req}` : TIER_NAMES[x.tier]}</span></div></li>`).join("")}</ul>
        </div>`;
      }).join("") : `<div class="card"><p class="ok">Every slot meets your ${TIER_NAMES[target]} target. Raise the budget target to see the next step.</p></div>`}`;

    body.querySelectorAll(".stash-card li").forEach((li) => {
      const e = state.stash.find((x) => x.id === li.dataset.id);
      $(".eq", li).onclick = () => equipFromStash(c, e, li.dataset.slot);
    });
    const ef = $("#extraFcr");
    if (ef) ef.onchange = (e) => { c.extraFcr = Number(e.target.value) || 0; save(); render(); };
  }

  // ---------- Terror Zones ----------
  // Single player: computed on this device from the game's own rotation (terrorzones.js), no internet needed.
  // Online: the zone players report to D2RuneWizard, fetched with the user's own API token.
  const TZ_API = "https://d2runewizard.com/api/trackers/terror-zone";
  const TZ_SOURCE = "https://d2runewizard.com/terror-zone-tracker";
  const TZ_REPO = "https://github.com/jlyle/D2r-gear";
  let tzTimer = null;
  let tzOnline = { at: 0, data: null, error: "", loading: false };
  const GRADE = { great: ["Clear it all", "g-great"], ok: ["Mostly fine", "g-ok"], tough: ["Tough", "g-tough"], unknown: ["No build", ""] };
  const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function countdown(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(r).padStart(2, "0")}s`;
  }
  function tzBreakers(c) {
    const have = new Set(c.charms.map((ch) => ch.item));
    const sunder = new Set(Object.entries(TZ.SUNDERS).filter(([, n]) => have.has(n)).map(([k]) => k));
    return { sunder, infinity: c.gear.merc_weapon?.item === "Infinity" };
  }
  // Sunder charms the character lacks, with how many of this zone's blocked monster types each would open up.
  function sunderHints(zone, els, br) {
    const out = [];
    for (const e of els) {
      if (br.sunder.has(e)) continue;
      const withIt = { sunder: new Set([...br.sunder, e]), infinity: br.infinity };
      const before = TZ.rate(zone, els.join(""), br).blocked.length, after = TZ.rate(zone, els.join(""), withIt).blocked.length;
      if (after < before) out.push({ name: TZ.SUNDERS[e], n: before - after });
    }
    return out.sort((a, b) => b.n - a.n);
  }
  function zoneHTML(zone, c, opts = {}) {
    if (!zone) return `<div class="tz-zone"><div class="notes">${esc(opts.empty || "Unknown zone")}</div></div>`;
    const els = [...(BUILD_DAMAGE[c.build] || "")];
    const br = tzBreakers(c);
    const r = TZ.rate(zone, els.join(""), br);
    const [label, cls] = GRADE[r.grade];
    const imm = TZ.immunitySummary(zone);
    const hints = r.blocked.length ? sunderHints(zone, els, br) : [];
    return `<div class="tz-zone">
      <div class="tz-title"><div><b>${esc(zone.name)}</b> <span class="notes-inline">Act ${zone.act}</span></div>${els.length ? `<span class="badge ${cls}">${label}</span>` : ""}</div>
      ${opts.when ? `<div class="notes tz-when">${opts.when}</div>` : ""}
      ${els.length ? `<div class="tz-fit">You can hurt ${r.total - r.blocked.length} of ${r.total} monster types here${r.blocked.length ? ` · immune to you: ${esc(r.blocked.map((m) => m.name).join(", "))}` : ""}</div>` : ""}
      ${hints.length ? `<div class="notes tz-hint">${hints.map((h) => `${esc(h.name)} would open up ${h.n} of them${byName.get(h.name) ? " · " + traderieLink(byName.get(h.name)) : ""}`).join("<br>")}</div>` : ""}
      ${opts.full !== false ? `<div class="tz-imm">${imm.length ? imm.map(([k, n]) => `<span class="imm imm-${k}">${TZ.ELEMENTS[k]} ${n}</span>`).join("") : `<span class="imm">No immunes</span>`}</div>
      <div class="notes tz-areas">${esc(zone.areas.join(" · "))}</div>` : ""}
    </div>`;
  }
  async function fetchOnlineTZ(force) {
    const cfg = state.tz || {};
    if (!cfg.token || tzOnline.loading) return;
    if (!force && Date.now() - tzOnline.at < 60000) return; // D2RuneWizard asks for no faster than its cache (30-60s)
    tzOnline.loading = true;
    try {
      const res = await fetch(`${TZ_API}?token=${encodeURIComponent(cfg.token)}`, {
        headers: { "D2R-Contact": cfg.contact || "", "D2R-Platform": "Web", "D2R-Repo": TZ_REPO },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || body?.error || `D2RuneWizard answered ${res.status}`);
      tzOnline = { at: Date.now(), data: body, error: "", loading: false };
    } catch (e) {
      tzOnline = { at: Date.now(), data: tzOnline.data, loading: false,
        error: e instanceof TypeError ? "Couldn't reach D2RuneWizard from here (offline, or the site refused the request)." : e.message };
    }
    if (tab === "tz") render();
  }
  function onlineCardHTML(c) {
    const cfg = state.tz || {};
    const now = Date.now(), sw = TZ.nextSwitch(now);
    const credit = `<div class="notes">Online zones are reported by players to <a href="${TZ_SOURCE}" target="_blank" rel="noopener">D2RuneWizard</a>.</div>`;
    if (!cfg.token) return `<div class="card tz-card"><h3>Online (Battle.net)</h3>
      <p class="notes">Online zones change every 30 minutes and can't be worked out ahead of time, so they come from players' reports. Add your own free D2RuneWizard API token to see the current zone here.</p>
      <form class="stack tz-setup" id="tzSetup">
        <label class="field"><span>API token</span><input type="password" id="tzToken" autocomplete="off" placeholder="From d2runewizard.com/integration"></label>
        <label class="field"><span>Contact email (sent to D2RuneWizard, required by their API)</span><input type="text" id="tzContact" inputmode="email" autocomplete="email"></label>
        <button class="btn">Save token</button>
      </form>${credit}</div>`;
    const tzd = tzOnline.data?.terrorZone;
    const hp = tzd?.highestProbabilityZone;
    const zone = hp ? TZ.matchName(hp.zone, hp.act) : null;
    const reportedAt = tzd?.lastUpdate?.seconds ? tzd.lastUpdate.seconds * 1000 : 0;
    const slotStart = sw - 30 * 60000;
    const stale = reportedAt && reportedAt < slotStart;
    const nextName = tzOnline.data?.nextTerrorZone?.zone || tzd?.nextTerrorZone?.zone || tzd?.nextTerrorZone?.highestProbabilityZone?.zone;
    const nextZone = nextName ? TZ.matchName(nextName, tzOnline.data?.nextTerrorZone?.act || tzd?.nextTerrorZone?.act) : null;
    let current;
    if (tzOnline.loading && !tzd) current = `<div class="notes">Loading…</div>`;
    else if (!hp) current = zoneHTML(null, c, { empty: tzOnline.error || "No report yet." });
    else if (stale) current = `<div class="tz-zone"><div class="notes">No one has reported the zone since the ${hhmm(slotStart)} switch yet. Check back in a minute, or run <code>/terrorized</code> in game.</div></div>`;
    else current = zoneHTML(zone, c, { when: `${hp.probability ? Math.round(hp.probability > 1 ? hp.probability : hp.probability * 100) + "% of reports" : "Reported"}${reportedAt ? ` · ${hhmm(reportedAt)}` : ""}${zone ? "" : ` · “${esc(hp.zone)}”`}` });
    return `<div class="card tz-card"><h3>Online (Battle.net)</h3>
      <div class="tz-label">Now</div>${current}
      <div class="tz-label">Next · switches in <span data-until="${sw}">${countdown(sw - now)}</span></div>
      ${nextZone ? zoneHTML(nextZone, c, { full: false }) : `<div class="notes">Online zones aren't published ahead of time; the next one shows here once players report it after ${hhmm(sw)}.</div>`}
      ${tzOnline.error && hp ? `<p class="err">${esc(tzOnline.error)}</p>` : ""}
      <div class="row-btns"><button class="btn ghost small" id="tzRefresh"${tzOnline.loading ? " disabled" : ""}>Refresh</button><button class="btn ghost small" id="tzForget">Remove token</button></div>
      ${credit}</div>`;
  }
  function renderTerror(body, c) {
    const now = Date.now();
    const sp = TZ.spWindows(now, 13);
    const b = buildOf(c);
    const els = [...(BUILD_DAMAGE[c.build] || "")];
    const br = tzBreakers(c);
    const breakNotes = [...[...br.sunder].map((k) => TZ.SUNDERS[k]), ...(br.infinity ? ["Infinity on your merc"] : [])];
    body.innerHTML = `
      <div class="card notes tz-intro">
        ${b && els.length ? `Rated for <b>${esc(c.name)}</b> — ${esc(b.name)} (${els.map((e) => TZ.ELEMENTS[e]).join(" + ")} damage)${breakNotes.length ? `, with ${esc(breakNotes.join(" and "))} breaking immunities` : ""}. ` : "Pick a build to rate zones for this character. "}
        Ratings use Hell monsters; champions and uniques can roll extra immunities.
      </div>
      <div class="summary tz-grid">
        ${onlineCardHTML(c)}
        <div class="card tz-card"><h3>Single player</h3>
          <div class="tz-label">Now · ends in <span data-until="${sp[0].end}">${countdown(sp[0].end - now)}</span></div>
          ${zoneHTML(sp[0].zone, c)}
          <div class="tz-label">Next · ${hhmm(sp[1].start)}</div>
          ${zoneHTML(sp[1].zone, c)}
          <div class="notes">Worked out on this device from the game's own schedule — no server or token needed. Turn on <b>Enable Terror Zones</b> in the game's offline settings; a difficulty unlocks once you've killed Baal on it.</div>
        </div>
      </div>
      <details class="card tz-later">
        <summary><h3>Later today in single player</h3></summary>
        <ul class="sugg">${sp.slice(2).map((w) => {
          const r = TZ.rate(w.zone, els.join(""), br);
          const [label, cls] = GRADE[r.grade];
          return `<li><div><b>${hhmm(w.start)}</b> ${esc(w.zone.name)} <span class="notes-inline">Act ${w.zone.act}</span>${r.blocked.length ? `<div class="s-stats">Immune to you: ${esc(r.blocked.map((m) => m.name).join(", "))}</div>` : ""}</div>${els.length ? `<span class="badge ${cls}">${label}</span>` : ""}</li>`;
        }).join("")}</ul>
      </details>`;

    const setup = $("#tzSetup", body);
    if (setup) setup.onsubmit = (e) => {
      e.preventDefault();
      const token = $("#tzToken", body).value.trim(), contact = $("#tzContact", body).value.trim();
      if (!token) return;
      state.tz = { token, contact };
      tzOnline = { at: 0, data: null, error: "", loading: false };
      save(); render();
    };
    const rf = $("#tzRefresh", body);
    if (rf) rf.onclick = () => fetchOnlineTZ(true);
    const fg = $("#tzForget", body);
    if (fg) fg.onclick = () => { if (!confirm("Remove your D2RuneWizard token from this account?")) return; delete state.tz; tzOnline = { at: 0, data: null, error: "", loading: false }; save(); render(); };

    fetchOnlineTZ(false);
    // Tick the countdowns; re-render at a switch, and re-check the online report every 2 minutes.
    const renderedSlot = sp[0].start;
    let ticks = 0;
    tzTimer = setInterval(() => {
      if (tab !== "tz" || !document.body.contains(body)) { clearInterval(tzTimer); tzTimer = null; return; }
      const t = Date.now();
      if (TZ.spWindows(t, 1)[0].start !== renderedSlot) { tzOnline.at = 0; render(); return; }
      body.querySelectorAll("[data-until]").forEach((el) => { el.textContent = countdown(Number(el.dataset.until) - t); });
      if (++ticks % 120 === 0) fetchOnlineTZ(false);
    }, 1000);
  }

  // ---------- add gear from photos (on-device OCR) ----------
  // Tesseract.js is loaded from the CDN on first use; photos never leave the device
  // and aren't stored — only the matched item and its stat lines are saved.
  const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  let ocrWorker = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("load failed"));
      document.head.appendChild(s);
    });
  }
  async function getWorker(progress) {
    if (ocrWorker) return ocrWorker;
    if (!window.Tesseract) await loadScript(TESS_URL);
    progress("Loading text reader (first time only)…");
    ocrWorker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => { if (m.status === "recognizing text") progress(`Reading text… ${Math.round(m.progress * 100)}%`); },
    });
    // Only characters that appear in tooltips — cuts most of the noise.
    await ocrWorker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-%.,:()'/ Øø" });
    return ocrWorker;
  }

  // Grayscale, invert (tooltips are light text on black) and stretch contrast.
  // Two readings of each photo, combined: the usual one (good for gold/green item names) and one that
  // keeps only the game's blue and white text, which survives see-through tooltips over busy backgrounds.
  async function readPhoto(worker, file) {
    const a = (await worker.recognize(await prepImage(file))).data.text || "";
    const b = (await worker.recognize(await prepImage(file, "text"))).data.text || "";
    return a + "\n" + b;
  }
  async function prepImage(file, mode) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    if (mode === "text") {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const text = (b > 140 && b - Math.max(r, g) > 45) || (mn > 165 && mx - mn < 45); // magic blue or white
        d[i] = d[i + 1] = d[i + 2] = text ? 0 : 255;
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    }
    // Brightest channel, so blue magic-property text stays as strong as white and gold text.
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.max(d[i], d[i + 1], d[i + 2]);
      const v = Math.max(0, Math.min(255, (255 - g - 30) * 1.5));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  const norm = (s) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const row = [i];
      for (let j = 1; j <= n; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row;
    }
    return prev[n];
  }
  const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length);

  // Generic rare/crafted fallbacks by base-type words in the tooltip.
  const BASE_HINTS = [
    [/\b(small charm)\b/, (t) => /hit recovery/.test(t) ? "Small charm — FHR" : /magic items/.test(t) ? "Small charm — MF" : "Small charm — life/res"],
    [/\b(large charm)\b/, () => "Large charm"],
    [/\b(grand charm)\b/, (t) => /\+1 to .*skills/.test(t) ? "Skiller grand charm" : "Grand charm (other)"],
    [/\b(circlet|coronet|tiara|diadem)\b/, () => "Rare caster circlet"],
    [/\bring\b/, (t) => /cast rate/.test(t) ? "Rare/Crafted FCR ring" : "Rare melee ring"],
    [/\bamulet\b/, (t) => /cast rate/.test(t) && /\+2 to/.test(t) ? "2/20 caster amulet" : /\+3 to/.test(t) ? "Rare +3 skill-tree amulet" : "Rare amulet"],
    [/\b(boots|greaves|shoes|treads)\b/, () => "Rare tri-res boots"],
    [/\b(sash|belt|girdle)\b/, () => "Rare/Crafted belt"],
    [/\b(claws?|katar|talons?|scissors|blade talons|runic talons)\b/, () => "Rare trap claw"],
    [/\b(dagger|kris|dirk|blade|poignard|mithril point|stiletto)\b/, () => "Rare Warlock dagger"],
    [/\b(pelt|hawk helm|antlers|totem|wolf head|spirit mask)\b/, (t) => /shape shifting/.test(t) ? "Rare Shape Shifting pelt" : "Rare druid pelt"],
    [/\b(gauntlets|gloves|vambraces|bracers)\b/, (t) => /javelin/.test(t) ? "Rare javelin gloves" : /bow and crossbow/.test(t) ? "Rare bow gloves" : "Crafted Blood gloves"],
    [/\b(head|preserved head|zombie head|fetish trophy|hierophant trophy)\b/, () => "Rare necro head"],
  ];

  function matchItems(text) {
    // Name lines never contain digits; stat lines ("+15 to Strength") must not pose as names.
    const lines = text.split(/\n+/).filter((l) => !/\d/.test(l)).map(norm).filter((l) => l.length >= 3);
    const flat = norm(text).replace(/[ ']/g, "");
    const scored = [];
    for (const it of ITEMS) {
      if (it.type === "rare" || (it.type === "charm" && !it.unique1)) continue;
      const names = [it.name.replace(/ \((sword|shield|helm|weapon)\)$/, ""), it.alias].filter(Boolean).map(norm);
      let best = 0;
      for (const nm of names) for (const l of lines) {
        if (nm.length >= 6 && l.includes(nm) && l.length <= nm.length + 6) best = Math.max(best, 1);
        else best = Math.max(best, sim(l, nm));
      }
      if (it.runes && flat.includes(norm(it.runes).replace(/ /g, ""))) best = Math.max(best, 0.97); // rune recipe line
      if (best >= 0.6) scored.push({ it, score: best });
    }
    // Spirit / Dream / Fortitude share a name: prefer the one matching the base type.
    const shieldy = /(shield|monarch|targe|aegis|ward|pavise|buckler|grimoire|tome|codex|trophy|head)/.test(norm(text));
    scored.forEach((s) => {
      if (/\((shield)\)$/.test(s.it.name)) s.score += shieldy ? 0.01 : -0.01;
      if (/\((sword|weapon)\)$/.test(s.it.name)) s.score += shieldy ? -0.01 : 0.01;
    });
    scored.sort((a, z) => z.score - a.score);
    const out = scored.slice(0, 4);
    if (!out.length || out[0].score < 0.8) {
      // Weak name match: probably a rare/magic item — lead with a base-type guess.
      const t = text.toLowerCase().replace(/\s+/g, " ");
      for (const [re, pick] of BASE_HINTS) if (re.test(t)) { const it = byName.get(pick(t)); if (it && !out.some((o) => o.it === it)) out.unshift({ it, score: 0.5, guess: true }); break; }
    }
    return out;
  }

  // Only real item properties from the photo, with OCR slips fixed (see statclean.js).
  const STAT_VOCAB = ITEMS.map((i) => i.stats).join(" ");
  function statNotes(text, it) {
    const skip = new Set(it ? [it.name, it.alias].filter(Boolean).map((n) => n.toLowerCase()) : []);
    // Known unique/set/runeword: match against its own stat lines; otherwise the general parser.
    const known = it && it.stats && !["rare", "magic", "misc", "rune", "gem", "jewel"].includes(it.type) && !it.custom && !/Sunder/.test(it.stats)
      && !(it.type === "charm" && !it.unique1);
    // Magic charms/jewels: the name ("Cobalt Small Charm of Vita") says which stats to look for.
    const affix = !known && StatClean.affixTemplates(text);
    const lines = known ? StatClean.cleanStatsForItem(text, it.stats)
      : affix ? StatClean.cleanStatsForItem(text, affix, true)
      : StatClean.cleanStats(text, STAT_VOCAB);
    // The photo is read twice, so the general parser can see a stat twice: keep the first of each kind.
    const seen = new Set();
    return lines.filter((l) => {
      const k = l.toLowerCase().replace(/[+\-]?\d+(?:\.\d+)?/g, "#");
      if (skip.has(l.toLowerCase()) || seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, 18).join("\n");
  }

  function destinations(c, it) {
    const opts = [];
    if (it.slot === "charm") opts.push({ v: "charms", l: `${c.name}'s charms` });
    else for (const s of slotsFor(c, it)) {
      const curIt = c.gear[s.key]?.item;
      opts.push({ v: s.key, l: `${s.label}${curIt ? ` (replaces ${curIt})` : " (empty)"}` });
    }
    opts.push({ v: "stash", l: "Shared stash" });
    return opts;
  }
  function defaultDest(c, it) {
    if (it.slot === "charm") return "charms";
    const slots = slotsFor(c, it).filter((s) => s.key !== "swap" && !s.key.startsWith("merc"));
    const pool = slots.length ? slots : slotsFor(c, it);
    if (tab === "merc") { const m = slotsFor(c, it).find((s) => s.key.startsWith("merc")); if (m) return m.key; }
    if (tab === "stash") return "stash";
    return (pool.find((s) => !c.gear[s.key]?.item) || pool[0])?.key || "stash";
  }

  const GEAR_TYPES = [["helm", "Helm"], ["armor", "Armor"], ["weapon", "Weapon"], ["offhand", "Shield / off-hand"], ["gloves", "Gloves"], ["belt", "Belt"], ["boots", "Boots"], ["amulet", "Amulet"], ["ring", "Ring"], ["charm", "Charm"]];
  const STASH_TYPES = [...GEAR_TYPES, ["rune", "Rune"], ["gem", "Gem"], ["jewel", "Jewel / facet"], ["misc", "Key, organ, token & other"]];
  const TYPE_WORDS = [
    ["charm", /\b(small|large|grand) charm\b/], ["ring", /\bring\b/], ["amulet", /\bamulet\b/],
    ["helm", /\b(helm|cap|crown|mask|circlet|coronet|tiara|diadem|shako|pelt|hawk|antlers|totem|wolf head|spirit mask|demonhead|death mask|bone visage|sallet|casque|armet)\b/],
    ["boots", /\b(boots|greaves|shoes|treads)\b/], ["belt", /\b(belt|sash|girdle|coil)\b/],
    ["gloves", /\b(gloves|gauntlets|vambraces|bracers)\b/],
    ["offhand", /\b(shield|monarch|targe|aegis|ward|pavise|buckler|grimoire|tome|codex|compendium|text|trophy|preserved head|zombie head)\b/],
    ["armor", /\b(armor|plate|mail|robe|wyrmhide|dusk shroud|sacred armor|archon plate|mage plate|hellforge|shroud|cuirass|breast plate)\b/],
    ["weapon", /\b(sword|blade|axe|mace|hammer|maul|flail|scepter|staff|wand|orb|bow|crossbow|javelin|spear|pike|polearm|claw|katar|dagger|kris|knife|scythe|thresher|war pike)\b/],
  ];
  // Pre-pick the gear type: best candidate, else base-type words, else the current tab.
  function guessType(c, text, cands) {
    if (cands[0]) return cands[0].it.slot;
    const t = text.toLowerCase();
    for (const [g, re] of TYPE_WORDS) if (re.test(t)) return g;
    return tab === "charms" ? "charm" : "helm";
  }
  // Items of one gear type: this build's picks first, then by kind; other classes last.
  function itemsOfType(c, type) {
    const b = buildOf(c);
    const list = ITEMS.filter((i) => i.slot === type);
    const mine = list.filter((i) => !i.cls || i.cls === c.cls);
    const others = list.filter((i) => i.cls && i.cls !== c.cls);
    const opt = (i) => `<option value="${esc(i.name)}">${esc(i.name)}${i.alias ? ` (${esc(i.alias)})` : ""}${i.cls && i.cls !== c.cls ? ` — ${i.cls}` : ""}</option>`;
    const rec = new Set();
    if (b) {
      const keys = type === "ring" ? ["ring"] : type === "charm" ? [] : [type, ...(type === "weapon" ? ["swap", "merc_weapon"] : type === "helm" ? ["merc_helm"] : type === "armor" ? ["merc_armor"] : [])];
      keys.forEach((k) => (b.tiers[k] || []).flat().forEach((n) => rec.add(n)));
      if (type === "charm") b.charms.forEach((n) => rec.add(n));
    }
    const recItems = mine.filter((i) => rec.has(i.name));
    let html = recItems.length ? `<optgroup label="Recommended for ${esc(b.name)}">${recItems.map(opt).join("")}</optgroup>` : "";
    const customs = mine.filter((i) => i.custom);
    if (customs.length) html += `<optgroup label="Your custom items">${customs.map(opt).join("")}</optgroup>`;
    for (const [k, l] of [["unique", "Uniques"], ["set", "Set items"], ["runeword", "Runewords"], ["rare", "Rare / crafted"], ["magic", "Magic"], ["charm", "Charms"], ["rune", "Runes"], ["gem", "Gems"], ["jewel", "Jewels"], ["misc", "Other"]]) {
      const g = mine.filter((i) => i.type === k && !rec.has(i.name) && !i.custom).sort((x, y) => (k === "rune" ? 0 : x.name.localeCompare(y.name)));
      if (g.length) html += `<optgroup label="${l}">${g.map(opt).join("")}</optgroup>`;
    }
    if (others.length) html += `<optgroup label="Other classes">${others.map(opt).join("")}</optgroup>`;
    return html;
  }

  function reviewDialog(c, file, text, cands, idx, total) {
    return new Promise((resolve) => {
      const d = $("#scanDialog");
      const url = URL.createObjectURL(file);
      const typeOpts = STASH_TYPES.map(([g, l]) => `<option value="${g}">${l}</option>`).join("");
      d.innerHTML = `<form method="dialog" class="stack">
        <h2>Photo ${idx + 1} of ${total}</h2>
        <img class="scan-thumb" src="${url}" alt="Your photo">
        ${cands.length ? `<div class="field"><span>Best match${cands.length > 1 ? "es" : ""}</span>
          <div class="cands">${cands.map((x, i) => `<label class="cand"><input type="radio" name="cand" value="${esc(x.it.name)}" ${i === 0 ? "checked" : ""}> ${itemLine(x.it)} <span class="runes">${x.guess ? "best guess from base type" : Math.round(Math.min(1, x.score) * 100) + "% match"}</span></label>`).join("")}
          <label class="cand"><input type="radio" name="cand" value=""> Something else…</label></div></div>`
          : `<p class="err">Couldn't recognise the item name. Pick it below — retaking the photo closer and straight on usually helps.</p>`}
        <div id="otherWrap" class="stack" ${cands.length ? "hidden" : ""}>
          ${searchHTML("Search any item…")}
          <label class="field"><span>Gear type</span><select id="scanType">${typeOpts}</select></label>
          <label class="field"><span>Item</span><select id="scanOther"></select></label>
        </div>
        <label class="field"><span>Put it in</span><select id="scanDest"></select></label>
        <label class="check" id="moveWrap"><input type="checkbox" id="scanMove" checked> Move the replaced item to the shared stash</label>
        <label class="field"><span>Actual stats (read from the photo — one per line, edit as needed)</span><textarea id="scanNote" rows="6"></textarea></label>
        <details class="raw"><summary>Text read from photo</summary><pre>${esc(text.trim()) || "(nothing)"}</pre></details>
        <div class="row-btns end">
          <button class="btn ghost" value="skip" formnovalidate>Skip</button>
          ${idx + 1 < total ? `<button class="btn ghost" value="stop" formnovalidate>Stop</button>` : ""}
          <button class="btn" value="ok">Save</button>
        </div>
      </form>`;
      const chosen = () => {
        const r = $('input[name="cand"]:checked', d);
        return byName.get(r && r.value ? r.value : $("#scanOther").value);
      };
      const refresh = (resetNote) => {
        const it = chosen();
        $("#otherWrap").hidden = !!(cands.length && $('input[name="cand"]:checked', d)?.value);
        const dest = defaultDest(c, it);
        $("#scanDest").innerHTML = destinations(c, it).map((o) => `<option value="${o.v}" ${o.v === dest ? "selected" : ""}>${esc(o.l)}</option>`).join("");
        refreshMove();
        if (resetNote) $("#scanNote").value = statNotes(text, it);
      };
      const refreshMove = () => {
        const v = $("#scanDest").value;
        $("#moveWrap").hidden = !(v !== "stash" && v !== "charms" && c.gear[v]?.item);
      };
      d.querySelectorAll('input[name="cand"]').forEach((r) => (r.onchange = () => refresh(true)));
      $("#scanOther").onchange = () => refresh(true);
      $("#scanType").value = guessType(c, text, cands);
      $("#scanOther").innerHTML = itemsOfType(c, $("#scanType").value);
      $("#scanType").onchange = () => { $("#scanOther").innerHTML = itemsOfType(c, $("#scanType").value); refresh(true); };
      wireSearch($("#otherWrap .isearch", d), null, (it) => {
        $("#scanType").value = it.slot;
        $("#scanOther").innerHTML = itemsOfType(c, it.slot);
        $("#scanOther").value = it.name;
        refresh(true);
      });
      $("#scanDest").onchange = refreshMove;
      refresh(true);
      d.showModal();
      $("form", d).onsubmit = (e) => {
        e.preventDefault();
        const action = e.submitter?.value || "ok";
        d.close(); URL.revokeObjectURL(url);
        if (action !== "ok") return resolve(action);
        resolve({ item: chosen(), dest: $("#scanDest").value, note: $("#scanNote").value.trim(), move: $("#scanMove").checked });
      };
      d.oncancel = () => { URL.revokeObjectURL(url); resolve("stop"); };
    });
  }

  async function applyScan(c, r, file) {
    const it = r.item;
    if (!it) return;
    const entry = { item: it.name, note: r.note };
    if (r.dest === "stash") addToStash(entry.item, entry.note);
    else if (r.dest === "charms") c.charms.push({ id: uid(), added: Date.now(), ...entry });
    else {
      const old = c.gear[r.dest];
      if (old?.item && r.move) addToStash(old.item, old.note || "");
      c.gear[r.dest] = entry;
    }
    save();
  }

  async function scanPhotos(c, files) {
    if (!files.length) return;
    const status = $("#scanStatus");
    const progress = (msg) => { status.textContent = msg; status.hidden = false; };
    let added = 0;
    try {
      const worker = await getWorker(progress);
      for (let i = 0; i < files.length; i++) {
        progress(`Reading photo ${i + 1} of ${files.length}…`);
        const text = await readPhoto(worker, files[i]);
        status.hidden = true;
        const res = await reviewDialog(c, files[i], text, matchItems(text), i, files.length);
        if (res === "stop") break;
        if (res !== "skip") { await applyScan(c, res, files[i]); added++; render(); }
      }
    } catch (err) {
      alert("Couldn't read photos — the text reader needs an internet connection the first time it loads.");
    }
    status.hidden = true;
    if (added) render();
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
  // Export = the encrypted account record; still needs the password to open.
  $("#exportBtn").onclick = async () => {
    $(".menu").open = false;
    await saveChain;
    const { name, salt, iv, data } = session.acct;
    const blob = new Blob([JSON.stringify({ format: "gear-ledger-account", v: 2, name, salt, iv, data })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `perfect-roll-${name.replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importFile").onchange = (e) => importFile(e);
  $("#lockBtn").onclick = async () => { await saveChain; lock(); };
  $("#changePw").onclick = async () => {
    $(".menu").open = false;
    const pw = await pwDialog();
    if (!pw) return;
    await saveChain;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pw, salt);
    session.acct.salt = b64(salt);
    await sealInto(session.acct, key, state);
    session.key = key;
    writeAccounts();
    alert("Password changed. Backups exported before now still use the old password.");
  };
  $("#deleteAcct").onclick = async () => {
    $(".menu").open = false;
    const a = session.acct;
    const typed = prompt(`This permanently deletes the account "${a.name}", its ${state.chars.length} character(s) and its stash from this device.\n\nType the account name to confirm:`);
    if (typed === null) return;
    // Phone keyboards capitalise the first letter, so compare without case.
    if (typed.trim().toLowerCase() !== a.name.trim().toLowerCase()) {
      alert(`"${typed.trim()}" doesn't match "${a.name}", so nothing was deleted.`);
      return;
    }
    await saveChain;
    accounts = accounts.filter((x) => x.id !== a.id);
    writeAccounts();
    try { purgePhotos(); } catch (e) { /* ignore */ }
    lock();
    alert(`Account "${a.name}" was deleted from this device.`);
  };

  render();
})();
