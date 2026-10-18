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
  const RGAP = "\\s*[:.]?\\s*";              // "Fire Resist: +30%"
  // Item resists never go past 100. A bigger number is an OCR slip: "+" read as 4/7
  // ("430" → 30), "%" read as 2/9 ("302" → 30), or a slashed zero doubled ("300" → 30).
  function res(n) {
    const sg = /^-/.test(n) ? "-" : /^\+/.test(n) ? "+" : "", d = n.replace(/^[+\-]/, "");
    if (Number(d) <= 100) return n;
    const fix = /^[47]/.test(d) && Number(d.slice(1)) > 0 && Number(d.slice(1)) <= 100 ? d.slice(1)
      : /0$/.test(d) && Number(d) / 10 <= 100 ? String(Number(d) / 10)
      : /[29]$/.test(d) && Number(d.slice(0, -1)) <= 100 ? d.slice(0, -1) : d;
    return sg + fix;
  }

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
    [new RegExp(N + "\\s*%?\\s*to maximum " + ELEM + " resist"), (m) => `${sign(res(m[1]))}% to Maximum ${SK(m[2])} Resist`],
    [new RegExp("maximum " + ELEM + " resist\\w*" + RGAP + N), (m) => `+${res(m[2]).replace(/^[+\-]/, "")}% to Maximum ${SK(m[1])} Resist`],
    [new RegExp(ELEM + " resist\\w*" + RGAP + N), (m) => `${SK(m[1])} Resist ${sign(res(m[2]))}%`],
    [new RegExp("all resist\\w*" + RGAP + N), (m) => `All Resistances ${sign(res(m[1]))}`],
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
      // These always roll in 5s/10s: a lone "2" or "3" is a 20/30 that lost its zero.
      if (/faster cast|faster hit|faster run|attack speed|faster block/.test(re) && /^[+\-]?[1-9]$/.test(n) && Number(n.replace(/^[+\-]/, "")) * 10 <= max) n = n + "0";
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
  const CLASSES = ["amazon", "assassin", "barbarian", "druid", "necromancer", "paladin", "sorceress", "warlock"];
  function CLASS_FIX(w) {
    let best = null, bd = 99;
    for (const c of CLASSES) { const d = wlev(w, c); if (d < bd) { bd = d; best = c; } }
    return bd <= Math.max(2, w.length * 0.35) ? best : null;
  }
  const OCR_FIX = { al: "all", ail: "all", aii: "all", ys: "vs", fo: "to", te: "to", t0: "to", ot: "of", lite: "life", iife: "life" };

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
  // Letters D2R's small-caps font makes look alike: a swap between them costs little.
  const CONF = ["cg", "pd", "eo", "il", "ij", "nh", "rt", "mn", "uv", "vy", "bh", "ce", "ao", "fl", "uo", "rn", "kx", "ti"];
  const confusable = new Set(CONF.flatMap(([x, y]) => [x + y, y + x]));
  function wlev(a, b) {
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const row = [i];
      for (let j = 1; j <= n; j++) {
        const sub = a[i - 1] === b[j - 1] ? 0 : confusable.has(a[i - 1] + b[j - 1]) ? 0.35 : 1;
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + sub);
      }
      prev = row;
    }
    return prev[n];
  }
  function closest(w) {
    if (w.length < 4) return null;
    let best = null, bd = 99;
    for (const d of D) { if (Math.abs(d.length - w.length) > 2) continue; const x = wlev(w, d); if (x < bd) { bd = x; best = d; } }
    return bd <= (w.length >= 7 ? 2 : w.length >= 5 ? 1.4 : 0.8) ? best : null;
  }
  // D2R draws zero with a slash (Ø). OCR turns it into Ø ø @ © ® θ, or a degree sign before "%".
  function fixZeros(s) {
    return s
      .replace(/(\d)\s*[Øø@©®θΘϕΦ]/g, "$10").replace(/[Øø@©®θΘϕΦ](?=\d)/g, "0")
      .replace(/(\d)[°º](?=\s*%)/g, "$10")          // "3°%" → "30%"
      .replace(/(\d)[oO](?=\s*%|\s+to\b|\s+(?:faster|enhanced|increased|deadly|chance|better|extra|life|mana|damage)\b|$)/g, "$10")
      .replace(/(\d)\/(?=\s*%)/g, "$10");          // "2/%" → "20%"
  }
  // Lower-case, fix symbols, merge "reduc ed", repair "vitahty". Skill names it doesn't know are left alone.
  function normalize(raw) {
    let s = fixZeros(raw).toLowerCase()
      .replace(/^\s*\*(?=\d)/, "+").replace(/[“”«»‘’`´]/g, "'")
      .replace(/(\d)\s*[°º]o?/g, "$1%").replace(/(\d)\s*%o\b/g, "$1%")
      .replace(/(^|\s)[il|]\s?(?=\d)/g, "$11") // "I 1%" → "11%"
      .replace(/(^|\s)[t*]\s?(?=\d)/g, "$1+")  // "t30%" / "*30%" → "+30%" (misread plus sign)
      .replace(/([a-z])1(?=[a-z])/g, "$1i").replace(/([a-z])0(?=[a-z])/g, "$1o") // "res1st" → "resist"
      .replace(/[—–]/g, "-").replace(/([+\-])\s+(\d)/g, "$1$2").replace(/(\d)\s+%/g, "$1%")
      .replace(/[|\[\]{}=_~;]/g, " ").replace(/\s+/g, " ").trim();
    // "(barbarian euy)" / "(bansanian nvyv)" → "(barbarian only)"
    s = s.replace(/\(\s*([a-z]{5,12})\s+[a-z]{2,5}\s*\)?$/, (m, c) => { const k = CLASS_FIX(c); return k ? `(${k} only)` : m; });
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

  // ---------- item-aware matching ----------
  // When the item is known, its game-data stat lines are templates: match each photo
  // line to the closest template by letters, then take the numbers from the photo.
  const letters = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const NUM_RE = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/g;
  function photoNumbers(line) {
    const LOOK = { o: "0", O: "0", D: "0", l: "1", I: "1", "|": "1", i: "1", Z: "2", z: "2", S: "5", s: "5", B: "8", g: "9", q: "9", G: "6", b: "6" };
    // A look-alike letter next to a digit or "%" is a digit ("Z8%" → 28%, "1Ø" → 10).
    const fixed = fixZeros(line)
      .replace(/(?<=[\d])[oODlI|iZzSsBgqGb](?=[\d%]|\b)/g, (c) => LOOK[c])
      .replace(/(?<=[+\-\s]|^)[oODlI|iZzSsBgqGb](?=\d)/g, (c) => LOOK[c]);
    return [...fixed.matchAll(/\d+/g)].map((m) => Number(m[0]));
  }
  function fillTemplate(tpl, nums) {
    // "Adds 15-35 Damage" / "5-30 fire damage": min and max are separate fixed numbers.
    if (/^adds\b|\bto \d+ \w+ damage/i.test(tpl)) {
      const m = tpl.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
      if (m && nums.length >= 2) {
        const i = nums.findIndex((n, j) => j + 1 < nums.length && n <= nums[j + 1]);
        if (i >= 0) return tpl.replace(m[0], `${nums[i]}-${nums[i + 1]}`);
      }
      return tpl;
    }
    let k = 0, unread = false;
    const out = tpl.replace(NUM_RE, (m, a, b) => {
      const lo = Number(a), hi = b != null ? Number(b) : lo;
      // take the next photo number that fits this stat's range (a little slack for rounding)
      const fits = (n) => n >= Math.floor(lo * 0.95) && n <= Math.ceil(hi * 1.05);
      for (let i = k; i < nums.length; i++) {
        const n = nums[i];
        if (fits(n)) { k = i + 1; return String(n); }
        if (fits(n * 10)) { k = i + 1; return String(n * 10); } // trailing zero dropped by OCR ("2" for 20)
        // "%" read as a digit: "282" for 28%
        if (n >= 100 && fits(Math.floor(n / 10))) { k = i + 1; return String(Math.floor(n / 10)); }
      }
      if (b == null) return a;      // fixed value: trust the game data
      unread = true;
      return m;                      // variable and unreadable: leave the range so it's obvious to edit
    });
    return unread ? `${out} (check)` : out;
  }
  // Skills a "+3 to a Random <Class> Skill" item can roll (Ormus' Robes: game skill IDs 36-60).
  const RANDOM_SKILLS = {
    sorceress: ["Fire Bolt", "Warmth", "Charged Bolt", "Ice Bolt", "Frozen Armor", "Inferno", "Static Field", "Telekinesis",
      "Frost Nova", "Ice Blast", "Blaze", "Fire Ball", "Nova", "Lightning", "Shiver Armor", "Fire Wall", "Enchant",
      "Chain Lightning", "Teleport", "Glacial Spike", "Meteor", "Thunder Storm", "Energy Shield", "Blizzard", "Chilling Armor"],
  };
  // Find the photo line for a random-skill stat ("+3 to Blizzard (Sorceress Only)") and name the skill.
  function readRandomSkill(tpl, lines, taken) {
    const m = tpl.match(/^\+?(\d+) to a random (\w+) skill \((\w+) only\)/i);
    if (!m) return null;
    const cls = m[2], list = RANDOM_SKILLS[cls.toLowerCase()] || [];
    let best = null;
    lines.forEach((line, li) => {
      if (taken.has(li)) return;
      const n = normalize(line).toLowerCase();
      const om = n.match(/\bto\s+(.+?)\s*\(?\s*(\w+)\s+only/) || n.match(/\bto\s+(.+?)\s*\(\s*(\w+)/);
      if (!om || wlev(letters(om[2]), cls.toLowerCase()) > 3) return;
      const sk = letters(om[1]);
      for (const name of list) {
        const d = wlev(sk, letters(name)) / letters(name).length;
        if (d <= 0.34 && (!best || d < best.d)) best = { li, d, name };
      }
    });
    if (!best) return null;
    const lvl = photoNumbers(lines[best.li]).find((x) => x >= 1 && x <= 3) || Number(m[1]);
    return { li: best.li, text: `+${lvl} to ${best.name} (${cls} Only)` };
  }
  // Magic charms and jewels: the name says which stats the item has ("Cobalt Small Charm of Vita" =
  // cold resist + life). Returns those stat templates (with the game's ranges), or null.
  const AFF_BASES = [["s", /sma\w*\s*cha\w*/], ["m", /lar\w*\s*cha\w*/], ["l", /gra\w*\s*cha\w*/], ["j", /\bjew\w*/]];
  function affixTemplates(text, affixes) {
    affixes = affixes || root.AFFIXES;
    if (!affixes) return null;
    const lines = String(text || "").split(/\n+/).map((l) => l.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim());
    for (const line of lines) {
      for (const [t, re] of AFF_BASES) {
        const m = line.match(re);
        if (!m || /keep in|inventory/.test(line)) continue;
        const table = affixes[t] || {}, out = [];
        const pick = (frag, isSuffix) => {
          const f = letters(frag);
          if (f.length < 3) return null;
          let best = null;
          for (const [name, stats] of Object.entries(table)) {
            if (isSuffix !== /^of /.test(name)) continue;
            const n = letters(name);
            // the fragment may carry junk in front ("piecobalt"): compare its tail too
            const cands = isSuffix ? [f.slice(0, n.length), f] : [f.slice(-n.length), f];
            for (const c of cands) {
              const d = wlev(c, n) / n.length;
              if (d <= 0.3 && (!best || d < best.d)) best = { d, stats };
            }
          }
          return best && best.stats;
        };
        const pre = line.slice(0, m.index).trim().split(" ").slice(-2).join(" ");
        const suf = line.slice(m.index + m[0].length).trim();
        const p = pick(pre, false), q = /^o\w? /.test(suf) ? pick(suf.replace(/^o\w? /, "of "), true) : null;
        if (p) out.push(p);
        if (q) out.push(q);
        if (out.length) return out.join(", ");
      }
    }
    return null;
  }
  function cleanStatsForItem(text, itemStats, trusted) {
    const allTpls = String(itemStats || "").split(/,\s+(?![^()]*\))/).map((t) => t.trim()).filter(Boolean);
    const perLevel = allTpls.filter((t) => /per character level/.test(t));
    const randomTpls = allTpls.filter((t) => /to a random \w+ skill/i.test(t));
    const tpls = allTpls.filter((t) => !/per character level/.test(t) && !randomTpls.includes(t));
    // Drop base-item lines (Required Strength, Durability, Defense:) so they can't pose as stats.
    const lines = String(text || "").split(/\n+/).map((l) => l.trim())
      .filter((l) => letters(l).length >= 4 && !/^[^a-z]*(required|durability|defense\s*:|chance to block|one.hand|two.hand|throw damage|quantity|item version|.*class\s*-)/i.test(normalize(l)));
    // Score every (photo line, stat template) pair, then assign best matches first.
    const pairs = [];
    lines.forEach((line, li) => {
      const L = letters(normalize(line));
      tpls.forEach((t, ti) => {
        const T = letters(t);
        let s = L.length < T.length ? 1 - wlev(L, T) / T.length : 0;
        // the photo line may carry junk at either end: slide a template-sized window over it
        for (let off = 0; off <= Math.max(0, L.length - T.length); off += Math.max(1, Math.floor(T.length / 6))) {
          s = Math.max(s, 1 - wlev(L.slice(off, off + T.length + 2), T) / Math.max(T.length, 1));
        }
        if (s >= 0.62) pairs.push({ li, ti, s });
      });
    });
    pairs.sort((a, b) => b.s - a.s);
    // Sanity check: a correctly identified item shows most of its known stat lines.
    // If the photo matches too few of them, the item is probably wrong — read the photo generically.
    const matchedTpls = new Set(pairs.filter((p) => p.s >= 0.7).map((p) => p.ti));
    if (!trusted && tpls.length && matchedTpls.size < Math.min(tpls.length, Math.max(2, Math.ceil(tpls.length * 0.34)))) return cleanStats(text);
    const used = new Set(), taken = new Set(), out = [];
    for (const t of randomTpls) {
      const r = readRandomSkill(t, lines, taken);
      if (r) { taken.add(r.li); out.push({ at: r.li, text: r.text }); }
      else out.push({ at: -1, text: `${t} (check)` });
    }
    for (const p of pairs) {
      if (used.has(p.ti) || taken.has(p.li)) continue;
      used.add(p.ti); taken.add(p.li);
      out.push({ at: p.li, text: fillTemplate(tpls[p.ti], photoNumbers(lines[p.li])) });
    }
    // Name-derived templates are certain, so a garbled line ("Peon ResisT 8%") still counts if it has the
    // stat's key word and a number in range.
    if (trusted) tpls.forEach((t, ti) => {
      if (used.has(ti)) return;
      const keys = t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length >= 5 && !/^(chance|getting)$/.test(w));
      for (let li = 0; li < lines.length; li++) {
        if (taken.has(li)) continue;
        const words = normalize(lines[li]).toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
        if (!keys.some((k) => words.some((w) => w.length >= 4 && wlev(w, k) <= 1))) continue;
        const filled = fillTemplate(t, photoNumbers(lines[li]));
        if (/\(check\)$/.test(filled) || filled === t && /\d+\s*-\s*\d+/.test(t)) continue;
        used.add(ti); taken.add(li); out.push({ at: li, text: filled });
        break;
      }
    });
    // Anything else the general parser recognises (e.g. "+148 to Life (Based on Character Level)", sockets).
    lines.forEach((l, li) => {
      if (taken.has(li)) return;
      for (const p of parseLine(l)) {
        const key = p.replace(/[+\-]?\d+/g, "#").toLowerCase();
        if (!out.some((o) => o.text.replace(/[+\-]?\d+(?:-\d+)?/g, "#").toLowerCase() === key)) out.push({ at: li, text: p });
      }
    });
    // The item is confirmed, so every stat it always carries belongs on it — even lines the photo
    // couldn't read. Fixed values are certain; unread rolled values keep their range, flagged.
    const isRange = (t) => /\d+(?:\.\d+)?\s*-\s*\d+/.test(t.replace(/^adds\b.*/i, ""));
    tpls.forEach((t, ti) => {
      if (used.has(ti)) return;
      out.push({ at: 1e6 + ti, text: isRange(t) ? `${t} (check)` : t });
    });
    for (const t of perLevel) {
      const stat = (t.match(/per character level/) && t.replace(/^\+[\d.%]+\s*/, "").replace(/\s*per character level/, "")).toLowerCase();
      const already = out.some((o) => /based on character level/i.test(o.text) && o.text.toLowerCase().includes(stat.replace(/^%\s*/, "").split(" ").pop()));
      if (!already) out.push({ at: 2e6, text: t });
    }
    return out.sort((a, b) => a.at - b.at).map((o) => o.text);
  }

  root.StatClean = { cleanStats, parseLine, cleanStatsForItem, affixTemplates };
})(typeof window !== "undefined" ? window : globalThis);
