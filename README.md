# Gear Ledger — D2R gear tracker

Track Diablo II: Resurrected characters' equipped gear, mercenary, and charm inventory, and get upgrade recommendations by build and budget (Starter / Mid / Endgame).

**Live site:** https://jlyle.github.io/D2r-gear/

## Features
- Password-protected accounts, each with up to 10 characters and its own shared stash. Data is encrypted (AES-GCM, PBKDF2 key) and stored in the browser only; a forgotten password can't be recovered.
- Export account backup (still encrypted) / Import to move an account between devices
- Slot-by-slot gear picker with uniques, sets, runewords and common rare/crafted types
- Mercenary weapon, helm and armor
- Charm inventory with 10×4 cell usage and duplicate-unique warnings
- Shared stash (all characters): flags stash items that upgrade the current character, one-tap Equip that swaps the worn item back to stash
- Top 5 builds for every class, including the Warlock (Season 15 / Patch 3.3, Reign of the Warlock), with Starter/Mid/Endgame gear per slot
- Add gear from photos: snap item tooltips, on-device OCR (Tesseract.js) matches the item, pre-picks the slot and fills in your rolls
- Photos kept with each item (encrypted in IndexedDB with the account key, included in backups); tap to view full size
- Tooltip-style item display: your rolls one per line, typical stats underneath
- Upgrades tab: stash upgrades first, then per-slot suggestions with Traderie links, FCR breakpoint check for caster builds, missing charms

## Editing data
All items and build guides live in `data.js`. Add an item to `ITEMS`, then reference its exact name in a build's tier lists (`[starter, mid, endgame]`).

Fan-made; not affiliated with Blizzard Entertainment.
