/**
 * Dev-gated logger. Use instead of console.* in app code:
 *  - keeps production JS free of logging work even before Babel's
 *    transform-remove-console pass
 *  - one grep-able seam if we ever wire a crash reporter (Sentry etc.)
 * NEVER log tokens, passwords or full API payloads.
 */
/* eslint-disable no-console */
const noop = () => {};

export const log = __DEV__ ? console.log.bind(console) : noop;
export const warn = __DEV__ ? console.warn.bind(console) : noop;
export const error = __DEV__ ? console.error.bind(console) : noop;

export default { log, warn, error };
