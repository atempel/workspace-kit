/**
 * ⌘K command palette — section and file navigation (docs/specs/web-app-dashboard.md, P1).
 *
 * Navigation only, deliberately. Every *action* in this dashboard is currently
 * unavailable-with-a-reason, because the server is read-only; a palette that
 * offered "Commit changes" and then explained it could not would be worse than
 * one that never offers it. So the palette lists the five sections and every
 * file the scan found, and nothing else. When actions become real, they belong
 * here — the shape allows for it.
 *
 * Built rather than pulled in (cmdk and friends): the whole behaviour is a
 * filtered list with four keys bound to it, and web/ vendors its primitives on
 * purpose (see components/ui.jsx).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon } from './icons.jsx';

/** Subsequence match — "ovw" finds "Overview", "tsk" finds "TASKS.md". */
function matches(haystack, needle) {
  if (!needle) return true;
  const text = haystack.toLowerCase();
  const query = needle.toLowerCase();
  let at = 0;
  for (let i = 0; i < query.length; i++) {
    at = text.indexOf(query[i], at);
    if (at === -1) return false;
    at++;
  }
  return true;
}

export default function CommandPalette({ open, onClose, sections, files, onGoSection, onGoFile }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const sectionItems = sections.map((s) => ({
      kind: 'section',
      id: 'section:' + s.id,
      label: s.label,
      hint: 'Section',
      run: () => onGoSection(s.id),
    }));
    const fileItems = files.map((f) => ({
      kind: 'file',
      id: 'file:' + f.path,
      label: f.path,
      hint: 'File',
      run: () => onGoFile(f.path),
    }));
    // Sections first: five of them against a hundred files, and they are what
    // an empty query should be offering.
    return [...sectionItems, ...fileItems].filter((i) => matches(i.label, query));
  }, [sections, files, query, onGoSection, onGoFile]);

  // A filtered list whose cursor stays where it was would run off the end.
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // The input mounts with the overlay; focus after paint, not before.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => (items.length ? (c + 1) % items.length : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = items[cursor];
        if (item) {
          item.run();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, cursor, onClose]);

  // Keep the highlighted row in view when the cursor is driven by the keyboard.
  useEffect(() => {
    const node = listRef.current?.querySelector('[data-cursor="true"]');
    if (node) node.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      data-palette=""
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: 'color-mix(in oklab, #000 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-lg"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,.4)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--muted-foreground)' }}>
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            data-palette-input=""
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go to a section or a file…"
            aria-label="Go to a section or a file"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--foreground)' }}
          />
          <kbd
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p
              className="px-4 py-6 text-center text-[13px]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Nothing matches “{query}”.
            </p>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-palette-item={item.id}
                data-cursor={i === cursor ? 'true' : 'false'}
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left"
                style={{ background: i === cursor ? 'var(--accent)' : 'transparent' }}
              >
                <span
                  className={
                    'flex-1 truncate ' +
                    (item.kind === 'file' ? 'font-mono text-xs' : 'text-[13px] font-medium')
                  }
                >
                  {item.label}
                </span>
                <span className="text-[10.5px]" style={{ color: 'var(--muted-foreground)' }}>
                  {item.hint}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
