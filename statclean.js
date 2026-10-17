// Turns noisy OCR text from a photo of a D2R tooltip into clean stat lines.
// Keeps only lines that read as real item properties; fixes common OCR slips
// (° for %, 2 for %, split or misspelled words, stray symbols at the edges).
(function (root) {
  // [phrase, isPercent, plausibleMax]
  const STATS = [
    ["to all skills", 0, 5], ["skill levels", 0, 5], ["skills", 0, 6], ["only)", 0, 20],
    ["faster cast rate", 1, 75], ["faster hit recovery", 1, 60], ["faster run/walk", 1, 45], ["faster run walk", 1, 45],
    ["increased attack speed", 1, 70], ["faster block rate", 1, 60], ["increased chance of blocking", 1, 50],
    ["enhanced damage", 1, 500], ["enhanced defense", 1, 400], ["enhanced maximum damage", 1, 400],
    ["better chance of getting magic items", 1, 100], ["extra gold from monsters", 1, 300], ["experience gained", 1, 15],
    ["life stolen per hit", 1, 15], ["mana stolen per hit", 1, 15], ["deadly strike", 1, 100], ["crushing blow", 1, 60], ["open wounds", 1, 100],
    ["damage reduced by", 0, 60], ["magic damage reduced by", 0, 20], ["physical damage received reduced", 1, 20],
    ["fire resist", 1, 75], ["cold resist", 1, 75], ["lightning resist", 1, 75], ["poison resist", 1, 75], ["all resistances", 0, 75],
    ["maximum fire resist", 1, 10], ["maximum cold resist", 1, 10], ["maximum lightning resist", 1, 10], ["maximum poison resist", 1, 10],
    ["absorb", 0, 40], ["to enemy", 1, 60], ["resistance", 1, 75],
    ["to life", 0, 400], ["to mana", 0, 400], ["to strength", 0, 60], ["to dexterity", 0, 60], ["to vitality", 0, 60], ["to energy", 0, 60],
    ["to all attributes", 0, 30], ["to attack rating", 0, 1500], ["attack rating", 0, 1500], ["to maximum damage", 0, 500], ["to minimum damage", 0, 200],
    ["defense vs. missile", 0, 400], ["defense vs missile", 0, 400], ["defense", 0, 1000],
    ["adds", 0, 999], ["fire damage", 0, 999], ["cold damage", 0, 999], ["lightning damage", 0, 999], ["poison damage", 0, 999], ["magic damage", 0, 999], ["damage", 0, 999],
    ["regenerate mana", 1, 100], ["replenish life", 0, 50], ["life after each kill", 0, 20], ["mana after each kill", 0, 20],
    ["increase maximum life", 1, 20], ["increase maximum mana", 1, 50], ["maximum mana", 1, 50], ["maximum life", 1, 20],
    ["chance to cast", 0, 99], ["aura when equipped", 0, 30], ["ignore target", 0, 1], ["piercing attack", 1, 100], ["knockback", 0, 1],
    ["slows target", 1, 50], ["prevent monster heal", 0, 1], ["cannot be frozen", 0, 1], ["half freeze duration", 0, 1], ["light radius", 0, 10],
    ["attacker takes damage", 0, 300], ["damage to demons", 1, 400], ["damage to undead", 1, 400], ["requirements", 1, 100],
    ["socketed", 0, 6], ["ethereal", 0, 1], ["indestructible", 0, 1], ["repairs", 0, 10], ["charges", 0, 999], ["damage taken goes to mana", 1, 20],
    ["hit causes monster to flee", 1, 50], ["hit blinds target", 0, 5], ["freezes target", 0, 5], ["reduces all vendor prices", 1, 15],
    ["based on character level", 0, 999], ["when struck", 1, 100], ["on striking", 1, 100], ["on attack", 1, 100], ["teleport", 0, 1],
  ];
  // Lines that are base-item info, not properties.
  const NOT_STATS = /^(defense|durability|required|chance to block|quantity|one-hand damage|two-hand damage|throw damage|one hand damage|two hand damage|item version|sell value|shift|keep in inventory|right click|left click|ctrl|press)\b/i;

  const OCR_FIX = { al: "all", ys: "vs", fo: "to", t0: "to", ot: "of", tlie: "the", tbe: "the", wlth: "with", lite: "life", iife: "life", rn: "m" };
  let DICT = null;
  function dict(extraText) {
    if (DICT) return DICT;
    const words = new Set();
    const add = (s) => String(s).toLowerCase().split(/[^a-z']+/).forEach((w) => w.length > 1 && words.add(w));
    STATS.forEach(([p]) => add(p));
    add("to of the on by in and per vs based level character only amazon assassin barbarian druid necromancer paladin sorceress warlock all skills fire cold lightning poison magic physical damage resist life mana strength dexterity vitality energy attributes faster cast rate hit recovery run walk attack speed block blocking enhanced defense better chance getting items extra gold monsters experience gained stolen deadly strike crushing blow open wounds reduced maximum minimum regenerate replenish after each kill increase aura equipped ignore target's piercing knockback slows prevent monster heal cannot frozen freeze duration light radius attacker takes demons undead requirements socketed ethereal indestructible repairs durability charges teleport when struck striking enemy resistance resistances missile adds javelin spear bow crossbow traps repaired cast casts level levels shadow disciplines martial arts combat warcries masteries shape shifting elemental summoning curses poison bone offensive defensive auras chaos demon eldritch skill");
    if (extraText) add(extraText);
    DICT = words;
    return words;
  }

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
  function closest(w, D) {
    let best = null, bd = 99;
    for (const d of D) {
      if (Math.abs(d.length - w.length) > 2) continue;
      const x = lev(w, d);
      if (x < bd) { bd = x; best = d; }
    }
    const ok = best && (w.length >= 6 ? bd <= 2 : w.length >= 4 ? bd <= 1 : false);
    return ok ? best : null;
  }
  const matchCase = (orig, w) => (orig[0] === orig[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w);

  // Fix words: merge "Reduc ed" → "Reduced", correct "Vitahty" → "Vitality", "I ightning" → "Lightning".
  function fixWords(line, D) {
    const toks = line.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const core = t.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, "");
      const pre = t.slice(0, t.indexOf(core));
      const post = t.slice(t.indexOf(core) + core.length).replace(/[^%),.:']/g, ""); // drop stray "]" "|" etc.
      const lw = core.toLowerCase();
      if (!core || /\d/.test(core) || D.has(lw)) { out.push(t); continue; }
      const next = toks[i + 1] && toks[i + 1].replace(/[^A-Za-z']+$/g, "");
      if (next && /^[A-Za-z']+$/.test(next)) {
        const merged = (lw + next.toLowerCase());
        const hit = D.has(merged) ? merged : (!D.has(next.toLowerCase()) && closest(merged, D));
        if (hit) { out.push(pre + matchCase(core, hit) + toks[i + 1].slice(next.length)); i++; continue; }
      }
      const fixed = OCR_FIX[lw] || closest(lw, D);
      out.push(fixed ? pre + matchCase(core, fixed) + post : t);
    }
    return out.join(" ");
  }

  function cleanLine(raw, D) {
    let s = raw
      .replace(/^\s*\*(?=\d)/, "+")
      .replace(/[“”«»]/g, "'").replace(/[‘’`´]/g, "'")
      .replace(/(\d)\s*[°º]o?/g, "$1%").replace(/(\d)\s*%o\b/g, "$1%")
      .replace(/(\d%)(?=[A-Za-z])/g, "$1 ")
      .replace(/[—–]/g, "-")
      .replace(/^[^A-Za-z0-9+\-(']+/, "").replace(/[^A-Za-z0-9%)']+$/, "")
      .replace(/\s+/g, " ").trim();
    // Drop 1-2 char junk tokens at the edges ("S +250 Defense", "Mana =")
    s = s.replace(/^(?:[A-Za-z]{1,2}|[|=:;_~]+)\s+(?=[+\-\d])/, "").replace(/\s+(?:[|=:;_~]+|[A-Za-z])$/, "");
    s = s.replace(/([+\-])\s+(\d)/g, "$1$2").replace(/(\d)\s+%/g, "$1%");
    if (s.length < 4) return null;
    s = fixWords(s, D);
    const low = s.toLowerCase();
    if (NOT_STATS.test(low)) return null;
    const stat = STATS.find(([p]) => low.includes(p));
    if (!stat) return null;
    const [phrase, pct, max] = stat;
    // Mostly real words? (keeps garbage like "Crs af Chek to Close" out)
    const words = low.split(/[^a-z']+/).filter((w) => w.length > 1);
    const known = words.filter((w) => D.has(w)).length;
    if (words.length && known / words.length < 0.6) return null;
    if (pct) {
      // "+102 Faster Cast Rate" → OCR read "%" as "2"; "+35," → missing %.
      s = s.replace(/([+\-]?)(\d+)([,.:;']?)(?!\d)(?!%)/, (m, sign, num, punct) => {
        let n = Number(num);
        if (n > max && /[2296]$/.test(num) && Number(num.slice(0, -1)) <= max) num = num.slice(0, -1);
        return `${sign}${num}%`;
      });
    }
    // Lines that need a number but have none are probably fragments.
    const noNumberOk = /(cannot be frozen|half freeze|prevent monster heal|knockback|ethereal|indestructible|ignore target|teleport|only\))/;
    if (!/\d/.test(s) && !noNumberOk.test(low)) return null;
    return s.replace(/\s+([,.:;])/g, "$1").trim();
  }

  // text: raw OCR text. skipNames: normalized item names/aliases to leave out.
  function cleanStats(text, extraVocab) {
    const D = dict(extraVocab);
    const seen = new Set();
    const out = [];
    for (const raw of String(text || "").split(/\n+/)) {
      const c = cleanLine(raw, D);
      if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push(c); }
    }
    return out;
  }

  root.StatClean = { cleanStats, cleanLine: (l, x) => cleanLine(l, dict(x)) };
})(typeof window !== "undefined" ? window : globalThis);
