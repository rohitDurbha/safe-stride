import { apiUrl, jsonHeaders, readToken } from "@/lib/api";
import { fetchProfile, saveSession } from "@/lib/session";
import type { StoredUser } from "@/lib/storedUser";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function failure(data: Record<string, unknown>, fallback: string): Error {
  return new Error(typeof data.error === "string" ? data.error : fallback);
}

/** Save the token, then load the full account so the app can show it. */
async function startSession(token: string, fallback: StoredUser): Promise<StoredUser> {
  const profile = (await fetchProfile(token).catch(() => null)) ?? fallback;
  saveSession(token, profile);
  return profile;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  contactName: string,
  contactEmail: string,
): Promise<StoredUser> {
  const emergency_contact = { name: contactName, email: contactEmail };
  const res = await fetch(apiUrl("/signup"), {
    method: "POST",
    headers: jsonHeaders(null),
    body: JSON.stringify({ email, password, name, emergency_contact }),
  });
  const data = await readJson(res);
  if (res.status === 409) throw new Error("User already exists");
  if (!res.ok || typeof data.token !== "string") throw failure(data, "Signup failed");
  return startSession(data.token, { email, name, emergency_contact });
}

export async function loginUser(email: string, password: string): Promise<StoredUser> {
  const res = await fetch(apiUrl("/login"), {
    method: "POST",
    headers: jsonHeaders(null),
    body: JSON.stringify({ email, password }),
  });
  const data = await readJson(res);
  if (!res.ok || typeof data.token !== "string") throw failure(data, "Invalid email or password");
  return startSession(data.token, { email });
}

/** Change the account email and emergency contact on the server. */
export async function updateUserProfile(
  current: StoredUser | null,
  email: string,
  contactName: string,
  contactEmail: string,
): Promise<StoredUser> {
  const token = readToken();
  if (!token) throw new Error("Please sign in again.");
  const emergency_contact = { name: contactName, email: contactEmail };
  const res = await fetch(apiUrl("/update_profile"), {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify({ email, emergency_contact }),
  });
  const data = await readJson(res);
  if (!res.ok) throw failure(data, "Failed to update profile");
  const updated = { ...current, email, emergency_contact };
  saveSession(token, updated);
  return updated;
}
