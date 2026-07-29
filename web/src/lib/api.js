/**
 * The dashboard's only data source.
 *
 * One request, one scan, every section — that is deliberate on the server side
 * (core/server.js) so the five sections can never disagree with each other
 * mid-refresh. The UI honours it by fetching once and holding the result, not
 * by re-fetching per section.
 */

export async function fetchDashboard(signal) {
  const response = await fetch('/api/dashboard', { signal });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body && body.error ? body.error : '';
    } catch {
      /* a non-JSON error body is not worth surfacing verbatim */
    }
    throw new Error(
      detail || 'The workspace server answered with ' + response.status + '.'
    );
  }
  return response.json();
}

/**
 * Distinguishes "the server is not running" from "the server said no".
 * The first is by far the most common thing to go wrong in local development,
 * and it has a specific fix worth naming.
 */
export function describeFailure(error) {
  if (error instanceof TypeError) {
    return {
      title: 'Cannot reach the workspace server',
      detail:
        'Nothing is answering on 127.0.0.1:4319. Start it from the repository root with `node bin/workspace-kit.js serve .` and this page will connect.',
    };
  }
  return {
    title: 'The workspace server returned an error',
    detail: error.message,
  };
}
