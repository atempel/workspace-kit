/**
 * Health check — a rendering of core/doctor.js's report.
 *
 * The UI applies no threshold of its own. Verdicts, statuses, percentages and
 * suggestions all arrive decided; this file chooses where they sit on screen
 * and nothing else. That boundary is the section's P0 acceptance criterion, and
 * it is why "is 300 lines too many?" has exactly one answer across the CLI and
 * this dashboard.
 *
 * History growth is a distinct block from per-file size, per the spec — a
 * decision log at 15/15 entries is a different kind of problem from a file
 * being too long, and merging them would blur that.
 *
 * Dismissing a suggestion (P1) hides it *here* and nowhere else. It does not
 * touch the verdict, the counts, or what `workspace-kit doctor` reports — the
 * finding is still true, the reader has simply decided they are not acting on
 * it now. Letting a dismissal quiet the verdict would make the two surfaces
 * disagree about the same workspace, which is the one thing this whole data
 * layer is built to prevent. The screen says so rather than leaving it to be
 * inferred, and dismissed items stay one click from coming back.
 */

import { useState } from 'react';
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  Meter,
  SectionTitle,
  Stat,
  Status,
  TableWrap,
  Td,
  Th,
} from '../components/ui.jsx';
import {
  TOKEN_METHOD_NOTE,
  formatCount,
  formatTokens,
  statusLabel,
  statusTone,
} from '../lib/format.js';
import { suggestionKey } from '../lib/prefs.js';

function severityTone(severity) {
  if (severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'info';
}

/**
 * `dismissed`/`onDismiss`/`onRestore` are optional: the shell owns that state
 * because it owns persistence, but the section must render correctly without
 * it — which is also what lets the render tests exercise this file with nothing
 * but a payload.
 */
export default function Health({ data, dismissed = [], onDismiss, onRestore }) {
  const { health } = data;
  const budget = health.budget || {};
  const alwaysLoaded = (health.files || []).filter((f) => f.alwaysLoaded);
  const [showDismissed, setShowDismissed] = useState(false);

  const all = health.suggestions || [];
  const isDismissed = (s) => dismissed.indexOf(suggestionKey(s)) !== -1;
  const hiddenCount = all.filter(isDismissed).length;
  const visible = showDismissed ? all : all.filter((s) => !isDismissed(s));

  return (
    <div>
      <SectionTitle note="Thresholds, verdict and suggestions all come from the health check itself — this screen renders them, it does not decide them.">
        Health check
      </SectionTitle>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Overall verdict"
          value={statusLabel(health.verdict)}
          tone={statusTone(health.verdict)}
          data-status={health.verdict}
        />
        <Stat
          label="Always-loaded budget"
          value={budget.pctOfCap + '%'}
          sub={budget.lines + ' of ' + budget.lineCap + ' lines'}
          tone={statusTone(budget.status)}
        />
        <Stat
          label="Always-loaded tokens"
          value={formatTokens(budget.tokensEstimate)}
          sub="characters ÷ 4, approximate"
        />
        <Stat
          label="Cross-references"
          value={formatCount(health.crossReferences?.total)}
          sub={(health.crossReferences?.broken ?? 0) + ' broken'}
          tone={health.crossReferences?.broken ? 'bad' : undefined}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Always-loaded context budget"
          note={
            'These files are read into every conversation, so their size is a recurring cost. ' +
            TOKEN_METHOD_NOTE
          }
        />
        <div className="px-5 pt-4">
          <Meter
            value={budget.pctOfCap}
            tone={statusTone(budget.status)}
            label={
              'Always-loaded context budget: ' +
              budget.lines +
              ' of ' +
              budget.lineCap +
              ' lines'
            }
          />
        </div>
        {alwaysLoaded.length === 0 ? (
          <Empty>No always-loaded files detected.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th align="right">Lines</Th>
                  <Th align="right">Tokens (est.)</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {alwaysLoaded.map((f) => (
                  <tr key={f.path}>
                    <Td mono>{f.path}</Td>
                    <Td align="right" mono>
                      {formatCount(f.lines)}
                    </Td>
                    <Td align="right" mono>
                      {formatTokens(f.tokensEstimate)}
                    </Td>
                    <Td>
                      <Status tone={statusTone(f.status)}>{statusLabel(f.status)}</Status>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="History growth"
          note="Append-only logs measured against their rotation trigger — a different concern from file size."
        />
        {(health.growth || []).length === 0 ? (
          <Empty>No append-only history files tracked in this workspace.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th align="right">Entries</Th>
                  <Th align="right">Of threshold</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {health.growth.map((g) => (
                  <tr key={g.path}>
                    <Td mono>{g.path}</Td>
                    <Td align="right" mono>
                      {g.entries} / {g.threshold}
                    </Td>
                    <Td align="right" mono>
                      {g.pctOfThreshold}%
                    </Td>
                    <Td>
                      <Status tone={statusTone(g.status)}>{statusLabel(g.status)}</Status>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Suggestions"
          note={
            'Each one names a specific file and a concrete action.' +
            (hiddenCount
              ? ' Dismissing one hides it on this screen only — the health check still counts it.'
              : '')
          }
          right={
            <div className="flex items-center gap-2">
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  data-show-dismissed=""
                  onClick={() => setShowDismissed((v) => !v)}
                  className="cursor-pointer text-xs font-medium hover:underline"
                  style={{ color: 'var(--brand-2)' }}
                >
                  {showDismissed ? 'Hide dismissed' : hiddenCount + ' dismissed'}
                </button>
              ) : null}
              <Badge tone={all.length ? 'warn' : 'ok'}>{all.length}</Badge>
            </div>
          }
        />
        {all.length === 0 ? (
          <Empty>Nothing to suggest — this workspace is within every threshold.</Empty>
        ) : visible.length === 0 ? (
          <Empty>
            All {all.length} suggestion{all.length === 1 ? '' : 's'} dismissed on this screen. The
            health check still reports {all.length === 1 ? 'it' : 'them'}.
          </Empty>
        ) : (
          <ul>
            {visible.map((s, i) => {
              const key = suggestionKey(s);
              const off = isDismissed(s);
              return (
                <li
                  key={key + ':' + i}
                  data-suggestion={s.severity}
                  data-dismissed={off ? 'true' : 'false'}
                  className="flex items-start gap-4 px-5 py-3.5"
                  style={{
                    borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--border)',
                    opacity: off ? 0.5 : 1,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Status tone={severityTone(s.severity)}>{s.severity}</Status>
                      {s.file ? (
                        <span
                          className="font-mono text-xs"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {s.file}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[13px]">{s.message}</p>
                  </div>
                  {onDismiss ? (
                    <button
                      type="button"
                      data-dismiss={key}
                      onClick={() => (off ? onRestore(key) : onDismiss(key))}
                      className="shrink-0 cursor-pointer rounded px-2 py-1 text-[11.5px] font-medium"
                      style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                      title={
                        off
                          ? 'Show this suggestion again'
                          : 'Hide this suggestion on this screen. The health check still reports it.'
                      }
                    >
                      {off ? 'Restore' : 'Dismiss'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
