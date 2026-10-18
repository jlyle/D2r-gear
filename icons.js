// Original line icons for item classes (drawn for Perfect Roll, 48×48, stroked
// with currentColor so the item's rarity color tints them).
(function (root) {
  const P = {
    // helms
    helm: '<path d="M10 32c0-11 6-20 14-20s14 9 14 20v4H10z"/><path d="M10 36h28M24 12v24M17 26h14"/>',
    crown: '<path d="M8 36V16l8 8 8-12 8 12 8-8v20z"/><path d="M8 36h32"/><circle cx="24" cy="29" r="2.5"/>',
    circlet: '<ellipse cx="24" cy="29" rx="16" ry="7"/><path d="M24 14l4 7-4 7-4-7z"/>',
    cap: '<path d="M14 37l2-23c0-3 4-6 8-6s8 3 8 6l2 23z"/><path d="M10 37h28M16 22h16"/>',
    mask: '<path d="M10 14c0-4 4-6 14-6s14 2 14 6v8c0 10-6 18-14 18S10 32 10 22z"/><path d="M16 22h5M27 22h5M20 32h8"/>',
    pelt: '<path d="M10 12l6 5h16l6-5-2 15c-2 8-7 13-12 13s-10-5-12-13z"/><path d="M18 25h3M27 25h3M22 33h4"/>',
    horned: '<path d="M14 34c0-9 4-16 10-16s10 7 10 16v4H14z"/><path d="M14 26C8 24 6 16 8 8c2 6 5 10 9 12M34 26c6-2 8-10 6-18-2 6-5 10-9 12"/><path d="M14 38h20"/>',
    // weapons
    sword: '<path d="M34 8h6v6L20 34l-6-6z"/><path d="M12 26l10 10M8 40l6-6"/>',
    axe: '<path d="M12 40L30 10"/><path d="M26 8c8-4 14 2 14 10-6 0-11-2-14-6z"/>',
    mace: '<path d="M14 40l14-22"/><circle cx="32" cy="13" r="7"/><path d="M32 3v3M42 13h-3M39 6l-2 2M25 6l2 2"/>',
    hammer: '<path d="M16 40l12-20"/><path d="M21 14l12-6 6 12-12 6z"/>',
    staff: '<path d="M14 42L32 12"/><circle cx="34" cy="9" r="4"/><path d="M27 16l-4-2M29 19l-1 4"/>',
    wand: '<path d="M12 40l18-22"/><path d="M30 18l4-10 2 6 6 2-10 4z"/>',
    orb: '<circle cx="24" cy="21" r="11"/><path d="M18 35h12l-2 7h-8z"/><path d="M19 17a6 6 0 0 1 6-4"/>',
    bow: '<path d="M14 6c14 6 14 30 0 36"/><path d="M14 6v36"/><path d="M8 24h30M34 20l4 4-4 4"/>',
    crossbow: '<path d="M8 18c10-8 22-8 32 0"/><path d="M8 18l16 8 16-8"/><path d="M24 10v32M20 38h8"/>',
    javelin: '<path d="M8 40L36 12"/><path d="M36 12l5-6-7 3z"/><path d="M12 32l4 4"/>',
    spear: '<path d="M10 40l22-22"/><path d="M32 18l4-12-12 4z"/><path d="M14 32l4 4"/>',
    polearm: '<path d="M10 42l24-28"/><path d="M29 10c9-3 13 4 11 11-5-2-8-5-11-11z"/><path d="M34 14l4-8"/>',
    claw: '<path d="M15 30h18v10H15z"/><path d="M18 30l2-22M24 30V6M30 30l-2-22"/>',
    dagger: '<path d="M24 5l5 19H19z"/><path d="M16 24h16M24 24v10"/><circle cx="24" cy="38" r="3"/>',
    // off-hands
    shield: '<path d="M24 6l15 5v11c0 10-7 16-15 20-8-4-15-10-15-20V11z"/><path d="M24 11v26M14 21h20"/>',
    holy: '<path d="M24 6l15 5v11c0 10-7 16-15 20-8-4-15-10-15-20V11z"/><path d="M24 14v18M17 21h14"/><circle cx="24" cy="21" r="10"/>',
    tower: '<rect x="12" y="6" width="24" height="36" rx="4"/><path d="M24 6v36M12 20h24"/>',
    tome: '<path d="M10 8h22a6 6 0 0 1 6 6v26H16a6 6 0 0 1-6-6z"/><path d="M10 34a6 6 0 0 1 6-6h22"/><path d="M24 12l4 6-4 6-4-6z"/>',
    head: '<path d="M14 18c0-7 4-11 10-11s10 4 10 11c0 8-3 14-10 14s-10-6-10-14z"/><path d="M19 18h3M26 18h3M20 26h8M24 32v8M18 40h12"/>',
    // armor
    plate: '<path d="M16 8l8 5 8-5 8 7-4 7v18H12V22l-4-7z"/><path d="M24 13v27M18 26h12M18 32h12"/>',
    light: '<path d="M16 8l8 6 8-6 6 6-3 6v20H13V20l-3-6z"/><path d="M24 14v26"/><circle cx="21" cy="22" r="1.2"/><circle cx="21" cy="30" r="1.2"/>',
    robe: '<path d="M18 6h12l2 10 6 26H10l6-26z"/><path d="M18 6l6 8 6-8M16 22h16"/>',
    // gloves, belts, boots, jewelry
    gloves: '<path d="M14 40V22l3-11h3l1 9 2-12h3l1 12 2-10h3v12l3-6 3 1-4 14v9z"/><path d="M14 34h18"/>',
    gauntlets: '<path d="M14 40V20l4-10h14l2 10v20z"/><path d="M14 28h20M14 34h20M19 10v10M24 10v10M29 10v10"/>',
    belt: '<rect x="6" y="18" width="36" height="12" rx="2"/><rect x="19" y="16" width="10" height="16" rx="1"/><path d="M24 20v8"/>',
    sash: '<path d="M6 19c12 4 24 4 36 0v9c-12 4-24 4-36 0z"/><path d="M22 27l-4 14M26 27l4 14"/>',
    boots: '<path d="M14 8h11v20l12 5c3 1 4 3 4 6v3H10V30z"/><path d="M14 16h11M10 36h31"/>',
    amulet: '<path d="M10 8c0 12 6 18 14 22 8-4 14-10 14-22"/><path d="M24 30l7 8-7 6-7-6z"/>',
    ring: '<circle cx="24" cy="28" r="12"/><circle cx="24" cy="28" r="7"/><path d="M19 15l5-7 5 7z"/>',
    // stash goods
    rune: '<path d="M14 8h20l6 16-6 16H14L8 24z"/><path d="M20 16l8 0-6 8 6 8h-8"/>',
    gem: '<path d="M14 10h20l6 10-16 20L8 20z"/><path d="M8 20h32M20 10l-4 10 8 20 8-20-4-10"/>',
    jewel: '<path d="M24 6l14 10-5 18H15l-5-18z"/><path d="M24 6v28M10 16h28"/><circle cx="24" cy="20" r="4"/>',
    key: '<circle cx="14" cy="24" r="7"/><path d="M21 24h21M34 24v6M39 24v4"/>',
    organ: '<path d="M16 12c-6 0-9 6-7 12 2 8 9 14 15 16 6-2 13-8 15-16 2-6-1-12-7-12-4 0-6 2-8 5-2-3-4-5-8-5z"/><path d="M18 22c2 2 4 2 6 0 2 2 4 2 6 0"/>',
    essence: '<path d="M18 6h12M20 6v8l-8 14a8 8 0 0 0 7 12h10a8 8 0 0 0 7-12l-8-14V6"/><path d="M15 30h18"/>',
    token: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="10"/><path d="M24 16v16M16 24h16"/>',
    misc: '<path d="M10 16l14-8 14 8v16l-14 8-14-8z"/><path d="M10 16l14 8 14-8M24 24v16"/>',
    // charms by size
    small: '<rect x="16" y="16" width="16" height="16" rx="3"/><path d="M24 20l4 4-4 4-4-4z"/>',
    large: '<rect x="16" y="8" width="16" height="32" rx="3"/><path d="M24 17l4 7-4 7-4-7z"/>',
    grand: '<rect x="15" y="3" width="18" height="42" rx="3"/><path d="M24 15l5 9-5 9-5-9z"/>',
  };

  // Item → icon. Anything not listed falls back to its slot's default.
  const BY_NAME = {
    "Peasant Crown": "crown", "Crown of Ages": "crown", "Griffon's Eye": "circlet", "Kira's Guardian": "circlet",
    "Rare caster circlet": "circlet", "Harlequin Crest": "cap", "Tarnhelm": "cap", "Andariel's Visage": "mask",
    "Tal Rasha's Horadric Crest": "mask", "Hellwarden's Will": "mask", "Horazon's Countenance": "mask",
    "Jalal's Mane": "pelt", "Rare druid pelt": "pelt", "Rare Shape Shifting pelt": "pelt",
    "Arreat's Face": "horned", "Rare Warcries helm": "horned",
    "Insight": "polearm", "Infinity": "polearm", "Pride": "polearm", "Obedience": "polearm", "Doom": "polearm",
    "The Reaper's Toll": "polearm", "Fortitude (weapon)": "polearm", "Arioc's Needle": "spear",
    "Titan's Revenge": "javelin", "Thunderstroke": "javelin", "White": "wand", "Arm of King Leoric": "wand", "Death's Web": "wand",
    "Memory": "staff", "Ondal's Wisdom": "staff", "Mang Song's Lesson": "staff", "Obsession": "staff", "Magic caster weapon": "staff",
    "The Oculus": "orb", "Death's Fathom": "orb", "Eschuta's Temper": "orb", "Tal Rasha's Lidless Eye": "orb",
    "Buriza-Do Kyanon": "crossbow", "Faith": "bow", "Windforce": "bow", "Rare/Crafted bow": "bow",
    "Heart of the Oak": "mace", "Last Wish": "hammer", "Beast": "axe", "Death Cleaver": "axe", "Breath of the Dying": "axe", "Gimmershred": "axe",
    "Rare trap claw": "claw", "Mosaic": "claw", "Chaos": "claw", "Rare off-hand claw": "claw",
    "Wizardspike": "dagger", "Warshrike": "dagger", "Bloodpact Shard": "dagger", "Void": "dagger", "Ritual": "dagger", "Rare Warlock dagger": "dagger",
    "Herald of Zakarum": "holy", "Exile": "holy", "Dream (shield)": "holy", "Stormshield": "tower",
    "Ars Dul'Mephistos": "tome", "Ars Al'Diabolos": "tome", "Ars Tor'Baalos": "tome", "Measured Wrath": "tome", "Horazon's Secrets": "tome",
    "Homunculus": "head", "Rare necro head": "head",
    "Skin of the Vipermagi": "light", "Stealth": "light", "Smoke": "light", "Treachery": "light", "Horazon's Dominion": "light", "Ormus' Robes": "robe",
    "Steelrend": "gauntlets", "Dracul's Grasp": "gauntlets", "Soul Drainer": "gauntlets", "Crafted Blood gloves": "gauntlets",
    "Key of Terror": "key", "Key of Hate": "key", "Key of Destruction": "key",
    "Mephisto's Brain": "organ", "Diablo's Horn": "organ", "Baal's Eye": "organ",
    "Twisted Essence of Suffering": "essence", "Charged Essence of Hatred": "essence", "Burning Essence of Terror": "essence", "Festering Essence of Destruction": "essence",
    "Token of Absolution": "token", "Standard of Heroes": "token",
    "Arachnid Mesh": "sash", "String of Ears": "sash", "Goldwrap": "sash",
  };
  const BY_SLOT = { helm: "helm", weapon: "sword", offhand: "shield", armor: "plate", gloves: "gloves", belt: "belt", boots: "boots", amulet: "amulet", ring: "ring", rune: "rune", gem: "gem", jewel: "jewel", misc: "misc" };

  // Game base-type codes (from the item catalog) → icon.
  const BY_BTYPE = {
    knif: "dagger", tkni: "dagger", swor: "sword", axe: "axe", taxe: "axe", club: "mace", scep: "mace", mace: "mace", hamm: "hammer",
    staf: "staff", wand: "wand", orb: "orb", bow: "bow", abow: "bow", xbow: "crossbow", jave: "javelin", ajav: "javelin",
    spea: "spear", aspe: "spear", pole: "polearm", h2h: "claw", h2h2: "claw",
    helm: "helm", circ: "circlet", pelt: "pelt", phlm: "horned", head: "head", ashd: "holy", shie: "shield", grim: "tome",
    tors: "plate", glov: "gloves", belt: "belt", boot: "boots", amul: "amulet", ring: "ring", scha: "small", mcha: "large", lcha: "grand",
  };
  function key(it) {
    if (it.slot === "charm") return it.size === 1 ? "small" : it.size === 2 ? "large" : it.size === 3 ? "grand" : BY_BTYPE[it.btype] || "grand";
    return BY_NAME[it.name] || BY_BTYPE[it.btype] || BY_SLOT[it.slot] || "misc";
  }
  function svg(it) {
    return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${P[key(it)]}</svg>`;
  }
  root.ItemIcons = { svg, key, PATHS: P };
})(typeof window !== "undefined" ? window : globalThis);
