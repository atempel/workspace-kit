/**
 * Document queue — queue/*.md.
 *
 * The spec's acceptance criterion is that pending items are distinguishable
 * without opening anything, and that this view reflects exactly what
 * `grep -l "Status: Pending" queue/*.md` would return. Both come from the
 * parser in core/inspect.js, which normalises the status for that grep
 * convention; the UI sorts pending first and says so.
 */

import { useMemo } from 'react';
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  SectionTitle,
  Status,
  TableWrap,
  Td,
  Th,
} from '../components/ui.jsx';

function statusTone(status) {
  if (status === 'pending') return 'warn';
  if (status === 'ingested') return 'ok';
  return 'muted';
}

export default function Queue({ data }) {
  const items = data.queue || [];

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status === b.status) return (b.added || '').localeCompare(a.added || '');
        return a.status === 'pending' ? -1 : 1;
      }),
    [items]
  );

  const pending = items.filter((i) => i.status === 'pending').length;

  return (
    <div>
      <SectionTitle note="References saved but not yet incorporated. Pending items sort first.">
        Document queue
      </SectionTitle>

      <Card>
        <CardHeader
          title="Queue"
          note={items.length + ' item' + (items.length === 1 ? '' : 's') + ' in queue/'}
          right={
            <Badge tone={pending ? 'warn' : 'ok'}>
              {pending} pending
            </Badge>
          }
        />
        {items.length === 0 ? (
          <Empty>
            Nothing queued. When you save a reference you have not incorporated yet, it belongs
            here as a stub in <code className="font-mono">queue/</code>.
          </Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Source</Th>
                  <Th>Added</Th>
                  <Th>Status</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.path}>
                    <Td>
                      <div className="font-medium">{item.title || '—'}</div>
                      <div className="font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        {item.path}
                      </div>
                    </Td>
                    <Td>{item.type || '—'}</Td>
                    <Td>{item.source || '—'}</Td>
                    <Td mono>{item.added || '—'}</Td>
                    <Td>
                      <Status tone={statusTone(item.status)}>
                        {item.statusRaw || item.status || 'Unknown'}
                      </Status>
                      {item.ingestedOn ? (
                        <div className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          {item.ingestedOn}
                          {item.ingestedInto ? ' → ' + item.ingestedInto : ''}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <span style={{ color: 'var(--muted-foreground)' }}>{item.notes || '—'}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
