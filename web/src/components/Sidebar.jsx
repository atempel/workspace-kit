/**
 * The app shell's persistent sidebar, per DESIGN.md's layout direction:
 * workspace identity, section nav, no top mega-nav.
 *
 * The logo is the prototype's — three offset rounded rectangles and a play
 * mark, in the product's teal and amber.
 */

import { useEffect, useRef, useState } from 'react';
import {
  BranchIcon,
  CheckIcon,
  ChevronIcon,
  FileIcon,
  InboxIcon,
  MoonIcon,
  PulseIcon,
  SearchIcon,
  SunIcon,
  HistoryIcon,
} from './icons.jsx';
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

/**
 * The workspace switcher (docs/specs/web-app-dashboard.md, P1) — a shell
 * affordance, not #29's multi-project dashboard.
 *
 * It can remember where you have been and it cannot take you there, and the UI
 * says so plainly instead of pretending otherwise. `core/server.js` binds one
 * root for its whole lifetime, so opening another workspace means restarting it
 * — the same thing the not-a-workspace screen already tells the user. Drawing a
 * live-looking switcher over a server that cannot rebind would be exactly the
 * dishonesty the Source control section's disabled buttons exist to avoid.
 */
function WorkspaceSwitcher({ data, name, recent, onForget }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onAway = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onAway);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const others = recent.filter((w) => w.root !== data?.root);

  const copy = (root) => {
    const command = 'workspace-kit serve ' + root;
    // Clipboard access is permission-gated and absent over plain http in some
    // browsers; the command stays selectable on screen either way.
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(root);
        setTimeout(() => setCopied(null), 1600);
      },
      () => setCopied(null)
    );
  };

  return (
    <div className="relative px-3 pb-3" ref={ref}>
      <button
        type="button"
        data-workspace-switcher=""
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium" title={name}>
            {name}
          </span>
          <span
            className="block truncate font-mono text-[10.5px]"
            style={{ color: 'var(--muted-foreground)' }}
            title={data?.root}
          >
            {data?.root || '—'}
          </span>
        </span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          <ChevronIcon size={14} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          data-workspace-menu=""
          className="absolute right-3 left-3 z-30 mt-1 overflow-hidden rounded-md"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,.35)',
          }}
        >
          <div
            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}
          >
            Recent workspaces
          </div>

          <div className="max-h-64 overflow-y-auto">
            <div className="flex items-start gap-2 px-3 py-2">
              <span className="mt-0.5" style={{ color: 'var(--ok)' }}>
                <CheckIcon size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{name}</span>
                <span className="block text-[10.5px]" style={{ color: 'var(--muted-foreground)' }}>
                  Open now
                </span>
              </span>
            </div>

            {others.length === 0 ? (
              <p
                className="px-3 pb-3 text-[11.5px]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                No other workspace has been opened in this browser yet.
              </p>
            ) : (
              others.map((w) => (
                <div
                  key={w.root}
                  data-recent-workspace={w.root}
                  className="px-3 py-2"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium" title={w.name}>
                        {w.name}
                      </span>
                      <span
                        className="block truncate font-mono text-[10px]"
                        style={{ color: 'var(--muted-foreground)' }}
                        title={w.root}
                      >
                        {w.root}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(w.root)}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      {copied === w.root ? 'Copied' : 'Copy command'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onForget(w.root)}
                      title="Remove from this list"
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[10.5px]"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Forget
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <p
            className="px-3 py-2 text-[11px]"
            style={{ color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}
          >
            This server reads one workspace for as long as it runs. To open another, restart it
            against that folder — the copied command does exactly that.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  data,
  active,
  onSelect,
  theme,
  onToggleTheme,
  counts,
  recent = [],
  onForgetWorkspace = () => {},
  onOpenPalette,
}) {
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

      <WorkspaceSwitcher
        data={data}
        name={name}
        recent={recent}
        onForget={onForgetWorkspace}
      />

      <div className="px-3 pb-3">
        <button
          type="button"
          data-palette-trigger=""
          onClick={onOpenPalette}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          <SearchIcon size={13} />
          <span className="flex-1 text-left">Search…</span>
          <kbd
            className="rounded px-1 font-mono text-[10px]"
            style={{ background: 'var(--muted)' }}
          >
            ⌘K
          </kbd>
        </button>
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
