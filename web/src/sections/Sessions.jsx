/**
 * Session log — SESSIONS.md, newest first.
 *
 * The tool tag is read from the entry, not guessed by the UI. If a session was
 * logged without one, this renders that honestly rather than inferring which
 * tool it "probably" was — the log is a handoff record, and a fabricated tag
 * would make it a worse one.
 */

import { Card, CardHeader, Empty, SectionTitle } from '../components/ui.jsx';

const TOOL_COLORS = {
  Cowork: 'var(--brand-2)',
  'Claude Code': 'var(--brand)',
  'Claude Design': 'var(--info)',
};

function ToolTag({ tool }) {
  if (!tool) {
    return (
      <span className="text-[11px] italic" style={{ color: 'var(--muted-foreground)' }}>
        tool not recorded
      </span>
    );
  }
  const known = Object.keys(TOOL_COLORS).find((k) => tool.startsWith(k));
  const color = known ? TOOL_COLORS[known] : 'var(--muted-foreground)';
  return (
    <span
      className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        color,
        border: '1px solid ' + color,
        background: 'color-mix(in oklab, ' + color + ' 10%, transparent)',
      }}
    >
      {tool}
    </span>
  );
}

export default function Sessions({ data }) {
  const sessions = data.sessions || [];

  return (
    <div>
      <SectionTitle note="Who touched this workspace, in what tool, and the state they left it in. Newest first.">
        Session log
      </SectionTitle>

      {sessions.length === 0 ? (
        <Card>
          <Empty>
            No SESSIONS.md entries found. The convention is one entry per session, appended
            before the session ends.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <Card key={i}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span className="font-mono text-xs">{s.date}</span>
                    <ToolTag tool={s.tool} />
                  </span>
                }
                right={
                  <span className="font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    SESSIONS.md:{s.startLine}
                  </span>
                }
              />
              <div className="space-y-3 px-5 py-4">
                {s.did ? (
                  <div>
                    <div
                      className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Did
                    </div>
                    <p className="text-[13px] leading-relaxed">{s.did}</p>
                  </div>
                ) : null}
                {s.leftAt ? (
                  <div>
                    <div
                      className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Left at
                    </div>
                    <p className="text-[13px] leading-relaxed">{s.leftAt}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
