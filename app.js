// Gear Ledger — app logic. Plain JS, no build step.
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
  function lock() { session = null; state = null; pickedAcct = null; tab = "gear"; clearPhotoCache(); render(); }

  // ---------- item photos (IndexedDB, encrypted with the account key) ----------
  // Records: { key: "<acctId>:<photoId>", acct, iv, data: ArrayBuffer }. Entries keep only `photo: <photoId>`.
  const DB_NAME = "gearLedger", PHOTO_STORE = "photos";
  let dbPromise = null;
  function db() {
    if (!dbPromise) dbPromise = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore(PHOTO_STORE, { keyPath: "key" }); s.createIndex("acct", "acct"); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbPromise;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(PHOTO_STORE, mode);
      const out = fn(tx.objectStore(PHOTO_STORE));
      tx.oncomplete = () => res(out && "result" in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
    });
  }
  const pkey = (acctId, id) => `${acctId}:${id}`;
  const photoCache = new Map(); // photoId -> object URL (this session only)
  function clearPhotoCache() { for (const u of photoCache.values()) URL.revokeObjectURL(u); photoCache.clear(); }

  // Shrink to a readable size (tooltip text stays legible) and save encrypted.
  async function storePhoto(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
    const bytes = await blob.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, session.key, bytes);
    const id = uid() + uid();
    await idb("readwrite", (s) => s.put({ key: pkey(session.acct.id, id), acct: session.acct.id, iv: b64(iv), data }));
    photoCache.set(id, URL.createObjectURL(blob));
    return id;
  }
  async function photoURL(id) {
    if (photoCache.has(id)) return photoCache.get(id);
    const rec = await idb("readonly", (s) => s.get(pkey(session.acct.id, id)));
    if (!rec) return null;
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv) }, session.key, rec.data);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    photoCache.set(id, url);
    return url;
  }
  function dropPhoto(id) {
    if (!id || !session) return;
    const u = photoCache.get(id);
    if (u) { URL.revokeObjectURL(u); photoCache.delete(id); }
    idb("readwrite", (s) => s.delete(pkey(session.acct.id, id))).catch(() => {});
  }
  const acctPhotos = (acctId) => idb("readonly", (s) => s.index("acct").getAll(acctId)).catch(() => []);
  // Fill in <img data-photo-id> elements after a render.
  function hydratePhotos(root) {
    root.querySelectorAll("img[data-photo-id]").forEach(async (img) => {
      try { const u = await photoURL(img.dataset.photoId); if (u) img.src = u; else img.closest(".ph")?.remove(); } catch (e) { img.closest(".ph")?.remove(); }
    });
  }

  // Characters saved by the earlier single-user version (plain, unencrypted).
  function legacyData() {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? normalize(JSON.parse(raw)) : null; } catch (e) { return null; }
  }

  const SLOT_LABELS = { helm: "Helms", amulet: "Amulets", ring: "Rings", weapon: "Weapons", offhand: "Shields & off-hands", armor: "Armor", gloves: "Gloves", belt: "Belts", boots: "Boots", charm: "Charms" };
  const inStash = (name) => state.stash.some((s) => s.item === name);
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

  function cellsUsed(c) {
    return c.charms.reduce((n, ch) => n + (byName.get(ch.item)?.size || 1), 0);
  }

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
        ${[["gear", "Gear"], ["merc", "Mercenary"], ["charms", "Charms"], ["stash", `Stash (${state.stash.length})`], ["upgrades", "Upgrades"]].map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}
      </nav>
      ${tab !== "upgrades" ? `<div class="scan-row"><label class="btn ghost scan-btn">📷 Add gear from photos<input type="file" id="scanInput" accept="image/*" multiple></label><span class="notes">Snap the item tooltip — straight on, whole box in frame.</span></div>` : ""}
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
    const si = $("#scanInput");
    if (si) si.onchange = (e) => { const files = [...e.target.files]; e.target.value = ""; scanPhotos(c, files); };

    const body = $("#tabBody");
    if (tab === "gear") renderSlots(body, c, GEAR_SLOTS);
    else if (tab === "merc") renderSlots(body, c, MERC_SLOTS);
    else if (tab === "charms") renderCharms(body, c);
    else if (tab === "stash") renderStash(body, c);
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

  // ---------- login / account screens ----------
  function renderLogin() {
    const app = $("#app");
    const legacy = legacyData();
    const list = accounts.map((a) => `<button class="acct ${pickedAcct === a.id ? "on" : ""}" data-id="${a.id}"><span class="acct-ico">🔒</span>${esc(a.name)}</button>`).join("");
    const picked = accounts.find((a) => a.id === pickedAcct);
    app.innerHTML = `
      <div class="login">
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

    app.querySelectorAll(".acct").forEach((b) => (b.onclick = () => { pickedAcct = b.dataset.id; renderLogin(); $("#unlockPw")?.focus(); }));
    const uf = $("#unlockForm");
    if (uf) uf.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button", uf); btn.disabled = true; btn.textContent = "Unlocking…";
      try {
        const { key, data } = await openAcct(picked, $("#unlockPw").value);
        session = { acct: picked, key }; state = normalize(data); render();
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
      session = s; state = data; render();
    };
    $("#loginImport").onchange = (e) => importFile(e);
  }

  function addImportedAccount(rec) {
    let name = rec.name || "Imported", n = 2;
    while (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) name = `${rec.name} (${n++})`;
    const acct = { id: uid(), name, salt: rec.salt, iv: rec.iv, data: rec.data, created: Date.now() };
    accounts.push(acct);
    writeAccounts();
    if (Array.isArray(rec.photos) && rec.photos.length) {
      idb("readwrite", (s) => { rec.photos.forEach((p) => s.put({ key: pkey(acct.id, p.id), acct: acct.id, iv: p.iv, data: unb64(p.data).buffer })); })
        .catch(() => alert("The account was added, but its photos couldn't be stored on this device."));
    }
    return acct;
  }

  async function importFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    $(".menu").open = false;
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (err) { alert("That file isn't a Gear Ledger backup."); return; }
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
    alert("That file isn't a Gear Ledger backup.");
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

  const TYPE_LABEL = { unique: "Unique", set: "Set item", runeword: "Runeword", rare: "Rare / crafted", charm: "Charm" };
  // Split "a, b (x, y), c" into stat lines without breaking inside parentheses.
  const statLines = (s) => String(s || "").split(/,\s+(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
  const noteLines = (s) => String(s || "").split(/\n|\s·\s/).map((x) => x.trim()).filter(Boolean);

  // Tooltip-style item block with the photo, your rolls and typical stats.
  // opts.noteKey marks the entry for wiring (see wireEntries).
  function entryHTML(entry, it, opts = {}) {
    if (!it) return opts.empty ? `<div class="tip empty-tip">${opts.empty}</div>` : "";
    const mine = noteLines(entry.note);
    const typical = statLines(it.stats);
    const sub = [TYPE_LABEL[it.type], it.req ? `lvl ${it.req}` : "", it.cls ? `${it.cls} only` : ""].filter(Boolean).join(" · ");
    return `<div class="tip" data-entry="${opts.noteKey || ""}">
      <div class="tip-top">
        ${entry.photo ? `<button class="ph" type="button" aria-label="View photo"><img data-photo-id="${esc(entry.photo)}" alt="Photo of ${esc(it.name)}"></button>` : ""}
        <div class="tip-head">
          <div class="tip-name n-${it.type}">${esc(it.name)}</div>
          <div class="tip-sub">${esc(sub)}</div>
          ${it.runes ? `<div class="tip-runes">'${esc(it.runes.replace(/ /g, ""))}'</div>` : ""}
        </div>
      </div>
      ${mine.length ? `<div class="tip-h">Your item</div><ul class="tip-stats mine">${mine.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <details class="typ"><summary>Typical stats</summary><ul class="tip-stats">${typical.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>`
      : `<ul class="tip-stats">${typical.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`}
      <div class="tip-actions">
        <button class="link edit-note" type="button">✎ ${mine.length ? "Edit your rolls" : "Add your rolls"}</button>
        <label class="link">📷 ${entry.photo ? "Change photo" : "Add photo"}<input type="file" class="ph-in" accept="image/*" hidden></label>
        ${entry.photo ? `<button class="link rm-ph" type="button">Remove photo</button>` : ""}
      </div>
      <textarea class="note" rows="4" hidden placeholder="One stat per line, e.g. +35% Faster Cast Rate">${esc(mine.join("\n"))}</textarea>
    </div>`;
  }

  // Hook up notes, photo buttons and the viewer for every .tip under root.
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
      const ph = $(".ph", tip);
      if (ph) ph.onclick = () => viewPhoto(get()?.photo, $(".tip-name", tip)?.textContent);
      const inp = $(".ph-in", tip);
      if (inp) inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const en = get(); if (!en) return;
        try { const id = await storePhoto(f); dropPhoto(en.photo); en.photo = id; save(); render(); }
        catch (err) { alert("Couldn't save that photo on this device (storage may be full or blocked)."); }
      };
      const rm = $(".rm-ph", tip);
      if (rm) rm.onclick = () => { const en = get(); if (!en) return; dropPhoto(en.photo); delete en.photo; save(); render(); };
    });
    hydratePhotos(root);
  }

  async function viewPhoto(id, title) {
    if (!id) return;
    const d = $("#photoView");
    const url = await photoURL(id);
    if (!url) return;
    $("img", d).src = url;
    $("h2", d).textContent = title || "Photo";
    d.showModal();
  }

  function renderSlots(body, c, slots) {
    body.innerHTML = `<div class="grid">${slots.map((s) => {
      const g = c.gear[s.key] || {};
      const it = byName.get(g.item);
      return `<div class="card slot" data-slot="${s.key}">
        <h3><span>${s.label}</span>${tierBadge(c, s.key, g.item)}</h3>
        <select class="pick" aria-label="${s.label}">${itemOptions(c, s, g.item)}</select>
        ${entryHTML(g, it, { noteKey: s.key })}
      </div>`;
    }).join("")}</div>`;
    body.querySelectorAll(".slot").forEach((el) => {
      const key = el.dataset.slot;
      $(".pick", el).onchange = (e) => {
        const old = c.gear[key] || {};
        // A different item: its old photo and rolls no longer apply.
        if (old.item !== e.target.value) dropPhoto(old.photo);
        c.gear[key] = e.target.value ? { item: e.target.value, note: "" } : {};
        save(); render();
      };
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
            ${entryHTML(ch, it, { noteKey: ch.id })}
            <div class="row-btns"><span class="runes">${it ? `${it.size} cell${it.size > 1 ? "s" : ""}` : ""}</span><button class="btn ghost small rm" aria-label="Remove">✕</button></div>
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
      $(".rm", row).onclick = () => { dropPhoto(ch.photo); c.charms = c.charms.filter((x) => x !== ch); save(); render(); };
    });
    wireEntries(body, (k) => c.charms.find((x) => x.id === k));
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
    state.stash = state.stash.filter((x) => x !== entry);
    if (it.slot === "charm") {
      c.charms.push({ id: uid(), item: it.name, note: entry.note || "", photo: entry.photo });
    } else {
      const old = c.gear[slotKey];
      if (old?.item) state.stash.push({ id: uid(), item: old.item, note: old.note || "", photo: old.photo });
      else dropPhoto(old?.photo);
      c.gear[slotKey] = { item: it.name, note: entry.note || "", photo: entry.photo };
    }
    save(); render();
  }

  function renderStash(body, c) {
    const groups = Object.keys(SLOT_LABELS);
    const picker = groups.map((g) => {
      const list = ITEMS.filter((i) => i.slot === g).sort((a, z) => a.name.localeCompare(z.name));
      return `<optgroup label="${SLOT_LABELS[g]}">${list.map((i) => `<option value="${esc(i.name)}">${esc(i.name)}${i.cls ? ` (${i.cls})` : ""}</option>`).join("")}</optgroup>`;
    }).join("");
    const ups = new Map(stashUpgrades(c).map((u) => [u.entry.id, u]));
    const sections = groups.map((g) => {
      const entries = state.stash.filter((e) => byName.get(e.item)?.slot === g);
      if (!entries.length) return "";
      return `<h3 class="grp">${SLOT_LABELS[g]}</h3>${entries.map((e) => {
        const it = byName.get(e.item);
        const u = ups.get(e.id);
        const target = u ? u.slotKey : slotsFor(c, it)[0]?.key;
        const canEquip = it.slot === "charm" || target;
        return `<div class="charm-row" data-id="${e.id}">
          <div>
            ${u ? `<div class="ok up-flag">▲ Upgrade for ${esc(c.name)}: ${esc(u.label)} — ${esc(u.why)}</div>` : ""}
            ${entryHTML(e, it, { noteKey: e.id })}
          </div>
          <div class="row-btns">
            ${canEquip ? `<button class="btn small eq" data-slot="${target || ""}">Equip</button>` : ""}
            <button class="btn ghost small rm" aria-label="Remove">✕</button>
          </div>
        </div>`;
      }).join("")}`;
    }).join("");
    body.innerHTML = `
      <div class="card">
        <h3>Shared stash</h3>
        <p class="notes" style="margin-top:4px">Items here are shared by all your characters. Upgrades for ${esc(c.name)} are flagged, and the Upgrades tab checks them first. Equip swaps the worn item back into the stash.</p>
        <div class="add-row">
          <select id="addStash">${picker}</select>
          <button class="btn" id="addStashBtn">Add</button>
        </div>
      </div>
      <div class="card" style="margin-top:12px">${sections || `<p class="notes">Stash is empty. Add the items you're holding onto.</p>`}</div>`;
    $("#addStashBtn").onclick = () => { state.stash.push({ id: uid(), item: $("#addStash").value, note: "" }); save(); render(); };
    body.querySelectorAll(".charm-row").forEach((row) => {
      const e = state.stash.find((x) => x.id === row.dataset.id);
      $(".rm", row).onclick = () => { dropPhoto(e.photo); state.stash = state.stash.filter((x) => x !== e); save(); render(); };
      const eq = $(".eq", row);
      if (eq) eq.onclick = () => equipFromStash(c, e, eq.dataset.slot);
    });
    wireEntries(body, (k) => state.stash.find((x) => x.id === k));
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
    return ocrWorker;
  }

  // Grayscale, invert (tooltips are light text on black) and stretch contrast.
  async function prepImage(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = Math.max(0, Math.min(255, (255 - g - 40) * 1.6));
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
    const lines = text.split(/\n+/).map(norm).filter((l) => l.length >= 3);
    const flat = norm(text).replace(/[ ']/g, "");
    const scored = [];
    for (const it of ITEMS) {
      if (it.type === "rare" || (it.type === "charm" && !it.unique1)) continue;
      const names = [it.name.replace(/ \((sword|shield|helm|weapon)\)$/, ""), it.alias].filter(Boolean).map(norm);
      let best = 0;
      for (const nm of names) for (const l of lines) {
        if (nm.length >= 6 && l.includes(nm)) best = Math.max(best, 1);
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

  // Stat lines worth keeping in the notes: drop the item name, base type and rune lines.
  function statNotes(text, it) {
    const skip = /^(required|durability|defense|item version|sell value|shift|one hand damage|two hand damage|throw damage|quantity|class|\(.*only\)|keep in inventory|socketed|ethereal)/i;
    const runeLine = /^['‘’"]?([A-Z][a-z]{1,4}){2,6}['‘’"]?$/;
    const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 2);
    const names = it ? [it.name.replace(/ \((sword|shield|helm|weapon)\)$/, ""), it.alias].filter(Boolean).map(norm) : [];
    let nameIdx = lines.findIndex((l) => names.some((n) => sim(norm(l), n) >= 0.75));
    const start = nameIdx >= 0 ? nameIdx + 2 : Math.min(2, Math.max(0, lines.length - 3)); // name + base type
    return lines.slice(start).filter((l) => !skip.test(l) && !runeLine.test(l.replace(/\s/g, "")))
      .slice(0, 14).join("\n").slice(0, 500);
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
    for (const [k, l] of [["unique", "Uniques"], ["set", "Set items"], ["runeword", "Runewords"], ["rare", "Rare / crafted / magic"], ["charm", "Charms"]]) {
      const g = mine.filter((i) => i.type === k && !rec.has(i.name)).sort((x, y) => x.name.localeCompare(y.name));
      if (g.length) html += `<optgroup label="${l}">${g.map(opt).join("")}</optgroup>`;
    }
    if (others.length) html += `<optgroup label="Other classes">${others.map(opt).join("")}</optgroup>`;
    return html;
  }

  function reviewDialog(c, file, text, cands, idx, total) {
    return new Promise((resolve) => {
      const d = $("#scanDialog");
      const url = URL.createObjectURL(file);
      const typeOpts = GEAR_TYPES.map(([g, l]) => `<option value="${g}">${l}</option>`).join("");
      d.innerHTML = `<form method="dialog" class="stack">
        <h2>Photo ${idx + 1} of ${total}</h2>
        <img class="scan-thumb" src="${url}" alt="Your photo">
        ${cands.length ? `<div class="field"><span>Best match${cands.length > 1 ? "es" : ""}</span>
          <div class="cands">${cands.map((x, i) => `<label class="cand"><input type="radio" name="cand" value="${esc(x.it.name)}" ${i === 0 ? "checked" : ""}> ${itemLine(x.it)} <span class="runes">${x.guess ? "best guess from base type" : Math.round(Math.min(1, x.score) * 100) + "% match"}</span></label>`).join("")}
          <label class="cand"><input type="radio" name="cand" value=""> Something else…</label></div></div>`
          : `<p class="err">Couldn't recognise the item name. Pick it below — retaking the photo closer and straight on usually helps.</p>`}
        <div id="otherWrap" class="stack" ${cands.length ? "hidden" : ""}>
          <label class="field"><span>Gear type</span><select id="scanType">${typeOpts}</select></label>
          <label class="field"><span>Item</span><select id="scanOther"></select></label>
        </div>
        <label class="field"><span>Put it in</span><select id="scanDest"></select></label>
        <label class="check" id="moveWrap"><input type="checkbox" id="scanMove" checked> Move the replaced item to the shared stash</label>
        <label class="check"><input type="checkbox" id="scanKeep" checked> Keep this photo with the item</label>
        <label class="field"><span>Your rolls (read from the photo — one per line, edit as needed)</span><textarea id="scanNote" rows="6"></textarea></label>
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
      $("#scanDest").onchange = refreshMove;
      refresh(true);
      d.showModal();
      $("form", d).onsubmit = (e) => {
        e.preventDefault();
        const action = e.submitter?.value || "ok";
        d.close(); URL.revokeObjectURL(url);
        if (action !== "ok") return resolve(action);
        resolve({ item: chosen(), dest: $("#scanDest").value, note: $("#scanNote").value.trim(), move: $("#scanMove").checked, keepPhoto: $("#scanKeep").checked });
      };
      d.oncancel = () => { URL.revokeObjectURL(url); resolve("stop"); };
    });
  }

  async function applyScan(c, r, file) {
    const it = r.item;
    if (!it) return;
    let photo;
    if (r.keepPhoto) { try { photo = await storePhoto(file); } catch (err) { alert("Saved the item, but couldn't store the photo on this device."); } }
    const entry = { item: it.name, note: r.note, ...(photo ? { photo } : {}) };
    if (r.dest === "stash") state.stash.push({ id: uid(), ...entry });
    else if (r.dest === "charms") c.charms.push({ id: uid(), ...entry });
    else {
      const old = c.gear[r.dest];
      if (old?.item && r.move) state.stash.push({ id: uid(), item: old.item, note: old.note || "", photo: old.photo });
      else dropPhoto(old?.photo);
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
        const canvas = await prepImage(files[i]);
        const { data } = await worker.recognize(canvas);
        status.hidden = true;
        const res = await reviewDialog(c, files[i], data.text || "", matchItems(data.text || ""), i, files.length);
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
    Object.values(c.gear).forEach((g) => dropPhoto(g?.photo));
    c.charms.forEach((ch) => dropPhoto(ch.photo));
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
    const recs = await acctPhotos(session.acct.id);
    const photos = recs.map((r) => ({ id: r.key.slice(r.key.indexOf(":") + 1), iv: r.iv, data: b64(r.data) }));
    const blob = new Blob([JSON.stringify({ format: "gear-ledger-account", v: 3, name, salt, iv, data, photos })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gear-ledger-${name.replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
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
    // Re-encrypt this account's photos with the new key first.
    const recs = await acctPhotos(session.acct.id);
    const redone = [];
    for (const r of recs) {
      const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, session.key, r.data);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      redone.push({ ...r, iv: b64(iv), data: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes) });
    }
    if (redone.length) await idb("readwrite", (s) => { redone.forEach((r) => s.put(r)); });
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
    if (typed === null || typed.trim() !== a.name) return;
    await saveChain;
    accounts = accounts.filter((x) => x.id !== a.id);
    writeAccounts();
    const recs = await acctPhotos(a.id);
    if (recs.length) await idb("readwrite", (s) => { recs.forEach((r) => s.delete(r.key)); }).catch(() => {});
    lock();
  };

  render();
})();
