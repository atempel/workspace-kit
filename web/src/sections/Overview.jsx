/**
 * Overview — the file table and the cross-reference graph.
 *
 * Every row and every edge comes from core/inspect.js. Nothing here is
 * hard-coded, which is the section's own P0 acceptance criterion.
 *
 * Broken cross-references appear twice on purpose: as a badge on the offending
 * file's row, and as an annotation in the graph. One is scannable, the other is
 * structural, and the spec asks for both.
 */

import { useMemo, useState } from 'react';
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
  formatBytes,
  formatCount,
  formatTokens,
  gitStateLabel,
  gitStateTone,
  layerLabel,
} from '../lib/format.js';

const LAYER_ORDER = ['anchor', 'agent', 'human', 'other'];

function CrossReferenceGraph({ graph }) {
  const broken = (graph.edges || []).filter((e) => !e.resolved);

  // Files that actually participate in the graph; showing all 100+ scanned
  // files as nodes would drown the handful that carry the structure.
  const connected = useMemo(() => {
    const seen = new Map();
    (graph.edges || []).forEach((e) => {
      seen.set(e.from, (seen.get(e.from) || 0) + 1);
      if (e.resolved) seen.set(e.to, (seen.get(e.to) || 0) + 1);
    });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [graph]);

  if (!connected.length) {
    return <Empty>No cross-references between files in this workspace.</Empty>;
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap gap-2">
        {connected.map(([node, degree]) => (
          <span
            key={node}
            className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-xs"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            title={degree + ' reference(s)'}
          >
            {node}
            <span
              className="rounded px-1 text-[10px] font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--muted-foreground)' }}
            >
              {degree}
            </span>
          </span>
        ))}
      </div>

      {broken.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-semibold">
            <Status tone="bad">
              {broken.length} broken reference{broken.length === 1 ? '' : 's'} in the graph
            </Status>
          </h4>
          <ul className="space-y-1">
            {broken.map((e, i) => (
              <li key={i} className="font-mono text-xs">
                <span style={{ color: 'var(--muted-foreground)' }}>{e.from}</span>
                <span style={{ color: 'var(--bad)' }}> → {e.to}</span>
                <span style={{ color: 'var(--muted-foreground)' }}> (target not found)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Overview({ data }) {
  const { overview } = data;
  const [showAll, setShowAll] = useState(false);

  // A file is flagged when it is the source of an unresolved edge.
  const brokenBySource = useMemo(() => {
    const map = new Map();
    (overview.graph.edges || [])
      .filter((e) => !e.resolved)
      .forEach((e) => {
        map.set(e.from, [...(map.get(e.from) || []), e.to]);
      });
    return map;
  }, [overview.graph]);

  const grouped = useMemo(() => {
    const byLayer = new Map();
    overview.files.forEach((f) => {
      const layer = LAYER_ORDER.includes(f.layer) ? f.layer : 'other';
      byLayer.set(layer, [...(byLayer.get(layer) || []), f]);
    });
    return LAYER_ORDER.filter((l) => byLayer.has(l)).map((l) => [l, byLayer.get(l)]);
  }, [overview.files]);

  const totals = overview.totals;

  return (
    <div>
      <SectionTitle note="Everything below is read from the workspace on disk — no figure here is entered by hand.">
        Overview
      </SectionTitle>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Files indexed" value={formatCount(totals.files)} />
        <Stat label="Lines" value={formatCount(totals.lines)} />
        <Stat
          label="Estimated tokens"
          value={formatTokens(totals.tokensEstimate)}
          sub="characters ÷ 4, approximate"
        />
        <Stat
          label="Cross-references"
          value={formatCount((overview.graph.edges || []).length)}
          sub={
            (overview.graph.edges || []).filter((e) => !e.resolved).length + ' unresolved'
          }
          tone={
            (overview.graph.edges || []).some((e) => !e.resolved) ? 'bad' : undefined
          }
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Cross-reference graph"
          note="Files that reference each other, busiest first. Unresolved links are named below."
        />
        <CrossReferenceGraph graph={overview.graph} />
      </Card>

      {grouped.map(([layer, files]) => {
        const visible = showAll || layer !== 'other' ? files : files.slice(0, 8);
        return (
          <Card key={layer} className="mb-5">
            <CardHeader
              title={layerLabel(layer)}
              note={files.length + ' file' + (files.length === 1 ? '' : 's') + '. ' + TOKEN_METHOD_NOTE}
              right={
                layer === 'other' && files.length > 8 ? (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="cursor-pointer text-xs font-medium hover:underline"
                    style={{ color: 'var(--brand-2)' }}
                  >
                    {showAll ? 'Show fewer' : 'Show all ' + files.length}
                  </button>
                ) : null
              }
            />
            <TableWrap>
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th align="right">Lines</Th>
                    <Th align="right">Size</Th>
                    <Th align="right">Tokens (est.)</Th>
                    <Th>Change state</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((f) => {
                    const broken = brokenBySource.get(f.path);
                    return (
                      <tr key={f.path}>
                        <Td mono>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{f.path}</span>
                            {broken ? (
                              <Badge
                                tone="bad"
                                title={'Missing target(s): ' + broken.join(', ')}
                              >
                                {broken.length} broken link{broken.length === 1 ? '' : 's'}
                              </Badge>
                            ) : null}
                            {f.binary ? <Badge tone="muted">binary</Badge> : null}
                          </div>
                        </Td>
                        <Td align="right" mono>
                          {f.binary ? '—' : formatCount(f.lines)}
                        </Td>
                        <Td align="right" mono>
                          {formatBytes(f.bytes)}
                        </Td>
                        <Td align="right" mono>
                          {f.binary ? '—' : formatTokens(f.tokensEstimate)}
                        </Td>
                        <Td>
                          <Status tone={gitStateTone(f.gitState)}>
                            {gitStateLabel(f.gitState)}
                          </Status>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        );
      })}
    </div>
  );
}
