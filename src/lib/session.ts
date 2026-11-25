import { TOKEN_STORAGE_KEY, apiUrl, jsonHeaders } from "@/lib/api";
import { STORED_USER_KEY, StoredUser } from "@/lib/storedUser";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): SessionStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Save the login token and the account details shown around the app. */
export function saveSession(token: string, user: StoredUser, storage = defaultStorage()): void {
  try {
    storage?.setItem(TOKEN_STORAGE_KEY, token);
    storage?.setItem(STORED_USER_KEY, JSON.stringify(user));
  } catch {
    // Storage can be blocked. The app still works for this visit.
  }
}

/** Sign out on this device by forgetting the token and the cached account. */
export function clearSession(storage = defaultStorage()): void {
  try {
    storage?.removeItem(TOKEN_STORAGE_KEY);
    storage?.removeItem(STORED_USER_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

/** A display name for the account, falling back to the part of the email before @. */
export function displayName(user: StoredUser | null): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  return email ? email.split("@")[0] : "";
}

/** One or two capital letters for the avatar. */
export function initials(user: StoredUser | null): string {
  const name = displayName(user);
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 1)).toUpperCase() || "?";
}

/** Read the signed in account from the backend. Returns null for a bad token. */
export async function fetchProfile(token: string, fetcher: typeof fetch = (i, o) => fetch(i, o)): Promise<StoredUser | null> {
  const res = await fetcher(apiUrl("/me"), { headers: jsonHeaders(token) });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    email: data.email ?? "",
    name: data.name ?? "",
    emergency_contact: {
      name: data.emergency_contact?.name ?? "",
      email: data.emergency_contact?.email ?? "",
    },
  };
}
