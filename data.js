// Item database and build guides for Gear Ledger.
// Stats are summarized key affixes; ranges shown as low-high. Edit freely.
// type: unique | set | runeword | rare | charm
// slot: helm | amulet | ring | weapon | offhand | armor | gloves | belt | boots | charm
// fcr: fixed (or minimum-roll) Faster Cast Rate the item contributes
// cls: class restriction · merc: usable by Act 2 mercenary as weapon
// size: inventory cells for charms

const CLASSES = ["Amazon", "Assassin", "Barbarian", "Druid", "Necromancer", "Paladin", "Sorceress"];

const ITEMS = [
  // ---------- HELMS ----------
  { name: "Tarnhelm", type: "unique", slot: "helm", req: 15, stats: "+1 all skills, 25-50% MF, 75% extra gold" },
  { name: "Lore", type: "runeword", slot: "helm", req: 27, runes: "Ort Sol", stats: "+1 all skills, +10 energy, 30% light res, damage reduced by 7" },
  { name: "Peasant Crown", type: "unique", slot: "helm", req: 28, stats: "+1 all skills, 15% FRW, +20 vitality, +20 energy" },
  { name: "Rockstopper", type: "unique", slot: "helm", req: 31, stats: "30% FHR, 10% DR, cold/fire/light res" },
  { name: "Guillaume's Face", type: "unique", slot: "helm", req: 34, stats: "30% FHR, 15% crushing blow, 35% deadly strike, +15 str" },
  { name: "Vampire Gaze", type: "unique", slot: "helm", req: 41, stats: "6-8% life & mana leech, 15-20% DR, slows target" },
  { name: "Arreat's Face", type: "unique", slot: "helm", cls: "Barbarian", req: 42, stats: "+2 Barbarian skills, +2 Combat skills, 3-6% LL, 30% FHR, +20 str/dex" },
  { name: "Jalal's Mane", type: "unique", slot: "helm", cls: "Druid", req: 42, stats: "+2 Druid skills, +2 Shape Shifting, 30% FHR, +30 all res" },
  { name: "Harlequin Crest", alias: "Shako", type: "unique", slot: "helm", req: 62, stats: "+2 all skills, life & mana per level, +2 all attributes, 10% DR, 50% MF" },
  { name: "Dream (helm)", type: "runeword", slot: "helm", req: 65, runes: "Io Jah Pul", stats: "Lvl 15 Holy Shock aura, 20-30% FHR, +5-20 all res" },
  { name: "Tal Rasha's Horadric Crest", type: "set", slot: "helm", req: 66, stats: "+45 life, +60 mana, 10% life & mana leech, +15 all res" },
  { name: "Nightwing's Veil", type: "unique", slot: "helm", req: 67, stats: "+2 all skills, +8-15% cold skill damage, +10-20 dex, cold absorb" },
  { name: "Griffon's Eye", type: "unique", slot: "helm", req: 76, fcr: 25, stats: "+1 all skills, -15 to -20% enemy light res, +10-15% light damage, 25% FCR" },
  { name: "Kira's Guardian", type: "unique", slot: "helm", req: 77, stats: "20% FHR, +50-70 all res, cannot be frozen" },
  { name: "Crown of Ages", type: "unique", slot: "helm", req: 82, stats: "+1 all skills, 10-15% DR, +20-30 all res, 30% FHR, 1-2 sockets" },
  { name: "Andariel's Visage", type: "unique", slot: "helm", req: 83, stats: "+2 all skills, 20% IAS, 8-10% LL, +25-30 str, -30 fire res" },
  { name: "Rare caster circlet", type: "rare", slot: "helm", req: 1, fcr: 20, stats: "+2 class skills, 20% FCR, life/res, up to 2 sockets" },
  { name: "Rare druid pelt", type: "rare", slot: "helm", cls: "Druid", req: 1, stats: "+2-3 Elemental skills, +3 Tornado/Hurricane etc." },

  // ---------- AMULETS ----------
  { name: "Nokozan Relic", type: "unique", slot: "amulet", req: 10, stats: "10% FHR, +50 fire res, +3 light radius" },
  { name: "The Eye of Etlich", type: "unique", slot: "amulet", req: 15, stats: "+1 all skills, 3-7% LL, cold damage" },
  { name: "Saracen's Chance", type: "unique", slot: "amulet", req: 47, stats: "+12 all attributes, +15-25 all res" },
  { name: "Cat's Eye", type: "unique", slot: "amulet", req: 50, stats: "+30% FRW, +20% IAS, +25 dex" },
  { name: "Atma's Scarab", type: "unique", slot: "amulet", req: 60, stats: "5% chance Amplify Damage on striking, +75 poison res" },
  { name: "Highlord's Wrath", type: "unique", slot: "amulet", req: 65, stats: "+1 all skills, 20% IAS, deadly strike per level, +35 light res" },
  { name: "Seraph's Hymn", type: "unique", slot: "amulet", req: 65, stats: "+2 all skills, +1-2 Defensive Auras (Paladin), +20-50% damage vs demons/undead" },
  { name: "Tal Rasha's Adjudication", type: "set", slot: "amulet", req: 67, stats: "+2 Sorceress skills, +50 life, +42 mana, +33 light res" },
  { name: "Mara's Kaleidoscope", type: "unique", slot: "amulet", req: 67, stats: "+2 all skills, +5 all attributes, +20-30 all res" },
  { name: "Metalgrid", type: "unique", slot: "amulet", req: 81, stats: "+400-450 AR, +25-35 all res, Iron Golem charges" },
  { name: "2/20 caster amulet", type: "rare", slot: "amulet", req: 1, fcr: 20, stats: "Crafted: +2 class skills, 20% FCR, plus res/life rolls" },
  { name: "Rare amulet", type: "rare", slot: "amulet", req: 1, stats: "Rare: res, stats, life (note your rolls)" },

  // ---------- RINGS ----------
  { name: "Nagelring", type: "unique", slot: "ring", req: 7, stats: "15-30% MF, +50-75 AR, attacker takes damage 3" },
  { name: "Manald Heal", type: "unique", slot: "ring", req: 15, stats: "4-7% mana leech, replenish life, +20 life" },
  { name: "The Stone of Jordan", alias: "SoJ", type: "unique", slot: "ring", req: 29, stats: "+1 all skills, +25% max mana, +20 mana, lightning damage" },
  { name: "Dwarf Star", type: "unique", slot: "ring", req: 45, stats: "+40 life, 15% fire absorb, 100% extra gold, magic damage reduced" },
  { name: "Raven Frost", type: "unique", slot: "ring", req: 45, stats: "+150-250 AR, +15-20 dex, +40 mana, cannot be frozen, 20% cold absorb" },
  { name: "Bul-Kathos' Wedding Band", alias: "BK", type: "unique", slot: "ring", req: 58, stats: "+1 all skills, 3-5% LL, life per level" },
  { name: "Wisp Projector", type: "unique", slot: "ring", req: 76, stats: "10-20% light absorb, 10-20% MF, Spirit of Barbs charges" },
  { name: "Rare/Crafted FCR ring", type: "rare", slot: "ring", req: 1, fcr: 10, stats: "10% FCR plus res, stats, life or mana" },
  { name: "Rare melee ring", type: "rare", slot: "ring", req: 1, stats: "LL, AR, stats, damage (note your rolls)" },

  // ---------- WEAPONS ----------
  { name: "Steel", type: "runeword", slot: "weapon", req: 13, runes: "Tir El", stats: "+20% ED, 25% IAS, 50% open wounds" },
  { name: "Spirit (sword)", type: "runeword", slot: "weapon", req: 25, fcr: 25, runes: "Tal Thul Ort Amn", stats: "+2 all skills, 25-35% FCR, 55% FHR, +89-112 mana, +22 vit" },
  { name: "Insight", type: "runeword", slot: "weapon", merc: true, req: 27, runes: "Ral Tir Tal Sol", stats: "Lvl 12-17 Meditation aura, +1-6 Critical Strike, 23% MF, +200-260% ED" },
  { name: "White", type: "runeword", slot: "weapon", cls: "Necromancer", req: 35, fcr: 20, runes: "Dol Io", stats: "+3 Poison & Bone, +3 Bone Spear, +2 Bone Armor, 20% FCR" },
  { name: "Arm of King Leoric", type: "unique", slot: "weapon", cls: "Necromancer", req: 36, stats: "+2 Summoning skills, +2 Raise Skeleton/Mage, +3 Bone Prison" },
  { name: "Memory", type: "runeword", slot: "weapon", cls: "Sorceress", req: 37, fcr: 33, runes: "Lum Io Sol Eth", stats: "+3 Sorceress skills, 33% FCR, +3 Energy Shield, +2 Static Field" },
  { name: "The Oculus", type: "unique", slot: "weapon", cls: "Sorceress", req: 42, fcr: 30, stats: "+3 Sorceress skills, 30% FCR, +20 all res, teleport when struck" },
  { name: "Titan's Revenge", type: "unique", slot: "weapon", cls: "Amazon", req: 42, stats: "+2 Amazon skills, +2 Javelin & Spear, 5-9% LL, 30% FRW, replenishes" },
  { name: "Buriza-Do Kyanon", type: "unique", slot: "weapon", req: 41, stats: "Crossbow: 100% pierce, 80% IAS, cold damage" },
  { name: "Lawbringer", type: "runeword", slot: "weapon", req: 43, runes: "Amn Lem Ko", stats: "Lvl 16-18 Sanctuary aura, decrepify on hit, -50% target def" },
  { name: "Kingslayer", type: "runeword", slot: "weapon", req: 53, runes: "Mal Um Gul Fal", stats: "30% IAS, +230-270% ED, 33% CB, -25% target def" },
  { name: "Heart of the Oak", alias: "HotO", type: "runeword", slot: "weapon", req: 55, fcr: 40, runes: "Ko Vex Pul Thul", stats: "+3 all skills, 40% FCR, +30-40 all res, +10 dex" },
  { name: "Call to Arms", alias: "CtA", type: "runeword", slot: "weapon", req: 57, runes: "Amn Ral Mal Ist Ohm", stats: "+1 all skills, +2-6 Battle Orders, +1-6 Battle Command, +1-4 Battle Cry" },
  { name: "Grief", type: "runeword", slot: "weapon", req: 59, runes: "Eth Tir Lo Mal Ral", stats: "+340-400 damage, 30-40% IAS, ignore target def, -25% target def" },
  { name: "Death's Fathom", type: "unique", slot: "weapon", cls: "Sorceress", req: 73, fcr: 20, stats: "+3 Cold skills, 20% FCR, +15-30% cold skill damage" },
  { name: "Eschuta's Temper", type: "unique", slot: "weapon", cls: "Sorceress", req: 72, fcr: 40, stats: "+1-3 Sorceress skills, 40% FCR, +10-20% fire & light damage" },
  { name: "Tal Rasha's Lidless Eye", type: "set", slot: "weapon", cls: "Sorceress", req: 65, fcr: 20, stats: "+1-2 Fire/Cold/Light Mastery, 20% FCR, +57 life & mana" },
  { name: "Wizardspike", type: "unique", slot: "weapon", req: 61, fcr: 50, stats: "50% FCR, +75 all res, mana regen" },
  { name: "Beast", type: "runeword", slot: "weapon", req: 63, runes: "Ber Tir Um Mal Lum", stats: "Lvl 9 Fanaticism aura, +240-270% ED, 40% IAS, 20% CB" },
  { name: "Infinity", type: "runeword", slot: "weapon", merc: true, req: 63, runes: "Ber Mal Ber Ist", stats: "Lvl 12 Conviction aura, +255-325% ED, 35% FRW, Cyclone Armor charges" },
  { name: "Last Wish", type: "runeword", slot: "weapon", req: 65, runes: "Jah Mal Jah Sur Jah Ber", stats: "Lvl 17 Might aura, +330-375% ED, 60-70% CB, Life Tap on striking" },
  { name: "Faith", type: "runeword", slot: "weapon", req: 65, runes: "Ohm Jah Lem Eld", stats: "Bow: Lvl 12-15 Fanaticism aura, +1-2 all skills, +280-300% ED" },
  { name: "Pride", type: "runeword", slot: "weapon", merc: true, req: 66, runes: "Cham Sur Io Lo", stats: "Lvl 16-20 Concentration aura, +X lightning damage per level" },
  { name: "Doom", type: "runeword", slot: "weapon", merc: true, req: 67, runes: "Hel Ohm Um Lo Cham", stats: "Lvl 12 Holy Freeze aura, +2 all skills, -40-60% enemy cold res" },
  { name: "Hand of Justice", type: "runeword", slot: "weapon", req: 67, runes: "Sur Cham Amn Lo", stats: "Lvl 16 Holy Fire aura, 33% IAS, -20% enemy fire res" },
  { name: "Breath of the Dying", alias: "BotD", type: "runeword", slot: "weapon", merc: true, req: 69, runes: "Vex Hel El Eld Zod Eth", stats: "+350-400% ED, 60% IAS, 12-15% LL, +30 all attributes" },
  { name: "Thunderstroke", type: "unique", slot: "weapon", cls: "Amazon", req: 69, stats: "+2-4 Javelin & Spear, 15% IAS, -15% enemy light res" },
  { name: "Death Cleaver", type: "unique", slot: "weapon", req: 70, stats: "40% IAS, 66% deadly strike, life after each kill" },
  { name: "Windforce", type: "unique", slot: "weapon", cls: "Amazon", req: 73, stats: "Bow: +250% ED, 20% IAS, 6-8% mana leech, knockback" },
  { name: "Obedience", type: "runeword", slot: "weapon", merc: true, req: 41, runes: "Hel Ko Thul Eth Fal", stats: "Polearm: 40% FHR, 40% CB, -25% enemy fire res, +370% ED" },
  { name: "The Reaper's Toll", type: "unique", slot: "weapon", merc: true, req: 75, stats: "Decrepify on hit, 11-15% LL, ignore target def" },
  { name: "Rare trap claw", type: "rare", slot: "weapon", cls: "Assassin", req: 1, fcr: 20, stats: "+3 Traps, +3 Lightning Sentry/Death Sentry, 20% FCR" },
  { name: "Magic caster weapon", type: "rare", slot: "weapon", req: 1, stats: "+2-3 to a class skill tree (wand, orb, staff, scepter)" },

  // ---------- OFF-HAND / SHIELDS ----------
  { name: "Ancient's Pledge", type: "runeword", slot: "offhand", req: 21, runes: "Ral Ort Tal", stats: "+50% ED, +43-48 all res, 10% damage to mana" },
  { name: "Rhyme", type: "runeword", slot: "offhand", req: 29, runes: "Shael Eth", stats: "+25 all res, 25% MF, cannot be frozen, 20% faster block" },
  { name: "Spirit (shield)", type: "runeword", slot: "offhand", req: 25, fcr: 25, runes: "Tal Thul Ort Amn", stats: "+2 all skills, 25-35% FCR, 55% FHR, cold/light res" },
  { name: "Splendor", type: "runeword", slot: "offhand", req: 37, fcr: 10, runes: "Eth Lum", stats: "+1 all skills, 10% FCR, 20% faster block, 20-50% MF" },
  { name: "Lidless Wall", type: "unique", slot: "offhand", req: 41, fcr: 20, stats: "+1 all skills, 20% FCR, +10% max mana, +1 light radius" },
  { name: "Homunculus", type: "unique", slot: "offhand", cls: "Necromancer", req: 42, stats: "+2 Necromancer skills, +2 Curses, 30% faster block, +40 all res" },
  { name: "Herald of Zakarum", type: "unique", slot: "offhand", cls: "Paladin", req: 47, stats: "+2 Paladin skills, +2 Combat skills, +50 all res, 30% faster block, +20 str/vit" },
  { name: "Exile", type: "runeword", slot: "offhand", cls: "Paladin", req: 57, runes: "Vex Ohm Ist Dol", stats: "Lvl 13-16 Defiance aura, +2 Offensive Auras, Life Tap on striking" },
  { name: "Phoenix", type: "runeword", slot: "offhand", req: 65, runes: "Vex Vex Lo Jah", stats: "Lvl 10-15 Redemption aura, +50 life, +5% max light & fire res" },
  { name: "Dream (shield)", type: "runeword", slot: "offhand", req: 65, runes: "Io Jah Pul", stats: "Lvl 15 Holy Shock aura, 20-30% FHR, +5-20 all res" },
  { name: "Stormshield", type: "unique", slot: "offhand", req: 73, stats: "35% DR, 25% increased block, +60 cold res, +25 light res" },
  { name: "Rare off-hand claw", type: "rare", slot: "offhand", cls: "Assassin", req: 1, stats: "Second claw: +3 Traps, FCR, res" },

  // ---------- ARMOR ----------
  { name: "Stealth", type: "runeword", slot: "armor", req: 17, fcr: 25, runes: "Tal Eth", stats: "25% FCR, 25% FRW, 25% FHR, magic damage reduced 3" },
  { name: "Skin of the Vipermagi", type: "unique", slot: "armor", req: 29, fcr: 30, stats: "+1 all skills, 30% FCR, +20-35 all res, magic damage reduced 9-13" },
  { name: "Smoke", type: "runeword", slot: "armor", req: 37, runes: "Nef Lum", stats: "+50 all res, 20% FHR, +10 energy" },
  { name: "Shaftstop", type: "unique", slot: "armor", req: 38, stats: "30% DR, +60 life, +180-220% ED" },
  { name: "Duriel's Shell", type: "unique", slot: "armor", req: 41, stats: "Cannot be frozen, +50 cold res, life per level, +15 str" },
  { name: "Treachery", type: "runeword", slot: "armor", req: 43, runes: "Shael Thul Lem", stats: "45% IAS, 20% FHR, Fade & Venom procs" },
  { name: "Duress", type: "runeword", slot: "armor", req: 47, runes: "Shael Um Thul", stats: "40% FHR, 15% CB, 33% open wounds, cold damage" },
  { name: "Que-Hegan's Wisdom", type: "unique", slot: "armor", req: 51, fcr: 20, stats: "+1 all skills, 20% FCR, 20% FHR, +15 energy" },
  { name: "Fortitude", type: "runeword", slot: "armor", req: 59, fcr: 25, runes: "El Sol Dol Lo", stats: "+300% ED, 25% FCR, life per level, +25-30 all res" },
  { name: "Bramble", type: "runeword", slot: "armor", req: 61, runes: "Ral Ohm Sur Eth", stats: "Lvl 15-21 Thorns aura, +25-50% poison skill damage" },
  { name: "Chains of Honor", alias: "CoH", type: "runeword", slot: "armor", req: 63, runes: "Dol Um Ber Ist", stats: "+2 all skills, +65 all res, 8% DR, 8% LL, +200% damage vs demons/undead" },
  { name: "Enigma", type: "runeword", slot: "armor", req: 65, runes: "Jah Ith Ber", stats: "+2 all skills, +1 Teleport, 45% FRW, str & MF per level, 8% DR" },
  { name: "Leviathan", type: "unique", slot: "armor", req: 65, stats: "15-25% DR, +40-50 str, very high defense" },
  { name: "Tal Rasha's Guardianship", type: "set", slot: "armor", req: 71, stats: "+40 all res, +88 MF, magic damage reduced 15" },
  { name: "Ormus' Robes", type: "unique", slot: "armor", cls: "Sorceress", req: 75, fcr: 20, stats: "+10-15% cold/fire/light skill damage, +3 to a Sorc skill, 20% FCR" },
  { name: "Tyrael's Might", type: "unique", slot: "armor", req: 84, stats: "20% FRW, +20-30 str, +10-20 all res, cannot be frozen" },
  { name: "Arkaine's Valor", type: "unique", slot: "armor", req: 85, stats: "+1-2 all skills, 30% FHR, vitality per level, damage reduced 10-15" },

  // ---------- GLOVES ----------
  { name: "Bloodfist", type: "unique", slot: "gloves", req: 9, stats: "10% IAS, 30% FHR, +40 life" },
  { name: "Chance Guards", type: "unique", slot: "gloves", req: 15, stats: "25-40% MF, 200% extra gold, +20 AR" },
  { name: "Magefist", type: "unique", slot: "gloves", req: 23, fcr: 20, stats: "+1 Fire skills, 20% FCR, 25% mana regen" },
  { name: "Frostburn", type: "unique", slot: "gloves", req: 29, stats: "+40% max mana, cold damage" },
  { name: "Gravepalm", type: "unique", slot: "gloves", req: 32, stats: "+100-200% damage vs undead, +10-20 str/energy" },
  { name: "Trang-Oul's Claws", type: "set", slot: "gloves", req: 45, fcr: 20, stats: "+2 Curses, 20% FCR, +30 cold res" },
  { name: "Laying of Hands", type: "unique", slot: "gloves", req: 63, stats: "20% IAS, +350% damage vs demons, +50 fire res" },
  { name: "Steelrend", type: "unique", slot: "gloves", req: 70, stats: "+60-80% ED, +15-20 str" },
  { name: "Soul Drainer", type: "unique", slot: "gloves", req: 74, stats: "4-7% life & mana leech, -50 monster defense per hit" },
  { name: "Dracul's Grasp", type: "unique", slot: "gloves", req: 76, stats: "5-10% LL, +10-15 str, open wounds, Life Tap on striking" },
  { name: "Rare javelin gloves", type: "rare", slot: "gloves", cls: "Amazon", req: 1, stats: "+2-3 Javelin & Spear, 20% IAS, res/stats" },
  { name: "Crafted Blood gloves", type: "rare", slot: "gloves", req: 1, stats: "Crafted: crushing blow, IAS, LL, str/dex" },

  // ---------- BELTS ----------
  { name: "Goldwrap", type: "unique", slot: "belt", req: 27, stats: "10% IAS, 30% MF, 50-80% extra gold" },
  { name: "String of Ears", type: "unique", slot: "belt", req: 29, stats: "6-8% LL, 10-15% DR, magic damage reduced" },
  { name: "Razortail", type: "unique", slot: "belt", req: 32, stats: "33% pierce, +15 dex, attacker takes damage" },
  { name: "Thundergod's Vigor", type: "unique", slot: "belt", req: 47, stats: "+3 Lightning Fury & Strike, lightning absorb, +20 str/vit" },
  { name: "Nosferatu's Coil", type: "unique", slot: "belt", req: 51, stats: "5-7% LL, 10% IAS, slows target" },
  { name: "Tal Rasha's Fine-Spun Cloth", type: "set", slot: "belt", req: 53, stats: "10-15% MF, +37 mana, +20 dex, 10% damage to mana" },
  { name: "Verdungo's Hearty Cord", type: "unique", slot: "belt", req: 63, stats: "10-15% DR, 10% FHR, +30-40 vit" },
  { name: "Arachnid Mesh", type: "unique", slot: "belt", req: 80, fcr: 20, stats: "+1 all skills, 20% FCR, +5% max mana" },
  { name: "Rare/Crafted belt", type: "rare", slot: "belt", req: 1, stats: "FHR, res, life, str (note your rolls)" },

  // ---------- BOOTS ----------
  { name: "Treads of Cthon", type: "unique", slot: "boots", req: 15, stats: "30% FRW, half freeze duration, +10 life" },
  { name: "Waterwalk", type: "unique", slot: "boots", req: 32, stats: "20% FRW, +45-65 life, +15 dex, +5% max fire res" },
  { name: "Silkweave", type: "unique", slot: "boots", req: 36, stats: "30% FRW, +10% max mana, mana after each kill" },
  { name: "War Traveler", type: "unique", slot: "boots", req: 42, stats: "25% FRW, 30-50% MF, +10 str/vit" },
  { name: "Aldur's Advance", type: "set", slot: "boots", req: 45, stats: "40% FRW, +50 life, +40-50 fire res" },
  { name: "Gore Rider", type: "unique", slot: "boots", req: 47, stats: "30% FRW, 15% CB, 15% deadly strike, 10% open wounds" },
  { name: "Sandstorm Trek", type: "unique", slot: "boots", req: 64, stats: "20% FRW, 20% FHR, +10-15 str/vit, +40-70 poison res" },
  { name: "Marrowwalk", type: "unique", slot: "boots", cls: "Necromancer", req: 66, stats: "20% FRW, +1-2 Skeleton Mastery, +10-20 str/dex" },
  { name: "Shadow Dancer", type: "unique", slot: "boots", cls: "Assassin", req: 71, stats: "+1-2 Shadow Disciplines, 30% FRW, 30% FHR, +15-25 dex" },
  { name: "Rare tri-res boots", type: "rare", slot: "boots", req: 1, stats: "FRW, FHR, triple resist, dex (note your rolls)" },

  // ---------- CHARMS ----------
  { name: "Annihilus", type: "charm", slot: "charm", size: 1, unique1: true, req: 70, stats: "Small: +1 all skills, +10-20 all attributes, +10-20 all res, +5-10% XP" },
  { name: "Hellfire Torch", type: "charm", slot: "charm", size: 2, unique1: true, req: 75, stats: "Large: +3 to one class's skills, +10-20 all attributes, +10-20 all res" },
  { name: "Gheed's Fortune", type: "charm", slot: "charm", size: 3, unique1: true, req: 62, stats: "Grand: 20-40% MF, 80-160% gold, vendor discount" },
  { name: "Cold Rupture", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster cold immunity is sundered" },
  { name: "Flame Rift", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster fire immunity is sundered" },
  { name: "Crack of the Heavens", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster lightning immunity is sundered" },
  { name: "Rotting Fissure", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster poison immunity is sundered" },
  { name: "Bone Break", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster physical immunity is sundered" },
  { name: "Black Cleft", type: "charm", slot: "charm", size: 3, unique1: true, req: 75, stats: "Sunder: monster magic immunity is sundered" },
  { name: "Skiller grand charm", type: "charm", slot: "charm", size: 3, req: 1, stats: "Grand: +1 to a skill tree (note which, and any life/FHR)" },
  { name: "Grand charm (other)", type: "charm", slot: "charm", size: 3, req: 1, stats: "Grand: damage/AR/life (note rolls)" },
  { name: "Large charm", type: "charm", slot: "charm", size: 2, req: 1, stats: "Large: life, res, stats (note rolls)" },
  { name: "Small charm — life/res", type: "charm", slot: "charm", size: 1, req: 1, stats: "Small: life, resist (note rolls)" },
  { name: "Small charm — FHR", type: "charm", slot: "charm", size: 1, req: 1, stats: "Small: 5% FHR (+ life/res)" },
  { name: "Small charm — MF", type: "charm", slot: "charm", size: 1, req: 1, stats: "Small: 3-7% MF (+ life/res)" },
];

// FCR breakpoints by class (frames). Values are FCR % needed.
const FCR_BREAKPOINTS = {
  Amazon:      [0, 7, 14, 22, 32, 48, 68, 99, 152],
  Assassin:    [0, 8, 16, 27, 42, 65, 102, 174],
  Barbarian:   [0, 9, 20, 37, 63, 105, 200],
  Druid:       [0, 4, 10, 19, 30, 46, 68, 99, 163],
  Necromancer: [0, 9, 18, 30, 48, 75, 125],
  Paladin:     [0, 9, 18, 30, 48, 75, 125],
  Sorceress:   [0, 9, 20, 37, 63, 105, 200],
};

// Slot layout. listSlot = which item list a slot draws from.
const GEAR_SLOTS = [
  { key: "helm", label: "Helm", list: "helm" },
  { key: "amulet", label: "Amulet", list: "amulet" },
  { key: "weapon", label: "Weapon", list: "weapon" },
  { key: "offhand", label: "Off-hand", list: "offhand" },
  { key: "armor", label: "Armor", list: "armor" },
  { key: "gloves", label: "Gloves", list: "gloves" },
  { key: "belt", label: "Belt", list: "belt" },
  { key: "boots", label: "Boots", list: "boots" },
  { key: "ring1", label: "Ring 1", list: "ring" },
  { key: "ring2", label: "Ring 2", list: "ring" },
  { key: "swap", label: "Weapon swap", list: "weapon" },
];
const MERC_SLOTS = [
  { key: "merc_weapon", label: "Merc weapon", list: "weapon", mercOnly: true },
  { key: "merc_helm", label: "Merc helm", list: "helm" },
  { key: "merc_armor", label: "Merc armor", list: "armor" },
];

// Shared tier lists. Each slot: [starter, mid, endgame] arrays of item names.
const CASTER_COMMON = {
  helm: [["Lore", "Tarnhelm"], ["Harlequin Crest"], ["Harlequin Crest"]],
  amulet: [["Nokozan Relic", "The Eye of Etlich"], ["Saracen's Chance", "2/20 caster amulet"], ["Mara's Kaleidoscope"]],
  weapon: [["Spirit (sword)"], ["Heart of the Oak"], ["Heart of the Oak"]],
  offhand: [["Ancient's Pledge", "Splendor"], ["Spirit (shield)", "Lidless Wall"], ["Spirit (shield)"]],
  armor: [["Stealth", "Smoke"], ["Skin of the Vipermagi"], ["Enigma"]],
  gloves: [["Chance Guards", "Bloodfist"], ["Magefist"], ["Magefist", "Trang-Oul's Claws"]],
  belt: [["Rare/Crafted belt", "Goldwrap"], ["Tal Rasha's Fine-Spun Cloth", "String of Ears"], ["Arachnid Mesh"]],
  boots: [["Treads of Cthon"], ["Waterwalk", "Silkweave", "War Traveler"], ["Sandstorm Trek", "Rare tri-res boots"]],
  ring: [["Nagelring", "Manald Heal"], ["The Stone of Jordan", "Rare/Crafted FCR ring"], ["The Stone of Jordan", "Bul-Kathos' Wedding Band"]],
  swap: [[], ["Spirit (sword)"], ["Call to Arms"]],
  merc_weapon: [["Insight"], ["Insight"], ["Infinity"]],
  merc_helm: [["Tal Rasha's Horadric Crest", "Vampire Gaze"], ["Vampire Gaze", "Tal Rasha's Horadric Crest"], ["Andariel's Visage", "Crown of Ages"]],
  merc_armor: [["Smoke", "Stealth"], ["Treachery", "Duress"], ["Fortitude", "Chains of Honor"]],
};
const MELEE_COMMON = {
  helm: [["Rockstopper", "Guillaume's Face"], ["Vampire Gaze", "Guillaume's Face"], ["Andariel's Visage", "Crown of Ages", "Guillaume's Face"]],
  amulet: [["The Eye of Etlich", "Nokozan Relic"], ["Cat's Eye", "Atma's Scarab"], ["Highlord's Wrath", "Atma's Scarab"]],
  weapon: [["Steel"], ["Kingslayer", "Grief"], ["Grief", "Breath of the Dying"]],
  offhand: [["Ancient's Pledge", "Rhyme"], ["Spirit (shield)", "Stormshield"], ["Stormshield", "Spirit (shield)"]],
  armor: [["Smoke", "Stealth"], ["Shaftstop", "Duress", "Treachery"], ["Fortitude", "Chains of Honor"]],
  gloves: [["Bloodfist", "Crafted Blood gloves"], ["Laying of Hands", "Crafted Blood gloves"], ["Dracul's Grasp", "Steelrend"]],
  belt: [["Goldwrap", "Rare/Crafted belt"], ["Nosferatu's Coil", "String of Ears"], ["Verdungo's Hearty Cord", "String of Ears"]],
  boots: [["Treads of Cthon"], ["Gore Rider", "War Traveler"], ["Gore Rider", "Sandstorm Trek"]],
  ring: [["Nagelring", "Manald Heal"], ["Raven Frost", "Rare melee ring"], ["Raven Frost", "Bul-Kathos' Wedding Band"]],
  swap: [[], ["Spirit (sword)"], ["Call to Arms"]],
  merc_weapon: [["Insight"], ["Insight", "Obedience"], ["Infinity", "The Reaper's Toll"]],
  merc_helm: [["Vampire Gaze"], ["Vampire Gaze", "Tal Rasha's Horadric Crest"], ["Andariel's Visage", "Crown of Ages"]],
  merc_armor: [["Smoke"], ["Treachery", "Duress"], ["Fortitude", "Chains of Honor"]],
};

const BUILDS = [
  {
    id: "blizz-sorc", name: "Blizzard Sorceress", cls: "Sorceress", caster: true, fcrTarget: 105,
    base: CASTER_COMMON,
    slots: {
      helm: [["Lore", "Tarnhelm"], ["Harlequin Crest"], ["Harlequin Crest", "Nightwing's Veil"]],
      amulet: [["Nokozan Relic", "The Eye of Etlich"], ["Tal Rasha's Adjudication", "2/20 caster amulet"], ["Mara's Kaleidoscope", "Tal Rasha's Adjudication"]],
      weapon: [["Spirit (sword)", "Magic caster weapon"], ["The Oculus", "Heart of the Oak", "Memory"], ["Death's Fathom", "Heart of the Oak"]],
    },
    charms: ["Cold Rupture", "Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — FHR"],
    notes: "Aim for 105% FCR (63% is the cheaper step). Cold Mastery + sunder handles cold immunes; Infinity merc helps too.",
  },
  {
    id: "light-sorc", name: "Lightning Sorceress", cls: "Sorceress", caster: true, fcrTarget: 105,
    base: CASTER_COMMON,
    slots: {
      helm: [["Lore", "Tarnhelm"], ["Harlequin Crest"], ["Griffon's Eye", "Harlequin Crest"]],
      amulet: [["Nokozan Relic", "The Eye of Etlich"], ["Tal Rasha's Adjudication", "2/20 caster amulet"], ["Mara's Kaleidoscope", "Tal Rasha's Adjudication"]],
      weapon: [["Spirit (sword)", "Magic caster weapon"], ["The Oculus", "Heart of the Oak", "Memory"], ["Eschuta's Temper", "Heart of the Oak"]],
    },
    charms: ["Crack of the Heavens", "Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — FHR"],
    notes: "Lightning immunes are the problem: Infinity merc + Crack of the Heavens + Griffon's. 105% FCR target.",
  },
  {
    id: "hammerdin", name: "Hammerdin (Blessed Hammer)", cls: "Paladin", caster: true, fcrTarget: 125,
    base: CASTER_COMMON,
    slots: {
      offhand: [["Ancient's Pledge"], ["Spirit (shield)", "Herald of Zakarum"], ["Herald of Zakarum", "Spirit (shield)"]],
      amulet: [["Nokozan Relic", "The Eye of Etlich"], ["2/20 caster amulet", "Saracen's Chance"], ["Mara's Kaleidoscope", "Seraph's Hymn"]],
      merc_weapon: [["Insight"], ["Insight"], ["Insight", "Infinity"]],
    },
    charms: ["Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — FHR"],
    notes: "Hammers are magic damage — no sunder needed. 75% FCR is fine, 125% is the endgame breakpoint.",
  },
  {
    id: "smiter", name: "Smiter (Uber killer)", cls: "Paladin", caster: false,
    base: MELEE_COMMON,
    slots: {
      weapon: [["Steel", "Lawbringer"], ["Kingslayer", "Grief"], ["Grief"]],
      offhand: [["Ancient's Pledge", "Rhyme"], ["Herald of Zakarum", "Spirit (shield)"], ["Herald of Zakarum", "Exile"]],
      helm: [["Rockstopper", "Guillaume's Face"], ["Guillaume's Face", "Vampire Gaze"], ["Guillaume's Face", "Crown of Ages", "Andariel's Visage"]],
      gloves: [["Bloodfist"], ["Laying of Hands"], ["Dracul's Grasp", "Laying of Hands"]],
    },
    charms: ["Annihilus", "Hellfire Torch", "Grand charm (other)", "Small charm — life/res"],
    notes: "Crushing blow + life tap + high block. Max resists matter more than raw damage for Ubers.",
  },
  {
    id: "ww-barb", name: "Whirlwind Barbarian", cls: "Barbarian", caster: false,
    base: MELEE_COMMON,
    slots: {
      helm: [["Rockstopper", "Guillaume's Face"], ["Arreat's Face"], ["Arreat's Face", "Andariel's Visage"]],
      offhand: [["Steel", "Ancient's Pledge"], ["Grief", "Kingslayer"], ["Grief", "Breath of the Dying"]],
      weapon: [["Steel"], ["Grief", "Death Cleaver"], ["Grief", "Breath of the Dying"]],
    },
    charms: ["Annihilus", "Hellfire Torch", "Skiller grand charm", "Grand charm (other)", "Small charm — life/res"],
    notes: "Dual-wield two weapons (off-hand slot = second weapon). Call to Arms in swap for Battle Orders.",
  },
  {
    id: "javazon", name: "Lightning Fury Javazon", cls: "Amazon", caster: false,
    base: MELEE_COMMON,
    slots: {
      weapon: [["Titan's Revenge"], ["Titan's Revenge"], ["Thunderstroke", "Titan's Revenge"]],
      offhand: [["Ancient's Pledge"], ["Spirit (shield)", "Rhyme"], ["Spirit (shield)", "Stormshield"]],
      helm: [["Lore", "Peasant Crown"], ["Harlequin Crest", "Vampire Gaze"], ["Griffon's Eye", "Harlequin Crest", "Andariel's Visage"]],
      armor: [["Stealth", "Smoke"], ["Treachery", "Skin of the Vipermagi"], ["Enigma", "Chains of Honor"]],
      gloves: [["Bloodfist", "Rare javelin gloves"], ["Rare javelin gloves"], ["Rare javelin gloves"]],
      belt: [["Rare/Crafted belt"], ["Thundergod's Vigor"], ["Thundergod's Vigor"]],
      boots: [["Treads of Cthon"], ["War Traveler", "Waterwalk"], ["Sandstorm Trek", "Rare tri-res boots", "War Traveler"]],
      amulet: [["The Eye of Etlich"], ["Cat's Eye", "Saracen's Chance"], ["Highlord's Wrath", "Mara's Kaleidoscope"]],
      merc_weapon: [["Insight"], ["Insight"], ["Infinity"]],
    },
    charms: ["Crack of the Heavens", "Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — life/res"],
    notes: "Infinity merc is the biggest upgrade for lightning immunes. Throw IAS matters more than FCR.",
  },
  {
    id: "summon-necro", name: "Summon Necromancer", cls: "Necromancer", caster: true, fcrTarget: 75,
    base: CASTER_COMMON,
    slots: {
      weapon: [["Spirit (sword)", "Magic caster weapon"], ["Arm of King Leoric", "White"], ["Heart of the Oak", "Arm of King Leoric"]],
      offhand: [["Ancient's Pledge"], ["Homunculus", "Spirit (shield)"], ["Homunculus", "Spirit (shield)"]],
      gloves: [["Chance Guards"], ["Trang-Oul's Claws", "Magefist"], ["Trang-Oul's Claws", "Magefist"]],
      belt: [["Rare/Crafted belt"], ["String of Ears", "Arachnid Mesh"], ["Arachnid Mesh", "Verdungo's Hearty Cord"]],
      boots: [["Treads of Cthon"], ["Waterwalk", "Silkweave"], ["Marrowwalk", "Sandstorm Trek"]],
    },
    charms: ["Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — life/res"],
    notes: "Skeletons scale with +skills; FCR mainly speeds Corpse Explosion/curses. Summoning skiller GCs.",
  },
  {
    id: "wind-druid", name: "Wind Druid (Tornado/Hurricane)", cls: "Druid", caster: true, fcrTarget: 99,
    base: CASTER_COMMON,
    slots: {
      helm: [["Lore"], ["Jalal's Mane", "Rare druid pelt"], ["Jalal's Mane", "Rare druid pelt"]],
      offhand: [["Ancient's Pledge"], ["Spirit (shield)"], ["Spirit (shield)", "Lidless Wall"]],
      merc_weapon: [["Insight"], ["Insight"], ["The Reaper's Toll", "Infinity"]],
    },
    charms: ["Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — FHR"],
    notes: "Tornado is physical and Hurricane is cold — a Reaper's Toll merc (decrepify) handles physical immunes. 99% FCR target.",
  },
  {
    id: "trapsin", name: "Lightning Sentry Trapsin", cls: "Assassin", caster: true, fcrTarget: 102,
    base: CASTER_COMMON,
    slots: {
      weapon: [["Spirit (sword)", "Rare trap claw"], ["Heart of the Oak", "Rare trap claw"], ["Rare trap claw", "Heart of the Oak"]],
      offhand: [["Ancient's Pledge"], ["Spirit (shield)", "Rare off-hand claw"], ["Spirit (shield)", "Rare off-hand claw"]],
      helm: [["Lore"], ["Harlequin Crest"], ["Griffon's Eye", "Harlequin Crest"]],
      boots: [["Treads of Cthon"], ["Waterwalk", "Silkweave"], ["Shadow Dancer", "Sandstorm Trek"]],
    },
    charms: ["Crack of the Heavens", "Annihilus", "Hellfire Torch", "Skiller grand charm", "Small charm — FHR"],
    notes: "Trap laying uses cast rate — 102% FCR is the goal (65% is the cheap step).",
  },
];

// Resolve each build's slot tiers (build overrides on top of its base).
for (const b of BUILDS) {
  b.tiers = Object.assign({}, b.base, b.slots);
}
