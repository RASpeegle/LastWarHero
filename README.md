# Last War Hero Tracker

iPad-friendly web app for adding, updating, and removing Last War heroes in the Tank, Air, and Missile squads. Data lives in the **Hero Stats** Google Sheet; the app is a Google Apps Script web app bound to that sheet, so there is no server, hosting, or API key to manage.

## How it uses the sheet

The app reads and writes `Sheet1`, columns A:M, with this header row (checked on every call; a mismatch stops the app with a clear error rather than writing to the wrong column):

`Squad | Name | Power | Gear Top Left | Gear Bottom Left | Gear Top Right | Gear Bottom Right | Skill Top Left | Skill Bottom Left | Skill Top Right | Skill Bottom Right | Tier Stars | Exclusive Weapon`

Each squad is a block of rows separated by a blank row. The existing layout is preserved:

| Action | What happens in the sheet |
|---|---|
| Add | Fills the first row in that squad's block with a blank Name. If none, inserts a row at the end of the block. |
| Update | Rewrites the hero's row in place. Changing the squad frees the old slot and fills one in the new squad. |
| Remove | Clears B:M on that row and keeps the Squad label, leaving an open slot. |

Rules enforced: max 5 heroes per squad, hero names unique across squads, Power is a whole number, Tier Stars is numeric (e.g. `3.1`). Gear (`40 5*`), Skills (`Max`), and Exclusive Weapon (`NA`) are free text with light normalization (`max` becomes `Max`, `n/a` becomes `NA`). Plain numbers are stored as numbers so the sheet can still sort and sum them.

Every write runs under a script lock and checks that the row still holds the hero you opened. If you edited the sheet directly in the meantime, the app refuses the write and reloads instead of overwriting the wrong row.

## Setup (one time, about 5 minutes, easiest on a desktop browser)

1. Open the **Hero Stats** sheet. Choose **Extensions > Apps Script**.
2. In the editor, replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs).
3. Click **+ > HTML**, name it `Index` (exactly; the editor adds `.html`), and paste [`apps-script/Index.html`](apps-script/Index.html).
4. Save. Click **Deploy > New deployment**, gear icon **> Web app**:
   - Execute as: **Me**
   - Who has access: **Only myself**
5. Click **Deploy**, then **Authorize access** and approve. Google shows an "unverified app" warning because this is your own script: choose **Advanced > Go to (project name)**. The script requests access to the **current spreadsheet only** (`@OnlyCurrentDoc`).
6. Copy the **Web app URL** (ends in `/exec`).

### On the iPad

1. Open the `/exec` URL in Safari, signed in to the same Google account.
2. Tap **Share > Add to Home Screen** to get an app icon.

Landscape shows all three squads side by side; portrait switches to Tank / Air / Missile tabs.

### Updating after code changes

Paste the new code, then **Deploy > Manage deployments > (pencil) > Version: New version > Deploy**. This keeps the same URL. Creating a *new* deployment gives a new URL and the home screen icon would point at the old version.

Optional: deploy from this repo with [`clasp`](https://github.com/google/clasp) (`clasp clone <scriptId> --rootDir apps-script`, then `clasp push` and `clasp deploy -i <deploymentId>`).

## Upgrade advice

The **Advice** button shows a ranked list of upgrades for your squads, and each hero card shows its next step. The advice comes from a weekly scheduled Claude session (Sundays around 6am Eastern) that runs on your Claude subscription. No API key is involved.

How a weekly run works:

1. It reads **Hero Stats** (the squads, plus the **Settings** tab) through the Google Drive connector.
2. It researches only the sites in [`intel/trusted-sources.json`](intel/trusted-sources.json). Today that is cpt-hedge.com as the primary source, allclash.com and lastwartutorial.com, and pocketgamer.com for corroboration only.
3. It ranks 6 to 10 concrete actions. Each action has the reason, a confidence level and citations.
4. It checks the report with [`intel/validate.js`](intel/validate.js). Any citation from a site outside the trusted list fails the check.
5. It publishes `intel/recommendations.json` to the repo's `intel` branch with [`intel/publish.sh`](intel/publish.sh).

The full instructions the session follows are in [`intel/ROUTINE.md`](intel/ROUTINE.md). Edit that file or the trusted-source list to change how advice is produced; the next run picks up the change.

The app reads the report from GitHub (cached for 15 minutes; the ↻ button in the Advice panel bypasses the cache). It also warns you when:

- the report is more than 8 days old;
- your Settings changed after the report was made;
- a hero's power, stars or Exclusive Weapon changed since the report (that hero's card shows "updated since advice").

**Settings** (⚙︎ button): Season, Goal (Balanced, PvP, or PvE / zombie events) and free-text Notes. Use Notes for things the sheet can't show, such as heroes you own outside your squads or what you're saving for.

**After updating to this version,** the first time you open the app Google asks you to approve one new permission: "Connect to an external service". It's needed to download the report from GitHub.

**Privacy:** the repo is public, so the report and your hero stats snapshot are publicly readable. Make the repo private only if you also give Apps Script a GitHub token, because a private repo's files can't be fetched without one.

## Configuration

Top of `Code.gs`:

```js
const CONFIG = { sheetName: 'Sheet1', squads: ['Tank', 'Air', 'Missile'], squadSize: 5 };
```

Renaming the tab or adding a squad (e.g. a fourth squad) only needs a change here. If you add or reorder columns, update `COLUMNS` in `Code.gs` and the `FIELDS` list and form in `Index.html`.

## Development

Requires Node 18+. No dependencies.

```sh
npm test          # runs Code.gs against an in-memory copy of the sheet, plus the report validator
npm run preview   # builds preview.html: the full app running locally on mock data
```

`test/mock-apps-script.js` stubs `SpreadsheetApp` and `LockService` and is seeded with a snapshot of the real sheet.
