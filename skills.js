// Suggested skill and stat points per build (endgame, ~110 points = level 99 incl. 12 quest points).
// Each entry: [skill, points, note]. Points: "20", "1", "1+" (one or more), "rest" (leftover points).
// Listed in the order to max them. "Prereqs" = 1 point in each prerequisite skill.
// src: "iv" = matches the current Icy Veins skill guide; "std" = long-standing community allocation.

const STAT_TEXT = {
  shield: { str: "Enough for gear (about 156 for a Spirit Monarch)", dex: "Enough for gear; more only if you want max block", vit: "Everything else (250+)", enr: "None" },
  paladin: { str: "Enough for gear (about 103 for Archon Plate with Herald of Zakarum)", dex: "About 130–170 total for max block (75%)", vit: "Everything else (250+)", enr: "None" },
  melee: { str: "Enough for your weapon and gear; each extra point adds ~1% damage", dex: "Enough for gear", vit: "Everything else (250+)", enr: "None" },
  bow: { str: "Enough for gear", dex: "Gear requirement or more — each point adds 1% bow damage", vit: "Everything else (250+)", enr: "None (40–50 while leveling, then respec)" },
  warlock: { str: "Enough for gear (Levitation Mastery lowers requirements)", dex: "Enough for gear", vit: "Everything else (250+)", enr: "None (a few while leveling is fine)" },
};
const PRE = ["Prerequisites", "1", "1 point in each skill needed to unlock the ones below"];

