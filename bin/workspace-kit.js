#!/usr/bin/env node
/**
 * workspace//kit CLI.
 *
 * Currently carries one command, `doctor`, which is docs/specs/
 * workspace-health-check.md's (→ #78) P0 command surface. The generate flow --
 * the CLI's first command, docs/specs/cli-generator.md (→ #20) -- is not built
 * yet; this entry point exists so `doctor` can ship without waiting on it, and
 * is deliberately shaped to take more subcommands rather than to be a
 * doctor-specific script.
 *
 * Zero dependencies, no build step, same as the rest of core/.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const inspector = require('../core/inspect.js');
const doctor = require('../core/doctor.js');

const HELP = [
  'workspace//kit — workspace management and versioning for instructions and docs',
  '',
  'Usage: workspace-kit <command> [options]',
  '',
  'Commands:',
  '  doctor [dir]     Check a workspace\'s context health. Defaults to the current',
  '                   directory. Exits non-zero when the verdict is unhealthy, so it',
  '                   is usable in CI.',
  '  inspect [dir]    Dump the raw workspace index as JSON (debugging aid).',
  '',
  'Options:',
  '  --json           Machine-readable output instead of the terminal report.',
  '  --max-lines <n>  Override the always-loaded budget (default 300 lines, the',
  '                   figure from docs/specs/context-manager-conventions.md).',
  '  -h, --help       Show this help.',
  '',
  'Note on token figures: every token count reported is an estimate derived from',
  'characters ÷ 4, a rough approximation — not a tokenizer count. Treat it as an',
  'order-of-magnitude signal, not an exact number.',
].join('\n');

function parseArgs(argv) {
  const args = { command: null, dir: null, json: false, maxLines: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--max-lines') args.maxLines = parseInt(argv[++i], 10);
    else if (!args.command) args.command = arg;
    else if (!args.dir) args.dir = arg;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);

  if (args.help || !args.command) {
    process.stdout.write(HELP + '\n');
    return 0;
  }

  const dir = path.resolve(args.dir || process.cwd());

  if (args.command === 'inspect') {
    process.stdout.write(JSON.stringify(inspector.inspect(dir), null, 2) + '\n');
    return 0;
  }

  if (args.command === 'doctor') {
    const index = inspector.inspect(dir);
    const thresholds = {};
    if (args.maxLines) thresholds.alwaysLoadedLines = args.maxLines;
    const report = doctor.diagnose(index, {
      thresholds: thresholds,
      // The doctor is handed a reader rather than reaching for `fs` itself, so
      // there stays exactly one module in this codebase that touches the disk.
      readFile: function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); },
    });

    process.stdout.write(
      (args.json ? JSON.stringify(report, null, 2) : doctor.formatReport(report)) + '\n'
    );
    return report.verdict === doctor.VERDICT.UNHEALTHY ? 1 : 0;
  }

  process.stderr.write('Unknown command: ' + args.command + '\n\n' + HELP + '\n');
  return 2;
}

process.exit(main(process.argv.slice(2)));
