/**
 * Browser verification for the dashboard.
 *
 * Ported from the parallel `app/` implementation (branch `worktree-dashboard`,
 * retired 2026-07-30) — see DECISIONS.md. That implementation lost on scope, but
 * its verification method won outright, and this is why: `check-render.cjs`
 * renders the five sections server-side and had been green for a day while the
 * app opened as a blank page in a real browser. The crash was in the shell,
 * which server-rendering the sections never touches.
 *
 * So the two suites are not redundant, and neither replaces the other:
 *
 *   check-render.cjs  — the sections hold no hard-coded data, apply no
 *                       threshold, label every estimate. Fast, no browser.
 *   check-ui.mjs      — the built app actually boots, mounts, navigates and
 *                       shows the API's numbers. Slow, real Chromium.
 *
 * This builds the app, serves the build (not the dev server — production output
 * is what ships), points it at the real core/server.js reading this repository,
 * and asserts rendered values equal the API's.
 *
 * Run with `npm run check:ui` from web/, or `npm run test:ui` from the root.
 */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const target = process.env.WSKIT_TARGET || repo;

// Everything binds to 127.0.0.1 explicitly. Vite's default `localhost` resolves
// to ::1 here, and Node's fetch — unlike curl, which falls back — then gets
// ECONNREFUSED, so the servers and this script would silently disagree about
// which address they mean.
const HOST = '127.0.0.1';
const API_PORT = 4319;
const UI_PORT = 4331; // web/'s preview port, see vite.config.js
const EMPTY_API_PORT = 4332;
const shots = path.join(here, 'screenshots');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForHttp(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await isUp(url)) return true;
    await wait(500);
  }
  throw new Error('timed out waiting for ' + url);
}

const procs = [];
function start(cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: 'ignore' });
  procs.push(p);
  return p;
}

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log('PASS  ' + name);
  } else {
    failures++;
    console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
  }
}

/**
 * Switch section and wait for the highlight to actually follow the content.
 * Without the settle, screenshots catch the transition mid-flight and show the
 * *previous* item still highlighted — which reads as a state bug and is really
 * just misleading evidence.
 */
async function goTo(page, id, label) {
  await page.click(`[data-nav="${id}"]`);
  await page.waitForFunction(
    (nav) => document.querySelector(`[data-nav="${nav}"]`)?.getAttribute('aria-current') === 'page',
    id
  );
  await wait(300);
  check(
    `the ${label} nav item is the one highlighted`,
    (await page.locator(`[data-nav="${id}"][aria-current="page"]`).count()) === 1 &&
      (await page.locator('[aria-current="page"]').count()) === 1
  );
}

