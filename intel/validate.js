#!/usr/bin/env node
// Validates an advice report before it is published.
// Usage: node intel/validate.js intel/recommendations.json
const fs = require('fs');
const path = require('path');

const AREAS = ['Exclusive Weapon', 'Skills', 'Gear', 'Stars', 'Awakening', 'Roster', 'Lineup'];
const SQUADS = ['Tank', 'Air', 'Missile'];
const CONFIDENCE = ['high', 'medium', 'low'];

function validate(report, allowedDomains) {
  const errors = [];
  const err = (m) => errors.push(m);
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

  if (!report || typeof report !== 'object') return ['Report is not an object.'];
  if (report.version !== 1) err('version must be 1.');
  if (!isStr(report.generatedAt) || isNaN(Date.parse(report.generatedAt))) err('generatedAt must be an ISO date-time.');
  if (!isStr(report.summary)) err('summary is required.');

  const inputs = report.inputs || {};
  if (typeof inputs.season !== 'string') err('inputs.season must be a string ("" if unknown).');
  if (!isStr(inputs.goal)) err('inputs.goal is required.');
  if (!inputs.heroes || typeof inputs.heroes !== 'object') err('inputs.heroes (snapshot of the sheet) is required.');
  const heroNames = Object.keys(inputs.heroes || {});
  heroNames.forEach((n) => {
    const h = inputs.heroes[n];
    if (!SQUADS.includes(h.squad)) err(`inputs.heroes.${n}.squad must be one of ${SQUADS.join(', ')}.`);
    if (!(typeof h.power === 'number' || h.power === null)) err(`inputs.heroes.${n}.power must be a number or null.`);
  });

  const sources = Array.isArray(report.sources) ? report.sources : (err('sources must be an array.'), []);
  const ids = new Set();
  sources.forEach((s, i) => {
    if (!Number.isInteger(s.id)) err(`sources[${i}].id must be an integer.`);
    if (ids.has(s.id)) err(`sources[${i}].id ${s.id} is duplicated.`);
    ids.add(s.id);
    if (!isStr(s.title)) err(`sources[${i}].title is required.`);
    let host = '';
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { err(`sources[${i}].url is not a valid URL.`); }
    if (host && !allowedDomains.some((d) => host === d || host.endsWith('.' + d))) {
      err(`sources[${i}].url (${host}) is not on the trusted list in trusted-sources.json.`);
    }
  });

  const actions = Array.isArray(report.actions) ? report.actions : (err('actions must be an array.'), []);
  if (actions.length === 0) err('actions must not be empty.');
  actions.forEach((a, i) => {
    const at = `actions[${i}]`;
    if (a.rank !== i + 1) err(`${at}.rank must be ${i + 1} (actions are listed in priority order).`);
    if (!SQUADS.includes(a.squad)) err(`${at}.squad must be one of ${SQUADS.join(', ')}.`);
    if (!AREAS.includes(a.area)) err(`${at}.area must be one of ${AREAS.join(', ')}.`);
    if (!isStr(a.hero)) err(`${at}.hero is required.`);
    else if (!['Roster', 'Lineup'].includes(a.area) && !heroNames.includes(a.hero)) err(`${at}.hero "${a.hero}" is not in inputs.heroes.`);
    if (!isStr(a.action)) err(`${at}.action is required.`);
    if (!isStr(a.why)) err(`${at}.why is required.`);
    if (!CONFIDENCE.includes(a.confidence)) err(`${at}.confidence must be high, medium or low.`);
    if (!Array.isArray(a.sources) || a.sources.length === 0) err(`${at}.sources must cite at least one source id.`);
    else a.sources.forEach((id) => { if (!ids.has(id)) err(`${at}.sources references unknown id ${id}.`); });
  });

  const squads = report.squads || {};
  SQUADS.forEach((s) => { if (!isStr(squads[s])) err(`squads.${s} assessment is required.`); });

  const next = report.next || {};
  Object.keys(next).forEach((n) => {
    if (!heroNames.includes(n)) err(`next.${n} is not in inputs.heroes.`);
    if (!isStr(next[n]) || next[n].length > 40) err(`next.${n} must be a short label (40 chars max).`);
  });

  if (!Array.isArray(report.caveats)) err('caveats must be an array (may be empty).');
  return errors;
}

module.exports = { validate };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node intel/validate.js <report.json>'); process.exit(2); }
  const trusted = JSON.parse(fs.readFileSync(path.join(__dirname, 'trusted-sources.json'), 'utf8'));
  let report;
  try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('Invalid JSON: ' + e.message); process.exit(1); }
  const errors = validate(report, trusted.allowed.map((d) => d.domain));
  if (errors.length) { console.error(errors.map((e) => '- ' + e).join('\n')); process.exit(1); }
  console.log(`OK: ${report.actions.length} actions, ${report.sources.length} sources.`);
}
