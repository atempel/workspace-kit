/**
 * The dashboard shell.
 *
 * One scan backs all five sections: the payload is fetched once and held, and
 * switching sections never re-fetches. That is not a performance choice — the
 * server deliberately answers every section from a single scan so they cannot
 * disagree, and re-fetching per section would throw that away.
 *
 * Theme is the only state this app persists, in localStorage. Suggestion
 * dismissals and the workspace list are deliberately not persisted: where that
 * state should live is still an open question in the spec, and inventing a
 * store now would be answering it by accident.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar, { SECTIONS } from './components/Sidebar.jsx';
import { Button, Card, Status } from './components/ui.jsx';
import { AlertIcon, FolderIcon } from './components/icons.jsx';
import { describeFailure, fetchDashboard } from './lib/api.js';
import Overview from './sections/Overview.jsx';
import Health from './sections/Health.jsx';
import Sessions from './sections/Sessions.jsx';
import Queue from './sections/Queue.jsx';
import SourceControl from './sections/SourceControl.jsx';

const VIEWS = {
  overview: Overview,
  health: Health,
  sessions: Sessions,
  queue: Queue,
  git: SourceControl,
};

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('wskit-theme') || 'dark'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wskit-theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function Centered({ children }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

/**
 * Pointing the app at a folder that is not a workspace is a first-class result,
 * not an error — core/inspect.js returns it as one, and the spec asks the UI to
 * match. So this states what was scanned and offers the two ways forward,
 * rather than showing a failure screen.
 */
function NotAWorkspace({ data, onRetry }) {
  return (
    <Centered>
      <Card className="px-6 py-6">
        <div className="mb-3 flex items-center gap-2">
          <span style={{ color: 'var(--warn)' }}>
            <FolderIcon size={18} />
          </span>
          <h2 className="text-base font-semibold">Not a workspace//kit workspace</h2>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
          {data.detection?.reason ||
            'None of the anchor files a workspace//kit workspace is built around were found here.'}
        </p>
        <p className="mt-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Scanned: {data.root}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            tone="brand"
            disabled
            title="Generation runs in the CLI and the standalone artifact, not from this read-only screen."
          >
            Generate a workspace here
          </Button>
          <Button onClick={onRetry}>Pick another folder</Button>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          To open a different folder, restart the server against it:{' '}
          <code className="font-mono">workspace-kit serve &lt;folder&gt;</code>.
        </p>
      </Card>
    </Centered>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('overview');

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchDashboard(controller.signal)
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(describeFailure(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      overview: data.overview?.totals?.files,
      health: data.health?.suggestions?.length || null,
      sessions: data.sessions?.length,
      queue: data.queue?.filter((q) => q.status === 'pending').length || null,
      git: data.git?.files?.length || null,
    };
  }, [data]);

  const View = VIEWS[active] || Overview;

  return (
    <div className="flex h-full">
      <Sidebar
        data={data}
        active={active}
        onSelect={setActive}
        theme={theme}
        onToggleTheme={toggleTheme}
        counts={counts}
      />

      <main className="flex-1 overflow-y-auto">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-8 py-3"
          style={{
            background: 'var(--background)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h1 className="text-[13px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
            {SECTIONS.find((s) => s.id === active)?.label}
          </h1>
          <div className="flex items-center gap-3">
            {data?.git?.branch ? (
              <span className="font-mono text-xs" style={{ color: 'var(--brand-2)' }}>
                {data.git.branch}
              </span>
            ) : null}
            <Button onClick={load} title="Re-scan the workspace">
              {loading ? 'Scanning…' : 'Rescan'}
            </Button>
          </div>
        </header>

        <div className="px-8 py-6">
          {loading && !data ? (
            <Centered>
              <p className="text-center text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                Scanning the workspace…
              </p>
            </Centered>
          ) : error ? (
            <Centered>
              <Card className="px-6 py-6">
                <div className="mb-3 flex items-center gap-2">
                  <span style={{ color: 'var(--bad)' }}>
                    <AlertIcon size={18} />
                  </span>
                  <h2 className="text-base font-semibold">{error.title}</h2>
                </div>
                <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                  {error.detail}
                </p>
                <div className="mt-5">
                  <Button tone="brand" onClick={load}>
                    Try again
                  </Button>
                </div>
              </Card>
            </Centered>
          ) : data && !data.isWorkspace ? (
            <NotAWorkspace data={data} onRetry={load} />
          ) : data ? (
            <View data={data} />
          ) : null}
        </div>

        {/*
          `health.method` is an object ({ tokenEstimate, thresholds }), not a
          string. Only the token line belongs in the footer — the spec asks that
          the estimate always be labelled as an approximation wherever a token
          count is shown, and this is where that label lives for the whole shell.
        */}
        {data?.health?.method?.tokenEstimate ? (
          <footer
            className="px-8 pb-8 text-[11px]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Status tone="muted">Tokens: {data.health.method.tokenEstimate}</Status>
          </footer>
        ) : null}
      </main>
    </div>
  );
}
