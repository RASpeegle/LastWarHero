// Runs Code.gs against the mock sheet. `node --test test/`
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { install } = require('./mock-apps-script');

const SRC = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');

function load() {
  const ctx = {};
  vm.createContext(ctx);
  const sheet = install(ctx);
  // const/let at top level aren't context properties; expose what tests need.
  vm.runInContext(SRC + '\n;this.__api = { getHeroes, saveHero, removeHero };', ctx);
  return { api: ctx.__api, sheet };
}
const names = (d, s) => Array.from(d.squads[s], (h) => h.name);

test('reads squads from the block layout', () => {
  const { api } = load();
  const d = api.getHeroes();
  assert.deepStrictEqual(names(d, 'Tank'), ['Kimberly', 'Murphy', 'Williams', 'Stetmann', 'Marshall']);
  assert.strictEqual(d.squads.Air.length, 5);
  assert.strictEqual(d.squads.Missile.length, 0);
  assert.strictEqual(d.squads.Tank[0].power, 4459565);
  assert.strictEqual(d.squads.Air[3].tier, '3.1');
});

test('add fills the first open Missile slot and types cells', () => {
  const { api, sheet } = load();
  const d = api.saveHero({ squad: 'missile', name: ' Swift ', power: '1,234,567', gearTL: '40 3 *', skillBR: 'max', ew: 'n/a', tier: '4.2' });
  assert.deepStrictEqual(names(d, 'Missile'), ['Swift']);
  assert.deepStrictEqual(sheet.grid[13].slice(0, 4), ['Missile', 'Swift', 1234567, '40 3*']);
  assert.strictEqual(sheet.grid[13][10], 'Max');
  assert.strictEqual(sheet.grid[13][11], 4.2);
  assert.strictEqual(sheet.grid[13][12], 'NA');
});

test('full squad and duplicate names are rejected', () => {
  const { api } = load();
  assert.throws(() => api.saveHero({ squad: 'Tank', name: 'Venom' }), /Tank squad is full/);
  assert.throws(() => api.saveHero({ squad: 'Missile', name: 'kimberly' }), /already in the Tank squad/);
  assert.throws(() => api.saveHero({ squad: 'Missile', name: '' }), /Name is required/);
  assert.throws(() => api.saveHero({ squad: 'Missile', name: 'X', power: '12abc' }), /whole number/);
});

test('update writes in place; stale edits are refused', () => {
  const { api, sheet } = load();
  const murphy = api.getHeroes().squads.Tank[1];
  api.saveHero({ ...murphy, power: '4400000', skillTL: '21', originalName: 'Murphy' });
  assert.strictEqual(sheet.grid[2][2], 4400000);
  assert.strictEqual(sheet.grid[2][7], 21);
  assert.throws(() => api.saveHero({ ...murphy, originalName: 'Kimberly' }), /changed since you loaded/);
});

test('remove clears the slot but keeps the squad label; slot is reused', () => {
  const { api, sheet } = load();
  let d = api.removeHero(4, 'Williams');
  assert.deepStrictEqual(names(d, 'Tank'), ['Kimberly', 'Murphy', 'Stetmann', 'Marshall']);
  assert.deepStrictEqual([...sheet.grid[3]], ['Tank', '', '', '', '', '', '', '', '', '', '', '', '']);
  d = api.saveHero({ squad: 'Tank', name: 'Venom' });
  assert.strictEqual(sheet.grid[3][1], 'Venom');
  assert.throws(() => api.removeHero(4, 'Williams'), /changed since you loaded/);
});

test('moving squads frees old slot; rows are inserted when a block has no open slot', () => {
  const { api, sheet } = load();
  api.removeHero(6, 'Marshall'); // open a Tank slot
  const dva = api.getHeroes().squads.Air[0];
  let d = api.saveHero({ ...dva, squad: 'Tank', originalName: 'DVA' });
  assert.ok(names(d, 'Tank').includes('DVA'));
  assert.ok(!names(d, 'Air').includes('DVA'));
  assert.strictEqual(sheet.grid[5][1], 'DVA');
  assert.strictEqual(sheet.grid[7][1], '');

  // Remove the Air block's spare label so the Air squad has 4 heroes and no open row, then add one.
  sheet.grid[7][0] = '';
  d = api.saveHero({ squad: 'Air', name: 'Sarah' });
  assert.ok(names(d, 'Air').includes('Sarah'));
  assert.strictEqual(sheet.grid[12][1], 'Sarah'); // inserted after Schuyler (row 12 -> new row 13)
  assert.strictEqual(sheet.grid[14][0], 'Missile'); // Missile block shifted down intact
});

test('moving into a full squad fails without losing the hero', () => {
  const { api } = load();
  const dva = api.getHeroes().squads.Air[0];
  assert.throws(() => api.saveHero({ ...dva, squad: 'Tank', originalName: 'DVA' }), /full/);
  assert.ok(names(api.getHeroes(), 'Air').includes('DVA'));
});

test('header mismatch fails loudly', () => {
  const { api, sheet } = load();
  sheet.grid[0][2] = 'Might';
  assert.throws(() => api.getHeroes(), /Column C header is "Might"/);
});

// --- Settings and advice -----------------------------------------------------

function loadWith(opts) {
  const ctx = {};
  vm.createContext(ctx);
  const sheet = install(ctx, null, opts);
  vm.runInContext(SRC + '\n;this.__api = { getSettings, saveSettings, getAdvice };', ctx);
  return { api: ctx.__api, sheet };
}

test('settings default when the tab is missing, and round-trip once saved', () => {
  const { api, sheet } = loadWith();
  assert.deepStrictEqual({ ...api.getSettings() }, { season: '', goal: 'Balanced', notes: '' });
  const s = api.saveSettings({ season: ' 6 ', goal: 'PvP', notes: 'Saving  shards for DVA' });
  assert.deepStrictEqual({ ...s }, { season: '6', goal: 'PvP', notes: 'Saving shards for DVA' });
  assert.strictEqual(sheet.tabs.Settings.grid[0][0], 'Setting');
  assert.strictEqual(sheet.tabs.Settings.grid[1][1], "'6"); // stored as text
  assert.throws(() => api.saveSettings({ season: 'six', goal: 'PvP' }), /Season must be a number/);
  assert.throws(() => api.saveSettings({ season: '6', goal: 'Whales' }), /Goal must be one of/);
});

test('advice: 404 means no report yet; 200 is parsed and cached; bad JSON is reported', () => {
  let calls = 0;
  let resp = { code: 404, body: 'nope' };
  const { api } = loadWith({ fetch: () => { calls++; return resp; } });
  assert.strictEqual(api.getAdvice().report, null);

  resp = { code: 200, body: JSON.stringify({ version: 1, summary: 'hi' }) };
  assert.strictEqual(api.getAdvice().report.summary, 'hi');
  resp = { code: 200, body: JSON.stringify({ version: 1, summary: 'newer' }) };
  assert.strictEqual(api.getAdvice().report.summary, 'hi'); // served from cache
  assert.strictEqual(api.getAdvice(true).report.summary, 'newer'); // refresh bypasses cache
  assert.strictEqual(calls, 3);

  resp = { code: 200, body: '{oops' };
  assert.throws(() => api.getAdvice(true), /not valid JSON/);
  resp = { code: 500, body: '' };
  assert.throws(() => api.getAdvice(true), /HTTP 500/);
});