const SKILL_PLANS = {
  // ===== AMAZON =====
  javazon: { src: "iv", stats: STAT_TEXT.shield, skills: [PRE,
    ["Lightning Fury", "20", "Main pack clear — max first"], ["Charged Strike", "20", "Bosses; synergy"], ["Lightning Bolt", "20", "Synergy"], ["Lightning Strike", "20", "Synergy"],
    ["Pierce", "1", "Aim for ~63% pierce with gear"], ["Valkyrie", "1+", "Reach skill level 17+ with gear"], ["Decoy / Dodge / Avoid / Evade", "1", "Utility and defense"]] },
  "strike-zon": { src: "iv", stats: STAT_TEXT.shield, note: "Same points as Lightning Fury — you just lead with Charged/Lightning Strike in melee.", skills: [PRE,
    ["Charged Strike", "20", "Main single target"], ["Lightning Strike", "20", "Chain damage; synergy"], ["Lightning Fury", "20", "Synergy and ranged packs"], ["Lightning Bolt", "20", "Synergy"],
    ["Valkyrie", "1+", "Tank — level 17+ with gear"], ["Decoy / Dodge / Avoid / Evade", "1", "Utility and defense"]] },
  "strafe-zon": { src: "iv", stats: STAT_TEXT.bow, note: "Physical bow: Strafe, Guided Arrow and Multiple Shot share the same points.", skills: [PRE,
    ["Strafe", "20", "Main damage"], ["Guided Arrow", "20", "Bosses"], ["Multiple Shot", "20", "Big packs (10+)"], ["Critical Strike", "10-20", "Passive damage"],
    ["Pierce", "9", "Or enough for 100% with Razortail"], ["Valkyrie", "17+", "Recommended (level 17 gives her best gear)"]] },
  "multishot-zon": { src: "iv", stats: STAT_TEXT.bow, note: "Physical bow: Multiple Shot, Guided Arrow and Strafe share the same points.", skills: [PRE,
    ["Multiple Shot", "20", "Main pack clear"], ["Guided Arrow", "20", "Bosses"], ["Strafe", "20", "General damage"], ["Critical Strike", "10-20", "Passive damage"],
    ["Pierce", "9", "Or enough for 100% with Razortail"], ["Valkyrie", "17+", "Recommended"]] },
  "freezing-zon": { src: "iv", stats: STAT_TEXT.bow, note: "Current guides run Freezing Arrow as a frost/fire hybrid so cold immunes die to fire.", skills: [PRE,
    ["Freezing Arrow", "20", "Main cold damage"], ["Cold Arrow", "20", "Synergy"], ["Immolation Arrow", "20", "Fire for cold immunes"], ["Exploding Arrow", "20", "Synergy"], ["Fire Arrow", "20", "Synergy"],
    ["Ice Arrow", "1", ""], ["Pierce", "9", ""], ["Valkyrie", "1+", "Optional — 17+ once +skills gear frees up points"]] },

  // ===== ASSASSIN =====
  trapsin: { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Lightning Sentry", "20", "Main damage"], ["Death Sentry", "20", "Corpse explosions; synergy"], ["Shock Web", "20", "Synergy"], ["Charged Bolt Sentry", "20", "Synergy"],
    ["Fade or Burst of Speed", "1+", "Fade for resists, BoS for speed"], ["Shadow Master", "1+", "Tank"], ["Mind Blast / Cloak of Shadows / Venom", "1", "Utility"]] },
  mosaic: { src: "iv", stats: STAT_TEXT.shield, skills: [PRE,
    ["Phoenix Strike", "20", "Main damage"], ["Claws of Thunder", "20", "Charge-up"], ["Blades of Ice", "20", "Charge-up; synergy"], ["Fists of Fire", "20", "Charge-up; synergy"],
    ["Dragon Talon", "rest", "Finisher"], ["Cloak of Shadows / Mind Blast / Burst of Speed / Fade / Venom", "1", "Required utility"], ["Weapon Block", "1", "Only with two claws"]] },
  kicksin: { src: "iv", stats: { ...STAT_TEXT.shield, dex: "Enough for gear; 150+ total for max block with Stormshield" }, skills: [PRE,
    ["Dragon Talon", "20", "Main single target"], ["Venom", "20", "Big damage boost"], ["Death Sentry", "20", "Optional — pack clear via corpses"],
    ["Dragon Flight / Cloak of Shadows / Mind Blast / Burst of Speed / Fade", "1", "Utility"], ["Shadow Warrior or Shadow Master", "1+", ""], ["Lightning Sentry", "20", "Optional alternative damage"]] },
  "wof-sin": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Wake of Fire", "20", "Main damage"], ["Fire Blast", "20", "Synergy"], ["Wake of Inferno", "20", "Synergy"], ["Death Sentry", "20", "Corpse explosions"],
    ["Lightning Sentry", "1+", "For fire immunes"], ["Fade or Burst of Speed", "1+", ""], ["Shadow Master / Mind Blast / Cloak of Shadows", "1", "Utility"]] },
  bladefury: { src: "iv", stats: { ...STAT_TEXT.shield, dex: "About 150 (enough for gear)" }, skills: [PRE,
    ["Blade Fury", "20", "Main damage"], ["Blade Sentinel", "20", "Synergy"], ["Blade Shield", "20", "Synergy"], ["Venom", "20", "Overall damage"], ["Death Sentry", "20", "Area damage / corpses"],
    ["Mind Blast / Cloak of Shadows", "1", "Crowd control"], ["Fade", "1+", "Resists"]] },

  // ===== BARBARIAN =====
  "berserk-barb": { src: "iv", stats: STAT_TEXT.melee, skills: [PRE,
    ["Berserk", "20", "Main skill"], ["Weapon Mastery (Blade Mastery)", "20", ""], ["Battle Orders", "20", "Life and mana"], ["Find Potion", "20", "Berserk synergy"], ["Find Item", "15+", "Berserk synergy"],
    ["Increased Speed / Natural Resistance / Battle Command", "1", ""], ["Howl", "1+", ""]] },
  "ww-barb": { src: "iv", stats: STAT_TEXT.melee, skills: [PRE,
    ["Whirlwind", "20", "Main skill"], ["Weapon Mastery (Blade Mastery)", "20", ""], ["Battle Orders", "20", ""], ["Shout", "rest", "Defense for you and your party"],
    ["Leap Attack / Increased Speed / Natural Resistance / Battle Command", "1", ""], ["Taunt / Battle Cry / Find Item", "1", "Optional"]] },
  "throw-barb": { src: "iv", stats: STAT_TEXT.melee, skills: [PRE,
    ["Double Throw", "20", "Main damage"], ["Double Swing", "20", "Synergy"], ["Throwing Mastery", "20", ""], ["Battle Orders", "20", ""],
    ["Leap / Increased Speed / Natural Resistance / Battle Command", "1", ""], ["Howl", "1+", ""], ["Taunt / Battle Cry / Berserk / Frenzy", "1", "Optional"]] },
  "frenzy-barb": { src: "iv", stats: STAT_TEXT.melee, skills: [PRE,
    ["Frenzy", "20", "Main damage"], ["Double Swing", "20", "Synergy"], ["Weapon Mastery", "20", ""], ["Battle Orders", "20", ""], ["Shout", "1+", ""],
    ["Increased Speed / Natural Resistance / Battle Command", "1", ""], ["Leap / Taunt / Battle Cry / Find Item", "1", "Optional"]] },
  "singer-barb": { src: "iv", stats: { ...STAT_TEXT.shield, str: "Enough for gear" }, skills: [PRE,
    ["War Cry", "20", "Main damage and stun"], ["Battle Orders", "20", ""], ["Battle Cry", "20", "Lowers enemy defense/damage"], ["Taunt", "20", "War Cry synergy"], ["Howl", "1+", "War Cry synergy"],
    ["Battle Command / Increased Speed / Leap", "1", ""], ["Natural Resistance", "1+", ""], ["Concentrate", "1", "Optional"]] },

  // ===== DRUID =====
  "wind-druid": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Tornado", "20", "Main damage (physical)"], ["Hurricane", "20", "Cold aura damage; synergy"], ["Twister", "20", "Synergy"], ["Cyclone Armor", "20", "Absorb; synergy"],
    ["Oak Sage", "rest", "Life"], ["Raven / Summon Grizzly", "1", "Distraction / tank"]] },
  "fire-druid": { src: "iv", stats: STAT_TEXT.shield, skills: [PRE,
    ["Fissure", "20", "Main damage"], ["Firestorm", "20", "Early damage; synergy"], ["Volcano", "20", "Synergy; physical for fire immunes"], ["Oak Sage", "20", "Life"],
    ["Summon Grizzly", "1+", "Max in Hell for immunes"], ["Cyclone Armor", "1+", ""]] },
  "summon-druid": { src: "iv", stats: STAT_TEXT.shield, skills: [PRE,
    ["Summon Grizzly", "20", ""], ["Summon Dire Wolf", "20", "Main damage"], ["Summon Spirit Wolf", "20", ""], ["Oak Sage or Heart of Wolverine", "20", "Life vs damage"],
    ["Raven", "rest", "Optional"], ["Werebear / Lycanthropy / Shock Wave", "1", "Optional"]] },
  "fury-druid": { src: "iv", stats: STAT_TEXT.melee, skills: [PRE,
    ["Werewolf", "20", ""], ["Lycanthropy", "20", "Life and duration"], ["Fury", "20", "Main damage"], ["Feral Rage", "1+", "Life steal"], ["Oak Sage", "20", "Life"],
    ["Heart of Wolverine / Summon Grizzly", "1+", "Optional"]] },
  werebear: { src: "std", stats: STAT_TEXT.melee, skills: [PRE,
    ["Werebear", "20", ""], ["Lycanthropy", "20", ""], ["Shock Wave", "20", "Stun / main skill"], ["Maul", "20", "Synergy"], ["Oak Sage", "rest", "Life"], ["Summon Grizzly", "1+", "Optional tank"]] },

  // ===== NECROMANCER =====
  "pnova-necro": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Poison Nova", "20", "Main damage"], ["Poison Explosion", "20", "Synergy"], ["Poison Dagger", "20", "Synergy"], ["Lower Resist", "rest", "Key curse for poison"],
    ["Corpse Explosion / Amplify Damage / Decrepify", "1", ""], ["Bone Armor / Clay Golem", "1", ""]] },
  "summon-necro": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Raise Skeleton", "20", "Main damage"], ["Skeleton Mastery", "20", ""], ["Raise Skeletal Mage", "20", ""], ["Corpse Explosion", "20", "Pack clear"],
    ["Summon Resist", "1+", ""], ["Amplify Damage / Decrepify / Clay Golem / Golem Mastery / Revive", "1", ""]] },
  "bone-necro": { src: "iv", stats: STAT_TEXT.shield, note: "Bone Spear for lined-up groups, Bone Spirit for single targets — both maxed.", skills: [PRE,
    ["Bone Spear", "20", "Main for groups"], ["Bone Spirit", "20", "Main single target"], ["Bone Prison", "20", "Synergy"], ["Bone Wall", "20", "Synergy"], ["Teeth", "20", "Synergy"],
    ["Corpse Explosion", "1+", ""], ["Bone Armor / Amplify Damage", "1", ""], ["Decrepify / Clay Golem / Golem Mastery / Summon Resist", "1", "Optional"]] },
  "bonespirit-necro": { src: "iv", stats: STAT_TEXT.shield, note: "Same points as Bone Spear — lead with Bone Spirit.", skills: [PRE,
    ["Bone Spirit", "20", "Main single target"], ["Bone Spear", "20", "Groups"], ["Bone Prison", "20", "Synergy"], ["Bone Wall", "20", "Synergy"], ["Teeth", "20", "Synergy"],
    ["Corpse Explosion", "1+", ""], ["Bone Armor / Amplify Damage", "1", ""]] },
  "curse-necro": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Corpse Explosion", "20", "Main damage"], ["Bone Spear", "20", "First kills to make corpses"], ["Bone Spirit", "20", ""], ["Amplify Damage", "1+", "Key curse"], ["Decrepify", "1+", ""],
    ["Bone Wall / Bone Prison", "rest", "Synergy"], ["Bone Armor / Clay Golem / Raise Skeleton", "1", ""]] },

  // ===== PALADIN =====
  hammerdin: { src: "std", stats: STAT_TEXT.paladin, skills: [PRE,
    ["Blessed Hammer", "20", "Main damage"], ["Concentration", "20", "Aura"], ["Blessed Aim", "20", "Synergy"], ["Vigor", "20", "Synergy"],
    ["Holy Shield", "1+", "Block and defense"], ["Redemption / Charge", "1", ""], ["Salvation / resist auras", "rest", "Optional"]] },
  fohdin: { src: "iv", stats: STAT_TEXT.paladin, skills: [PRE,
    ["Fist of the Heavens", "20", "Main skill"], ["Holy Bolt", "20", "Synergy"], ["Conviction", "20", "Aura"], ["Holy Shock", "20", "Synergy"],
    ["Holy Shield", "1", "Max block"], ["Salvation", "1", "Optional"], ["Resist Fire / Cold / Lightning", "rest", "Every 2 points = +1% max resist"]] },
  smiter: { src: "iv", stats: STAT_TEXT.paladin, skills: [PRE,
    ["Smite", "20", "Main skill"], ["Holy Shield", "20", "Synergy and defense"], ["Fanaticism", "20", "Aura"],
    ["Resist Fire / Cold / Lightning", "rest", "Every 2 points = +1% max resist"]] },
  zealot: { src: "iv", stats: STAT_TEXT.paladin, skills: [PRE,
    ["Zeal", "20", "Main damage"], ["Sacrifice", "20", "Zeal synergy"], ["Holy Shield", "20", "Block and defense"], ["Fanaticism", "20", "Aura"],
    ["Salvation", "1", "Optional"], ["Resist auras", "rest", "Optional"]] },
  dreamadin: { src: "std", stats: STAT_TEXT.paladin, note: "Dream gives the Holy Shock aura; your points boost it through Resist Lightning while you run Conviction.", skills: [PRE,
    ["Zeal", "20", "Attack"], ["Sacrifice", "20", "Zeal synergy"], ["Conviction", "20", "Aura"], ["Resist Lightning", "20", "Holy Shock synergy"], ["Holy Shield", "rest", "Block"]] },

  // ===== SORCERESS =====
  "blizz-sorc": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Blizzard", "20", "Main damage"], ["Ice Blast", "20", "Synergy / single target"], ["Glacial Spike", "20", "Synergy / freeze"], ["Ice Bolt", "20", "Synergy"],
    ["Cold Mastery", "rest", "Lowers enemy cold resist (~17)"], ["Teleport / Static Field / Frozen Armor / Warmth", "1", ""]] },
  "light-sorc": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Chain Lightning", "20", "Main damage"], ["Lightning", "20", "Synergy / single target"], ["Lightning Mastery", "20", ""], ["Charged Bolt", "20", "Synergy"],
    ["Static Field", "rest", "Bosses"], ["Teleport / Frozen Armor / Warmth / Energy Shield", "1", ""]] },
  "nova-sorc": { src: "iv", stats: { ...STAT_TEXT.shield, enr: "None — unless you run Energy Shield, then all of it" }, skills: [PRE,
    ["Nova", "20", "Main damage"], ["Lightning Mastery", "20", ""], ["Static Field", "20", ""], ["Telekinesis", "20", "Synergy"],
    ["Energy Shield", "20", "Only for ES builds"], ["Thunder Storm", "1+", "Optional"], ["Teleport / Warmth / Frozen Armor", "1", ""]] },
  "fire-sorc": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Fireball", "20", "Main damage"], ["Meteor", "20", "Synergy / burst"], ["Fire Bolt", "20", "Synergy"], ["Fire Mastery", "20", ""],
    ["Teleport / Static Field / Warmth / Frozen Armor", "1", ""], ["Energy Shield", "1", "Optional"]] },
  "orb-sorc": { src: "std", stats: STAT_TEXT.shield, skills: [PRE,
    ["Frozen Orb", "20", "Cold damage"], ["Hydra", "20", "Fire damage"], ["Ice Bolt", "20", "Frozen Orb synergy"], ["Fire Bolt", "20", "Hydra synergy"],
    ["Cold Mastery / Fire Mastery", "rest", "Split leftover points"], ["Teleport / Static Field / Warmth", "1", ""]] },

  // ===== WARLOCK =====
  "echo-lock": { src: "iv", stats: STAT_TEXT.warlock, skills: [PRE,
    ["Echoing Strike", "20", "Main damage (scales with FCR)"], ["Mirrored Blades", "20", "Synergy / single target"], ["Blade Warp", "20", "Synergy"], ["Bind Demon", "15", ""],
    ["Levitation Mastery", "rest", "Lowers requirements"], ["Sigil: Lethargy / Psychic Ward / Consume / Hex: Bane", "1", ""]] },
  "chaos-lock": { src: "iv", stats: STAT_TEXT.warlock, skills: [PRE,
    ["Ring of Fire", "20", "Main skill"], ["Flame Wave", "20", "Main skill"], ["Apocalypse", "20", "Main skill"], ["Consume", "20", ""], ["Bind Demon", "15", ""],
    ["Demonic Mastery", "5-10", "10 with 1 point in Tainted, or 5 with Tainted maxed"], ["Summon Tainted", "1", "Or 20 with Demonic Mastery at 5"], ["Sigil: Death / Sigil: Lethargy", "1", ""]] },
  "abyss-lock": { src: "iv", stats: STAT_TEXT.warlock, skills: [PRE,
    ["Miasma Chain", "20", "Main skill"], ["Miasma Bolt", "20", "Synergy"], ["Abyss", "20", "Big packs"], ["Consume", "20", ""], ["Demonic Mastery", "10", "Up to 3 demons"],
    ["Enhanced Entropy", "rest", "Passive — +skills cover most of it"], ["Summon Defiler / Levitation Mastery", "1", ""]] },
  "blades-lock": { src: "std", stats: STAT_TEXT.warlock, note: "Warlock is new — this mirrors the Eldritch allocation guides use; check a current guide for changes.", skills: [PRE,
    ["Mirrored Blades", "20", "Main single target"], ["Echoing Strike", "20", "Synergy and packs"], ["Blade Warp", "20", "Synergy"], ["Hex: Bane", "1+", ""],
    ["Levitation Mastery", "rest", ""], ["Psychic Ward / Bind Demon / Consume", "1", ""]] },
  "demon-lock": { src: "iv", stats: STAT_TEXT.warlock, skills: [PRE,
    ["Summon Goatman", "20", "Army"], ["Bind Demon", "20", ""], ["Demonic Mastery", "20", ""], ["Blood Oath", "20", ""],
    ["Death Mark", "rest", ""], ["Sigil: Lethargy / Sigil: Death / Engorge", "1", ""], ["Blood Boil", "rest", "Optional"]] },
};

