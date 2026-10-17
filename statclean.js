// Turns noisy OCR text from a photo of a D2R tooltip into clean stat lines.
// Each line is matched against known D2R property wordings and rebuilt in a
// standard form, so junk before or after a stat (neighbouring panels, icons,
// mixed-caps misreads) never makes it into the result.
(function (root) {
  const T = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(To|Of|On|By|The|Vs|In|After|Per|From)\b/g, (m) => m.toLowerCase());
  const SK = (s) => s.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" "); // skill / aura names
  const sign = (n) => (/^[+\-]/.test(n) ? n : "+" + n);
  const neg = (n) => (/^[+\-]/.test(n) ? n : "-" + n);
  const N = "([+\\-]?\\d{1,4})";          // a signed number
  const GAP = "\\s*(?:\\S{1,3}\\s+)?";     // tolerate one short garbled word ("Te" for "to")
  const ELEM = "(fire|cold|lightning|poison|magic)";

  // Percent stats written "+X% Name". [regex body, display name, plausible max]
  const PCT_BEFORE = [
    ["faster cast rate", "Faster Cast Rate", 75], ["faster hit recovery", "Faster Hit Recovery", 60],
    ["faster run\\s*/?\\s*walk", "Faster Run/Walk", 45], ["increased attack speed", "Increased Attack Speed", 70],
    ["faster block rate", "Faster Block Rate", 60], ["increased chance of blocking", "Increased Chance of Blocking", 50],
    ["enhanced maximum damage", "Enhanced Maximum Damage", 400], ["enhanced damage", "Enhanced Damage", 500],
    ["enhanced defense", "Enhanced Defense", 400], ["better chance of getting magic items", "Better Chance of Getting Magic Items", 100],
    ["extra gold from monsters", "Extra Gold from Monsters", 300], ["to experience gained", "to Experience Gained", 15],
    ["life stolen per hit", "Life Stolen per Hit", 15], ["mana stolen per hit", "Mana Stolen per Hit", 15],
    ["deadly strike", "Deadly Strike", 100], ["chance of crushing blow", "Chance of Crushing Blow", 60],
    ["chance of open wounds", "Chance of Open Wounds", 100], ["damage taken goes to mana", "Damage Taken Goes to Mana", 20],
    ["damage to demons", "Damage to Demons", 400], ["damage to undead", "Damage to Undead", 400],
    ["chance of uninterruptable attack", "Chance of Uninterruptable Attack", 100],
  ];

  const RULES = [
    // skills
    [new RegExp(N + GAP + "to all skills"), (m) => `${sign(m[1])} to All Skills`],
    [new RegExp(N + GAP + "to (\\w+) skill levels"), (m) => `${sign(m[1])} to ${SK(m[2])} Skill Levels`],
    [new RegExp(N + GAP + "to ([a-z' ]+?) skills\\s*\\(?\\s*(\\w+) only"), (m) => `${sign(m[1])} to ${SK(m[2])} Skills (${SK(m[3])} Only)`],
    [new RegExp(N + GAP + "to ([a-z' ]+?)\\s*\\(\\s*(\\w+) only"), (m) => `${sign(m[1])} to ${SK(m[2])} (${SK(m[3])} Only)`],
    [new RegExp("(\\d{1,2})\\s*%?\\s*chance to cast level (\\d{1,2}) ([a-z' ]+?) (when struck|on striking|on attack|when you kill an enemy|when you die|when you level.?up)"),
      (m) => `${m[1]}% Chance to Cast Level ${m[2]} ${SK(m[3])} ${T(m[4])}`],
    [/level (\d{1,2}) ([a-z' ]+?) aura when equipped/, (m) => `Level ${m[1]} ${SK(m[2])} Aura When Equipped`],
    [/level (\d{1,2}) ([a-z' ]+?)\s*\(\s*(\d{1,3})\s*\/\s*(\d{1,3}) charges/, (m) => `Level ${m[1]} ${SK(m[2])} (${m[3]}/${m[4]} Charges)`],
    // elements
    [new RegExp(N + "\\s*%?\\s*to enemy " + ELEM + " resistance"), (m) => `${neg(m[1])}% to Enemy ${SK(m[2])} Resistance`],
    [new RegExp(N + "\\s*%?\\s*to " + ELEM + " skill damage"), (m) => `${sign(m[1])}% to ${SK(m[2])} Skill Damage`],
    [new RegExp("adds (\\d{1,4})\\s*-\\s*(\\d{1,4}) " + ELEM + " damage"), (m) => `Adds ${m[1]}-${m[2]} ${SK(m[3])} Damage`],
    [/adds (\d{1,4})\s*-\s*(\d{1,4}) damage/, (m) => `Adds ${m[1]}-${m[2]} Damage`],
    [new RegExp("maximum " + ELEM + " resist\\s*" + N), (m) => `Maximum ${SK(m[1])} Resist ${sign(m[2])}%`],
    [new RegExp(ELEM + " resist\\s*" + N), (m) => `${SK(m[1])} Resist ${sign(m[2])}%`],
    [/all resistances\s*([+\-]?\d{1,3})/, (m) => `All Resistances ${sign(m[1])}`],
    [new RegExp(ELEM + " absorb\\s*(\\d{1,3})\\s*%"), (m) => `${SK(m[1])} Absorb ${m[2]}%`],
    [new RegExp(N + GAP + ELEM + " absorb"), (m) => `${sign(m[1])} ${SK(m[2])} Absorb`],
    // defensive / utility
    [/magic damage reduced by (\d{1,3})/, (m) => `Magic Damage Reduced by ${m[1]}`],
    [/(?:^|[^c] )damage reduced by (\d{1,3})(\s*%)?/, (m) => `Damage Reduced by ${m[1]}${m[2] ? "%" : ""}`],
    [/physical damage (?:taken|received) reduced by (\d{1,3})/, (m) => `Physical Damage Taken Reduced by ${m[1]}%`],
    [/regenerate mana (\d{1,3})/, (m) => `Regenerate Mana ${m[1]}%`],
    [/increase maximum (life|mana) (\d{1,3})/, (m) => `Increase Maximum ${SK(m[1])} ${m[2]}%`],
    [/replenish life\s*\+?\s*(\d{1,3})/, (m) => `Replenish Life +${m[1]}`],
    [/attacker takes damage of (\d{1,4})/, (m) => `Attacker Takes Damage of ${m[1]}`],
    [/socketed\s*\(?\s*(\d)/, (m) => `Socketed (${m[1]})`],
    [/requirements\s*[+\-]?\s*(\d{1,3})/, (m) => `Requirements -${m[1]}%`],
    [/slows target by (\d{1,2})/, (m) => `Slows Target by ${m[1]}%`],
    [/hit causes monster to flee (\d{1,3})/, (m) => `Hit Causes Monster to Flee ${m[1]}%`],
    [/reduces all vendor prices (\d{1,2})/, (m) => `Reduces All Vendor Prices ${m[1]}%`],
    [/repairs (\d) durability in (\d{1,3}) seconds/, (m) => `Repairs ${m[1]} Durability in ${m[2]} Seconds`],
    // flat "+X to Something"
    [new RegExp(N + GAP + "(?:to\\s+)?life\\s*\\(?\\s*based on character level"), (m) => `${sign(m[1])} to Life (Based on Character Level)`],
    [new RegExp(N + GAP + "(?:to\\s+)?mana\\s*\\(?\\s*based on character level"), (m) => `${sign(m[1])} to Mana (Based on Character Level)`],
    [new RegExp(N + GAP + "(?:to\\s+)?(strength|dexterity|vitality|energy)\\s*\\(?\\s*based on character level"), (m) => `${sign(m[1])} to ${SK(m[2])} (Based on Character Level)`],
    [new RegExp(N + GAP + "life after each kill"), (m) => `${sign(m[1])} Life after each Kill`],
    [new RegExp(N + GAP + "(?:to\\s+)?mana after each kill"), (m) => `${sign(m[1])} to Mana after each Kill`],
    [new RegExp(N + GAP + "to all attributes"), (m) => `${sign(m[1])} to All Attributes`],
    [new RegExp(N + GAP + "to (strength|dexterity|vitality|energy)\\b"), (m) => `${sign(m[1])} to ${SK(m[2])}`],
    [new RegExp(N + GAP + "to attack rating against (demons|undead)"), (m) => `${sign(m[1])} to Attack Rating against ${SK(m[2])}`],
    [new RegExp(N + GAP + "to attack rating"), (m) => `${sign(m[1])} to Attack Rating`],
    [new RegExp(N + GAP + "to (maximum|minimum) damage"), (m) => `${sign(m[1])} to ${SK(m[2])} Damage`],
    [new RegExp(N + GAP + "to light radius"), (m) => `${sign(m[1])} to Light Radius`],
    [new RegExp(N + GAP + "defense vs\\.?\\s*(missile|melee)"), (m) => `${sign(m[1])} Defense vs. ${SK(m[2])}`],
    [new RegExp("([+\\-]\\d{1,4})\\s+defense\\b(?!\\s*vs)"), (m) => `${m[1]} Defense`],
    [new RegExp(N + GAP + "to life\\b"), (m) => `${sign(m[1])} to Life`],
    [new RegExp(N + GAP + "to mana\\b"), (m) => `${sign(m[1])} to Mana`],
    // flags (no number)
    [/cannot be frozen/, () => "Cannot Be Frozen"], [/half freeze duration/, () => "Half Freeze Duration"],
    [/prevent monster heal/, () => "Prevent Monster Heal"], [/\bknockback\b/, () => "Knockback"],
    [/ignore target'?s? defense/, () => "Ignore Target's Defense"], [/\bindestructible\b/, () => "Indestructible"],
    [/\bethereal\b/, () => "Ethereal (Cannot be Repaired)"], [/hit blinds target/, () => "Hit Blinds Target"],
  ];
  for (const [re, name, max] of PCT_BEFORE) {
    RULES.push([new RegExp(N + "\\s*(%?)\\s*" + re), (m) => {
      let n = m[1];
      // OCR often reads "%" as "2" or "9": "+102 Faster Cast Rate" → +10%
      if (!m[2] && Number(n.replace(/^[+\-]/, "")) > max && /[2-9]$/.test(n) && Number(n.replace(/^[+\-]/, "").slice(0, -1)) <= max) n = n.slice(0, -1);
      return `${/stolen|deadly|chance of|goes to mana|gold|magic items/.test(re) ? n.replace(/^\+/, "") : sign(n)}% ${name}`;
    }]);
  }

  // Generic vocabulary used only to repair split or misspelled words.
  const CORE = ("to of the on by in and per vs based level character only all skills skill levels fire cold lightning poison magic physical " +
    "damage resist resistance resistances life mana strength dexterity vitality energy attributes faster cast rate hit recovery run walk " +
    "increased attack speed block blocking enhanced defense better chance getting items extra gold monsters experience gained stolen " +
    "deadly strike crushing blow open wounds reduced maximum minimum regenerate replenish after each kill increase aura when equipped " +
    "ignore target's piercing knockback slows prevent monster heal cannot frozen freeze duration light radius attacker takes demons " +
    "undead requirements socketed ethereal indestructible repairs repaired durability charges struck striking enemy missile melee adds " +
    "absorb taken received goes vendor prices reduces flee blinds amazon assassin barbarian druid necromancer paladin sorceress warlock " +
    "javelin spear bow crossbow traps shadow disciplines martial arts combat warcries masteries shape shifting elemental summoning curses " +
    "bone offensive defensive auras chaos demon eldritch seconds against uninterruptable").split(" ");
  const D = new Set(CORE);
  const OCR_FIX = { al: "all", ys: "vs", fo: "to", te: "to", t0: "to", ot: "of", lite: "life", iife: "life" };

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
  function closest(w) {
    if (w.length < 5) return null;
    let best = null, bd = 99;
    for (const d of D) { if (Math.abs(d.length - w.length) > 2) continue; const x = lev(w, d); if (x < bd) { bd = x; best = d; } }
    return bd <= (w.length >= 7 ? 2 : 1) ? best : null;
  }
  // Lower-case, fix symbols, merge "reduc ed", repair "vitahty". Skill names it doesn't know are left alone.
  function normalize(raw) {
    let s = raw.toLowerCase()
      .replace(/^\s*\*(?=\d)/, "+").replace(/[“”«»‘’`´]/g, "'")
      .replace(/(\d)\s*[°º]o?/g, "$1%").replace(/(\d)\s*%o\b/g, "$1%")
      .replace(/(^|\s)[il|]\s?(?=\d)/g, "$11") // "I 1%" → "11%"
      .replace(/[—–]/g, "-").replace(/([+\-])\s+(\d)/g, "$1$2").replace(/(\d)\s+%/g, "$1%")
      .replace(/[|\[\]{}=_~;]/g, " ").replace(/\s+/g, " ").trim();
    const toks = s.split(" ");
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const m = t.match(/^([^a-z']*)([a-z']+)([^a-z']*)$/);
      if (!m || D.has(m[2])) { out.push(t); continue; }
      const nx = toks[i + 1] && toks[i + 1].match(/^([a-z']+)([^a-z']*)$/);
      if (nx && !m[3] && D.has(m[2] + nx[1])) { out.push(m[1] + m[2] + nx[1] + nx[2]); i++; continue; }
      const fix = OCR_FIX[m[2]] || closest(m[2]);
      out.push(fix ? m[1] + fix + m[3] : t);
    }
    return out.join(" ");
  }

  function parseLine(raw) {
    const s = normalize(raw);
    const found = [];
    for (const [re, fmt] of RULES) {
      const m = s.match(re);
      if (m) found.push({ at: m.index, len: m[0].length, text: fmt(m) });
    }
    // Keep non-overlapping matches, longest first (e.g. "Magic Damage Reduced" over "Damage Reduced").
    found.sort((a, b) => b.len - a.len);
    const kept = [];
    for (const f of found) if (!kept.some((k) => f.at < k.at + k.len && k.at < f.at + f.len)) kept.push(f);
    return kept.sort((a, b) => a.at - b.at).map((k) => k.text);
  }

  function cleanStats(text) {
    const seen = new Set(), out = [];
    for (const raw of String(text || "").split(/\n+/)) {
      for (const line of parseLine(raw)) {
        const key = line.replace(/[+\-]?\d+/g, "#").toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(line); }
      }
    }
    return out;
  }

  root.StatClean = { cleanStats, parseLine };
})(typeof window !== "undefined" ? window : globalThis);
