// Terror Zones, generated from the retail game tables (desecratedzones.json, levels.txt, monstats.txt; patch 3.3).
// mons: [monster name, Hell immunities] — f fire, c cold, l lightning, p poison, d physical, m magic, each followed by the resistance %.
const TZ_CONFIG = { start: "2025-12-05 00:00:00", seed: "16665365343970128666", minutes: 30, breakMinutes: 0 };
const TZ_ZONES = [
  {"id": "Act1-BurialGrounds", "act": 1, "name": "Burial Grounds, Crypt & Mausoleum", "areas": ["Burial Grounds", "Crypt", "Mausoleum"], "alias": [], "mons": [["Hungry Dead", "l110"], ["Skeleton", "l100"]]},
  {"id": "Act1-Catacombs", "act": 1, "name": "Cathedral & Catacombs", "areas": ["Cathedral", "Catacombs Level 1", "Catacombs Level 2", "Catacombs Level 3", "Catacombs Level 4", "Inner Cloister"], "alias": [], "mons": [["Afflicted", "l100"], ["Arach", "f110"], ["Black Archer", "l115"], ["Bone Mage", "l105"], ["Dark One", "f125"], ["Dark Shaman", "f115"], ["Ghoul", "f100"], ["Rat Man", "f100"], ["Tainted", "l105"], ["The Banished", "c150"], ["Wraith", "d100"]]},
  {"id": "Act1-ColdPlains", "act": 1, "name": "Cold Plains & The Cave", "areas": ["Cold Plains", "Cave Level 1", "Cave Level 2"], "alias": [], "mons": [["Dark Hunter", "c100"], ["Dark Ranger", "l100"], ["Dark Spearwoman", "l100"], ["Fallen Shaman", "f100"], ["Gargantuan Beast", "c100"], ["Hungry Dead", "l110"], ["Skeleton", "l100"]]},
  {"id": "Act1-DarkWood", "act": 1, "name": "Dark Wood & Underground Passage", "areas": ["Dark Wood", "Underground Passage Level 1", "Underground Passage Level 2"], "alias": [], "mons": [["Carver", "f110"], ["Misshapen", "l110"], ["Skeleton Archer", "p100"], ["Spike Fiend", ""], ["Vile Hunter", "c120"], ["Vile Lancer", "f110"]]},
  {"id": "Act1-BloodMoor", "act": 1, "name": "Blood Moor & Den of Evil", "areas": ["Blood Moor", "Den of Evil"], "alias": [], "mons": [["Fallen", "f100"], ["Fallen Shaman", "f100"], ["Gargantuan Beast", "c100"], ["Quill Rat", ""], ["Zombie", "c120"]]},
  {"id": "Act1-Jail", "act": 1, "name": "Barracks & Jail", "areas": ["Barracks", "Jail Level 1", "Jail Level 2", "Jail Level 3"], "alias": [], "mons": [["Black Rogue", "c140"], ["Bone Archer", "p105"], ["Bone Mage", "f105l105"], ["Dark One", "f125"], ["Death Clan", ""], ["Devilkin Shaman", "f110"], ["Wraith", "d100"]]},
  {"id": "Act1-MooMooFarm", "act": 1, "name": "Secret Cow Level", "areas": ["The Secret Cow Level"], "alias": ["Moo Moo Farm", "Cow Level"], "mons": [["Hell Bovine", ""]]},
  {"id": "Act1-Tristram", "act": 1, "name": "Stony Field & Tristram", "areas": ["Stony Field", "Tristram"], "alias": [], "mons": [["Carver Shaman", "f105"], ["Dark Ranger", "l100"], ["Foul Crow Nest", ""], ["Hungry Dead", "l110"], ["Moon Clan", "c100"], ["Night Clan", "l110"], ["Returned", "p100"], ["Skeleton", "l100"], ["Skeleton Archer", "p100"]]},
  {"id": "Act1-Tower", "act": 1, "name": "Black Marsh & Forgotten Tower", "areas": ["Black Marsh", "Hole Level 1", "Hole Level 2", "Forgotten Tower", "Tower Cellar Level 1", "Tower Cellar Level 2", "Tower Cellar Level 3", "Tower Cellar Level 4", "Tower Cellar Level 5"], "alias": [], "mons": [["Blood Clan", "f100"], ["Blood Hawk Nest", ""], ["Brute", "c120"], ["Carver", "f110"], ["Carver Shaman", "f105"], ["Dark Archer", "l110"], ["Devilkin", "f120"], ["Ghost", "d100"], ["Misshapen", "l110"], ["Night Clan", "l110"], ["Returned", "p100"], ["Vile Archer", "f110"]]},
  {"id": "Act1-Monastery", "act": 1, "name": "Tamoe Highland, Monastery & The Pit", "areas": ["Tamoe Highland", "Outer Cloister", "Pit Level 1", "Pit Level 2", "Monastery Gate"], "alias": [], "mons": [["Black Rogue", "c140"], ["Bone Warrior", "c110"], ["Dark Archer", "l110"], ["Dark Lancer", "l110"], ["Dark Stalker", "c130"], ["Devilkin", "f120"], ["Devilkin Shaman", "f110"], ["Disfigured", "l115"], ["Razor Spine", ""], ["Returned Archer", "p105"], ["Returned Mage", "f100l100"], ["Thorn Beast", ""], ["Yeti", "c130"]]},
  {"id": "Act2-Sewers", "act": 2, "name": "Lut Gholein Sewers", "areas": ["Sewers Level 1", "Sewers Level 2", "Sewers Level 3"], "alias": [], "mons": [["Burning Dead", "f100"], ["Burning Dead Archer", "p110"], ["Burning Dead Mage", "f110"], ["Dried Corpse", "p100"], ["Huntress", "c100"], ["Sand Raider", "f100"]]},
  {"id": "Act2-RockyWaste", "act": 2, "name": "Rocky Waste & Stony Tomb", "areas": ["Rocky Waste", "Stony Tomb Level 1", "Stony Tomb Level 2"], "alias": [], "mons": [["Burning Dead Mage", "l110"], ["Carrion Bird", "p110"], ["Dung Soldier", "l100"], ["Horror", "l120"], ["Huntress", "c100"], ["Sand Leaper", "f100"], ["Slinger", "c120"]]},
  {"id": "Act2-DryHills", "act": 2, "name": "Dry Hills & Halls of the Dead", "areas": ["Dry Hills", "Halls of the Dead Level 1", "Halls of the Dead Level 2", "Halls of the Dead Level 3"], "alias": [], "mons": [["Cave Leaper", "c100"], ["Decayed", "p100"], ["Desert Wing", "f100"], ["Hollow One", "l100"], ["Saber Cat", "f100"], ["Spear Cat", "c140"], ["Undead Scavenger", "l100"]]},
  {"id": "Act2-FarOasis", "act": 2, "name": "Far Oasis & Maggot Lair", "areas": ["Far Oasis", "Maggot Lair Level 1", "Maggot Lair Level 2", "Maggot Lair Level 3"], "alias": [], "mons": [["Black Locusts", "d100"], ["Black Raptor Nest", ""], ["Death Beetle", "l105"], ["Itchies", "d100"], ["Rock Worm", "p110"], ["Sand Maggot", "p105"], ["Scarab", "l110"], ["Undead Scavenger", "l100"]]},
  {"id": "Act2-LostCity", "act": 2, "name": "Lost City, Valley of Snakes & Ancient Tunnels", "areas": ["Lost City", "Valley of Snakes", "Claw Viper Temple Level 1", "Claw Viper Temple Level 2", "Ancient Tunnels"], "alias": [], "mons": [["Claw Viper", "c120"], ["Embalmed", "p105"], ["Guardian", "f100m100"], ["Horror Mage", "l115"], ["Invader", "f110"], ["Marauder", "c100"], ["Night Slinger", ""], ["Night Tiger", "l100"], ["Plague Bearer", "m100"], ["Salamander", "c110"], ["Tomb Creeper", "f105"]]},
  {"id": "Act2-TalRashas", "act": 2, "name": "Canyon of the Magi & Tal Rasha's Tombs", "areas": ["Tal Rasha's Tomb", "Tal Rasha's Chamber", "Canyon of the Magi"], "alias": [], "mons": [["Apparition", "d100"], ["Crusher", "c140"], ["Devourer", "p115"], ["Ghoul Lord", "c110"], ["Gorebelly", "c140"], ["Hell Cat", "c120"], ["Hell Slinger", "f105"], ["Preserved Dead", "p105"], ["Steel Scarab", "l115"], ["Unraveler", "c100m100"]]},
  {"id": "Act2-ArcaneSanctuary", "act": 2, "name": "Arcane Sanctuary & Palace", "areas": ["Arcane Sanctuary", "Harem Level 1", "Harem Level 2", "Palace Cellar Level 1", "Palace Cellar Level 2", "Palace Cellar Level 3"], "alias": [], "mons": [["Blunderbore", "f115"], ["Dune Beast", "l100"], ["Ghoul Lord", "c110"], ["Hell Clan", "f110"], ["Horror Archer", "p110"], ["Horror Mage", "c170f115l115"], ["Invader", "f110"], ["Specter", "d100"]]},
  {"id": "Act3-SpiderForest", "act": 3, "name": "Spider Forest & Spider Cavern", "areas": ["Spider Forest", "Arachnid Lair", "Spider Cavern"], "alias": [], "mons": [["Cloud Stalker", "l100"], ["Fetish", "l100"], ["Fiend", "l110"], ["Flame Spider", "f115"], ["Giant Lamprey", "p120"], ["Jungle Hunter", "l105"], ["Poison Spinner", "p110"], ["Sucker", "p105"], ["Thorned Hulk", "c120"]]},
  {"id": "Act3-GreatMarsh", "act": 3, "name": "Great Marsh", "areas": ["Great Marsh"], "alias": [], "mons": [["Bog Creature", "c120"], ["Bramble Hulk", "c130"], ["Drowned Carcass", "f110"], ["Fetish Shaman", "f110"], ["Gloam", "l100"], ["Swamp Dweller", "f100"]]},
  {"id": "Act3-FlayerJungle", "act": 3, "name": "Flayer Jungle & Flayer Dungeon", "areas": ["Flayer Jungle", "Flayer Dungeon Level 1", "Flayer Dungeon Level 2", "Flayer Dungeon Level 3", "Swampy Pit Level 1", "Swampy Pit Level 2", "Swampy Pit Level 3"], "alias": [], "mons": [["Dark Shape", "d100"], ["Drowned Carcass", "f110"], ["Fiend", "l110"], ["Flayer", "c140"], ["Flayer Shaman", "f115"], ["Gloam", "l100"], ["Gloombat", "c100"], ["Preserved Dead", "p105"], ["Slime Prince", "p110"], ["Soul Killer", "l110"], ["Soul Killer Shaman", "f120"], ["Undead Flayer", "p110"], ["Undead Soul Killer", "p115"], ["Undead Stygian Doll", "p120"], ["Winged Nightmare", "l100"]]},
  {"id": "Act3-Kurast", "act": 3, "name": "Kurast Bazaar & Temples", "areas": ["Kurast Bazaar", "Lower Kurast", "Upper Kurast", "Kurast Causeway", "Sewers Level 1", "Sewers Level 2", "Ruined Temple", "Disused Fane", "Forgotten Reliquary", "Forgotten Temple", "Ruined Fane", "Disused Reliquary"], "alias": ["Kurast Sewers"], "mons": [["Blood Diver", "f105"], ["Blood Wing", "p120"], ["Bone Scarab", "l120"], ["Cantor", "l100"], ["Doom Ape", "l105"], ["Faithful", "c140"], ["Feeder", "p110"], ["Flesh Archer", "c130"], ["Flesh Hunter", "c150"], ["Gloombat", "c100"], ["Hell Buzzard", "f100"], ["Hell Swarm", "d100"], ["Hierophant", "c160"], ["Horadrim Ancient", "m100"], ["Infidel", "c110"], ["Night Lord", "c120"], ["Preserved Dead", "p105"], ["Serpent Magus", "c120"], ["Sexton", "c140"], ["Slime Prince", "p110"], ["Spider Magus", "f120"], ["Temple Guard", "l110"], ["Thrasher", "c140"], ["Tree Lurker", "l100"], ["Undead Soul Killer", "p115"], ["Wailing Beast", "m100"], ["Winged Nightmare", "l100"], ["Zakarumite", "f100"], ["Zealot", "l100"]]},
  {"id": "Act3-Travincal", "act": 3, "name": "Travincal", "areas": ["Travincal"], "alias": [], "mons": [["Hierophant", "c160"], ["Night Lord", "c120"]]},
  {"id": "Act3-DuranceOfHate", "act": 3, "name": "Durance of Hate", "areas": ["Durance of Hate Level 1", "Durance of Hate Level 2", "Durance of Hate Level 3"], "alias": [], "mons": [["Blood Lord", "c140"], ["Cadaver", "p110"], ["Dark Lord", "c130"], ["Mauler", "l100"], ["Undead Stygian Doll", "p120"]]},
  {"id": "Act4_OuterSteppes", "act": 4, "name": "Outer Steppes & Plains of Despair", "areas": ["Outer Steppes", "Plains of Despair"], "alias": [], "mons": [["Burning Soul", "l110"], ["Cliff Lurker", "l100"], ["Corpulent", "p100"], ["Doom Caster", "l100"], ["Doom Knight", "f110"], ["Flesh Spawner", "c140"], ["Venom Lord", "f130"]]},
  {"id": "Act4-RiverOfFlame", "act": 4, "name": "River of Flame & City of the Damned", "areas": ["City of the Damned", "River of Flame"], "alias": [], "mons": [["Abyss Knight", "l100"], ["Blood Maggot", "p125"], ["Corpse Spitter", "p105"], ["Damned", "l120"], ["Dark Familiar", "l120"], ["Grotesque", "c160"], ["Maw Fiend", "p110"], ["Pit Lord", "f120"], ["Strangler", "l100"], ["Stygian Hag", "c150"], ["Urdar", ""]]},
  {"id": "Act4-ChaosSanctuary", "act": 4, "name": "Chaos Sanctuary", "areas": ["The Chaos Sanctuary"], "alias": [], "mons": [["Oblivion Knight", "c180"], ["Storm Caster", "l100"], ["Venom Lord", "f130"]]},
  {"id": "Act5-BloodyFoothils", "act": 5, "name": "Bloody Foothills & Frigid Highlands", "areas": ["Bloody Foothills", "Frigid Highlands", "Abaddon"], "alias": [], "mons": [["Balrog", "f140"], ["Blood Lord", "d100"], ["Blunderbore", ""], ["Burning Dead Archer", "p100"], ["Carrion Bird", "p100"], ["Dark Shaman", ""], ["Death Brawler", "l100"], ["Death Mauler", "l100"], ["Demon Gremlin", "f110"], ["Demon Imp", "f110"], ["Enslaved", "c130"], ["Foul Crow", "c120"], ["Hell Spawn", "f110"], ["Hell Temptress", ""], ["Hell Witch", "c145"], ["Horror Archer", "p140"], ["Lasher", "c130"], ["Overseer", "c120"], ["Quill Rat", "f100"], ["Siege Beast", "f110"], ["Slayer", "f105"], ["Slinger", "c150f110"], ["Strangler", "l100"], ["Thorned Hulk", "l100"], ["Undead Stygian Doll", "p105"], ["Vile Archer", "f115"], ["Vile Lancer", "l100"]]},
  {"id": "Act5-ArreatPlateau", "act": 5, "name": "Arreat Plateau & Pit of Acheron", "areas": ["Arreat Plateau", "Pit of Acheron"], "alias": [], "mons": [["Balrog", "f140"], ["Blood Bringer", "c120"], ["Blood Lord", "d100"], ["Burning Dead Mage", "f130p110"], ["Carver Shaman", ""], ["Death Slasher", "c135"], ["Demon Gremlin", "f110"], ["Demon Imp", "f110"], ["Fire Boar", "f110"], ["Hell Clan", "c155"], ["Hell Temptress", ""], ["Hell Whip", "c160"], ["Mauler", ""], ["Maw Fiend", "p110"], ["Night Clan", "c135"], ["Returned Mage", "f125l120p110"], ["Salamander", "f115"], ["Slinger", "p100"], ["Unraveler", "m100"]]},
  {"id": "Act5-CrystallinePassage", "act": 5, "name": "Crystalline Passage & Frozen River", "areas": ["Crystalline Passage", "Frozen River"], "alias": [], "mons": [["Blood Lord", "d100"], ["Bone Mage", "c160p110"], ["Cave Leaper", "c100"], ["Claw Viper", ""], ["Dark Archer", "c140"], ["Dark Lancer", "l100"], ["Frozen Creeper", "c150"], ["Ghost", "d100p100"], ["Gloam", "l100p105"], ["Infidel", "c150"], ["Rot Walker", "c130"], ["Siren", "c125"], ["Snow Drifter", "c150"], ["Succubus", "f120"]]},
  {"id": "Act5-Halls", "act": 5, "name": "Nihlathak's Temple & Halls", "areas": ["Nihlathak's Temple", "Halls of Anguish", "Halls of Pain", "Halls of Vaught"], "alias": ["Temple Halls"], "mons": [["Arach", "f120"], ["Blood Clan", "f110"], ["Blood Maggot", "l100p105"], ["Death Brigadier", "c145"], ["Devilkin Shaman", ""], ["Flayer", "f105"], ["Flayer Shaman", "f120"], ["Ghost", "d100p100"], ["Grotesque", "c140"], ["Guardian", "m100"], ["Hell Temptress", "d100"], ["Hierophant", ""], ["Horror Mage", ""], ["Infidel", "c150"], ["Night Lord", "l100"], ["Night Marauder", "d100p105"], ["Prowling Dead", "c170"], ["Razor Spine", "l100"], ["Returned", "l100p110"], ["Returned Archer", "p130"], ["Scarab", "l100"], ["Slayer", "c130"], ["Temple Guard", "l100"], ["Tomb Creeper", "c120"], ["Tomb Viper", "l100p110"], ["Wretched Defiler", "p105"]]},
  {"id": "Act5-GlacialTrail", "act": 5, "name": "Glacial Trail & Drifter Cavern", "areas": ["Glacial Trail", "Drifter Cavern"], "alias": [], "mons": [["Abominable", "c170"], ["Afflicted", "l100"], ["Bone Mage", "c160p110"], ["Bone Warrior", "l100p105"], ["Dark Archer", "c140"], ["Frozen Creeper", "c150"], ["Frozen Terror", "c160"], ["Ghost", "d100p100"], ["Gloombat", "l100"], ["Infidel", "c150"], ["Moon Lord", "f140"], ["Night Clan", "c135"], ["Pit Viper", "c145p110"], ["Rot Walker", "c130"], ["Snow Drifter", "c150"], ["Succubus", ""], ["Wraith", "d100p100"]]},
  {"id": "Act5-AncientsWay", "act": 5, "name": "Ancients' Way & Icy Cellar", "areas": ["The Ancients' Way", "Icy Cellar"], "alias": ["Ancient's Way"], "mons": [["Abominable", "c170"], ["Afflicted", "l100"], ["Bone Mage", "c160p110"], ["Carver Shaman", ""], ["Dark Lancer", "l100"], ["Frozen Terror", "c160"], ["Ghost", "d100p100"], ["Gloam", "l100p105"], ["Gloombat", "l100"], ["Hell Lord", "l100"], ["Hell Temptress", "d100"], ["Pit Viper", "c145p110"], ["Reanimated Horde", "c150"], ["Siren", "c125"], ["Spike Fiend", "c100"], ["Undead Stygian Doll", "p120"]]},
  {"id": "Act5-FrozenTundra", "act": 5, "name": "Frozen Tundra & Infernal Pit", "areas": ["Frozen Tundra", "Infernal Pit"], "alias": [], "mons": [["Balrog", "f140"], ["Blood Boss", "c150"], ["Blood Lord", "c125"], ["Blood Temptress", "p120"], ["Bone Archer", "p110"], ["Carrion Bird", "p100"], ["Crush Beast", "f120"], ["Death Berserker", "d100"], ["Death Clan", "c165"], ["Demon Rascal", "f105"], ["Demon Trickster", "f115"], ["Hell Spawn", "f115"], ["Hell Witch", "c160"], ["Night Lord", "l100"], ["Oblivion Knight", "c140"], ["Returned Mage", "l120p110"], ["Saber Cat", ""], ["Salamander", "f115"], ["Stygian Doll", "f110"], ["Unholy Corpse", "p120"]]},
  {"id": "Act5-WorldstoneKeep", "act": 5, "name": "Worldstone Keep & Throne of Destruction", "areas": ["Worldstone Keep Level 1", "Worldstone Keep Level 2", "Worldstone Keep Level 3", "Throne of Destruction", "The Worldstone Chamber"], "alias": [], "mons": [["Assailant", "f130"], ["Black Lancer", "l100"], ["Black Soul", "l100p110"], ["Blood Boss", "c150"], ["Burning Soul", "l100p115"], ["Cadaver", "p130"], ["Dark Lord", "c135"], ["Death Lord", "f120"], ["Demon Sprite", "f120"], ["Fetid Defiler", "p110"], ["Fiend", "l100"], ["Flesh Spawner", "c145"], ["Frenzied Ice Spawn", "c150"], ["Ghoul Lord", "c130"], ["Greater Hell Spawn", "c135"], ["Hell Temptress", "d100"], ["Hell Witch", "c160"], ["Hierophant", ""], ["Horadrim Ancient", "m100"], ["Horror Mage", "l130p110"], ["Invader", "c160"], ["Oblivion Knight", "c145"], ["Pit Lord", "f145"], ["Rancid Defiler", "p115"], ["Serpent Magus", "p115"], ["Soul Killer", "f115"], ["Soul Killer Shaman", "f130"], ["Specter", "d100p100"], ["Steel Scarab", "l100"], ["Storm Caster", "l100"], ["Undead Soul Killer", "p110"], ["Unholy Corpse", "p120"], ["Vile Witch", "c155"]]}
];

