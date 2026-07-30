/**
 * The app shell's persistent sidebar, per DESIGN.md's layout direction:
 * workspace identity, section nav, no top mega-nav.
 *
 * The logo is the prototype's — three offset rounded rectangles and a play
 * mark, in the product's teal and amber.
 */

import { BranchIcon, FileIcon, InboxIcon, MoonIcon, PulseIcon, SunIcon, HistoryIcon } from './icons.jsx';
import { Status } from './ui.jsx';
import { statusLabel, statusTone } from '../lib/format.js';

export const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: FileIcon },
  { id: 'health', label: 'Health check', Icon: PulseIcon },
  { id: 'sessions', label: 'Session log', Icon: HistoryIcon },
  { id: 'queue', label: 'Queue', Icon: InboxIcon },
  { id: 'git', label: 'Source control', Icon: BranchIcon },
];

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect
        x="12.3"
        y="1.8"
        width="21.75"
        height="27.55"
        rx="3.6"
        stroke="currentColor"
        strokeOpacity=".28"
        strokeWidth="1.8"
      />
      <rect
        x="7.2"
        y="5.4"
        width="21.75"
        height="27.55"
        rx="3.6"
        stroke="var(--brand-2)"
        strokeWidth="1.8"
      />
      <rect
        x="2.1"
        y="9"
        width="21.75"
        height="27.55"
        rx="3.6"
        stroke="var(--brand)"
        strokeWidth="2.2"
      />
      <path d="M8.2 24.9v-1.5l5.9-2.9-5.9-2.8v-1.5l7.6 3.6v1.6z" fill="var(--brand)" />
    </svg>
  );
}

export default function Sidebar({ data, active, onSelect, theme, onToggleTheme, counts }) {
  const name = data?.root ? data.root.split('/').filter(Boolean).pop() : 'No workspace';

  return (
    <aside
      className="flex w-60 shrink-0 flex-col"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight">
          workspace<span style={{ color: 'var(--brand)' }}>//</span>kit
        </span>
        <span
          className="ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--muted-foreground)' }}
        >
          local
        </span>
      </div>

      <div className="px-3 pb-3">
        <div
          className="rounded-md px-3 py-2"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="truncate text-[13px] font-medium" title={name}>
            {name}
          </div>
          <div
            className="truncate font-mono text-[10.5px]"
            style={{ color: 'var(--muted-foreground)' }}
            title={data?.root}
          >
            {data?.root || '—'}
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {SECTIONS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              data-nav={id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(id)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium"
              style={{
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              {counts && counts[id] != null ? (
                <span
                  className="rounded px-1.5 font-mono text-[10px] font-semibold"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {counts[id]}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {data?.health?.verdict ? (
        <div className="mt-4 px-4">
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Workspace health
          </div>
          <Status tone={statusTone(data.health.verdict)}>
            {statusLabel(data.health.verdict)}
          </Status>
        </div>
      ) : null}

      <div className="mt-auto px-3 py-3">
        <button
          type="button"
          data-theme-toggle=""
          onClick={onToggleTheme}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px]"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
        </button>
      </div>
    </aside>
  );
}
