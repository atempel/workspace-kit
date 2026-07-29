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
const gitLayer = require('../core/git.js');
const webServer = require('../core/server.js');

const HELP = [
  'workspace//kit — workspace management and versioning for instructions and docs',
  '',
  'Usage: workspace-kit <command> [options]',
  '',
  'Commands:',
  '  doctor [dir]     Check a workspace\'s context health. Defaults to the current',
  '                   directory. Exits non-zero when the verdict is unhealthy, so it',
  '                   is usable in CI.',
  '  status [dir]     Show what has changed in the workspace, in plain language.',
  '  serve [dir]      Start the read-only local JSON server the Web App dashboard',
  '                   consumes. Binds to 127.0.0.1 only.',
  '  inspect [dir]    Dump the raw workspace index as JSON (debugging aid).',
  '',
  '  worktree list [dir]              Show every worktree of this workspace.',
  '  worktree add <name> [dir]        Create one. By convention it goes in',
  '                                   .worktrees/<name> on a branch of the same',
  '                                   name; --path and --branch override either.',
  '  worktree remove <name> [dir]     Remove one. Refuses if it holds uncommitted',
  '                                   work unless --force. The branch is kept.',
  '',
  'Options:',
  '  --json           Machine-readable output instead of the terminal report.',
  '  --port <n>       Port for `serve` (default 4319).',
  '  --max-lines <n>  Override the always-loaded budget (default 300 lines, the',
  '                   figure from docs/specs/context-manager-conventions.md).',
  '  --path <p>       Place a new worktree somewhere other than the convention.',
  '  --branch <b>     Use a branch name other than the worktree name.',
  '  --force          Remove a worktree even though it holds uncommitted work.',
  '  -h, --help       Show this help.',
  '',
  'Worktrees are local-only: nothing is pushed and no remote is contacted.',
  '',
  'Note on token figures: every token count reported is an estimate derived from',
  'characters ÷ 4, a rough approximation — not a tokenizer count. Treat it as an',
  'order-of-magnitude signal, not an exact number.',
].join('\n');

function parseArgs(argv) {
  const args = {
    command: null, sub: null, name: null, dir: null, json: false, maxLines: null,
    port: null, help: false, path: null, branch: null, force: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--max-lines') args.maxLines = parseInt(argv[++i], 10);
    else if (arg === '--port') args.port = parseInt(argv[++i], 10);
    else if (arg === '--path') args.path = argv[++i];
    else if (arg === '--branch') args.branch = argv[++i];
    else positional.push(arg);
  }
  args.command = positional[0] || null;
  if (args.command === 'worktree') {
    // `worktree <sub> [name] [dir]` — `list` takes no name, so the directory
    // shifts one place left for it.
    args.sub = positional[1] || null;
    if (args.sub === 'list') {
      args.name = null;
      args.dir = positional[2] || null;
    } else {
      args.name = positional[2] || null;
      args.dir = positional[3] || null;
    }
  } else {
    args.dir = positional[1] || null;
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

  if (args.command === 'status') {
    const index = inspector.inspect(dir);
    const summary = gitLayer.changeSummary(dir, index);
    if (args.json) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      return 0;
    }
    if (!summary.isRepo) {
      process.stdout.write('Not a git repository — no change tracking available here.\n');
      return 0;
    }
    if (!summary.files.length) {
      process.stdout.write('On ' + summary.branch + ': nothing has changed since the last commit.\n');
      return 0;
    }
    const out = ['On ' + summary.branch + ': ' + summary.files.length
      + (summary.files.length === 1 ? ' file has changed' : ' files have changed') + '.', ''];
    summary.files.forEach(function (f) {
      out.push('  ' + f.path + '  (' + f.what + ')');
    });
    out.push('', 'Suggested commit message:', '');
    gitLayer.buildCommitMessage(summary).split('\n').forEach(function (line) {
      out.push(line ? '  ' + line : '');
    });
    process.stdout.write(out.join('\n') + '\n');
    return 0;
  }

  if (args.command === 'worktree') {
    const sub = args.sub;

    if (sub === 'list' || sub === null) {
      const listed = gitLayer.listWorktrees(dir);
      if (args.json) {
        process.stdout.write(JSON.stringify(listed, null, 2) + '\n');
        return 0;
      }
      if (!listed.isRepo) {
        process.stdout.write('Not a git repository — no worktrees here.\n');
        return 0;
      }
      const extra = listed.worktrees.filter(function (w) { return !w.isMain; });
      if (!extra.length) {
        process.stdout.write('No worktrees yet, only the main working copy.\n'
          + 'Create one with:  workspace-kit worktree add <name>\n');
        return 0;
      }
      const out = [extra.length + (extra.length === 1 ? ' worktree:' : ' worktrees:'), ''];
      extra.forEach(function (w) {
        out.push('  ' + w.name + '  on ' + (w.branch || 'a detached HEAD')
          + (w.byConvention ? '' : '  (custom location)'));
        out.push('    ' + w.path);
      });
      process.stdout.write(out.join('\n') + '\n');
      return 0;
    }

    if (sub === 'add') {
      const result = gitLayer.createWorktree(dir, args.name, {
        path: args.path,
        branch: args.branch,
        // core/git.js depends on nothing but child_process and path, so the
        // filesystem comes from here — same arrangement as doctor's readFile.
        io: {
          readFile: function (p) { return fs.readFileSync(p, 'utf8'); },
          writeFile: function (p, c) { fs.writeFileSync(p, c); },
          exists: function (p) { return fs.existsSync(p); },
        },
      });
      if (args.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        return result.ok ? 0 : 1;
      }
      if (!result.ok) {
        process.stderr.write(result.error + '\n');
        return 1;
      }
      const out = ['Created worktree "' + result.name + '".', ''];
      out.push('  location  ' + result.path + (result.byConvention ? '' : '  (custom)'));
      out.push('  branch    ' + result.branch + (result.reusedBranch ? '  (existing branch)' : '  (new branch)'));
      if (result.gitignoreUpdated) out.push('  .gitignore updated so worktrees are not reported as stray files');
      out.push('', 'Nothing was pushed — this is local only.');
      process.stdout.write(out.join('\n') + '\n');
      return 0;
    }

    if (sub === 'remove') {
      const result = gitLayer.removeWorktree(dir, args.name, { force: args.force });
      if (args.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        return result.ok ? 0 : 1;
      }
      if (!result.ok) {
        process.stderr.write(result.error + '\n');
        if (result.uncommitted) {
          result.uncommitted.forEach(function (f) { process.stderr.write('  ' + f + '\n'); });
        }
        return 1;
      }
      process.stdout.write('Removed worktree "' + result.name + '".\n'
        + 'Branch ' + (result.branch || '(detached)') + ' was kept — delete it yourself if you no longer want it.\n');
      return 0;
    }

    process.stderr.write('Unknown worktree subcommand: ' + sub + '\n'
      + 'Expected one of: list, add, remove.\n');
    return 2;
  }

  if (args.command === 'serve') {
    const port = args.port || 4319;
    webServer.listen(dir, port, function (err, instance) {
      if (err) {
        process.stderr.write('Could not start the server: ' + err.message + '\n');
        process.exit(1);
      }
      const actual = instance.address().port;
      process.stdout.write('workspace//kit serving ' + dir + '\n');
      process.stdout.write('  http://' + webServer.HOST + ':' + actual + '/api/dashboard\n');
      process.stdout.write('Read-only; localhost only. Ctrl-C to stop.\n');
    });
    return null; // keep the process alive
  }

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

const code = main(process.argv.slice(2));
if (code !== null) process.exit(code);
