import { showToast } from '../components/vantage/Toast';
import { showAppAlert } from '../components/vantage/AppAlert';

// Trade actions occasionally fail for reasons that aren't really user-facing
// "errors": a MAM/mirrored position is closed by the master (not the follower),
// and a closed market simply can't be traded right now. These should appear as
// a calm informational POPUP — never a red error.

export function isSoftTradeError(msg) {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('mam') ||
    m.includes('mirror') ||
    m.includes('master can close') ||
    m.includes('no price') ||
    m.includes('no live price') ||
    m.includes('reconnecting') ||
    m.includes('market is closed') ||
    m.includes('market closed') ||
    m.includes('market opens')
  );
}

// Returns { title, message } for the soft cases above, or null otherwise.
function softInfo(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('mam') || m.includes('mirror') || m.includes('master can close')) {
    return {
      title: 'Managed (MAM) trade',
      message: 'This is a MAM trade. Only the master can close it — it will close automatically when the master closes their position.',
    };
  }
  if (m.includes('no live price') || m.includes('reconnecting')) {
    return {
      title: 'Price unavailable',
      message: 'Live prices are reconnecting right now. Please try again in a few seconds.',
    };
  }
  if (m.includes('no price') || m.includes('market is closed') || m.includes('market closed') || m.includes('market opens')) {
    // The gateway's closed-market rejection includes the reopen schedule, e.g.
    // "Forex market opens Sunday at 22:00 UTC (current time 21:11 UTC)." —
    // surface the schedule, drop the parenthetical clutter.
    const schedule = String(msg || '').match(/\b[A-Za-z]+ market opens [^(.]+/);
    return {
      title: 'Market closed',
      message: schedule
        ? `The market is closed right now. ${schedule[0].trim()}.`
        : 'The market is closed right now. Please try again once it reopens.',
    };
  }
  return null;
}

// Single-action failure handler. Soft cases (MAM / market closed) show a clean
// info popup; any genuine error falls back to the red error toast.
export function handleTradeError(msg, fallback = 'Action failed') {
  const soft = softInfo(msg);
  if (soft) {
    showAppAlert({ title: soft.title, message: soft.message });
    return;
  }
  showToast({ kind: 'error', message: msg || fallback });
}

// Returns a { title, message } for ANY trade failure — soft cases get their
// friendly copy, everything else gets a clean, human message (no "Error:"
// prefix / stack noise). Callers that render their OWN popup (e.g. one that
// must show over a fullscreen chart, where toasts/root modals are hidden)
// use this instead of handleTradeError.
export function describeTradeError(msg, fallback = 'Order not placed') {
  const soft = softInfo(msg);
  if (soft) return soft;
  let m = String(msg || '').trim().replace(/^Error:\s*/i, '');
  return { title: 'Order not placed', message: m || fallback };
}
