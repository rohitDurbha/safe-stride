// The signed in user is cached in localStorage under this key by the login
// and profile flows.
export const STORED_USER_KEY = "safeStrideUser";

export interface StoredUser {
  email?: string;
  name?: string;
  emergency_contact?: { name?: string; email?: string };
}

type ReadableStorage = Pick<Storage, "getItem">;

function defaultStorage(): ReadableStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    // Some browsers throw when site data is blocked.
    return undefined;
  }
}

// Reads the cached user once, so components can pass this to a lazy useState
// initializer instead of copying storage into state from an effect. Missing,
// blocked or malformed data all come back as null.
export function readStoredUser(
  storage: ReadableStorage | undefined = defaultStorage(),
): StoredUser | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORED_USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredUser) : null;
  } catch (err) {
    console.error("Error reading the stored user:", err);
    return null;
  }
}