// Leveling skill orders (src "lvl"): what to put points into as you level, before respeccing.
// Points are roughly where the skill should be by level 60–75.
const LVL_STATS = {
  caster: { str: "About 50–75 for early gear (Spirit needs 95 later)", dex: "Base", vit: "Everything else", enr: "None — mana comes from Insight on your merc and potions" },
  melee: { str: "Enough for your weapon and armor", dex: "Enough for your weapon", vit: "Everything else", enr: "None" },
  bow: { str: "Enough for gear", dex: "About 2 of every 5 points until your bow's needs are met", vit: "Everything else", enr: "None" },
};
const LV_PLAN = (stats, note, skills) => ({ src: "lvl", stats, note, skills: [PRE, ...skills] });
Object.assign(SKILL_PLANS, {
  // ===== AMAZON =====
  "lvl-fury-zon": LV_PLAN(LVL_STATS.melee, "Javelins only — no arrows to carry.", [
    ["Jab", "1", "Lvl 1"], ["Power Strike", "5-10", "Lvl 6 — main attack until 30"], ["Charged Strike", "10", "Lvl 24 — bosses"],
    ["Lightning Fury", "20", "Lvl 30 — main attack"], ["Lightning Bolt", "rest", "Synergy"], ["Dodge / Avoid / Evade", "1", "Defense"]]),
  "lvl-poison-zon": LV_PLAN(LVL_STATS.melee, "", [
    ["Poison Javelin", "5-10", "Lvl 6 — main attack early"], ["Plague Javelin", "20", "Lvl 18 — packs"],
    ["Lightning Fury", "10", "Lvl 30 — poison immunes"], ["Dodge / Avoid / Evade", "1", "Defense"], ["Valkyrie", "1+", "Lvl 30 — tank"]]),
  "lvl-mshot-zon": LV_PLAN(LVL_STATS.bow, "Magic Arrow needs no arrows; carry a stack for the others.", [
    ["Magic Arrow", "1", "Lvl 1 — free arrows"], ["Multiple Shot", "20", "Lvl 6 — packs"], ["Guided Arrow", "5-10", "Lvl 18 — bosses"],
    ["Strafe", "rest", "Lvl 24"], ["Critical Strike / Penetrate / Pierce", "1+", "Passives"], ["Valkyrie", "1+", "Lvl 30 — tank"]]),
  "lvl-fire-zon": LV_PLAN(LVL_STATS.bow, "", [
    ["Fire Arrow", "1", "Lvl 1"], ["Exploding Arrow", "10", "Lvl 12 — packs"], ["Immolation Arrow", "20", "Lvl 24 — main"],
    ["Fire Arrow", "rest", "Synergy"], ["Decoy / Valkyrie", "1+", "Tanks"]]),
  "lvl-freeze-zon": LV_PLAN(LVL_STATS.bow, "", [
    ["Cold Arrow", "10", "Lvl 6 — main early"], ["Ice Arrow", "5", "Lvl 18 — freeze"], ["Freezing Arrow", "20", "Lvl 30 — packs"],
    ["Cold Arrow", "rest", "Synergy"], ["Valkyrie", "1+", "Tank"]]),
  // ===== ASSASSIN =====
  "lvl-trap-sin": LV_PLAN(LVL_STATS.caster, "", [
    ["Fire Blast", "10-15", "Lvl 1 — main attack early"], ["Lightning Sentry", "20", "Lvl 24 — main"], ["Death Sentry", "10", "Lvl 30 — corpse explosions"],
    ["Shock Web / Charged Bolt Sentry", "rest", "Synergies"], ["Burst of Speed / Fade", "1", "Speed and resists"]]),
  "lvl-wof-sin": LV_PLAN(LVL_STATS.caster, "", [
    ["Fire Blast", "10-15", "Lvl 1 — main early"], ["Wake of Fire", "20", "Lvl 12 — packs"], ["Lightning Sentry", "10", "Lvl 24 — fire immunes"],
    ["Death Sentry", "5", "Lvl 30"], ["Burst of Speed / Fade", "1", ""]]),
  "lvl-kick-sin": LV_PLAN(LVL_STATS.melee, "Kick damage comes from your boots.", [
    ["Fire Blast", "1-5", "Lvl 1 — ranged help early"], ["Dragon Talon", "20", "Lvl 1 — main"], ["Dragon Flight", "1", "Lvl 24 — teleport-kick"],
    ["Death Sentry", "5-10", "Lvl 30 — packs"], ["Fade / Burst of Speed / Venom", "1+", ""]]),
  "lvl-bf-sin": LV_PLAN(LVL_STATS.caster, "", [
    ["Blade Sentinel", "5", "Lvl 6"], ["Blade Fury", "20", "Lvl 24 — main"], ["Blade Shield / Blade Sentinel", "rest", "Synergies"],
    ["Fade / Burst of Speed / Shadow Warrior", "1+", ""]]),
  "lvl-ma-sin": LV_PLAN(LVL_STATS.melee, "Charge with Tiger Strike, release with Dragon Claw.", [
    ["Tiger Strike", "5-10", "Lvl 1 — charge damage"], ["Dragon Claw", "10", "Lvl 6 — finisher"], ["Fists of Fire / Claws of Thunder", "5", "Elemental charges"],
    ["Phoenix Strike", "10-20", "Lvl 30 — immunes"], ["Burst of Speed / Fade / Venom", "1+", ""]]),
  // ===== BARBARIAN =====
  "lvl-frenzy-barb": LV_PLAN(LVL_STATS.melee, "Wield two one-handed weapons.", [
    ["Double Swing", "5-10", "Lvl 6 — main early"], ["Frenzy", "20", "Lvl 24 — main"], ["Sword / Axe Mastery", "rest", "Your weapon type"],
    ["Battle Orders / Shout / Battle Command", "1+", "Lvl 24–30 — survival"], ["Increased Speed", "1", "Run speed"]]),
  "lvl-ww-barb": LV_PLAN(LVL_STATS.melee, "", [
    ["Bash / Double Swing", "5", "Early attack"], ["Whirlwind", "20", "Lvl 30 — main"], ["Weapon mastery", "rest", "Your weapon type"],
    ["Battle Orders / Shout / Battle Command", "1+", ""], ["Increased Speed", "1", ""]]),
  "lvl-berserk-barb": LV_PLAN(LVL_STATS.melee, "", [
    ["Bash", "10", "Lvl 1 — main early"], ["Berserk", "20", "Lvl 30 — magic damage"], ["Howl / Shout / Battle Orders", "1+", ""],
    ["Weapon mastery", "rest", "Your weapon type"], ["Natural Resistance", "1+", ""]]),
  "lvl-leap-barb": LV_PLAN(LVL_STATS.melee, "", [
    ["Bash", "5", "Lvl 1"], ["Leap Attack", "20", "Lvl 18 — main"], ["Leap", "rest", "Synergy"], ["Weapon mastery", "5+", ""],
    ["Battle Orders / Shout", "1+", ""]]),
  "lvl-throw-barb": LV_PLAN(LVL_STATS.melee, "Carry spare stacks of javelins or throwing axes.", [
    ["Double Swing", "1", "Prereq"], ["Double Throw", "20", "Lvl 24 — main"], ["Throwing Mastery", "rest", ""],
    ["Battle Orders / Shout", "1+", ""], ["Increased Speed", "1", ""]]),
  // ===== DRUID =====
  "lvl-fire-druid": LV_PLAN(LVL_STATS.caster, "", [
    ["Firestorm", "5", "Lvl 1"], ["Fissure", "20", "Lvl 12 — main"], ["Volcano", "10", "Lvl 24 — bosses"], ["Molten Boulder", "rest", "Synergy"],
    ["Raven / Spirit Wolf / Grizzly", "1+", "Tanks"], ["Oak Sage", "1", "Life"]]),
  "lvl-wind-druid": LV_PLAN(LVL_STATS.caster, "", [
    ["Arctic Blast", "5-10", "Lvl 6 — main early"], ["Twister", "5", "Lvl 18 — stun"], ["Tornado", "20", "Lvl 24 — main"], ["Hurricane", "rest", "Lvl 30"],
    ["Raven / Spirit Wolf", "1+", "Tanks"], ["Oak Sage", "1", ""]]),
  "lvl-summon-druid": LV_PLAN(LVL_STATS.caster, "Your pets do the work.", [
    ["Raven", "1-5", "Lvl 1"], ["Summon Spirit Wolf", "10", "Lvl 6"], ["Summon Dire Wolf", "20", "Lvl 18 — main"], ["Summon Grizzly", "1+", "Lvl 30"],
    ["Heart of the Wolverine / Oak Sage", "rest", "Spirit buffs"]]),
  "lvl-wolf-druid": LV_PLAN(LVL_STATS.melee, "", [
    ["Werewolf", "1+", "Lvl 1"], ["Lycanthropy", "5-10", "Life and duration"], ["Feral Rage", "5-10", "Lvl 12 — speed and leech"], ["Fury", "20", "Lvl 24 — main"],
    ["Oak Sage / Heart of the Wolverine", "1+", ""]]),
  "lvl-bear-druid": LV_PLAN(LVL_STATS.melee, "", [
    ["Werebear", "1+", "Lvl 6"], ["Maul", "5-10", "Lvl 12 — main early"], ["Shock Wave", "20", "Lvl 24 — stun packs"], ["Lycanthropy", "rest", ""],
    ["Oak Sage / Heart of the Wolverine", "1+", ""]]),
  // ===== NECROMANCER =====
  "lvl-summon-necro": LV_PLAN(LVL_STATS.caster, "Raise skeletons from every corpse.", [
    ["Raise Skeleton", "20", "Lvl 1 — main"], ["Skeleton Mastery", "rest", "Lvl 1"], ["Amplify Damage", "1", "Lvl 1"], ["Clay Golem", "1+", "Lvl 6 — slows monsters"],
    ["Corpse Explosion", "5", "Lvl 6 — packs"], ["Summon Resist / Raise Skeletal Mage", "1+", ""]]),
  "lvl-bone-necro": LV_PLAN(LVL_STATS.caster, "", [
    ["Teeth", "5-10", "Lvl 1 — main early"], ["Bone Spear", "20", "Lvl 18 — main"], ["Bone Wall / Bone Prison", "rest", "Synergies"],
    ["Amplify Damage", "1", ""], ["Clay Golem", "1", "Tank"]]),
  "lvl-poison-necro": LV_PLAN(LVL_STATS.caster, "", [
    ["Poison Dagger", "5", "Lvl 1 — early"], ["Poison Explosion", "5-10", "Lvl 12"], ["Poison Nova", "20", "Lvl 30 — main"], ["Lower Resist", "1+", "Lvl 30"],
    ["Raise Skeleton / Clay Golem", "1+", "Tanks"]]),
  "lvl-ce-necro": LV_PLAN(LVL_STATS.caster, "", [
    ["Teeth", "5", "Lvl 1 — first kills"], ["Amplify Damage", "1+", "Lvl 1"], ["Corpse Explosion", "20", "Lvl 6 — main"], ["Raise Skeleton", "5", "Make corpses"],
    ["Clay Golem / Iron Maiden", "1+", ""]]),
  "lvl-fishy-necro": LV_PLAN(LVL_STATS.melee, "You fight in melee next to your golem.", [
    ["Clay Golem / Blood Golem / Iron Golem", "1+", "Golem line"], ["Golem Mastery", "10", ""], ["Raise Skeleton", "10", ""], ["Amplify Damage", "1+", ""],
    ["Skeleton Mastery", "rest", ""]]),
  // ===== PALADIN =====
  "lvl-hammer-pal": LV_PLAN(LVL_STATS.caster, "", [
    ["Holy Bolt / Zeal", "1-5", "Early attack"], ["Blessed Hammer", "20", "Lvl 18 — main"], ["Concentration", "20", "Lvl 18 — aura"],
    ["Blessed Aim / Vigor", "rest", "Synergies"], ["Holy Shield", "1", "Lvl 24"]]),
  "lvl-zeal-pal": LV_PLAN(LVL_STATS.melee, "", [
    ["Sacrifice", "5", "Lvl 6"], ["Zeal", "20", "Lvl 12 — main"], ["Might", "5", "Aura early"], ["Fanaticism", "20", "Lvl 30 — aura"],
    ["Holy Shield", "1+", "Lvl 24"]]),
  "lvl-venge-pal": LV_PLAN(LVL_STATS.melee, "", [
    ["Sacrifice / Zeal", "1-5", "Early"], ["Vengeance", "20", "Lvl 18 — main"], ["Conviction", "10-20", "Lvl 24 — aura"],
    ["Resist Fire / Cold / Lightning", "rest", "Synergies"], ["Holy Shield", "1", ""]]),
  "lvl-holyfire-pal": LV_PLAN(LVL_STATS.melee, "", [
    ["Zeal", "10", "Lvl 12 — attack"], ["Holy Fire", "20", "Lvl 6 — aura does the damage"], ["Resist Fire", "rest", "Synergy"], ["Salvation", "1", ""]]),
  "lvl-foh-pal": LV_PLAN(LVL_STATS.caster, "", [
    ["Holy Bolt", "20", "Lvl 6 — main early"], ["Fist of the Heavens", "20", "Lvl 30 — main"], ["Conviction", "10-20", "Lvl 30 — aura"],
    ["Holy Shock", "rest", "Synergy"], ["Holy Shield", "1", ""]]),
  // ===== SORCERESS =====
  "lvl-blizz-sorc": LV_PLAN(LVL_STATS.caster, "", [
    ["Frost Nova", "5", "Lvl 6 — early"], ["Ice Blast", "10", "Lvl 12"], ["Blizzard", "20", "Lvl 24 — main"], ["Static Field", "5", "Lvl 6 — bosses"],
    ["Teleport / Frozen Armor / Warmth", "1", ""], ["Cold Mastery", "1+", "Lvl 30"]]),
  "lvl-fire-sorc": LV_PLAN(LVL_STATS.caster, "", [
    ["Fire Bolt", "5", "Lvl 1"], ["Fireball", "20", "Lvl 12 — main"], ["Meteor", "10-20", "Lvl 24"], ["Fire Mastery", "1+", "Lvl 30"],
    ["Static Field / Teleport / Warmth", "1+", ""]]),
  "lvl-light-sorc": LV_PLAN(LVL_STATS.caster, "", [
    ["Charged Bolt", "10", "Lvl 1 — main early"], ["Nova", "10", "Lvl 12"], ["Chain Lightning", "20", "Lvl 18 — main"], ["Static Field", "5", ""],
    ["Teleport / Warmth / Frozen Armor", "1", ""], ["Lightning Mastery", "1+", "Lvl 30"]]),
  "lvl-orb-sorc": LV_PLAN(LVL_STATS.caster, "", [
    ["Ice Bolt", "1-5", "Lvl 1"], ["Ice Blast", "10", "Lvl 6 — main early"], ["Glacial Spike", "5", "Lvl 18 — freeze packs"], ["Frozen Orb", "20", "Lvl 30 — main"],
    ["Static Field / Teleport / Warmth", "1+", ""], ["Cold Mastery", "1+", ""]]),
  "lvl-firewall-sorc": LV_PLAN(LVL_STATS.caster, "", [
    ["Fire Bolt", "5", "Lvl 1"], ["Fire Wall", "20", "Lvl 18 — main"], ["Hydra", "10-20", "Lvl 30"], ["Warmth / Static Field / Teleport", "1+", ""]]),
  // ===== WARLOCK =====
  "lvl-echo-lock": LV_PLAN(STAT_TEXT.warlock, "Warlock is new — check a current guide for unlock levels.", [
    ["Mirrored Blades", "5-10", "Early attack"], ["Echoing Strike", "20", "Main once unlocked"], ["Blade Warp", "rest", "Synergy and movement"], ["Bind Demon", "1+", "Tank"]]),
  "lvl-fire-lock": LV_PLAN(STAT_TEXT.warlock, "Warlock is new — check a current guide for unlock levels.", [
    ["Ring of Fire", "10", "Early"], ["Flame Wave", "20", "Packs"], ["Apocalypse", "10-20", "Later"], ["Summon Tainted", "1+", "Tank"], ["Consume", "1+", ""]]),
  "lvl-miasma-lock": LV_PLAN(STAT_TEXT.warlock, "Warlock is new — check a current guide for unlock levels.", [
    ["Miasma Bolt", "10", "Early"], ["Miasma Chain", "20", "Packs"], ["Abyss", "5-10", "Later"], ["Summon Defiler", "1+", "Tank"], ["Consume", "1+", ""]]),
  "lvl-blades-lock": LV_PLAN(STAT_TEXT.warlock, "Warlock is new — check a current guide for unlock levels.", [
    ["Mirrored Blades", "20", "Main"], ["Blade Warp", "10", "Movement and synergy"], ["Echoing Strike", "10", "Packs"], ["Hex: Bane", "1+", ""]]),
  "lvl-demon-lock": LV_PLAN(STAT_TEXT.warlock, "Warlock is new — check a current guide for unlock levels.", [
    ["Summon Goatman", "20", "Army"], ["Bind Demon", "10", ""], ["Demonic Mastery", "10", ""], ["Death Mark / Blood Oath", "1+", "Boost the army"]]),
});
