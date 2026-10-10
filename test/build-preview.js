// Builds a standalone preview of the app: Index.html + Code.gs running in the page
// against the mock sheet, with google.script.run shimmed. `node test/build-preview.js <out.html>`
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mock = fs.readFileSync(path.join(__dirname, 'mock-apps-script.js'), 'utf8');
const code = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
const index = fs.readFileSync(path.join(root, 'apps-script/Index.html'), 'utf8');

const shim = `<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${mock}</script>
<script>MockAppsScript.install(window);</script>
<script>${code}</script>
<script>
  // Mirrors google.script.run: async, success/failure handlers, plain-object results.
  function runner(ok, err) {
    const r = {
      withSuccessHandler: (f) => runner(f, err),
      withFailureHandler: (f) => runner(ok, f),
    };
    ['getHeroes', 'saveHero', 'removeHero'].forEach((fn) => {
      r[fn] = (...args) => setTimeout(() => {
        let res;
        try { res = JSON.parse(JSON.stringify(window[fn](...args))); }
        catch (e) { return err && err(e); }
        ok && ok(res);
      }, 150);
    });
    return r;
  }
  window.google = { script: { get run() { return runner(); } } };
</script>`;
fs.writeFileSync(process.argv[2], index.replace('<head>', '<head>' + shim));
