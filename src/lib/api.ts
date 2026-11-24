/**
 * The one place the frontend learns where the Flask backend lives.
 *
 * Set VITE_API_URL at build time (for example the Hugging Face Space URL).
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
