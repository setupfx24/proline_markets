/**
 * Decouples API / idle / broadcast from Zustand to avoid circular imports.
 */

export type AdminSessionEndReason = 'expired' | '401' | 'idle' | 'remote_logout' | 'manual';

type Handler = (reason: AdminSessionEndReason) => void;

let handler: Handler | null = null;
let reentryDepth = 0;

export function registerAdminSessionEndHandler(h: Handler | null): void {
  handler = h;
}

export function endAdminSession(reason: AdminSessionEndReason): void {
  if (typeof window === 'undefined') return;
  if (reentryDepth > 0) return;
  reentryDepth += 1;
  try {
    handler?.(reason);
  } finally {
    reentryDepth -= 1;
  }
}
