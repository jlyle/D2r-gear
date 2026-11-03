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
    delete d.tz; // old Terror Zones settings (D2RuneWizard email/token), no longer used
    if (!Array.isArray(d.custom)) d.custom = []; // user-defined items not in the database
    if (!Array.isArray(d.chars)) d.chars = [];
    if (!Array.isArray(d.stash)) d.stash = [];
    if (!Array.isArray(d.locRecent)) d.locRecent = []; // stash locations, most recently used first
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
  function lock() { unregisterCustom(); session = null; state = null; pickedAcct = null; tab = "gear"; render(); }

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
  // Add to the stash; a stackable item you already hold (same notes) just goes up by the amount added.
  function addToStash(item, note = "", n = 1) {
    n = Math.max(1, Math.floor(Number(n)) || 1);
    if (stackable(item)) {
      const same = state.stash.find((e) => e.item === item && (e.note || "") === (note || "") && !(e.loc || "").trim());
      if (same) { same.qty = qtyOf(same) + n; same.added = Date.now(); return same.id; }
    }
    const id = uid();
    const entry = { id, added: Date.now(), item, note: note || "" };
    if (n > 1) entry.qty = n;
    state.stash.push(entry);
    return id;
  }
  // Where a stash item is kept (shared stash, a mule's name…), typed by the player.
  const locOf = (e) => (e?.loc || "").trim();
  const knownLocs = () => [...new Set(state.stash.map(locOf).filter(Boolean))].sort((a, z) => a.localeCompare(z));
  const LOC_SHOW = 5;
  // Remember a location as the most recently used one.
  function rememberLoc(v) {
    v = (v || "").trim();
    if (!v) return;
    const k = v.toLowerCase();
    state.locRecent = [v, ...(state.locRecent || []).filter((x) => x.toLowerCase() !== k)].slice(0, 40);
  }
  // Up to 5 locations for the dropdown: most recently used first, then any others in the stash,
  // matching what's typed (anywhere in the name), leaving out exactly what's already in the box.
  function locChoices(typed, current = typed) {
    const q = (typed || "").trim().toLowerCase();
    const cur = (current || "").trim().toLowerCase();
    const seen = new Set(); const out = [];
    for (const l of [...(state.locRecent || []), ...knownLocs()]) {
      const k = l.toLowerCase();
      if (seen.has(k)) continue; seen.add(k);
      if (k === cur || (q && !k.includes(q))) continue;
      out.push(l);
      if (out.length === LOC_SHOW) break;
    }
    return out;
  }
  const QTY_MAX = 9999;
  // A typed quantity box: tap it to type a total; + / - keys (and the arrow keys) step it by one.
  // onCommit(n, how): how is "step" (a +/- key), "enter", or "change" (edited, then left the box).
  function wireQtyInput(input, onCommit, min = 1) {
    const clamp = (v) => Math.min(QTY_MAX, Math.max(min, Math.floor(Number(v)) || 0));
    const step = (d) => { input.value = clamp((Number(input.value) || 0) + d); };
    input.addEventListener("focus", () => input.select());
    input.addEventListener("click", () => input.select());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "+" || ev.key === "=" || ev.key === "ArrowUp") { ev.preventDefault(); step(1); if (onCommit) onCommit(clamp(input.value), "step"); }
      else if (ev.key === "-" || ev.key === "_" || ev.key === "ArrowDown") { ev.preventDefault(); step(-1); if (onCommit) onCommit(clamp(input.value), "step"); }
      else if (ev.key === "Enter") { ev.preventDefault(); input.value = clamp(input.value); if (onCommit) onCommit(clamp(input.value), "enter"); else input.blur(); }
    });
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 4); });
    input.addEventListener("change", () => { input.value = clamp(input.value); if (onCommit) onCommit(clamp(input.value), "change"); });
    return { step, value: () => clamp(input.value) };
  }
  // Older stashes may hold the same rune several times: fold those into one entry with a count.
  function mergeStacks() {
    const seen = new Map(); let changed = false;
    state.stash = state.stash.filter((e) => {
      if (!stackable(e.item)) return true;
      const k = e.item + "|" + (e.note || "") + "|" + (e.loc || "").trim().toLowerCase();
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

  // ---------- mercenary type, slots and what it can use ----------
  const mercType = (c) => MERC_TYPES.find((t) => t.key === c?.merc?.type) || MERC_TYPES[1];
  function mercSlots(c) {
    const t = mercType(c);
    const out = [{ key: "merc_weapon", label: "Merc weapon", list: "weapon", mercOnly: true }];
    if (t.key === "a5" && c.merc?.variant === "Frenzy") out.push({ key: "merc_weapon2", label: "Merc 2nd weapon", list: "weapon", mercOnly: true });
    if (t.key === "a3") out.push({ key: "merc_offhand", label: "Merc shield", list: "offhand" });
    out.push({ key: "merc_helm", label: "Merc helm", list: "helm" }, { key: "merc_armor", label: "Merc armor", list: "armor" });
    return out;
  }
  const TWO_HAND_SWORDS = /two-handed sword|claymore|giant sword|bastard sword|flamberge|great sword|espandon|dacian falx|tusk sword|gothic sword|zweihander|executioner sword|legend sword|highland blade|balrog blade|champion sword|colossus (?:sword|blade)/i;
  // Weapon kinds an item counts as, from its game base type, runeword bases, name or stats prefix.
  function weaponKinds(it) {
    const k = new Set();
    const bt = it.btype || "";
    if (bt === "bow" || bt === "abow") k.add("bow");
    if (bt === "swor") { k.add("sword"); if (!TWO_HAND_SWORDS.test(it.base || "")) k.add("sword1h"); }
    if (bt === "pole") k.add("polearm");
    if (bt === "spea" || bt === "aspe") k.add("spear");
    if (bt === "jave" || bt === "ajav") k.add("javelin");
    if (!bt) {
      const txt = `${it.bases || ""} ${(/^\s*(\w+):/.exec(it.stats || "") || [])[1] || ""} ${(/\((sword|weapon)\)/.exec(it.name) || [])[1] || ""}`.toLowerCase();
      if (/\bbows?\b|missile/.test(txt)) k.add("bow");
      if (/swords?\b/.test(txt)) { k.add("sword"); k.add("sword1h"); }
      if (/polearms?\b/.test(txt)) k.add("polearm");
      if (/spears?\b/.test(txt)) k.add("spear");
      if (/javelins?\b/.test(txt)) k.add("javelin");
      if (/(^|[\s-])weapons?\b|melee weapons|\(weapon\)/.test(txt)) ["bow", "sword", "sword1h", "polearm", "spear", "javelin"].forEach((x) => k.add(x));
      if (!k.size && it.merc) { k.add("polearm"); k.add("spear"); }
    }
    return k;
  }
  function mercItemOk(c, slot, it) {
    const t = mercType(c);
    const kinds = it.slot === "weapon" ? weaponKinds(it) : null;
    if (it.cls && !(t.key === "a1" && kinds?.has("bow"))) return false; // mercs can't use class items (Act 1 can use Amazon bows)
    if (slot.mercOnly) return t.weapons.some((w) => kinds.has(w));
    if (slot.key === "merc_offhand") return !it.btype || it.btype === "shie";
    return true;
  }
  const lvlFor = (c, key) => Number(String(key || "").startsWith("merc") ? c.merc?.level : c.level) || 0;
  const fitsSlot = (it, c, key) => { const L = lvlFor(c, key); return !L || !it.req || it.req <= L; };
  // Tier lists for a slot: merc types other than Act 2 have their own weapon lists.
  function tiersFor(build, slotKey, c) {
    if (c && slotKey.startsWith("merc")) { const o = MERC_RECS[mercType(c).key]?.[slotKey]; if (o) return o; }
    return build?.tiers[listKey(slotKey)];
  }

  function tierOf(build, slotKey, itemName, c) {
    if (!build || !itemName) return null;
    const tiers = tiersFor(build, slotKey, c);
    if (!tiers) return null;
    for (let t = 2; t >= 0; t--) if (tiers[t].includes(itemName)) return t;
    return -1;
  }

  function recommendations(c, slotKey) {
    const b = buildOf(c);
    if (!b) return { status: "nobuild", items: [] };
    const tiers = tiersFor(b, slotKey, c);
    if (!tiers) return { status: "none", items: [] };
    const target = Math.min(c.budget, 2);
    const curName = c.gear[slotKey]?.item;
    const t = curName ? tierOf(b, slotKey, curName, c) : -2; // -2 empty, -1 off-build
    if (t >= target) return { status: "ok", tier: t, items: [] };
    const seen = new Set();
    const items = [];
    for (let k = target; k > Math.max(t, -1); k--) {
      for (const n of tiers[k]) {
        if (n === curName || seen.has(n)) continue;
        const it = byName.get(n);
        if (!it || !fitsSlot(it, c, slotKey)) continue;
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

  // FCR from worn gear and charms (actual stats when entered, else lowest typical roll), plus the manual extra.
  function fcrTotal(c) {
    return (statSummary(c).totals.fcr || 0) + (Number(c.extraFcr) || 0);
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
        ${[["gear", "Gear"], ["merc", "Mercenary"], ["charms", "Charms"], ["stash", `Stash (${stashCount()})`], ["runewords", "Runewords"], ["cube", "Gems & Cube"], ["skills", "Skills"], ["upgrades", "Upgrades"]].map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}
      </nav>
      ${!["upgrades", "skills", "runewords", "cube"].includes(tab) ? `<div class="scan-row"><label class="btn scan-btn">📷 Take photo of gear<input type="file" id="scanCam" accept="image/*" capture="environment"></label><label class="btn ghost scan-btn">🖼 From gallery<input type="file" id="scanInput" accept="image/*" multiple></label><span class="notes">Point at the item tooltip in the game — straight on, whole box in frame.</span></div>` : ""}
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
    else if (tab === "merc") renderMerc(body, c);
    else if (tab === "charms") renderCharms(body, c);
    else if (tab === "stash") renderStash(body, c);
    else if (tab === "skills") renderSkills(body, c);
    else if (tab === "runewords") renderRunewords(body, c);
    else if (tab === "cube") renderCube(body, c);
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
            <button type="button" class="link danger" id="loginDelete">Delete ${esc(picked.name)} from this device</button>
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
          <label class="btn ghost file-btn">Import account backup<input type="file" id="loginImport"></label>
        </section>
      </div>`;

    loadReadme();
    $("#readmeBox").ontoggle = (e) => { readmeOpen = e.target.open; };
    app.querySelectorAll(".acct").forEach((b) => (b.onclick = () => { pickedAcct = b.dataset.id; renderLogin(); $("#unlockPw")?.focus(); }));
    const ld = $("#loginDelete");
    if (ld) ld.onclick = () => {
      const a = accounts.find((x) => x.id === pickedAcct);
      if (!a) return;
      const typed = prompt(`This permanently deletes the account "${a.name}", its characters and its stash from this device. A backup file you saved isn't affected.\n\nType the account name to confirm:`);
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== a.name.trim().toLowerCase()) { alert(`"${typed.trim()}" doesn't match "${a.name}", so nothing was deleted.`); return; }
      accounts = accounts.filter((x) => x.id !== a.id);
      writeAccounts();
      pickedAcct = null;
      renderLogin();
    };
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
    const isMerc = slot.key.startsWith("merc");
    const usable = ITEMS.filter((i) => (i.slot === slot.list || (dualWield && i.slot === "weapon")) && (isMerc ? mercItemOk(c, slot, i) : !i.cls || i.cls === c.cls));
    const opt = (i) => `<option value="${esc(i.name)}" ${i.name === selected ? "selected" : ""}>${esc(i.name)}${i.alias ? ` (${esc(i.alias)})` : ""} · lvl ${i.req ?? "?"}</option>`;
    let html = `<option value="">— empty —</option>`;
    const recNames = new Set();
    if (b && tiersFor(b, slot.key, c)) {
      const tiers = tiersFor(b, slot.key, c);
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
    if (b && !tiersFor(b, slotKey, c)) return `<span class="badge">not used by build</span>`;
    if (!name) return `<span class="badge">empty</span>`;
    const t = tierOf(buildOf(c), slotKey, name, c);
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
        <h3><span>${s.label}</span>${tierBadge(c, s.key, g.item)}${it && !fitsSlot(it, c, s.key) ? `<span class="badge off">needs lvl ${it.req}</span>` : ""}</h3>
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

  function renderMerc(body, c) {
    const m = c.merc || {};
    const t = mercType(c);
    const slots = mercSlots(c);
    renderSlots(body, c, slots);
    const variant = t.variants.includes(m.variant) ? m.variant : t.variants[0];
    const wrong = slots.filter((s) => { const it = byName.get(c.gear[s.key]?.item); return it && !mercItemOk(c, s, it); }).map((s) => byName.get(c.gear[s.key].item).name);
    body.insertAdjacentHTML("afterbegin", `<div class="card merc-head">
        <h3>${esc(m.name || "Mercenary")}</h3>
        <div class="merc-grid">
          <div class="field"><label for="mType">Type</label><select id="mType">${MERC_TYPES.map((x) => `<option value="${x.key}" ${x.key === t.key ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></div>
          <div class="field"><label for="mVar">${t.key === "a2" ? "Aura" : t.key === "a5" ? "Skills" : "Element"}</label><select id="mVar">${t.variants.map((v) => `<option ${v === variant ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
          <div class="field"><label for="mLvl">Level</label><input type="number" id="mLvl" min="1" max="99" inputmode="numeric" value="${esc(m.level || "")}" placeholder="—"></div>
          <div class="field"><label for="mName">Name</label><input type="text" id="mName" maxlength="30" value="${esc(m.name || "")}" placeholder="Optional"></div>
        </div>
        <p class="notes">Uses ${esc(t.weaponText)}.${t.variantNote ? ` ${esc(t.variantNote)}` : ""}${m.level ? ` Items above level ${esc(m.level)} are flagged, and suggestions stay at or below it.` : " Set a level to flag items it can't wear yet."}</p>
        ${wrong.length ? `<p class="err">${wrong.map(esc).join(", ")} can't be used by an ${esc(t.short)} merc. Pick a new item below.</p>` : ""}
      </div>`);
    const sum = statSummary(c, slots, false);
    const resLine = [["fire", "Fire"], ["cold", "Cold"], ["light", "Lightning"], ["poison", "Poison"]].map(([e, n]) => {
      const v = (sum.totals[e] || 0) + (sum.totals.allres || 0);
      return `<div class="res-tile res-${e}"><span class="rt-name">${n}</span><span class="rt-val">${v > 0 ? "+" : ""}${v}%</span><span class="rt-cap">from gear${sum.totals["max_" + e] ? ` · +${sum.totals["max_" + e]} max` : ""}</span></div>`;
    }).join("");
    const auras = auraList(sum.totals);
    const typicalCount = sum.sources.filter((x) => !x.actual && Object.keys(x.got).length).length;
    body.insertAdjacentHTML("beforeend", `<div class="card stat-sum merc-sum" style="margin-top:12px">
        <h3>Merc stats &amp; resists</h3>
        <div class="res-grid">${resLine}</div>
        <p class="notes">Resists from gear only. The merc's own resists rise with its level, and the difficulty penalty applies, so check its stat screen for the final number.</p>
        ${(() => { const rows = bpRows(MERC_FHR[t.key]); const f = sum.totals.fhr || 0; return `<h4 class="rw-sub">Faster Hit Recovery: ${f}% · ${framesAt(rows, f)} frames</h4>${bpChips(rows, f, "%")}<p class="notes">${bpNext(rows, f, "FHR")}</p>`; })()}
        <p class="notes">Auras: ${esc(t.key === "a2" ? `${variant} (hired)` : "none hired")}${auras.length ? `, plus from gear: ${auras.map(esc).join(", ")}` : ""}</p>
        ${otherStatsHTML(sum.totals)}
        ${typicalCount ? `<p class="notes">${typicalCount} item${typicalCount === 1 ? " has" : "s have"} no actual stats, so ${typicalCount === 1 ? "its" : "their"} lowest typical roll is used.</p>` : ""}
        <details class="ss-src"><summary>Where it comes from</summary>${sourcesHTML(sum.sources)}</details>
      </div>`);
    const setM = (patch) => { c.merc = { ...(c.merc || {}), ...patch }; save(); render(); };
    $("#mType").onchange = (e) => { const nt = MERC_TYPES.find((x) => x.key === e.target.value); setM({ type: nt.key, variant: nt.variants[0] }); };
    $("#mVar").onchange = (e) => setM({ variant: e.target.value });
    $("#mLvl").onchange = (e) => { const v = Math.min(99, Math.max(0, Math.round(Number(e.target.value) || 0))); setM({ level: v || undefined }); };
    $("#mName").onchange = (e) => setM({ name: e.target.value.trim() || undefined });
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
    return [...GEAR_SLOTS, ...mercSlots(c)].filter((s) => {
      const isMerc = s.key.startsWith("merc");
      const listOk = it.slot === s.list || (s.key === "offhand" && DUAL_WIELD.includes(c.cls) && it.slot === "weapon");
      if (!listOk) return false;
      if (isMerc) return mercItemOk(c, s, it);
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
        const t = tierOf(b, s.key, it.name, c);
        if (t === null || t < 0) continue;
        const curName = c.gear[s.key]?.item;
        const ct = curName ? tierOf(b, s.key, curName, c) : -2;
        if (t > ct && fitsSlot(it, c, s.key) && (!best || ct < best.ct)) best = { s, t, ct, curName };
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
  // Produce one rune of rank i from t.pool by cubing lower runes; records steps and gems in t.
  function cubeOne(i, t) {
    if (i <= 0) return false;
    const rec = runeRecipe(i - 1);
    for (let k = 0; k < rec.qty; k++) {
      if ((t.pool[rec.from] || 0) > 0) t.pool[rec.from]--;
      else if (!cubeOne(i - 1, t)) return false;
    }
    t.steps[i - 1] = (t.steps[i - 1] || 0) + 1;
    if (rec.gem) t.gems[rec.gem] = (t.gems[rec.gem] || 0) + 1;
    return true;
  }
  // Most runes of rank i you could end up with, cubing everything below it upward (gems ignored).
  function maxMakeable(have, i) {
    let carry = 0;
    for (let k = 0; ; k++) { const n = (have[RUNE_ORDER[k]] || 0) + carry; if (k === i) return n; carry = Math.floor(n / runeRecipe(k).qty); }
  }
  // Plan one runeword: use runes you hold first, then cube missing ones up from
  // lower runes (not counting runes the recipe itself needs). Gems are listed, not required.
  function planRuneword(g, have, gems) {
    const pool = { ...have };
    const need = {}; g.runes.forEach((r) => (need[r] = (need[r] || 0) + 1));
    const short = [];
    for (const [r, n] of Object.entries(need)) { const use = Math.min(pool[r] || 0, n); pool[r] = (pool[r] || 0) - use; for (let k = use; k < n; k++) short.push(r); }
    short.sort((a, b) => runeRank(a) - runeRank(b));
    let steps = {}, gemNeed = {};
    const toFind = [], cubed = [];
    const makeOne = cubeOne;
    let cur = { pool, steps, gems: gemNeed };
    for (const r of short) {
      const t = { pool: { ...cur.pool }, steps: { ...cur.steps }, gems: { ...cur.gems } };
      if (makeOne(runeRank(r), t)) { cur = t; cubed.push(r); } else toFind.push(r);
    }
    const stepList = Object.entries(cur.steps).map(([i, times]) => ({ ...runeRecipe(+i), times })).sort((a, b) => runeRank(a.from) - runeRank(b.from));
    const gemList = Object.entries(cur.gems).map(([gem, n]) => ({ gem, n, have: gems[gem] || 0 }));
    return { held: g.runes.length - short.length, cubed, toFind, steps: stepList, gems: gemList, gemsShort: gemList.filter((x) => x.have < x.n) };
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
    const gemChip = (gm, cls) => `<span class="gem-chip ${cls} gem-${(gm.split(" ").pop() || "").toLowerCase()}">${esc(gm)}</span>`;
    const trLink = (r) => `<a class="ext" href="https://traderie.com/diablo2resurrected/products?search=${encodeURIComponent(r + " Rune")}" target="_blank" rel="noopener">${esc(r)} ↗</a>`;
    const everyRw = runewordStatus(have);
    const rwByName = new Map(everyRw.map((g) => [g.name.toLowerCase(), g]));
    for (const g of everyRw) for (const it of g.items) if (it.alias) rwByName.set(String(it.alias).toLowerCase(), g);
    const target = c.rwTarget ? rwByName.get(c.rwTarget.toLowerCase()) : null;
    const planCard = (() => {
      const picker = `<div class="field rw-pick"><label for="rwTarget">Runeword to plan</label>
          <div class="rw-pick-row"><input type="search" id="rwTarget" list="rwNames" placeholder="Type a name, e.g. Enigma or HotO" value="${esc(target ? target.name : "")}" autocomplete="off">
          ${target ? `<button class="btn small ghost" id="rwClear">Clear</button>` : ""}</div>
          <datalist id="rwNames">${everyRw.map((g) => g.name).sort().map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>`;
      if (!target) return `<div class="card rw-plan" style="margin-top:12px"><h3>Plan a runeword</h3>${picker}<p class="notes">Pick any runeword to see which runes you hold, which you can cube up from lower runes in your stash, and what's left to find or trade for. You can also tap <b>Plan</b> on any card below.</p></div>`;
      const p = planRuneword(target, have, stashCounts("gem"));
      const it = target.items[0];
      const used = {};
      const chips = target.runes.map((r) => { used[r] = (used[r] || 0) + 1; return chip(r, used[r] <= (have[r] || 0)); }).join("");
      const status = !p.cubed.length && !p.toFind.length ? `<span class="rw-qty">Ready to make</span>`
        : !p.toFind.length ? `<span class="rw-qty">${p.gemsShort.length ? "Ready after cubing — gems short" : "Ready after cubing"}</span>`
        : `<span class="badge">${p.toFind.length} rune${p.toFind.length === 1 ? "" : "s"} to find</span>`;
      return `<div class="card rw-plan" style="margin-top:12px">
        <h3>Plan a runeword</h3>${picker}
        <div class="rw-card">
          <div class="rw-head"><span class="n-runeword rw-name">${esc(target.name)}</span>${status}${inBuild.has(target.name) ? `<span class="badge t2">★ ${esc(b.name)}</span>` : ""}</div>
          <div class="rw-runes">${chips}</div>
          <div class="notes">${esc([...target.bases].join(" · ") || "")}${target.req ? ` · lvl ${target.req}` : ""}</div>
          <p class="notes rw-sum">In your stash: ${p.held} of ${target.runes.length}${p.cubed.length ? ` · Cube up: ${p.cubed.map(esc).join(", ")}` : ""}${p.toFind.length ? ` · Still to find: ${p.toFind.map(esc).join(", ")}` : ""}</p>
          ${p.steps.length ? `<h4 class="rw-sub">Cube steps, in order</h4>
            ${p.steps.map((r) => `<div class="cube-row"><div class="cube-recipe">${r.qty} × ${chip(r.from, true)}${r.gem ? ` + ${gemChip(r.gem, (stashCounts("gem")[r.gem] || 0) ? "have" : "need")}` : ""} <span class="arrow">→</span> <span class="rune-chip out">${esc(r.to)}</span></div><div class="cube-meta">${r.times > 1 ? `<span class="rw-qty">×${r.times}</span>` : ""}</div></div>`).join("")}` : ""}
          ${p.gems.length ? `<h4 class="rw-sub">Gems for cubing</h4><div class="rw-runes">${p.gems.map((x) => `${gemChip(x.gem, x.have >= x.n ? "have" : "need")}<span class="notes">${x.have} of ${x.n}</span>`).join(" ")}</div>
            ${p.gemsShort.length ? `<p class="notes">Short on gems: ${p.gemsShort.map((x) => `${x.n - x.have} ${esc(x.gem)}`).join(", ")}. 3 of a grade cube into the next grade (Gems &amp; Cube tab).</p>` : ""}` : ""}
          ${p.toFind.length ? `<div class="notes rw-miss">Find or trade: ${p.toFind.map(trLink).join(" ")}</div><p class="notes">Not enough lower runes to cube ${p.toFind.length === 1 ? "this one" : "these"} up.</p>` : ""}
          <details class="rw-stats"><summary>Stats</summary><ul class="tip-stats">${statLines(it.stats).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>
        </div>
      </div>`;
    })();
    const card = (g) => {
      const it = g.items[0];
      const used = {}; // mark which of the recipe's runes you already hold
      const chips = g.runes.map((r) => { used[r] = (used[r] || 0) + 1; return chip(r, used[r] <= (have[r] || 0)); }).join("");
      return `<div class="rw-card">
        <div class="rw-head"><span class="n-runeword rw-name">${esc(g.name)}</span>${g.qty ? `<span class="rw-qty" title="How many you can make from your stash runes">×${g.qty} <small>can make</small></span>` : ""}${inBuild.has(g.name) ? `<span class="badge t2">★ ${esc(b.name)}</span>` : ""}<button class="btn small ghost rw-plan-btn" data-plan="${esc(g.name)}">Plan</button></div>
        <div class="rw-runes">${chips}</div>
        <div class="notes">${esc([...g.bases].join(" · ") || "")}${g.req ? ` · lvl ${g.req}` : ""}</div>
        ${g.missing.length ? `<div class="notes rw-miss">Need: ${g.missing.map(trLink).join(" ")}</div>` : ""}
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
      ${planCard}
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
    const setTarget = (name) => { if (name) c.rwTarget = name; else delete c.rwTarget; save(); render(); };
    const inp = body.querySelector("#rwTarget");
    const pick = () => { const g = rwByName.get(inp.value.trim().toLowerCase()); if (g && g !== target) setTarget(g.name); };
    inp.addEventListener("change", pick);
    inp.addEventListener("input", () => { if (rwByName.has(inp.value.trim().toLowerCase())) pick(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(); });
    body.querySelector("#rwClear")?.addEventListener("click", () => setTarget(null));
    body.querySelectorAll("[data-plan]").forEach((btn) => (btn.onclick = () => { setTarget(btn.dataset.plan); body.querySelector(".rw-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
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
    // ---- Rune upgrade checker: can I cube up to a target rune? ----
    const tRune = RUNE_ORDER.includes(c.runeTarget) ? c.runeTarget : "Ist";
    const tWant = Math.min(5, Math.max(1, Number(c.runeTargetQty) || 1));
    const ti = runeRank(tRune);
    const held = runes[tRune] || 0;
    const t = { pool: { ...runes }, steps: {}, gems: {} };
    const usedHeld = Math.min(held, tWant);
    t.pool[tRune] = held - usedHeld;
    let made = 0;
    for (let k = usedHeld; k < tWant; k++) { const tr = { pool: { ...t.pool }, steps: { ...t.steps }, gems: { ...t.gems } }; if (!cubeOne(ti, tr)) break; Object.assign(t, tr); made++; }
    const short = tWant - usedHeld - made;
    const maxN = maxMakeable(runes, ti);
    const steps = Object.entries(t.steps).map(([i, times]) => ({ ...runeRecipe(+i), times })).sort((a, b) => runeRank(a.from) - runeRank(b.from));
    const gemNeed = Object.entries(t.gems).map(([gem, n]) => ({ gem, n, have: gems[gem] || 0 }));
    const gemShort = gemNeed.filter((x) => x.have < x.n);
    const below = ti > 0 ? runeRecipe(ti - 1) : null;
    const status = !short && !made ? `<span class="rw-qty">In your stash</span>`
      : !short ? `<span class="rw-qty">${gemShort.length ? "Can cube — gems short" : "Can cube it"}</span>`
      : `<span class="badge">${short} short</span>`;
    const checker = `<div class="card rune-check" style="margin-top:12px">
        <h3>Rune upgrade checker</h3>
        <div class="rc-pick">
          <div class="field"><label for="rcRune">Rune you want</label><select id="rcRune">${RUNE_ORDER.map((r) => `<option ${r === tRune ? "selected" : ""}>${r}</option>`).join("")}</select></div>
          <div class="field"><label for="rcQty">How many</label><select id="rcQty">${[1, 2, 3, 4, 5].map((n) => `<option ${n === tWant ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        </div>
        <div class="rw-head" style="margin-top:10px">${runeChip(tRune, "out")}${tWant > 1 ? `<span class="notes">× ${tWant}</span>` : ""}${status}</div>
        <p class="notes rw-sum">In your stash: ${held}${made ? ` · Cube up: ${made}` : ""}${short ? ` · Still short: ${short}` : ""} · Most you could have by cubing everything below: ${maxN}</p>
        ${steps.length ? `<h4 class="rw-sub">Cube steps, in order</h4>${steps.map((r) => `<div class="cube-row"><div class="cube-recipe">${r.qty} × ${runeChip(r.from)}${r.gem ? ` + ${gemChip(r.gem, (gems[r.gem] || 0) ? "have" : "need")}` : ""} <span class="arrow">→</span> ${runeChip(r.to, "out")}</div><div class="cube-meta">${r.times > 1 ? `<span class="rw-qty">×${r.times}</span>` : ""}</div></div>`).join("")}` : ""}
        ${gemNeed.length ? `<h4 class="rw-sub">Gems for cubing</h4><div class="rw-runes">${gemNeed.map((x) => `${gemChip(x.gem, x.have >= x.n ? "have" : "need")}<span class="notes">${x.have} of ${x.n}</span>`).join(" ")}</div>
          ${gemShort.length ? `<p class="notes">Short on gems: ${gemShort.map((x) => `${x.n - x.have} ${esc(x.gem)}`).join(", ")}. 3 of a grade make the next grade (see Gem upgrades below).</p>` : ""}` : ""}
        ${short ? `<p class="notes">${below ? `Each ${esc(tRune)} takes ${below.qty} ${esc(below.from)}${below.gem ? ` + ${esc(below.gem)}` : ""}; you have ${runes[below.from] || 0} ${esc(below.from)} and not enough lower runes to make the rest.` : "El is the lowest rune — it can't be cubed."}</p>
          <div class="notes rw-miss">Trade: <a class="ext" href="https://traderie.com/diablo2resurrected/products?search=${encodeURIComponent(tRune + " Rune")}" target="_blank" rel="noopener">${esc(tRune)} ↗</a>${below ? ` <a class="ext" href="https://traderie.com/diablo2resurrected/products?search=${encodeURIComponent(below.from + " Rune")}" target="_blank" rel="noopener">${esc(below.from)} ↗</a>` : ""}</div>` : ""}
      </div>`;
    body.innerHTML = `
      <div class="card">
        <h3>Gems in your stash</h3>
        ${gemGrid}
      </div>
      ${checker}
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
    const rcSet = () => { c.runeTarget = body.querySelector("#rcRune").value; c.runeTargetQty = Number(body.querySelector("#rcQty").value) || 1; save(); render(); };
    body.querySelector("#rcRune").onchange = rcSet;
    body.querySelector("#rcQty").onchange = rcSet;
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
        const loc = locOf(e);
        return `<div class="charm-row ${e.id === flashId ? "flash" : ""}" data-id="${e.id}" data-hay="${esc(hay)}" data-find="${esc((hay + " " + loc).toLowerCase())}">
          <div>
            ${u ? `<div class="ok up-flag">▲ Upgrade for ${esc(c.name)}: ${esc(u.label)} — ${esc(u.why)}</div>` : ""}
            ${entryHTML(e, it, { noteKey: e.id })}
            <div class="loc-wrap"><label class="loc-field"><span>📍 Location</span><input type="text" class="loc-in" value="${esc(loc)}" placeholder="Shared stash, mule name…" maxlength="60" autocomplete="off" enterkeyhint="done"></label><div class="loc-sugg" role="listbox" aria-label="Recent locations" hidden></div></div>
          </div>
          <div class="row-btns">
            ${stackable(e.item) || qtyOf(e) > 1 ? `<div class="qty" aria-label="Quantity"><button class="btn ghost small qminus" aria-label="One fewer">−</button><input class="qn" type="text" inputmode="numeric" pattern="[0-9]*" value="${qtyOf(e)}" aria-label="Quantity — tap to type a total"><button class="btn ghost small qplus" aria-label="One more">+</button></div>` : ""}
            ${canEquip ? `<button class="btn small eq" data-slot="${target || ""}">Equip</button>` : ""}
            <button class="btn ghost small rm" aria-label="Remove">✕</button>
          </div>
        </div>`;
      }).join("")}</section>`;
    }).join("");
    body.innerHTML = `
      <div class="card">
        <h3>Shared stash</h3>
        <p class="notes" style="margin-top:4px">Items here are shared by all your characters. Upgrades for ${esc(c.name)} are flagged, and the Upgrades tab checks them first. Equip swaps the worn item back into the stash. Type where each item is kept (a mule's name, say) in its Location box; Find searches locations too.</p>
        <div class="add-row">
          <div class="stack add-pick">
            ${searchHTML("Search any item…")}
            <label class="field"><span>Gear type</span><select id="addStashType">${STASH_TYPES.map(([g, l]) => `<option value="${g}" ${g === stashType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field"><span>Item</span><select id="addStash">${itemsOfType(c, stashType)}</select></label>
            <div class="field"><span>Qty</span><div class="qty add-qty"><button type="button" class="btn ghost small" id="addQtyMinus" aria-label="One fewer">−</button><input class="qn" id="addQty" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Quantity to add — tap to type a number"><button type="button" class="btn ghost small" id="addQtyPlus" aria-label="One more">+</button></div></div>
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
    const addQty = wireQtyInput($("#addQty"), (n, how) => { if (how === "enter") $("#addStashBtn").click(); });
    $("#addQtyMinus").onclick = () => addQty.step(-1);
    $("#addQtyPlus").onclick = () => addQty.step(1);
    $("#addStashBtn").onclick = () => { flashId = addToStash($("#addStash").value, "", addQty.value()); save(); render(); };
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
      const qn = $("input.qn", row);
      if (qn) wireQtyInput(qn, (n, how) => {
        const done = how !== "step";
        if (n <= 0) { if (done) { state.stash = state.stash.filter((x) => x !== e); pruneCustom(); save(); render(); } return; }
        e.qty = n; save();
        if (done) render();
        else { const t = document.querySelector('.tab[data-tab="stash"]'); if (t) t.textContent = `Stash (${stashCount()})`; }
      }, 0);
      if (qm) qm.onclick = () => {
        if (qtyOf(e) > 1) e.qty = qtyOf(e) - 1;
        else { state.stash = state.stash.filter((x) => x !== e); pruneCustom(); }
        save(); render();
      };
      const eq = $(".eq", row);
      if (eq) eq.onclick = () => equipFromStash(c, e, eq.dataset.slot);
      const li = $(".loc-in", row);
      if (li) {
        const box = $(".loc-sugg", row);
        const setLoc = (v) => {
          v = v.slice(0, 60);
          if (v.trim()) e.loc = v; else delete e.loc;
          row.dataset.find = (row.dataset.hay + " " + v.trim()).toLowerCase();
        };
        const commit = () => {
          if (e.loc) { e.loc = e.loc.trim(); rememberLoc(e.loc); }
          if (mergeStacks()) { save(); render(); } else save();
        };
        // On tap: the 5 most recent (other than what's in the box). While typing: the 5 most recent that match.
        const showSugg = (typing) => {
          const list = locChoices(typing ? li.value : "", li.value);
          box.innerHTML = list.map((l) => `<button type="button" class="loc-opt" role="option">${esc(l)}</button>`).join("");
          box.hidden = !list.length;
          box.querySelectorAll(".loc-opt").forEach((b, i) => {
            // pointerdown, so the pick lands before the box loses focus
            b.onpointerdown = (ev) => { ev.preventDefault(); li.value = list[i]; setLoc(list[i]); box.hidden = true; commit(); li.blur(); };
          });
        };
        li.onfocus = () => showSugg(false);
        li.oninput = () => { setLoc(li.value); save(); showSugg(true); };
        li.onkeydown = (ev) => { if (ev.key === "Enter") li.blur(); if (ev.key === "Escape") box.hidden = true; };
        li.onblur = () => setTimeout(() => { box.hidden = true; }, 150);
        li.onchange = commit;
      }
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


  // ---------- stat & resist summary ----------
  // Reads stat lines in either game tooltip form ("Fire Resist +30%") or the short
  // typical form ("+20-30 all res"). Ranges count at their low end.
  const SUM_E = "(?:fire|cold|lightning|light|poison)";
  const SUM_EL = `(${SUM_E}(?:\\s*(?:/|&|,|and)\\s*${SUM_E})*)`;
  const SUM_N = "([+-]?\\d+)(?:\\s*-\\s*\\d+)?";
  const elemKey = (e) => (e.startsWith("light") ? "light" : e);
  const elemsIn = (txt) => (txt.match(new RegExp(SUM_E, "g")) || []).map(elemKey);
  function parseStatLine(line) {
    let l = String(line).toLowerCase().replace(/\s*\(check\)$/, "");
    const out = [];
    const add = (k, v) => { const n = Number(v); if (n) out.push([k, n]); };
    if (/enemy|target|monster|pierce|sunder|skill damage|\bvs\b/.test(l)) return out;
    l = l.replace(new RegExp(SUM_N + "%\\s*(?:to\\s+)?max(?:imum)?\\s+" + SUM_EL + "\\s+res\\w*", "g"), (m, n, el) => { elemsIn(el).forEach((e) => add("max_" + e, n)); return " "; });
    l = l.replace(new RegExp(SUM_N + "%?\\s*(?:to\\s+)?all res\\w*", "g"), (m, n) => { add("allres", n); return " "; });
    l = l.replace(/all resist\w*\s*[:.]?\s*\+?(\d+)%?/g, (m, n) => { add("allres", n); return " "; });
    l = l.replace(new RegExp(SUM_EL + "\\s+resist\\w*\\s*[:.]?\\s*" + SUM_N + "%?", "g"), (m, el, n) => { elemsIn(el).forEach((e) => add(e, n)); return " "; });
    l = l.replace(new RegExp(SUM_N + "%?\\s*(?:to\\s+)?" + SUM_EL + "\\s+res\\w*", "g"), (m, n, el) => { elemsIn(el).forEach((e) => add(e, n)); return " "; });
    let m;
    if ((m = l.match(new RegExp(SUM_N + "\\s*(?:to\\s+)?all skills")))) add("skills", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:faster hit recovery|fhr)\\b")))) add("fhr", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:faster cast rate|fcr)\\b")))) add("fcr", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:faster run/walk|frw)\\b")))) add("frw", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:increased attack speed|ias)\\b")))) add("ias", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:better chance of getting magic items|mf|magic find)\\b")))) add("mf", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:life stolen per hit|ll)\\b")))) add("ll", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:chance of crushing blow|cb)\\b")))) add("cb", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "%\\s*(?:deadly strike|ds)\\b")))) add("ds", m[1]);
    if ((m = l.match(/(?:level|lvl)\s*(\d+)(?:\s*-\s*\d+)?\s+([a-z][a-z ]*?)\s+aura/))) out.push(["aura:" + m[2].replace(/\b[a-z]/g, (x) => x.toUpperCase()), Number(m[1])]);
    if ((m = l.match(/damage reduced by (\d+)%/)) || (m = l.match(new RegExp(SUM_N + "%\\s*(?:dr|damage reduction|physical damage reduction)\\b")))) add("dr", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "\\s*(?:to\\s+)?all attributes")))) ["str", "dex", "vit", "enr"].forEach((k) => add(k, m[1]));
    else {
      const ATT = { strength: "str", str: "str", dexterity: "dex", dex: "dex", vitality: "vit", vit: "vit", energy: "enr" };
      for (const mm of l.matchAll(new RegExp(SUM_N + "\\s*(?:to\\s+)?(strength|dexterity|vitality|energy|str|dex|vit)\\b", "g"))) add(ATT[mm[2]], mm[1]);
    }
    if (!/replenish life/.test(l) && (m = l.match(new RegExp(SUM_N + "\\s*(?:to\\s+)?life\\b(?!\\s*(?:after|stolen|per|tap|leech|&))")))) add("life", m[1]);
    if ((m = l.match(new RegExp(SUM_N + "\\s*(?:to\\s+)?mana\\b(?!\\s*(?:after|stolen|per|leech|&))")))) add("mana", m[1]);
    return out;
  }
  const SUM_OTHER = [["skills", "All skills", ""], ["life", "Life", ""], ["mana", "Mana", ""], ["fhr", "FHR", "%"], ["frw", "FRW", "%"], ["ias", "IAS", "%"], ["ll", "Life leech", "%"], ["cb", "Crushing blow", "%"], ["ds", "Deadly strike", "%"], ["mf", "Magic find", "%"], ["dr", "Phys. dmg reduced", "%"], ["str", "Strength", ""], ["dex", "Dexterity", ""], ["vit", "Vitality", ""], ["enr", "Energy", ""]];
  const SUM_LABEL = { allres: "all res", fire: "fire res", cold: "cold res", light: "light res", poison: "poison res", max_fire: "max fire", max_cold: "max cold", max_light: "max light", max_poison: "max poison", skills: "skills", life: "life", mana: "mana", fhr: "% FHR", frw: "% FRW", ias: "% IAS", mf: "% MF", dr: "% DR", fcr: "% FCR", ll: "% LL", cb: "% CB", ds: "% DS", str: "str", dex: "dex", vit: "vit", enr: "energy" };
  const fmtGot = (k, v) => k.startsWith("aura:") ? `${k.slice(5)} aura lvl ${v}` : `${v > 0 ? "+" : ""}${v}${String(SUM_LABEL[k] || k).startsWith("%") ? "" : " "}${SUM_LABEL[k] || k}`;
  const auraList = (totals) => Object.keys(totals).filter((k) => k.startsWith("aura:")).map((k) => `${k.slice(5)} (lvl ${totals[k]})`);
  const otherStatsHTML = (totals) => { const o = SUM_OTHER.filter(([k]) => totals[k]); return o.length ? `<dl class="ss-other">${o.map(([k, l, u]) => `<div><dt>${l}</dt><dd>${totals[k] > 0 ? "+" : ""}${totals[k]}${u}</dd></div>`).join("")}</dl>` : ""; };
  const sourcesHTML = (sources) => `<ul>${sources.filter((x) => Object.keys(x.got).length).map((x) => `<li><b>${esc(x.label)}</b> ${esc(x.it.name)}${x.actual ? "" : ` <span class="badge">typical</span>`}<div class="notes">${Object.entries(x.got).map(([k, v]) => esc(fmtGot(k, v))).join(" · ")}</div></li>`).join("") || `<li class="notes">No stats found on worn gear yet.</li>`}</ul>`;
  const RES_PENALTY = { Normal: 0, Nightmare: 40, Hell: 100 };
  function statSummary(c, slots = GEAR_SLOTS.filter((s) => s.key !== "swap"), withCharms = true) {
    const totals = {}, sources = [];
    const take = (label, entry) => {
      const it = byName.get(entry?.item); if (!it) return;
      const mine = noteLines(entry.note);
      const lines = mine.length ? mine : statLines(it.stats);
      const got = {};
      for (const ln of lines) for (const [k, v] of parseStatLine(ln)) {
        if (k.startsWith("aura:")) { got[k] = Math.max(got[k] || 0, v); totals[k] = Math.max(totals[k] || 0, v); continue; }
        got[k] = (got[k] || 0) + v; totals[k] = (totals[k] || 0) + v;
      }
      if (!mine.length && it.fcr && !got.fcr) { got.fcr = it.fcr; totals.fcr = (totals.fcr || 0) + it.fcr; }
      sources.push({ label, it, actual: !!mine.length, got });
    };
    for (const s of slots) take(s.label, c.gear[s.key]);
    if (withCharms) for (const ch of c.charms) take("Charm", ch);
    const diff = RES_PENALTY[c.resDiff] !== undefined ? c.resDiff : "Hell";
    const anya = c.anya === undefined ? 3 : Math.min(3, Math.max(0, Number(c.anya) || 0));
    const res = ["fire", "cold", "light", "poison"].map((e) => {
      const raw = (totals[e] || 0) + (totals.allres || 0) + anya * 10 - RES_PENALTY[diff];
      const cap = Math.min(95, 75 + (totals["max_" + e] || 0));
      return { e, raw, cap, val: Math.min(raw, cap) };
    });
    return { totals, sources, res, diff, anya };
  }
  // ---------- breakpoints ----------
  // Weapon base for the attack-speed check: the item's own base, or the one the player picked for a runeword.
  function weaponBaseOf(c) {
    const it = byName.get(c.gear.weapon?.item);
    if (!it) return null;
    const name = WEAPON_BASES[it.base] ? it.base : WEAPON_BASES[c.iasBase] ? c.iasBase : null;
    return { it, name, wb: name ? WEAPON_BASES[name] : null };
  }
  function fhrTable(c) {
    const t = FHR_BREAKPOINTS[c.cls];
    if (!t) return null;
    const wb = weaponBaseOf(c)?.wb;
    let key = "";
    if (c.cls === "Druid" && wb && wb.wc === "1hs" && !wb.th) key = "1-handed swinging weapon";
    if (c.cls === "Paladin" && wb && ["spea", "aspe", "staf"].includes(wb.type)) key = "spear or staff";
    return { key, data: t[key] };
  }
  // [{ v: breakpoint, frames }] and the frames at value x.
  function bpRows([f0, bps]) { return bps.map((v, i) => ({ v, frames: f0 - i })); }
  const framesAt = (rows, x) => rows.filter((r) => r.v <= x).pop()?.frames;
  const bpChips = (rows, x, unit = "") => `<div class="bps">${rows.map((r) => `<span class="${r.v <= x ? "hit" : ""}" title="${r.frames} frames">${r.v}${unit}<small>·${r.frames}f</small></span>`).join("")}</div>`;
  const bpNext = (rows, x, what) => { const n = rows.find((r) => r.v > x); return n ? `next: ${n.v}% (${n.frames} frames), ${n.v - x}% more ${what}` : "top breakpoint reached"; };
  // Normal-attack frames: ceil(256 × (frames − start) / floor(speed × (100 + EIAS) / 100)) − 1.
  function attackFrames(anim, eias) {
    const [fpd, sf, sp = 256] = anim;
    const e = Math.max(-85, Math.min(75, eias));
    return Math.ceil((256 * (fpd - sf)) / Math.floor((sp * (100 + e)) / 100)) - 1;
  }
  const eiasFrom = (ias, sias, wsm) => Math.floor((120 * ias) / (120 + ias)) + sias - wsm;

  function renderUpgrades(body, c) {
    const b = buildOf(c);
    if (!b) { body.innerHTML = `<div class="card"><p>No build guide for ${esc(c.cls)} yet — gear tracking still works.</p></div>`; return; }
    const target = Number(c.budget);
    const allSlots = [...GEAR_SLOTS, ...mercSlots(c)];
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
        <div class="field" style="margin-top:10px"><label>Extra FCR not on your items' stats (e.g. jewels)</label><input type="number" id="extraFcr" min="0" max="200" value="${esc(c.extraFcr || 0)}"></div>
      </div>`;
    }

    // stat & resist summary
    const sum = statSummary(c);
    const RES_NAME = { fire: "Fire", cold: "Cold", light: "Lightning", poison: "Poison" };
    const typicalCount = sum.sources.filter((x) => !x.actual && Object.keys(x.got).length).length;
    const statsHtml = `<div class="card stat-sum">
        <h3>Stats &amp; resists</h3>
        <div class="ss-ctl">
          <div class="field"><label for="resDiff">Difficulty</label><select id="resDiff">${Object.keys(RES_PENALTY).map((d) => `<option ${d === sum.diff ? "selected" : ""}>${d}</option>`).join("")}</select></div>
          <div class="field"><label for="anya">Anya scrolls used</label><select id="anya">${[0, 1, 2, 3].map((n) => `<option ${n === sum.anya ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        </div>
        <div class="res-grid">${sum.res.map((r) => `<div class="res-tile res-${r.e} ${r.raw < 0 ? "bad" : r.raw < r.cap ? "low" : "ok"}">
            <span class="rt-name">${RES_NAME[r.e]}</span>
            <span class="rt-val">${r.val}%</span>
            <span class="rt-cap">${r.raw >= r.cap ? (r.raw > r.cap ? `max ${r.cap} · ${r.raw - r.cap} over` : `max ${r.cap}`) : `need +${r.cap - r.raw}`}</span>
          </div>`).join("")}</div>
        <p class="notes">${esc(sum.diff)} penalty −${RES_PENALTY[sum.diff]}%${sum.anya ? `, Anya +${sum.anya * 10}%` : ""}. Worn gear and charms; weapon swap and merc not counted.</p>
        ${otherStatsHTML(sum.totals)}
        ${auraList(sum.totals).length ? `<p class="notes">Auras from gear: ${auraList(sum.totals).map(esc).join(", ")}</p>` : ""}
        ${typicalCount ? `<p class="notes">${typicalCount} item${typicalCount === 1 ? " has" : "s have"} no actual stats, so ${typicalCount === 1 ? "its" : "their"} lowest typical roll is used. Add actual stats (Scan or Type stats on the Gear tab) for exact numbers.</p>` : ""}
        <details class="ss-src"><summary>Where it comes from</summary>
          ${sourcesHTML(sum.sources)}
          <p class="notes">Socketed jewels, runes and set bonuses count only if you type them into an item's actual stats.</p>
        </details>
      </div>`;

    // FHR panel
    const fhrT = fhrTable(c);
    const fhrNow = sum.totals.fhr || 0;
    let fhrHtml;
    if (fhrT) {
      const rows = bpRows(fhrT.data);
      fhrHtml = `<div class="card"><h3>Faster Hit Recovery</h3>
        <div class="stat-big">${fhrNow}% <small class="frames">${framesAt(rows, fhrNow)} frames</small></div>
        <div class="notes">${bpNext(rows, fhrNow, "FHR")}${fhrT.key ? ` · ${esc(c.cls)} with a ${esc(fhrT.key)}` : ""}</div>
        ${bpChips(rows, fhrNow, "%")}</div>`;
    } else fhrHtml = `<div class="card"><h3>Faster Hit Recovery</h3><div class="stat-big">${fhrNow}%</div><div class="notes">${esc(c.cls)} FHR breakpoints aren't published yet.</div></div>`;

    // IAS panel: normal attack with the equipped weapon
    let iasHtml = "";
    if (!b.caster) {
      const wpn = weaponBaseOf(c);
      const anims = ATTACK_ANIM[c.cls];
      const sias = Number(c.sias) || 0;
      const gearIas = sum.totals.ias || 0;
      let inner;
      if (!anims) inner = `<p class="notes">${esc(c.cls)} attack animations aren't published yet.</p>`;
      else if (!wpn) inner = `<p class="notes">Equip a weapon on the Gear tab to check attack speed.</p>`;
      else if (!wpn.wb) inner = `<p class="notes">Pick the base item your ${esc(wpn.it.name)} is made in:</p>`;
      else {
        const wc = wpn.wb.th && !(c.cls === "Barbarian" && wpn.wb.oot) ? wpn.wb.wc2 : wpn.wb.wc;
        const anim = anims[wc];
        if (!anim) inner = `<p class="notes">${esc(c.cls)} can't attack normally with a ${esc(wpn.name)}.</p>`;
        else {
          const cur = attackFrames(anim, eiasFrom(gearIas, sias, wpn.wb.wsm));
          const rows = [];
          let prev = null;
          for (let ias = 0; ias <= 400; ias++) {
            const f = attackFrames(anim, eiasFrom(ias, sias, wpn.wb.wsm));
            if (f !== prev) { rows.push({ v: ias, frames: f }); prev = f; }
            if (eiasFrom(ias, sias, wpn.wb.wsm) >= 75) break;
          }
          inner = `<div class="stat-big">${cur} <small class="frames">frames · ${(25 / cur).toFixed(2)} attacks/s</small></div>
            <div class="notes">${gearIas}% IAS from gear${sias ? ` + ${sias} skill IAS` : ""} · ${esc(wpn.name)} speed ${wpn.wb.wsm > 0 ? "+" : ""}${wpn.wb.wsm} · ${bpNext(rows, gearIas, "IAS")}</div>
            ${bpChips(rows, gearIas, "%")}`;
        }
      }
      const baseList = Object.keys(WEAPON_BASES).sort();
      const needBase = wpn && !WEAPON_BASES[wpn.it.base];
      iasHtml = `<div class="card ias-card"><h3>Attack speed (IAS)</h3>${inner}
        <div class="ias-ctl">
          ${needBase ? `<div class="field"><label for="iasBase">Base item</label><input type="search" id="iasBase" list="iasBases" value="${esc(c.iasBase || "")}" placeholder="e.g. Phase Blade"><datalist id="iasBases">${baseList.map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>` : ""}
          <div class="field"><label for="sias">Skill IAS</label><input type="number" id="sias" min="0" max="200" inputmode="numeric" value="${esc(c.sias || 0)}"></div>
        </div>
        <p class="notes">Skill IAS is from Fanaticism, Burst of Speed, Frenzy and the like. This checks the normal attack and skills that use it. Skills with their own animation (Zeal, Fury, Whirlwind, Strafe, Jab, martial arts, wereforms) and dual wielding aren't modeled.</p>
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
        ${fhrHtml}
        ${iasHtml}
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
          <ul class="sugg">${su.map((u) => `<li data-id="${u.entry.id}" data-slot="${u.slotKey || ""}"><div>${itemLine(u.it)}<div class="s-stats">${esc(u.label)} · ${esc(u.why)}</div>${locOf(u.entry) ? `<div class="s-stats loc-tag">📍 ${esc(locOf(u.entry))}</div>` : ""}</div><button class="btn small eq">Equip</button></li>`).join("")}</ul></div>`;
      })()}
      ${statsHtml}
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
    const sx = $("#sias"); if (sx) sx.onchange = (e) => { c.sias = Math.max(0, Number(e.target.value) || 0); save(); render(); };
    const ib = $("#iasBase"); if (ib) ib.onchange = (e) => { const v = e.target.value.trim(); const k = Object.keys(WEAPON_BASES).find((n) => n.toLowerCase() === v.toLowerCase()); if (k || !v) { c.iasBase = k || undefined; save(); render(); } };
    $("#resDiff").onchange = (e) => { c.resDiff = e.target.value; save(); render(); };
    $("#anya").onchange = (e) => { c.anya = Number(e.target.value); save(); render(); };
    const ef = $("#extraFcr");
    if (ef) ef.onchange = (e) => { c.extraFcr = Number(e.target.value) || 0; save(); render(); };
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
    const fileName = `perfect-roll-${name.replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}-v${APP_VERSION}.json`;
    // Browsers that can show a "Save as" window (Chrome/Edge on a computer) let you pick the folder.
    if (window.showSaveFilePicker) {
      try {
        const fh = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "Perfect Roll backup", accept: { "application/json": [".json"] } }] });
        const w = await fh.createWritable(); await w.write(blob); await w.close();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // closed the window without saving
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
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
