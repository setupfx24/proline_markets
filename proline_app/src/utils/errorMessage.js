// Normalize backend / thrown errors into a plain string suitable for <Text>.
//
// FastAPI returns validation errors as `detail` = an ARRAY of objects shaped
// like { type, loc, msg, input }. Rendering that array (or an object) directly
// inside a <Text> crashes React with "Objects are not valid as a React child".
// Always pipe untrusted error values through this before displaying them.

function pydanticItemToString(item) {
  if (!item || typeof item !== 'object') return String(item ?? '');
  // loc is like ["body", "email"] — surface the field name when present.
  const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
  const msg = item.msg || item.message || '';
  if (field && msg) return `${field}: ${msg}`;
  return msg || JSON.stringify(item);
}

export function toMessage(value, fallback = 'Something went wrong') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  // Error instance
  if (value instanceof Error) return value.message || fallback;

  // FastAPI 422: detail is an array of { type, loc, msg, input }
  if (Array.isArray(value)) {
    const parts = value.map(pydanticItemToString).filter(Boolean);
    return parts.length ? parts.join('\n') : fallback;
  }

  // Plain object: could be { detail }, { message }, or a single pydantic item.
  if (typeof value === 'object') {
    if (value.detail != null) return toMessage(value.detail, fallback);
    if (value.message != null) return toMessage(value.message, fallback);
    if (value.msg != null) return pydanticItemToString(value);
    return fallback;
  }

  return fallback;
}

export default toMessage;
