/**
 * Real parity check: loads the ACTUAL src/workspace-kit.html into jsdom,
 * drives its real form/functions (not a re-implementation), and diffs the
 * output against core/generator.js for the same inputs.
 *
 * This is the test check-fixtures.js can't do on its own: check-fixtures.js
 * only guards generator.js's own output against unnoticed edits. This
 * script proves generator.js actually behaves like the shipped HTML, not
 * just that it was transcribed carefully.
 *
 * Dev-only dependency (jsdom). Not wired into CI (none exists). Run with:
 *   node core/parity-check.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const core = require('./generator.js');

const FIXED_ISO = '2026-07-22T12:00:00Z';
function withFixedDate(fn) {
  const RealDate = Date;
  function FixedDate(...args) { return args.length ? new RealDate(...args) : new RealDate(FIXED_ISO); }
  FixedDate.prototype = RealDate.prototype;
  global.Date = FixedDate;
  try { return fn(FixedDate); } finally { global.Date = RealDate; }
}

const htmlPath = path.join(__dirname, '..', 'src', 'workspace-kit.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

function runRealHtml(input, FixedDate) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const win = dom.window;
  const doc = win.document;
  win.Date = FixedDate;

  win.setLang(input.lang);

  doc.getElementById('ptype').value = input.type;
  win.applyTypeDefaults();

  const cfgChecks = core.TYPE_CONFIG[input.type].checks;
  const wantedFolders = new Set(input.folders.map(f => f.name));
  [1, 2, 3].forEach(i => {
    const folderName = cfgChecks[i - 1].folder[input.lang];
    doc.getElementById(`chk${i}`).checked = wantedFolders.has(folderName);
  });

  doc.getElementById('pname').value = input.name;
  doc.getElementById('pdesc').value = input.desc;
  doc.getElementById('pobj').value = input.obj;
  doc.getElementById('pstack').value = input.stack;
  doc.getElementById('plimits').value = input.limits;

  const agentIds = { claude: 'agClaude', agentsmd: 'agAgentsmd', cursor: 'agCursor', copilot: 'agCopilot', gemini: 'agGemini', windsurf: 'agWindsurf', skill: 'agSkill' };
  Object.entries(agentIds).forEach(([key, id]) => {
    doc.getElementById(id).checked = !!(input.agents && input.agents[key]);
  });

  const fileMap = win.buildFileMap();
  win.renderPrompt();
  const starterPrompt = doc.getElementById('promptOut').value;

  dom.window.close();
  return { fileMap, starterPrompt };
}

let failures = 0;

fixtures.forEach(fixture => {
  const { input } = fixture;

  const real = withFixedDate((FixedDate) => runRealHtml(input, FixedDate));
  const fromCore = withFixedDate(() => ({
    fileMap: core.buildFileMap(input),
    starterPrompt: core.buildStarterPrompt(input),
  }));

  const realStr = JSON.stringify(real, null, 2);
  const coreStr = JSON.stringify(fromCore, null, 2);

  if (realStr === coreStr) {
    console.log(`PASS  ${fixture.name}  (real HTML output === core/generator.js output)`);
  } else {
    failures++;
    console.log(`FAIL  ${fixture.name}`);
    const r = realStr.split('\n');
    const c = coreStr.split('\n');
    const max = Math.max(r.length, c.length);
    for (let i = 0; i < max; i++) {
      if (r[i] !== c[i]) {
        console.log(`  line ${i + 1}:`);
        console.log(`    html:  ${r[i]}`);
        console.log(`    core:  ${c[i]}`);
      }
    }
  }
});

if (failures) {
  console.log(`\n${failures} case(s) diverged between src/workspace-kit.html and core/generator.js.`);
  process.exit(1);
} else {
  console.log(`\nAll ${fixtures.length} case(s): core/generator.js output matches src/workspace-kit.html exactly.`);
}
