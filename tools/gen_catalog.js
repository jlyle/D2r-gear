// Builds catalog.js (every D2R unique, set item and runeword) from blizzhackers/d2data (MIT).
const fs = require("fs");
const MERGE = `
// Merge: curated items (data.js) win for the same item and slot; everything else is added.
(function () {
  const base = (n) => n.toLowerCase().replace(/\\s*\\((sword|shield|helm|weapon|armor)\\)$/, "").replace(/[^a-z0-9]+/g, "");
  const SAME = { arsaldiablolos: "arsaldiabolos", thecatseye: "catseye" }; // naming differences between sources
  const have = new Map(ITEMS.map((i) => [base(i.name) + "|" + i.slot, i]));
  for (const c of CATALOG) {
    const k = (SAME[base(c.name)] || base(c.name)) + "|" + c.slot;
    const cur = have.get(k);
    // Game data is authoritative: take its type, level, base and full stats; keep the
    // curated extras (alias, fcr, merc, class, charm size) that the guides rely on.
    if (cur) { Object.assign(cur, { type: c.type, req: c.req ?? cur.req, base: c.base || cur.base, btype: c.btype || cur.btype, set: c.set, stats: /Sunder/.test(cur.stats || "") ? cur.stats : c.stats || cur.stats }); if (c.runes) cur.runes = c.runes; continue; }
    if (c.slot === "jewel" && /Rainbow Facet/.test(c.name)) continue;
    ITEMS.push(Object.assign({}, c));
  }
})();
`;

const DIR = process.argv[2], OUT = process.argv[3];
const J = (f) => require(`${DIR}/json/${f}.json`);
const uniques = Object.values(J("uniqueitems")), sets = Object.values(J("setitems")), rws = Object.values(J("runes"));
const bases = {};
for (const f of ["weapons", "armor", "misc"]) for (const b of Object.values(J(f))) if (b.code) bases[b.code] = b;
const STR = J("localestrings-eng");
const disp = (k) => (k && STR[k]) || String(k || "").replace(/^PreCrafted /, "");
const types = {}; for (const t of Object.values(J("itemtypes"))) if (t.Code) types[t.Code] = t;
const skills = {}, skillCls = {};
for (const s of Object.values(J("skills"))) { skills[s["*Id"]] = s.skill; skillCls[s["*Id"]] = s.charclass; skillCls[s.skill] = s.charclass; }
const skillName = (p) => (typeof p === "number" || /^\d+$/.test(p) ? skills[Number(p)] : p) || String(p);

const CLS = { ama: "Amazon", ass: "Assassin", bar: "Barbarian", dru: "Druid", nec: "Necromancer", pal: "Paladin", sor: "Sorceress", war: "Warlock" };
const TABS = ["Bow & Crossbow", "Passive & Magic", "Javelin & Spear", "Fire", "Lightning", "Cold", "Curses", "Poison & Bone", "Summoning",
  "Combat", "Offensive Auras", "Defensive Auras", "Combat", "Masteries", "Warcries", "Summoning", "Shape Shifting", "Elemental",
  "Traps", "Shadow Disciplines", "Martial Arts", "Demon", "Eldritch", "Chaos"];
const TAB_CLS = ["ama", "ama", "ama", "sor", "sor", "sor", "nec", "nec", "nec", "pal", "pal", "pal", "bar", "bar", "bar", "dru", "dru", "dru", "ass", "ass", "ass", "war", "war", "war"];

// item type → slot / class by walking the Equiv chain
const ROOT = { shld: "offhand", head: "offhand", ashd: "offhand", pala: "offhand", helm: "helm", pelt: "helm", phlm: "helm", circ: "helm", tors: "armor", shie: "offhand", grim: "offhand", glov: "gloves", belt: "belt", boot: "boots", ring: "ring", amul: "amulet", scha: "charm", mcha: "charm", lcha: "charm", char: "charm", jewl: "jewel", weap: "weapon", rune: "rune", gem: "gem" };
function slotOf(tc, seen = new Set()) {
  if (!tc || seen.has(tc)) return null; seen.add(tc);
  if (ROOT[tc]) return ROOT[tc];
  const t = types[tc]; if (!t) return null;
  return slotOf(t.Equiv1, seen) || slotOf(t.Equiv2, seen);
}
function clsOf(tc, seen = new Set()) {
  if (!tc || seen.has(tc)) return null; seen.add(tc);
  const t = types[tc]; if (!t) return null;
  return t.Class || clsOf(t.Equiv1, seen) || clsOf(t.Equiv2, seen);
}

