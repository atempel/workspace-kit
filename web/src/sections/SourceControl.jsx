/**
 * Source control — git state, in plain language.
 *
 * Two rules from the spec shape this file, and both are about honesty:
 *
 *   1. No raw git command appears anywhere, and no approve/merge control
 *      exists. Reviewing and merging happen in the user's own tools.
 *   2. Actions the system cannot currently perform are drawn as unavailable,
 *      with the reason, rather than as live-looking buttons over nothing. The
 *      `capabilities` object in the payload is what decides this — the UI never
 *      assumes an action works.
 *
 * Every capability is false today for one shared reason: the local server is
 * read-only and rejects non-GET, so the dashboard shows state and hands
 * execution to the CLI. Pull requests are additionally out of scope entirely,
 * since the git layer is local-only by decision (DECISIONS.md, 2026-07-29).
 */

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  SectionTitle,
  Stat,
  Status,
  TableWrap,
  Td,
  Th,
} from '../components/ui.jsx';
import { AlertIcon, BranchIcon, FolderIcon } from '../components/icons.jsx';
import { formatCount, gitStateLabel, gitStateTone } from '../lib/format.js';

function UnavailableNote({ children }) {
  return (
    <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
      {children}
    </p>
  );
}

export default function SourceControl({ data }) {
  const git = data.git || {};
  const caps = data.capabilities || {};
  const changed = git.files || [];
  const worktrees = git.worktrees || [];
  const unsafe = changed.filter((f) => f.state === 'modified-unstaged');

  // Worktrees exist so parallel work does not collide; the conflict flag (P1)
  // is where the UI says whether that is currently holding. The overlap is
  // computed by core/git.js — this counts per worktree so a row can carry the
  // flag, and judges nothing about whether the overlap is a problem.
  const conflicts = git.worktreeConflicts || [];
  const conflictsByWorktree = new Map();
  conflicts.forEach((c) => {
    c.worktrees.forEach((w) => {
      conflictsByWorktree.set(w.path, (conflictsByWorktree.get(w.path) || 0) + 1);
    });
  });

  if (!git.isRepo) {
    return (
      <div>
        <SectionTitle>Source control</SectionTitle>
        <Card>
          <Empty>
            This workspace is not a git repository, so there is no change history to track. That
            is a valid state — nothing here is broken.
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle note="What has changed since the last commit, described without git vocabulary.">
        Source control
      </SectionTitle>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Branch" value={<span className="text-base">{git.branch}</span>} />
        <Stat label="Files changed" value={formatCount(changed.length)} />
        <Stat label="Lines added" value={'+' + formatCount(git.totalAdded)} tone="ok" />
        <Stat label="Lines removed" value={'−' + formatCount(git.totalRemoved)} tone="bad" />
      </div>

      {unsafe.length > 0 && (
        <Card className="mb-5" style={{ borderColor: 'var(--warn)' }}>
          <div className="flex gap-3 px-5 py-4">
            <span style={{ color: 'var(--warn)' }}>
              <AlertIcon size={18} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--warn)' }}>
                Safe-edit warning
              </h3>
              <p className="mt-1 text-[13px]">
                {unsafe.length} file{unsafe.length === 1 ? ' has' : 's have'} changes that exist
                nowhere else yet. Anything that overwrites {unsafe.length === 1 ? 'it' : 'them'}{' '}
                would lose that work.
              </p>
              <ul className="mt-2 space-y-0.5">
                {unsafe.map((f) => (
                  <li key={f.path} className="font-mono text-xs">
                    {f.path}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader
          title="Changes"
          note="Each file with what happened to it, in plain language."
        />
        {changed.length === 0 ? (
          <Empty>Nothing has changed since the last commit.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>What changed</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {changed.map((f) => (
                  <tr key={f.path}>
                    <Td mono>{f.path}</Td>
                    <Td>{f.what}</Td>
                    <Td>
                      <Status tone={gitStateTone(f.state)}>{gitStateLabel(f.state)}</Status>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Commit" note="Record the changes above in the workspace's history." />
          <div className="px-5 py-4">
            <Button data-capability="commit" disabled={!caps.commit} tone="brand">
              Commit changes
            </Button>
            {!caps.commit && (
              <UnavailableNote>
                Not available from this screen. The dashboard reads the workspace and never writes
                to it; commit from the terminal with{' '}
                <code className="font-mono">workspace-kit status</code>, which prepares the
                message for you.
              </UnavailableNote>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pull request" note="Publish the branch for review." />
          <div className="px-5 py-4">
            <Button data-capability="pullRequest" disabled={!caps.pullRequest}>
              Open pull request
            </Button>
            {!caps.pullRequest && (
              <UnavailableNote>
                Out of scope for now, by decision: this layer works on local git only and contacts
                no remote. Pushing and pull requests bring authentication and a hosting provider,
                which are being treated as their own step.
              </UnavailableNote>
            )}
          </div>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <Card className="mb-5" style={{ borderColor: 'var(--warn)' }} data-worktree-conflicts="">
          <div className="flex gap-3 px-5 py-4">
            <span style={{ color: 'var(--warn)' }}>
              <AlertIcon size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--warn)' }}>
                Worktree overlap
              </h3>
              <p className="mt-1 text-[13px]">
                {conflicts.length} file{conflicts.length === 1 ? ' is' : 's are'} being edited in
                more than one worktree at the same time. That is allowed, and sometimes deliberate
                — but whichever copy is saved last is the one that survives a merge.
              </p>
              <ul className="mt-2 space-y-1.5">
                {conflicts.map((c) => (
                  <li key={c.path} data-conflict={c.path}>
                    <span className="font-mono text-xs">{c.path}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {c.worktrees.map((w) => w.name).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Worktrees"
          note="Isolated copies of this workspace, so several agents can work in parallel without colliding."
          right={<Badge tone="muted">{worktrees.length}</Badge>}
        />
        {worktrees.length === 0 ? (
          <Empty>No worktrees.</Empty>
        ) : (
          <ul>
            {worktrees.map((w, i) => (
              <li
                key={w.path}
                className="flex items-start gap-3 px-5 py-3"
                style={{
                  borderBottom: i === worktrees.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span className="mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {w.isMain ? <FolderIcon size={15} /> : <BranchIcon size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium">{w.name}</span>
                    {w.isMain ? <Badge tone="info">main working copy</Badge> : null}
                    {!w.isMain && !w.byConvention ? (
                      <Badge tone="muted">custom location</Badge>
                    ) : null}
                    {conflictsByWorktree.has(w.path) ? (
                      <Badge
                        tone="warn"
                        title="Files edited here are also being edited in another worktree."
                      >
                        {conflictsByWorktree.get(w.path)} overlapping
                      </Badge>
                    ) : null}
                  </div>
                  <div
                    className="mt-0.5 font-mono text-[11px] break-all"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {w.path}
                  </div>
                </div>
                <span className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--brand-2)' }}>
                  {w.branch || 'detached'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="px-5 py-4">
          <Button data-capability="worktrees" disabled={!caps.worktrees}>
            Manage worktrees
          </Button>
          {!caps.worktrees && (
            <UnavailableNote>
              Creating and removing worktrees is a write, so it lives in the CLI:{' '}
              <code className="font-mono">workspace-kit worktree add &lt;name&gt;</code>. This screen
              lists them.
            </UnavailableNote>
          )}
        </div>
      </Card>
    </div>
  );
}