// Damage types each build relies on: f fire, c cold, l lightning, p poison, d physical, m magic.
const BUILD_DAMAGE = {
  "javazon": "l", "strike-zon": "l", "strafe-zon": "d", "multishot-zon": "d", "freezing-zon": "c",
  "trapsin": "l", "mosaic": "clf", "kicksin": "d", "wof-sin": "f", "bladefury": "dm",
  "berserk-barb": "m", "ww-barb": "d", "throw-barb": "d", "frenzy-barb": "d", "singer-barb": "d",
  "wind-druid": "dc", "fire-druid": "f", "summon-druid": "d", "fury-druid": "d", "werebear": "d",
  "pnova-necro": "p", "summon-necro": "d", "bone-necro": "m", "bonespirit-necro": "m", "curse-necro": "fd",
  "hammerdin": "m", "fohdin": "lm", "smiter": "d", "zealot": "d", "dreamadin": "ld",
  "blizz-sorc": "c", "light-sorc": "l", "nova-sorc": "l", "fire-sorc": "f", "orb-sorc": "cf",
  "echo-lock": "d", "chaos-lock": "f", "abyss-lock": "m", "blades-lock": "m", "demon-lock": "d",
};

// Terror Zone schedule and zone ratings. Exposes window.TZ.
(() => {
  const ELEMENTS = { f: "Fire", c: "Cold", l: "Lightning", p: "Poison", d: "Physical", m: "Magic" };
  const SUNDERS = { c: "Cold Rupture", f: "Flame Rift", l: "Crack of the Heavens", p: "Rotting Fissure", d: "Bone Break", m: "Black Cleft" };
  const byId = new Map(TZ_ZONES.map((z) => [z.id, z]));
  for (const z of TZ_ZONES) z.immune = z.mons.map(([name, s]) => {
    const res = {};
    for (const m of s.matchAll(/([fclpdm])(\d+)/g)) res[m[1]] = Number(m[2]);
    return { name, res };
  });

  // ---------- SHA-1 (enough for the 8-byte inputs of the roll) ----------
  function sha1(bytes) {
    const ml = bytes.length, words = new Uint32Array((((ml + 8) >> 6) + 1) * 16);
    for (let i = 0; i < ml; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[ml >> 2] |= 0x80 << (24 - (ml % 4) * 8);
    words[words.length - 1] = ml * 8;
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);
    for (let b = 0; b < words.length; b += 16) {
      for (let i = 0; i < 16; i++) w[i] = words[b + i];
      for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
      let a = h0, b2 = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        const f = i < 20 ? (b2 & c) | (~b2 & d) : i < 40 ? b2 ^ c ^ d : i < 60 ? (b2 & c) | (b2 & d) | (c & d) : b2 ^ c ^ d;
        const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = (b2 << 30) | (b2 >>> 2); b2 = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b2) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4];
  }

  // ---------- single-player rotation ----------
  // The game's offline rotation (recovered from D2R 3.3 by the d2r-arcane-tracker project, MIT; verified against
  // d2emu's published schedule): every slot rolls SHA-1 of (slot time XOR seed); zones are picked by weight, the
  // picked zone's weight is handed to the others, so a zone never repeats and the longer it waits the likelier it gets.
  const [Y, Mo, D, H, Mi, Se] = TZ_CONFIG.start.match(/\d+/g).map(Number);
  const START = Date.UTC(Y, Mo - 1, D, H, Mi, Se) / 1000;
  const SEED = BigInt(TZ_CONFIG.seed);
  const ZONE_SECS = TZ_CONFIG.minutes * 60;
  const PERIOD = (TZ_CONFIG.minutes + TZ_CONFIG.breakMinutes) * 60;
  const N = TZ_ZONES.length;
  function roll(t) {
    let x = BigInt.asUintN(64, BigInt(t) ^ SEED);
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) { bytes[i] = Number(x & 0xffn); x >>= 8n; }
    const h = sha1(bytes)[0]; // first 4 digest bytes, read little-endian
    const le = ((h & 0xff) << 24 | ((h >>> 8) & 0xff) << 16 | ((h >>> 16) & 0xff) << 8 | (h >>> 24)) >>> 0;
    return le / 2 ** 32;
  }
  const picks = []; // zone index per slot, from slot 0
  let weights = null;
  function pickUpTo(slot) {
    if (!weights) {
      weights = new Array(N).fill(1 / (N - 1));
      weights[Math.floor(roll(START - PERIOD) * N)] = 0; // as if a zone was picked the slot before the first
    }
    for (let s = picks.length; s <= slot; s++) {
      const r = roll(START + PERIOD * s);
      let pick = N - 1, share = 0, cum = 0;
      for (let i = 0; i < N; i++) { cum += weights[i]; if (r < cum) { pick = i; share = weights[i] / (N - 1); break; } }
      for (let i = 0; i < N; i++) weights[i] += share;
      weights[pick] = 0;
      picks.push(pick);
    }
  }
  // Windows that end after `fromMs`, soonest first (the first may already have started).
  function spWindows(fromMs, count) {
    const t = Math.floor(fromMs / 1000);
    if (t < START) return [];
    let slot = Math.floor((t - START) / PERIOD);
    if (START + slot * PERIOD + ZONE_SECS <= t) slot++; // inside a break
    pickUpTo(slot + count - 1);
    const out = [];
    for (let s = slot; s < slot + count; s++) {
      const start = START + s * PERIOD;
      out.push({ start: start * 1000, end: (start + ZONE_SECS) * 1000, zone: TZ_ZONES[picks[s]] });
    }
    return out;
  }
  // Online zones switch on the same 30-minute boundaries.
  const nextSwitch = (ms) => (Math.floor(ms / 1000 / PERIOD) + 1) * PERIOD * 1000;

  // ---------- match a reported zone name (e.g. "Kurast Bazaar, Ruined Temple, and Disused Fane") ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+level\s+\d+/g, "").replace(/^the\s+/, "").trim();
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function matchName(name, act) {
    const text = norm(name);
    if (!text) return null;
    const actNo = Number(String(act || "").match(/\d/)?.[0]) || 0;
    let best = null, bestScore = 0;
    for (const z of TZ_ZONES) {
      if (actNo && z.act !== actNo) continue;
      if (norm(z.name) === text) return z;
      let score = 0;
      for (const a of new Set([...z.areas, ...z.alias].map(norm))) if (a && new RegExp(`\\b${reEsc(a)}\\b`).test(text)) score += a.length;
      if (score > bestScore) { best = z; bestScore = score; }
    }
    return best;
  }

  // ---------- rate a zone for a character ----------
  // elements: string of damage letters. breakers: { sunder: Set of letters, infinity: bool }.
  // A sunder charm lowers that immunity below 100; Infinity's Conviction breaks fire/cold/lightning immunity under 117%.
  function canHurt(res, el, breakers) {
    const r = res[el];
    if (r === undefined) return true;
    if (breakers.sunder.has(el)) return true;
    return breakers.infinity && "fcl".includes(el) && r < 117;
  }
  function rate(zone, elements, breakers) {
    const els = [...(elements || "")];
    const blocked = zone.immune.filter((m) => els.length && !els.some((e) => canHurt(m.res, e, breakers)));
    const total = zone.immune.length;
    const share = total ? (total - blocked.length) / total : 1;
    const grade = !els.length ? "unknown" : blocked.length === 0 ? "great" : share >= 0.85 ? "ok" : "tough";
    return { total, blocked, share, grade };
  }
  function immunitySummary(zone) {
    const counts = {};
    for (const m of zone.immune) for (const k of Object.keys(m.res)) counts[k] = (counts[k] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  window.TZ = { ELEMENTS, SUNDERS, byId, spWindows, nextSwitch, matchName, rate, immunitySummary, roll };
})();
