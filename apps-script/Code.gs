/** @OnlyCurrentDoc */

/**
 * Last War Hero Tracker: server side.
 *
 * Bound to the "Hero Stats" Google Sheet. The sheet keeps each squad as a
 * block of rows (Squad in column A) separated by blank rows. A row whose
 * Squad is set but Name is blank is an open slot. Removing a hero clears the
 * slot but keeps the Squad label so the block layout survives.
 */

const CONFIG = {
  sheetName: 'Sheet1',
  squads: ['Tank', 'Air', 'Missile'],
  squadSize: 5,
};

// Sheet columns A:M, in order. Header text is checked on every call so a
// reordered sheet fails loudly instead of writing into the wrong column.
const COLUMNS = [
  { key: 'squad', header: 'Squad' },
  { key: 'name', header: 'Name' },
  { key: 'power', header: 'Power' },
  { key: 'gearTL', header: 'Gear Top Left' },
  { key: 'gearBL', header: 'Gear Bottom Left' },
  { key: 'gearTR', header: 'Gear Top Right' },
  { key: 'gearBR', header: 'Gear Bottom Right' },
  { key: 'skillTL', header: 'Skill Top Left' },
  { key: 'skillBL', header: 'Skill Bottom Left' },
  { key: 'skillTR', header: 'Skill Top Right' },
  { key: 'skillBR', header: 'Skill Bottom Right' },
  { key: 'tier', header: 'Tier Stars' },
  { key: 'ew', header: 'Exclusive Weapon' },
];
const NUM_COLS = COLUMNS.length;

const STALE_MSG = 'The sheet changed since you loaded it. Data has been refreshed; please try again.';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Last War Heroes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

// ---------------------------------------------------------------------------
// Public API (called from the client via google.script.run)
// ---------------------------------------------------------------------------

function getHeroes() {
  return snapshot_(getSheet_());
}

/**
 * Adds or updates a hero.
 * hero.row / hero.originalName are set when editing an existing hero; the
 * name is re-checked against the sheet so an edit never lands on a row that
 * moved or was changed elsewhere.
 */
function saveHero(hero) {
  return withLock_(function (sheet) {
    const h = normalize_(hero);
    const rows = readRows_(sheet);
    const editingRow = hero.row ? Number(hero.row) : null;

    const dup = rows.find(function (r) {
      return r.name && sameName_(r.name, h.name) && r.row !== editingRow;
    });
    if (dup) throw new Error(dup.name + ' is already in the ' + canonicalSquad_(dup.squad) + ' squad.');

    if (!editingRow) {
      writeRow_(sheet, slotFor_(sheet, rows, h.squad), h);
      return;
    }

    const current = rows.find(function (r) { return r.row === editingRow; });
    if (!current || !sameName_(current.name, hero.originalName)) throw new Error(STALE_MSG);

    if (canonicalSquad_(current.squad) === h.squad) {
      writeRow_(sheet, editingRow, h);
      return;
    }

    // Moving squads: check capacity before touching anything, then free the
    // old slot and place the hero in the new squad.
    assertCapacity_(rows, h.squad);
    clearSlot_(sheet, editingRow);
    writeRow_(sheet, slotFor_(sheet, readRows_(sheet), h.squad), h);
  });
}

function removeHero(row, name) {
  return withLock_(function (sheet) {
    const current = readRows_(sheet).find(function (r) { return r.row === Number(row); });
    if (!current || !sameName_(current.name, name)) throw new Error(STALE_MSG);
    clearSlot_(sheet, current.row);
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function withLock_(mutate) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    mutate(sheet);
    SpreadsheetApp.flush();
    return snapshot_(sheet);
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheetName) || ss.getSheets()[0];
  const headers = sheet.getRange(1, 1, 1, NUM_COLS).getDisplayValues()[0];
  COLUMNS.forEach(function (c, i) {
    const actual = String(headers[i]).trim();
    if (actual.toLowerCase() !== c.header.toLowerCase()) {
      throw new Error('Column ' + String.fromCharCode(65 + i) + ' header is "' + actual +
        '", expected "' + c.header + '". Fix the sheet header row or update COLUMNS in Code.gs.');
    }
  });
  return sheet;
}

function readRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, NUM_COLS).getDisplayValues().map(function (values, i) {
    const r = { row: i + 2 };
    COLUMNS.forEach(function (c, j) { r[c.key] = String(values[j]).trim(); });
    return r;
  });
}

