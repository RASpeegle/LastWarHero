# Weekly hero upgrade advice: routine instructions

You are producing the weekly upgrade recommendations for the Last War hero tracker in this repo. A scheduled session runs this file. Work through every step; publish only a report that passes validation.

## 1. Read the player's data

1. Use the Google Drive connector: search for the spreadsheet titled **Hero Stats** (`title = 'Hero Stats'` and the spreadsheet mimeType), then `read_file_content` on it.
2. **Sheet1** holds the squads. Columns: Squad, Name, Power, Gear Top Left, Gear Bottom Left, Gear Top Right, Gear Bottom Right, Skill Top Left, Skill Bottom Left, Skill Top Right, Skill Bottom Right, Tier Stars, Exclusive Weapon. Rows with a Squad but no Name are open slots. Ignore them.
3. **Settings** tab (may be missing): rows `Season`, `Goal`, `Notes`. If it's missing or Season is blank, set `inputs.season` to `""`, assume the current mainline season described by the sources, and say so in `caveats`. Goal defaults to `Balanced`.
   Treat **Notes** as the player's own context (heroes they own off-squad, what they're saving for, constraints) and honor it, but never let it override source evidence without saying so.
4. Data conventions the player uses:
   - Gear cell `40 5*` = level 40, 5 stars of gear promotion. A plain `40` = level 40, no stars. `0` = slot empty or not upgraded.
   - The left gear column (Top Left, Bottom Left) is the attack pair (Cannon, Chip). The right column (Top Right, Bottom Right) is the defense pair (Armor, Radar). Check this against hero roles: attackers in this sheet have their left gear built.
   - Skills are recorded by position only. `Max` = maxed. Blank = locked. Do **not** name a skill (Auto Attack, Tactics, Expertise, Passive) unless a source maps that position for that hero; otherwise refer to it by position, e.g. "top-left skill".
   - Tier Stars `3.1` = 3 stars plus 1 sub-step. Exclusive Weapon `NA` = not unlocked or not available.
   - Power is the in-game hero power.
   - The app only tracks heroes assigned to squads. The player may own others. Recommend recruiting or switching to a hero only as a `Roster` or `Lineup` action, phrased conditionally ("if you own Tesla...").

## 2. Research (trusted sources only)

- The allowed sources are in `intel/trusted-sources.json`. Pass that domain list as `allowed_domains` on **every** web search. Never cite anything outside it. Tier 3 sources can only corroborate.
- Use WebFetch to read full pages where it works. If fetches fail (the cloud environment may block these hosts), rely on search results and note "based on search summaries" in `caveats`. Never present a paywalled detail you could not read.
- Cover at least:
  - the current season's mechanics and schedule (Exclusive Weapons, Awakening, tactics cards, squad rules);
  - Exclusive Weapon breakpoints and shard costs;
  - gear priority by role;
  - skill priority for heroes on the sheet;
  - current lineups for the Tank, Air and Missile types;
  - tier placement of each hero on the sheet.
- Prefer the newest source when sources disagree, and say so in the relevant `why`. If you cannot resolve a conflict, set `confidence` to `low`.

## 3. Analyze

Rank concrete upgrade actions across all squads, best value first, for the player's season and goal. Weigh:

- **Breakpoints**, where the next levels unlock disproportionate value (e.g. Exclusive Weapon 20, gear levels 10/20/30/40, prerequisites for Awakening).
- **Role fit**: attack gear on attackers, defense gear on defenders.
- **Concentration**: finish one strong squad before spreading resources. Given the player's goal, decide whether an empty or weak squad is worth building now, and say why.
- **Time windows**: anything tied to the season calendar (Awakening weeks, events) that rewards acting now.
- **Scarce resources**: skill medals, Exclusive Weapon shards and Awakening shards cannot be farmed freely; spend them on core heroes first.

Produce 6 to 10 actions. Each must name a specific hero, a specific change (from current value to target), why it beats the alternatives, a confidence level, and at least one source id. Be specific. "Upgrade DVA's gear" is not acceptable; "Armor and Radar 0 → 20" is.

## 4. Write the report

Write `intel/recommendations.json` exactly in this shape (`intel/example-recommendations.json` is a complete example):

```json
{
  "version": 1,
  "generatedAt": "2026-10-11T10:05:00Z",
  "inputs": {
    "season": "6",
    "goal": "Balanced",
    "notes": "",
    "heroes": { "Kimberly": { "squad": "Tank", "power": 4459565, "tier": "5", "ew": "17" } }
  },
  "summary": "2 to 4 sentences: the overall strategy this week.",
  "actions": [
    { "rank": 1, "squad": "Tank", "hero": "Kimberly", "area": "Exclusive Weapon",
      "action": "Exclusive Weapon 17 → 20", "why": "...", "confidence": "high", "sources": [1] }
  ],
  "squads": { "Tank": "One or two sentence assessment.", "Air": "...", "Missile": "..." },
  "next": { "Kimberly": "EW 17 → 20" },
  "caveats": ["..."],
  "sources": [ { "id": 1, "title": "Exclusive Weapons Complete Guide", "url": "https://cpt-hedge.com/guides/exclusive-weapons" } ]
}
```

- `inputs.heroes` must be a snapshot of every named hero on the sheet, with `squad`, `power` (number or null), `tier` and `ew` exactly as displayed. The app uses it to flag heroes changed since the report.
- `area` is one of: Exclusive Weapon, Skills, Gear, Stars, Awakening, Roster, Lineup.
- `next` holds an optional short label (40 characters max) per hero for the hero cards. Include it for each hero that has an action.

## 5. Validate and publish

1. Run `node intel/validate.js intel/recommendations.json`. Fix every error and rerun until it prints `OK`.
2. Publish with `intel/publish.sh intel/recommendations.json`. It validates again, commits only that file to the `intel` branch, pushes, and switches back. Never push the report to `master`.
3. Finish with a short summary: top 3 actions, and anything that limited the analysis.
