// API Configuration
import { API_BASE_URL as ENV_API_BASE_URL } from "@env";

// Use environment variable or fallback to production URL.
// NOTE: this must be the API gateway host (REST + WebSocket), NOT the web
// frontend host. prolinemarket.com serves the Next.js site and does not proxy
// /ws/* ; the gateway lives at api.prolinemarket.com.
export const API_BASE_URL =
  ENV_API_BASE_URL || "https://api.prolinemarket.com";
// Backend REST API is versioned under /api/v1
export const API_URL = `${API_BASE_URL}/api/v1`;

// For local development, update .env file with:
// API_BASE_URL=http://YOUR_LOCAL_IP:5001