const rng = (a, b) => (a == null ? "" : b == null || a === b ? `${a}` : `${a}-${b}`);
const plus = (a, b) => { const r = rng(a, b); return /^-/.test(r) ? r : `+${r}`; };
const perLvl = (p) => `${+(Number(p) / 8).toFixed(3)}`;
const EL = { fire: "Fire", cold: "Cold", ltng: "Lightning", pois: "Poison", mag: "Magic" };

function prop(code, par, min, max) {
  const r = rng(min, max), P = plus(min, max);
  const simple = {
    allskills: `${P} to All Skills`, "all-stats": `${P} to All Attributes`, str: `${P} to Strength`, dex: `${P} to Dexterity`, vit: `${P} to Vitality`, enr: `${P} to Energy`,
    hp: `${P} to Life`, mana: `${P} to Mana`, "hp%": `Increase Maximum Life ${r}%`, "mana%": `Increase Maximum Mana ${r}%`, regen: `Replenish Life ${P}`, "regen-mana": `Regenerate Mana ${r}%`,
    ac: `${P} Defense`, "ac%": `${P}% Enhanced Defense`, "ac-miss": `${P} Defense vs. Missile`, "ac-hth": `${P} Defense vs. Melee`,
    "dmg%": `${P}% Enhanced Damage`, "dmg-norm": `Adds ${r} Damage`, "dmg-min": `${P} to Minimum Damage`, "dmg-max": `${P} to Maximum Damage`,
    "dmg-undead": `${P}% Damage to Undead`, "dmg-demon": `${P}% Damage to Demons`, "att-undead": `${P} to Attack Rating against Undead`, "att-demon": `${P} to Attack Rating against Demons`,
    att: `${P} to Attack Rating`, "att%": `${r}% Bonus to Attack Rating`,
    swing1: `${P}% Increased Attack Speed`, swing2: `${P}% Increased Attack Speed`, swing3: `${P}% Increased Attack Speed`,
    cast1: `${P}% Faster Cast Rate`, cast2: `${P}% Faster Cast Rate`, cast3: `${P}% Faster Cast Rate`,
    balance1: `${P}% Faster Hit Recovery`, balance2: `${P}% Faster Hit Recovery`, balance3: `${P}% Faster Hit Recovery`,
    block1: `${P}% Faster Block Rate`, block2: `${P}% Faster Block Rate`, block3: `${P}% Faster Block Rate`, block: `${r}% Increased Chance of Blocking`,
    move1: `${P}% Faster Run/Walk`, move2: `${P}% Faster Run/Walk`, move3: `${P}% Faster Run/Walk`,
    lifesteal: `${r}% Life Stolen per Hit`, manasteal: `${r}% Mana Stolen per Hit`,
    "res-all": `All Resistances ${P}`, "res-all-max": `${P}% to All Maximum Resistances`,
    "mag%": `${r}% Better Chance of Getting Magic Items`, "gold%": `${r}% Extra Gold from Monsters`,
    "red-dmg": `Damage Reduced by ${r}`, "red-dmg%": `Damage Reduced by ${r}%`, "red-mag": `Magic Damage Reduced by ${r}`,
    deadly: `${r}% Deadly Strike`, crush: `${r}% Chance of Crushing Blow`, openwounds: `${r}% Chance of Open Wounds`,
    "ignore-ac": "Ignore Target's Defense", noheal: "Prevent Monster Heal", nofreeze: "Cannot Be Frozen", "half-freeze": "Half Freeze Duration",
    knock: "Knockback", indestruct: "Indestructible", sock: `Socketed (${r})`, ease: `Requirements ${r}%`, light: `${P} to Light Radius`,
    thorns: `Attacker Takes Damage of ${r}`, "heal-kill": `${P} Life after each Kill`, "mana-kill": `${P} to Mana after each Kill`,
    slow: `Slows Target by ${r}%`, howl: `Hit Causes Monster to Flee ${r}%`, stupidity: "Hit Blinds Target", freeze: `Freezes Target ${P}`,
    pierce: `${r}% Chance to Pierce`, "dmg-to-mana": `${r}% Damage Taken Goes to Mana`, addxp: `${P}% to Experience Gained`,
    "rep-dur": "Repairs Durability over time", "rep-quant": "Replenishes Quantity", stack: `Increased Stack Size`, "cheap": `Reduces All Vendor Prices ${r}%`,
    "dmg-ac": `${P} to Monster Defense per Hit`, "reduce-ac": `-${r}% Target Defense`, "explosivearrow": `Fires Explosive Arrows or Bolts`,
    "kill-skill": null,
  };
  if (code in simple && simple[code]) return simple[code];
  let m;
  if ((m = code.match(/^res-(fire|cold|ltng|pois)$/))) return `${EL[m[1]]} Resist ${P}%`;
  if ((m = code.match(/^res-(fire|cold|ltng|pois)-max$/))) return `${P}% to Maximum ${EL[m[1]]} Resist`;
  if ((m = code.match(/^abs-(fire|cold|ltng|mag)%$/))) return `${EL[m[1]]} Absorb ${r}%`;
  if ((m = code.match(/^abs-(fire|cold|ltng|mag)$/))) return `${P} ${EL[m[1]]} Absorb`;
  if ((m = code.match(/^dmg-(fire|cold|ltng|mag)$/))) return `Adds ${r} ${EL[m[1]]} Damage`;
  if (code === "dmg-pois") return `Adds ${r} Poison Damage over time`;
  if ((m = code.match(/^(fire|cold|ltng|mag)-(min|max)$/))) return null; // shown via dmg-*
  if ((m = code.match(/^pierce-(fire|cold|ltng|pois|mag)$/))) return `-${String(r).replace(/^-/, "")}% to Enemy ${EL[m[1]]} Resistance`;
  if ((m = code.match(/^extra-(fire|cold|ltng|pois|mag)$/))) return `${P}% to ${EL[m[1]]} Skill Damage`;
  if ((m = code.match(/^(str|dex|vit|enr|hp|mana|ac|att|mag%|gold%|deadly|dmg%|dmg-max|thorns|regen|res-fire|res-cold|res-ltng|res-pois|abs-fire|abs-cold|abs-ltng)\/lvl$/))) {
    const N = { str: "Strength", dex: "Dexterity", vit: "Vitality", enr: "Energy", hp: "Life", mana: "Mana", ac: "Defense", att: "Attack Rating", "mag%": "% Better Chance of Getting Magic Items", "gold%": "% Extra Gold", deadly: "% Deadly Strike", "dmg%": "% Enhanced Damage", "dmg-max": "Maximum Damage", thorns: "Attacker Takes Damage", regen: "Replenish Life", "res-fire": "% Fire Resist", "res-cold": "% Cold Resist", "res-ltng": "% Lightning Resist", "res-pois": "% Poison Resist", "abs-fire": "Fire Absorb", "abs-cold": "Cold Absorb", "abs-ltng": "Lightning Absorb" }[m[1]];
    return N.startsWith("%") ? `+${perLvl(par)}% ${N.slice(1).trim()} per character level` : `+${perLvl(par)} ${N} per character level`;
  }
  if (CLS[code]) return `${P} to ${CLS[code]} Skill Levels`;
  if (code === "skilltab") { const t = Number(par); return `${P} to ${TABS[t] || "skill tree"} Skills (${CLS[TAB_CLS[t]] || "class"} Only)`; }
  if (code === "skill") { const c = CLS[skillCls[Number(par)] || skillCls[par]]; return `${P} to ${skillName(par)}${c ? ` (${c} Only)` : ""}`; }
  if (code === "oskill") return `${P} to ${skillName(par)}`;
  if (code === "aura") return `Level ${r} ${skillName(par)} Aura When Equipped`;
  const procs = { "hit-skill": "on Striking", "gethit-skill": "When Struck", "att-skill": "on Attack", "kill-skill": "When You Kill an Enemy", "death-skill": "When You Die", "levelup-skill": "When You Level-Up" };
  if (procs[code]) return `${min}% Chance to Cast Level ${max} ${skillName(par)} ${procs[code]}`;
  if (code === "charged") return `Level ${max} ${skillName(par)} (${min} Charges)`;
  if (code === "skill-rand") return `+${min ?? ""} to a random class skill`;
  return null; // uncommon codes are left out of the summary
}

