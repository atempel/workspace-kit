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
 */

import {
  Badge,
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
import {
  TOKEN_METHOD_NOTE,
  formatCount,
  formatTokens,
  statusLabel,
  statusTone,
} from '../lib/format.js';

function severityTone(severity) {
  if (severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'info';
}

export default function Health({ data }) {
  const { health } = data;
  const budget = health.budget || {};
  const alwaysLoaded = (health.files || []).filter((f) => f.alwaysLoaded);

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
          note="Each one names a specific file and a concrete action."
          right={
            <Badge tone={health.suggestions?.length ? 'warn' : 'ok'}>
              {health.suggestions?.length || 0}
            </Badge>
          }
        />
        {(health.suggestions || []).length === 0 ? (
          <Empty>Nothing to suggest — this workspace is within every threshold.</Empty>
        ) : (
          <ul>
            {health.suggestions.map((s, i) => (
              <li
                key={i}
                className="px-5 py-3.5"
                style={{
                  borderBottom:
                    i === health.suggestions.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Status tone={severityTone(s.severity)}>{s.severity}</Status>
                  {s.file ? (
                    <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {s.file}
                    </span>
                  ) : null}
                </div>
                <p className="text-[13px]">{s.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