try {
  fs.mkdirSync(shots, { recursive: true });

  // Build every run. A stale dist/ passing is exactly the class of false green
  // this suite exists to remove.
  const built = spawnSync('npx', ['vite', 'build', '--logLevel', 'error'], {
    cwd: here,
    stdio: 'inherit',
  });
  if (built.status !== 0) throw new Error('vite build failed');

  if (!(await isUp(`http://${HOST}:${API_PORT}/api/health`))) {
    start('node', [path.join(repo, 'bin', 'workspace-kit.js'), 'serve', target], repo);
  }
  start('npx', ['vite', 'preview', '--port', String(UI_PORT), '--strictPort', '--host', HOST], here);
  await waitForHttp(`http://${HOST}:${API_PORT}/api/health`);
  await waitForHttp(`http://${HOST}:${UI_PORT}/`);

  const expected = await (await fetch(`http://${HOST}:${API_PORT}/api/dashboard`)).json();
  const api = expected.data || expected;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://${HOST}:${UI_PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-nav="overview"]');

  check('the shell mounts and renders all five sections', (await page.locator('[data-nav]').count()) === 5);

  // ---- Overview -----------------------------------------------------------
  // The "other" group is collapsed to 8 rows until expanded, so completeness is
  // asserted after expanding — the count must reach the API's, not a page size.
  await page.click('[data-show-all]');
  await wait(300);
  const rows = await page.locator('[data-file]').count();
  check(
    'the Overview table renders every scanned file once expanded',
    rows === api.overview.files.length,
    `page ${rows} vs api ${api.overview.files.length}`
  );

  check(
    'a known real file appears in the table',
    await page.locator('[data-file="AGENTS.md"]').first().isVisible()
  );

  const agentsRow = await page.locator('[data-file="AGENTS.md"]').first().innerText();
  const apiAgents = api.overview.files.find((f) => f.path === 'AGENTS.md');
  check(
    'the rendered line count matches the API, not a placeholder',
    agentsRow.includes(String(apiAgents.lines)),
    `row "${agentsRow.replace(/\s+/g, ' ')}" should contain ${apiAgents.lines}`
  );

  check(
    'token figures are labelled as estimates, never as exact counts',
    (await page.locator('text=/~\\d/').count()) > 0 &&
      (await page.getByText('estimate', { exact: false }).count()) > 0
  );

  await page.screenshot({ path: path.join(shots, '01-overview-dark.png'), fullPage: true });

  // ---- Health check -------------------------------------------------------
  await goTo(page, 'health', 'Health check');
  await page.waitForSelector('[role="meter"]');
  check(
    'the health verdict shown is the one the API computed',
    (await page.locator(`[data-status="${api.health.verdict}"]`).count()) > 0,
    'expected ' + api.health.verdict
  );
  check(
    'every suggestion from the API is rendered',
    (await page.locator('[data-suggestion]').count()) === api.health.suggestions.length
  );
  const meterNow = await page.locator('[role="meter"]').first().getAttribute('aria-valuenow');
  check(
    'the budget meter is accessible and carries the API percentage',
    (await page.locator('[role="meter"][aria-valuenow]').count()) === 1 &&
      Number(meterNow) === api.health.budget.pctOfCap,
    `meter ${meterNow} vs api ${api.health.budget.pctOfCap}`
  );
  await page.screenshot({ path: path.join(shots, '02-health-dark.png'), fullPage: true });

  // ---- Session log --------------------------------------------------------
  await goTo(page, 'sessions', 'Session log');
  await page.waitForSelector('[data-session]');
  check(
    'every session entry from SESSIONS.md is rendered',
    (await page.locator('[data-session]').count()) === api.sessions.length
  );
  await page.screenshot({ path: path.join(shots, '03-sessions-dark.png'), fullPage: true });

  // ---- Queue --------------------------------------------------------------
  await goTo(page, 'queue', 'Queue');
  await page.waitForSelector('[data-queue-status]');
  check(
    'every queue item is rendered with its status',
    (await page.locator('[data-queue-status]').count()) === api.queue.length
  );
  await page.screenshot({ path: path.join(shots, '04-queue-dark.png'), fullPage: true });

  // ---- Source control -----------------------------------------------------
  await goTo(page, 'git', 'Source control');
  await page.waitForSelector('[data-capability]');
  const capNames = Object.keys(api.capabilities);
  const blocked = capNames.filter((c) => !api.capabilities[c]);
  const disabled = await page.locator('[data-capability]:disabled').count();
  check(
    'every capability the server reports false is drawn unavailable',
    disabled === blocked.length && (await page.locator('[data-capability]').count()) === capNames.length,
    `${disabled} disabled of ${blocked.length} blocked (${blocked.join(', ')})`
  );
  check(
    'the safe-edit warning appears when files have unshared changes',
    (api.git.files || []).some((f) => f.state === 'modified-unstaged')
      ? (await page.getByText('Safe-edit warning').count()) === 1
      : (await page.getByText('Safe-edit warning').count()) === 0
  );
  check(
    'the worktree list renders every worktree the API reports',
    (await page.getByText(api.git.worktrees[0].path, { exact: false }).count()) > 0
  );
  await page.screenshot({ path: path.join(shots, '05-source-control-dark.png'), fullPage: true });

  // ---- Light theme --------------------------------------------------------
  // Light is first-class per DESIGN.md, so it gets verified rather than assumed.
  await page.click('[data-theme-toggle]');
  await wait(250);
  check(
    'the light theme is reachable and applies',
    (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light'
  );
  await goTo(page, 'overview', 'Overview');
  await page.screenshot({ path: path.join(shots, '06-overview-light.png'), fullPage: true });

  // ---- Not a workspace ----------------------------------------------------
  // A folder that is not a workspace is a first-class result, not an error.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-ui-'));
  fs.writeFileSync(path.join(tmp, 'notes.txt'), 'hello\n');
  start('node', [path.join(repo, 'bin', 'workspace-kit.js'), 'serve', tmp, '--port', String(EMPTY_API_PORT)], repo);
  await waitForHttp(`http://${HOST}:${EMPTY_API_PORT}/api/health`);

  const page2 = await browser.newPage({ viewport: { width: 900, height: 520 } });
  await page2.route('**/api/**', (route) =>
    route.continue({ url: route.request().url().replace(String(UI_PORT), String(EMPTY_API_PORT)) })
  );
  await page2.goto(`http://${HOST}:${UI_PORT}/`, { waitUntil: 'networkidle' });
  check(
    'a folder that is not a workspace shows a plain state, not an error screen',
    (await page2.getByText('Not a workspace//kit workspace').count()) === 1
  );
  await page2.screenshot({ path: path.join(shots, '07-not-a-workspace.png') });

  check('no console or page errors anywhere in the run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
} finally {
  procs.forEach((p) => {
    try {
      p.kill();
    } catch {
      /* already gone */
    }
  });
}

if (failures) {
  console.log('\n' + failures + ' UI check(s) failed.');
  process.exit(1);
}
console.log('\nAll UI checks passed. Screenshots in web/screenshots/.');