// The game tooltip folds equal Str/Dex/Vit/Enr into "All Attributes" and equal
// fire/cold/lightning/poison resists into "All Resistances"; do the same.
function fold(lines) {
  const grab = (re) => lines.map((l) => l.match(re)).filter(Boolean);
  const attrs = grab(/^\+([\d-]+) to (Strength|Dexterity|Vitality|Energy)$/);
  if (attrs.length === 4 && attrs.every((m) => m[1] === attrs[0][1])) {
    lines = lines.filter((l) => !attrs.some((m) => m[0] === l)); lines.push(`+${attrs[0][1]} to All Attributes`);
  }
  const res = grab(/^(Fire|Cold|Lightning|Poison) Resist \+([\d-]+)%$/);
  if (res.length === 4 && res.every((m) => m[2] === res[0][2])) {
    lines = lines.filter((l) => !res.some((m) => m[0] === l)); lines.push(`All Resistances +${res[0][2]}`);
  }
  return lines;
}
function propsOf(rec, pre, n, pfx = "") {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const code = rec[`${pre}${i}`]; if (!code) continue;
    const t = prop(code, rec[`${pfx}par${i}`] ?? rec[`${pre.replace(/Code$/, "Param")}${i}`], rec[`${pfx}min${i}`] ?? rec[`${pre.replace(/Code$/, "Min")}${i}`], rec[`${pfx}max${i}`] ?? rec[`${pre.replace(/Code$/, "Max")}${i}`]);
    if (t) out.push(t);
  }
  return fold([...new Set(out)]);
}
// dmg-fire style pairs come as fire-min / fire-max in item files
function elemPairs(rec, n) {
  const lines = [];
  const val = {};
  for (let i = 1; i <= n; i++) { const c = rec[`prop${i}`]; if (/^(fire|cold|ltng|mag)-(min|max)$/.test(c)) val[c] = [rec[`min${i}`], rec[`max${i}`]]; }
  for (const e of ["fire", "cold", "ltng", "mag"]) if (val[`${e}-min`] || val[`${e}-max`]) {
    const a = val[`${e}-min`] ? rng(...val[`${e}-min`]) : "?", b = val[`${e}-max`] ? rng(...val[`${e}-max`]) : "?";
    lines.push(`Adds ${a} to ${b} ${EL[e]} Damage`);
  }
  return lines;
}

