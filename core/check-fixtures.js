/**
 * Zero-dependency smoke test for core/generator.js.
 *
 * Regenerates output for the recorded cases in fixtures.json and diffs
 * against what's stored there. Not wired into CI (none exists yet) — run
 * manually with `node core/check-fixtures.js` before/after touching
 * generator.js, and especially before porting a change into the HTML
 * artifact's separate inline copy (see DECISIONS.md, 2026-07-22).
 *
 * This only guards generator.js's own output against unnoticed edits; it
 * is not a parity check against src/workspace-kit.html.
 */
const fs = require('fs');
const path = require('path');

const RealDate = Date;
function FixedDate(...args){ return args.length ? new RealDate(...args) : new RealDate('2026-07-22T12:00:00Z'); }
FixedDate.prototype = RealDate.prototype;
global.Date = FixedDate;

const core = require('./generator.js');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

let failures = 0;

fixtures.forEach(fixture => {
  const actual = {
    fileMap: core.buildFileMap(fixture.input),
    starterPrompt: core.buildStarterPrompt(fixture.input),
    agentFileList: core.buildAgentFileList(fixture.input.agents, fixture.input.lang),
  };
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(fixture.expected, null, 2);

  if (actualStr === expectedStr) {
    console.log(`PASS  ${fixture.name}`);
  } else {
    failures++;
    console.log(`FAIL  ${fixture.name}`);
    const a = actualStr.split('\n');
    const e = expectedStr.split('\n');
    const max = Math.max(a.length, e.length);
    for (let i = 0; i < max; i++) {
      if (a[i] !== e[i]) {
        console.log(`  line ${i + 1}:`);
        console.log(`    expected: ${e[i]}`);
        console.log(`    actual:   ${a[i]}`);
      }
    }
  }
});

global.Date = RealDate;

if (failures) {
  console.log(`\n${failures} fixture(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${fixtures.length} fixture(s) passed.`);
}
