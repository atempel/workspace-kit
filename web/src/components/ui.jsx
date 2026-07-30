/**
 * The small set of shadcn-shaped primitives this dashboard needs.
 *
 * Written here rather than generated with the shadcn CLI: a read-only
 * dashboard needs a card, a badge, a table and a button, none of which need
 * Radix's focus-management or portal machinery. Vendoring four styled elements
 * beats pulling a component library and its dependency tree behind them. The
 * visual language still follows the tokens in theme.css, which come from the
 * Claude Design prototype.
 *
 * `Status` is the important one. Every status in this UI renders as colour +
 * icon + text together, never colour alone — that is a P0 accessibility
 * criterion in docs/specs/web-app-dashboard.md, and centralising it here is
 * what makes it hold across all five sections.
 */

import { AlertIcon, CheckIcon, DotIcon, XIcon } from './icons.jsx';

const TONE_COLOR = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  info: 'var(--info)',
  muted: 'var(--muted-foreground)',
};

const TONE_ICON = {
  ok: CheckIcon,
  warn: AlertIcon,
  bad: XIcon,
  info: DotIcon,
  muted: DotIcon,
};

export function Status({ tone = 'muted', children, size = 12 }) {
  const Icon = TONE_ICON[tone] || DotIcon;
  const color = TONE_COLOR[tone] || TONE_COLOR.muted;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium"
      style={{ color }}
    >
      <Icon size={size} />
      <span>{children}</span>
    </span>
  );
}

export function Badge({ tone = 'muted', children, title }) {
  const color = TONE_COLOR[tone] || TONE_COLOR.muted;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{
        color,
        border: '1px solid ' + color,
        background: 'color-mix(in oklab, ' + color + ' 10%, transparent)',
      }}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = '', ...rest }) {
  return (
    <div
      className={'rounded-lg ' + className}
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, note, right }) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-5 py-3.5"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {note ? (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {note}
          </p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone, ...rest }) {
  return (
    <Card className="px-5 py-4" {...rest}>
      <div
        className="font-mono text-2xl font-semibold"
        style={{ color: tone ? TONE_COLOR[tone] : 'var(--foreground)' }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium">{label}</div>
      {sub ? (
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          {sub}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * The always-loaded budget as a real meter, not a decorative bar.
 *
 * `role="meter"` with aria-valuenow/min/max is what makes the figure reachable
 * to a screen reader — the same reason every status here pairs colour with an
 * icon and a label. The percentage arrives already computed by the health
 * check; nothing is judged here.
 */
export function Meter({ value, max = 100, tone = 'ok', label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = TONE_COLOR[tone] || TONE_COLOR.muted;
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--muted)' }}
    >
      <div className="h-full rounded-full" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

/** Wide content scrolls inside its own container; the page body never does. */
export function TableWrap({ children }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Th({ children, align = 'left' }) {
  return (
    <th
      className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{
        textAlign: align,
        color: 'var(--muted-foreground)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--muted)',
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', mono = false, className = '' }) {
  return (
    <td
      className={'px-4 py-2 align-top ' + (mono ? 'font-mono text-xs ' : 'text-[13px] ') + className}
      style={{ textAlign: align, borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </td>
  );
}

export function Button({ children, disabled, title, onClick, tone = 'default', ...rest }) {
  const isBrand = tone === 'brand';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...rest}
      className={
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-opacity ' +
        (disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:opacity-85')
      }
      style={{
        background: isBrand ? 'var(--brand)' : 'var(--muted)',
        color: isBrand ? '#18181b' : 'var(--foreground)',
        border: '1px solid ' + (isBrand ? 'var(--brand)' : 'var(--border)'),
      }}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, note }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {note ? (
        <p className="mt-1 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="px-5 py-8 text-center text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
      {children}
    </div>
  );
}

export function Mono({ children }) {
  return <span className="font-mono text-xs">{children}</span>;
}
