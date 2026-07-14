// Helpers to talk to the prolinemarkets backend (FastAPI, /api/v1).
// The backend returns { access_token, user_id, role, ... } for auth and a
// separate GET /auth/me for the full profile. Errors come as { detail }.
import { API_URL } from "../config";

const AUTH_URL = `${API_URL}/auth`;

// Normalize FastAPI error payloads ({ detail: string | [{ msg }] }) into text
export const getApiError = (data) => {
  if (!data) return null;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join("\n");
  }
  return data.message || null;
};

// Safely parse a fetch Response whose body may be empty or non-JSON
// (prevents "JSON Parse error: Unexpected end of input" crashes).
export const parseJsonSafe = async (response) => {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return {};
  }
};

// Fetch the full user profile and normalize the id field to `_id`,
// which is what the app's screens read throughout.
export const fetchUserProfile = async (token) => {
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return { ...u, _id: u.id, token };
  } catch (e) {
    return null;
  }
};
