# Gear Ledger — D2R gear tracker

Track Diablo II: Resurrected characters' equipped gear, mercenary, and charm inventory, and get upgrade recommendations by build and budget (Starter / Mid / Endgame).

**Live site:** https://jlyle.github.io/D2r-gear/

## Features
- Roster of characters, saved in the browser (Export/Import backup to move between devices)
- Slot-by-slot gear picker with uniques, sets, runewords and common rare/crafted types
- Mercenary weapon, helm and armor
- Charm inventory with 10×4 cell usage and duplicate-unique warnings
- Shared stash (all characters): flags stash items that upgrade the current character, one-tap Equip that swaps the worn item back to stash
- Upgrades tab: stash upgrades first, then per-slot suggestions with Traderie links, FCR breakpoint check for caster builds, missing charms

## Editing data
All items and build guides live in `data.js`. Add an item to `ITEMS`, then reference its exact name in a build's tier lists (`[starter, mid, endgame]`).

Fan-made; not affiliated with Blizzard Entertainment.
