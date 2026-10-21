# Perfect Roll — D2R gear tracker

Track Diablo II: Resurrected characters' equipped gear, mercenary, and charm inventory, and get upgrade recommendations by build and budget (Starter / Mid / Endgame).

**Live site:** https://jlyle.github.io/D2r-gear/

![Gear tab: each slot shows the item, its typical stats and your actual rolls, with a tier badge for your build](screenshots/gear.png)

## Features
- Password-protected accounts, each with up to 10 characters and its own shared stash. Data is encrypted (AES-GCM, PBKDF2 key) and stored in the browser only; a forgotten password can't be recovered.
- Export account backup (still encrypted) / Import to move an account between devices
- Slot-by-slot gear picker with uniques, sets, runewords and common rare/crafted types, plus item search (name, nickname or rune recipe)
- Mercenary weapon, helm and armor
- Charm inventory with 10×4 cell usage and duplicate-unique warnings
- Shared stash (all characters): any item — gear, runes, gems, jewels, keys, organs, essences, tokens, or your own custom items; flags stash items that upgrade the current character, one-tap Equip that swaps the worn item back to stash
- Top 5 builds for every class, including the Warlock (Season 15 / Patch 3.3, Reign of the Warlock), with Starter/Mid/Endgame gear per slot
- Add gear from photos: snap item tooltips, on-device OCR (Tesseract.js) matches the item, pre-picks the slot and fills in your rolls
- Photos are only used to read stats and are never stored; items show original gear-type icons tinted by rarity
- Tooltip-style item display: typical stats, a divider, then the item's actual stats; per-item Scan stats from a photo
- Runewords tab: what you can make from the runes in your stash, what you're one or two runes away from, and Traderie links for the missing ones
- Gems & Cube tab: gem inventory by grade, Horadric Cube rune and gem upgrades you can do right now
- Skills tab: suggested skill point order and amounts plus stat points for all 40 builds
- Upgrades tab: stash upgrades first, then per-slot suggestions with Traderie links, FCR breakpoint check for caster builds, missing charms

## Recording your item's actual stats
Every item you own — worn, on the merc, in the charm inventory or in the shared stash — shows two blocks: **Typical stats** (what the item can roll, from the game data) and **Actual stats** (the rolls on *your* copy). Actual stats are optional, but they're what tells a 15% Enigma from a perfect one when you're comparing or trading.

There are three ways to fill them in, all under the item's tooltip:
- **📷 Scan stats** — take a photo of the in-game tooltip. The text is read on your device and the photo is thrown away. For known uniques, sets and runewords the reader matches against that item's own stat lines, so OCR slips get corrected; for magic charms and jewels it uses the affix name (e.g. "Cobalt Small Charm of Vita") to know which stats to look for.
- **🖼 From gallery** — same thing from a screenshot you already have.
- **✎ Type stats / Edit stats** — one stat per line, e.g. `+35% Faster Cast Rate`. Use this to fix anything the scan got wrong.

Good to know:
- A line marked **check** is one the scan couldn't read. Tap Edit stats and enter your roll.
- Scanning again asks before replacing stats you already have.
- Stats stay with the item: **Equip** from the stash carries them onto the character, and the item it replaces goes back to the stash with its own stats intact.
- Picking a *different* item in a slot clears that slot's stats, since the old rolls no longer apply.
- Custom items added on the Stash tab take an optional stats box when you create them.
- **Find in your stash** searches actual stats too, so you can look up "faster cast" or "all resist" across everything you own.
- Upgrade suggestions are ranked by item and build tier, not by your exact rolls — actual stats are for your own comparison.

## Runes
Runes live in the shared stash like any other item, so every character on the account sees the same pile.

**Adding runes:** on the Stash tab, choose Gear type **Rune** and pick from El through Zod. Runes stack: adding one you already have bumps its count instead of making a new row, and the − / + buttons on the row change the count directly.

**Runewords tab** — built from the runes in your stash:
- **Runes in your stash** — every rune you hold, in game order, with counts.
- **Ready to make** — runewords you have every rune for, with how many you can make. Ones used by your current build are starred and listed first.
- **Almost there** — runewords missing one or two runes where you already own at least half the recipe. Each missing rune links to a Traderie search.
- Each card shows the rune order, allowed bases, required level, and the runeword's stats.
- Filter to **All runewords** or **Only** your current build's.

**Gems & Cube tab** — Horadric Cube upgrades from your stash:
- **Rune upgrades you can cube now** — El through Ort take 3 runes; Thul through Lem take 3 runes plus a gem; Pul and up take 2 runes plus a gem. The required gem follows the game's recipe table (Topaz, Amethyst, Sapphire, Ruby, Emerald, Diamond, stepping up a grade every six runes).
- **Missing only the gem** — recipes where you have the runes but not the gem, with a note when you could cube that gem from three of the grade below.
- **Gem upgrades** — any three gems of the same type and grade that make one of the next grade.
- **All rune recipes** — a collapsible reference of the full El → Zod chain.

Each recipe is counted on its own, so two recipes that need the same gem can both show as available — cube one and the other updates.

## Screenshots
**Upgrades:** stash items that beat what you're wearing come first, then the FCR breakpoint check and charms still to get.

![Upgrades tab](screenshots/upgrades.png)

**Stash:** items shared by all your characters, with upgrades for the current one flagged and one-tap Equip.

![Shared stash with an upgrade flagged](screenshots/stash.png)

**Skills:** skill point order and amounts for the selected build.

![Skills tab](screenshots/skills.png)

**On a phone:** the whole app works at phone width, including photo import.

![Gear tab on a phone](screenshots/mobile-gear.png)

## Editing data
Curated items and build guides live in `data.js`. `catalog.js` adds every other D2R unique, set item and runeword; it's generated by `tools/gen_catalog.js` from [blizzhackers/d2data](https://github.com/blizzhackers/d2data) (MIT): `node tools/gen_catalog.js <path-to-d2data> catalog.js`.

In `data.js`: Add an item to `ITEMS`, then reference its exact name in a build's tier lists (`[starter, mid, endgame]`).

Fan-made; not affiliated with Blizzard Entertainment.
