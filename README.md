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

## Configuration

Top of `Code.gs`:

```js
const CONFIG = { sheetName: 'Sheet1', squads: ['Tank', 'Air', 'Missile'], squadSize: 5 };
```

Renaming the tab or adding a squad (e.g. a fourth squad) only needs a change here. If you add or reorder columns, update `COLUMNS` in `Code.gs` and the `FIELDS` list and form in `Index.html`.

## Development

Requires Node 18+. No dependencies.

```sh
npm test          # runs Code.gs against an in-memory copy of the sheet
npm run preview   # builds preview.html: the full app running locally on mock data
```

`test/mock-apps-script.js` stubs `SpreadsheetApp` and `LockService` and is seeded with a snapshot of the real sheet.