const out = [];
for (const u of uniques) {
  if (!u.index || u.spawnable !== 1 || !u.code || !bases[u.code] || /^Crafted /.test(u.index)) continue;
  const b = bases[u.code], slot = slotOf(b.type);
  if (!slot || ["rune", "gem"].includes(slot)) continue;
  const cls = CLS[clsOf(b.type)] || undefined;
  const stats = [...propsOf(u, "prop", 12), ...elemPairs(u, 12)];
  const type = slot === "charm" ? "charm" : "unique";
  const e = { name: disp(u.index), type, slot, req: u["lvl req"] || undefined, base: b.name, btype: b.type, stats: stats.join(", ") };
  if (cls) e.cls = cls;
  if (slot === "charm") { e.size = /^cm1|^cm2|^cm3/.test(u.code) ? { cm1: 1, cm2: 2, cm3: 3 }[u.code] : 1; e.unique1 = true; }
  out.push(e);
}
for (const s of sets) {
  if (!s.index || !s.item || !bases[s.item]) continue;
  const b = bases[s.item], slot = slotOf(b.type);
  if (!slot) continue;
  const cls = CLS[clsOf(b.type)] || undefined;
  const stats = [...propsOf(s, "prop", 9), ...elemPairs(s, 9)];
  const e = { name: disp(s.index), type: "set", slot, req: s["lvl req"] || undefined, base: b.name, btype: b.type, set: disp(s.set), stats: stats.join(", ") };
  if (cls) e.cls = cls;
  out.push(e);
}
const runeName = (code) => (bases[code]?.name || "").replace(/ Rune$/, "");
for (const r of rws) {
  if (r.complete !== 1 || !r["*Rune Name"]) continue;
  const runes = []; let req = 0;
  for (let i = 1; i <= 6; i++) { const c = r[`Rune${i}`]; if (c && bases[c]) { runes.push(runeName(c)); req = Math.max(req, bases[c].levelreq || 0); } }
  const slots = new Set();
  for (let i = 1; i <= 6; i++) { const t = r[`itype${i}`]; if (t) { const sl = slotOf(t) || (t === "shld" ? "offhand" : null); if (sl) slots.add(sl); } }
  const stats = propsOf(r, "T1Code", 7, "").join(", ");
  const list = [...slots];
  const label = { weapon: "weapon", offhand: "shield", armor: "armor", helm: "helm" };
  for (const sl of list) {
    const rwName = STR[r.Name] || r["*Rune Name"];
    const name = list.length > 1 ? `${rwName} (${label[sl] || sl})` : rwName;
    out.push({ name, type: "runeword", slot: sl, req: req || undefined, runes: runes.join(" "), stats });
  }
}
const seen = new Set();
const uniq = out.filter((e) => (seen.has(e.name) ? false : seen.add(e.name)));
out.length = 0; out.push(...uniq);
fs.writeFileSync(OUT, "// Full D2R catalog generated from blizzhackers/d2data (MIT): every unique, set item and runeword.\n// Curated entries in data.js take priority; this fills in everything else.\nconst CATALOG = " + JSON.stringify(out).replace(/\},\{/g, "},\n{") + ";\n" + MERGE);
console.log("entries", out.length, "by slot", out.reduce((a, e) => (a[e.slot] = (a[e.slot] || 0) + 1, a), {}));
console.log(JSON.stringify(out.find((e) => e.name === "Heart Carver")));
console.log(JSON.stringify(out.find((e) => e.name === "Enigma")));
console.log(JSON.stringify(out.find((e) => /Tal Rasha's Adjudication/.test(e.name))));
console.log(JSON.stringify(out.find((e) => e.name === "Harlequin Crest")));