function snapshot_(sheet) {
  const squads = {};
  CONFIG.squads.forEach(function (s) { squads[s] = []; });
  readRows_(sheet).forEach(function (r) {
    const squad = canonicalSquad_(r.squad);
    if (!squad || !r.name) return;
    r.squad = squad;
    r.power = parsePower_(r.power);
    squads[squad].push(r);
  });
  return { squads: squads, squadNames: CONFIG.squads, squadSize: CONFIG.squadSize };
}

function assertCapacity_(rows, squad) {
  const filled = rows.filter(function (r) { return r.name && canonicalSquad_(r.squad) === squad; }).length;
  if (filled >= CONFIG.squadSize) {
    throw new Error('The ' + squad + ' squad is full (' + CONFIG.squadSize + ' heroes). Remove one first.');
  }
}

/** Returns the row to write a new hero into, inserting one if needed. */
function slotFor_(sheet, rows, squad) {
  assertCapacity_(rows, squad);
  const squadRows = rows.filter(function (r) { return canonicalSquad_(r.squad) === squad; });
  const open = squadRows.find(function (r) { return !r.name; });
  if (open) return open.row;
  if (squadRows.length) {
    const after = squadRows[squadRows.length - 1].row;
    sheet.insertRowAfter(after);
    return after + 1;
  }
  // Squad has no block yet: start one below the data, after a blank separator.
  const last = sheet.getLastRow();
  return last < 2 ? 2 : last + 2;
}

function writeRow_(sheet, row, h) {
  sheet.getRange(row, 1, 1, NUM_COLS).setValues([COLUMNS.map(function (c) { return toCell_(h[c.key]); })]);
}

function clearSlot_(sheet, row) {
  sheet.getRange(row, 2, 1, NUM_COLS - 1).clearContent();
}

function normalize_(hero) {
  if (!hero) throw new Error('No hero data received.');
  const h = {};
  COLUMNS.forEach(function (c) {
    h[c.key] = String(hero[c.key] == null ? '' : hero[c.key]).trim().replace(/\s+/g, ' ');
  });

  h.squad = canonicalSquad_(h.squad);
  if (!h.squad) throw new Error('Squad must be one of: ' + CONFIG.squads.join(', ') + '.');
  if (!h.name) throw new Error('Name is required.');
  if (h.name.length > 40) throw new Error('Name is too long (40 characters max).');

  if (h.power) {
    const p = h.power.replace(/[,\s]/g, '');
    if (!/^\d+$/.test(p)) throw new Error('Power must be a whole number.');
    h.power = p;
  }
  if (h.tier && !/^\d+(\.\d+)?$/.test(h.tier)) throw new Error('Tier Stars must be a number, e.g. 5 or 3.1.');

  ['skillTL', 'skillBL', 'skillTR', 'skillBR'].forEach(function (k) {
    if (/^max$/i.test(h[k])) h[k] = 'Max';
  });
  ['gearTL', 'gearBL', 'gearTR', 'gearBR'].forEach(function (k) {
    h[k] = h[k].replace(/\s*\*$/, '*');
  });
  if (/^n\/?a$/i.test(h.ew)) h.ew = 'NA';
  return h;
}

/** Plain numbers go in as numbers so the sheet can sort/sum them; "40 5*", "Max", "NA" stay text. */
function toCell_(v) {
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

function parsePower_(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return v && isFinite(n) ? n : null;
}

function canonicalSquad_(s) {
  const t = String(s || '').trim().toLowerCase();
  return CONFIG.squads.find(function (q) { return q.toLowerCase() === t; }) || null;
}

function sameName_(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
