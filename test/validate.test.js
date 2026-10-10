const test = require('node:test');
const assert = require('node:assert');
const { validate } = require('../intel/validate');
const trusted = require('../intel/trusted-sources.json').allowed.map((d) => d.domain);
const example = () => JSON.parse(JSON.stringify(require('../intel/example-recommendations.json')));

test('example report is valid', () => {
  assert.deepStrictEqual(validate(example(), trusted), []);
});

test('rejects untrusted sources, unknown heroes, bad ranks and dangling citations', () => {
  const r = example();
  r.sources.push({ id: 99, title: 'Spam', url: 'https://topuplist.com/blogs/x' });
  r.actions[0].hero = 'Tesla';
  r.actions[1].rank = 7;
  r.actions[2].sources = [42];
  r.next.Nobody = 'x';
  const errs = validate(r, trusted).join('\n');
  assert.match(errs, /topuplist\.com\) is not on the trusted list/);
  assert.match(errs, /hero "Tesla" is not in inputs\.heroes/);
  assert.match(errs, /actions\[1\]\.rank must be 2/);
  assert.match(errs, /unknown id 42/);
  assert.match(errs, /next\.Nobody/);
});

test('roster and lineup actions may name heroes not on the sheet; subdomains of trusted sites pass', () => {
  const r = example();
  r.actions[9].area = 'Roster';
  r.actions[9].hero = 'Tesla';
  r.sources[0].url = 'https://www.cpt-hedge.com/guides/exclusive-weapons';
  assert.deepStrictEqual(validate(r, trusted), []);
});
