/**
 * The one place the frontend learns where the Flask backend lives.
 *
 * Set VITE_API_URL at build time (the hosted site uses /api on the same domain).
 * Local development falls back to the Flask dev server on port 5000.
 */
export const DEFAULT_API_URL = "http://127.0.0.1:5000";

export function resolveApiUrl(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_API_URL;
}

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);

export function apiUrl(path: string, base: string = API_URL): string {
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export const TOKEN_STORAGE_KEY = "token";

/** The login token saved by the login page, or null when signed out. */
export function readToken(storage: Pick<Storage, "getItem"> = localStorage): string | null {
  try {
    return storage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Headers for a JSON request, with the login token when there is one. */
export function jsonHeaders(token: string | null = readToken()): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
