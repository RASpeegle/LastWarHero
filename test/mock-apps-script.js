// Minimal in-memory stand-ins for SpreadsheetApp / LockService, enough to run Code.gs.
// Works in Node (module.exports) and in the browser (window.MockAppsScript).
(function (root) {
  function createSheet(rows) {
    const grid = rows.map((r) => r.slice());
    const width = () => Math.max(...grid.map((r) => r.length));
    const getLastRow = () => {
      for (let i = grid.length - 1; i >= 0; i--) if (grid[i].some((v) => v !== '' && v != null)) return i + 1;
      return 0;
    };
    const ensure = (r, c) => {
      while (grid.length < r) grid.push([]);
      grid.forEach((row) => { while (row.length < Math.max(c, width())) row.push(''); });
    };
    const sheet = {
      grid,
      getLastRow,
      insertRowAfter(r) { grid.splice(r, 0, new Array(width()).fill('')); },
      getRange(r, c, nr, nc) {
        return {
          getDisplayValues() {
            ensure(r + nr - 1, c + nc - 1);
            return grid.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc).map((v) => (v == null ? '' : String(v))));
          },
          setValues(vals) {
            ensure(r + nr - 1, c + nc - 1);
            vals.forEach((row, i) => row.forEach((v, j) => (grid[r - 1 + i][c - 1 + j] = v)));
          },
          clearContent() {
            ensure(r + nr - 1, c + nc - 1);
            for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) grid[r - 1 + i][c - 1 + j] = '';
          },
        };
      },
    };
    return sheet;
  }

  // Snapshot of the real "Hero Stats" sheet (Sheet1, A1:M18) as of 2026-10-10.
  const SEED = [
    ['Squad', 'Name', 'Power', 'Gear Top Left', 'Gear Bottom Left', 'Gear Top Right', 'Gear Bottom Right', 'Skill Top Left', 'Skill Bottom Left', 'Skill Top Right', 'Skill Bottom Right', 'Tier Stars', 'Exclusive Weapon'],
    ['Tank', 'Kimberly', 4459565, '40 5*', '40 5*', 40, 40, 33, 'Max', 'Max', 'Max', 5, 17],
    ['Tank', 'Murphy', 4314695, 40, 40, '40 2*', '40 2*', 20, 23, 31, 'Max', 5, 10],
    ['Tank', 'Williams', 3516320, 40, 40, '40 1*', '40 2*', 11, 27, 'Max', 'Max', 5, 'NA'],
    ['Tank', 'Stetmann', 3265648, '40 2*', '40 1*', 40, 40, 24, 26, 28, 'Max', 5, 'NA'],
    ['Tank', 'Marshall', 3144527, 40, 40, 40, 40, 15, 23, 'Max', 'Max', 5, 'NA'],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Air', 'DVA', 3330489, 40, 40, 0, 0, 14, 13, 24, 'Max', 5, 10],
    ['Air', 'Carlie', 3189185, 0, 0, 30, 40, 5, 3, 5, 'Max', 5, 2],
    ['Air', 'Lucius', 2515799, 0, 0, 20, 37, 2, 10, 10, '', 4, 'NA'],
    ['Air', 'Morrison', 2150868, 20, 10, 0, 0, 1, 1, 1, '', 3.1, 'NA'],
    ['Air', 'Schuyler', 2130557, 0, 0, 0, 0, 1, 1, 1, '', 3, 'NA'],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Missile', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Missile', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Missile', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Missile', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Missile', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  function install(target, rows) {
    const sheet = createSheet(rows || SEED);
    target.SpreadsheetApp = {
      getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'Sheet1' ? sheet : null), getSheets: () => [sheet] }),
      flush() {},
    };
    target.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
    return sheet;
  }

  const api = { createSheet, install, SEED };
  if (typeof module !== 'undefined') module.exports = api;
  else root.MockAppsScript = api;
})(this);
