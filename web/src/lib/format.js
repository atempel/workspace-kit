/**
 * Presentation helpers.
 *
 * Everything here is formatting only. No threshold, verdict or classification
 * is computed in the front end — those belong to core/doctor.js and
 * core/git.js, and the spec makes that a hard boundary: if a section needs a
 * number the data layer does not produce, the fix goes there, not here.
 */

export function formatBytes(n) {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatCount(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}

/**
 * Token figures are an estimate (characters ÷ 4), never a tokenizer count. The
 * spec makes labelling that a P0 acceptance criterion, so the tilde is part of
 * the formatter rather than something each caller has to remember.
 */
export function formatTokens(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return '~' + (n / 1000).toFixed(1) + 'k';
  return '~' + n;
}

export const TOKEN_METHOD_NOTE =
  'Token figures are estimates (characters ÷ 4), not a tokenizer count.';

/** Human-readable label for a git file state. No git vocabulary reaches the UI. */
export function gitStateLabel(state) {
  switch (state) {
    case 'untracked':
      return 'New, not yet tracked';
    case 'modified-unstaged':
      return 'Changed, not saved to history';
    case 'staged':
      return 'Ready to commit';
    case 'committed-clean':
      return 'Saved';
    default:
      return state || 'Unknown';
  }
}

export function gitStateTone(state) {
  switch (state) {
    case 'modified-unstaged':
      return 'warn';
    case 'untracked':
      return 'info';
    case 'staged':
      return 'ok';
    default:
      return 'muted';
  }
}

/**
 * Maps the data layer's status vocabulary onto the four tones the UI knows.
 * Unknown values fall back to neutral rather than being guessed into a colour —
 * inventing a severity the doctor did not assign would be the UI making a
 * judgement, which is exactly what the spec forbids.
 */
export function statusTone(status) {
  switch (status) {
    case 'healthy':
    case 'ok':
      return 'ok';
    case 'warning':
    case 'needs-attention':
      return 'warn';
    case 'over-budget':
    case 'unhealthy':
    case 'broken':
      return 'bad';
    default:
      return 'muted';
  }
}

export function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'needs-attention':
      return 'Needs attention';
    case 'unhealthy':
      return 'Unhealthy';
    case 'over-budget':
      return 'Over budget';
    case 'warning':
      return 'Warning';
    case 'ok':
      return 'OK';
    default:
      return status || 'Unknown';
  }
}

export function layerLabel(layer) {
  switch (layer) {
    case 'anchor':
      return 'Anchor';
    case 'agent':
      return 'Agent layer';
    case 'human':
      return 'Human layer';
    default:
      return 'Other';
  }
}
