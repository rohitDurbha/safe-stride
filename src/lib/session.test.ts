import { describe, expect, it } from "vitest";
import { TOKEN_STORAGE_KEY } from "./api";
import { STORED_USER_KEY } from "./storedUser";
import { clearSession, displayName, fetchProfile, initials, saveSession } from "./session";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("session storage", () => {
  it("saves and clears the same keys the rest of the app reads", () => {
    const storage = memoryStorage();
    saveSession("tok", { email: "a@b.c", name: "Ana" }, storage);
    expect(storage.data.get(TOKEN_STORAGE_KEY)).toBe("tok");
    expect(JSON.parse(storage.data.get(STORED_USER_KEY)!)).toEqual({ email: "a@b.c", name: "Ana" });

    clearSession(storage);
    expect(storage.data.size).toBe(0);
  });

  it("ignores storage that throws", () => {
    const broken = {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => saveSession("tok", {}, broken)).not.toThrow();
    expect(() => clearSession(broken)).not.toThrow();
  });
});

describe("names", () => {
  it("prefers the saved name and falls back to the email", () => {
    expect(displayName({ name: " Rohit Durbha ", email: "r@x.com" })).toBe("Rohit Durbha");
    expect(displayName({ email: "rohit.d@x.com" })).toBe("rohit.d");
    expect(displayName(null)).toBe("");
  });

  it("makes avatar initials", () => {
    expect(initials({ name: "Rohit Durbha" })).toBe("RD");
    expect(initials({ email: "rohit.durbha@x.com" })).toBe("RD");
    expect(initials({ name: "ana" })).toBe("A");
    expect(initials(null)).toBe("?");
  });
});

describe("fetchProfile", () => {
  it("returns the account with the emergency contact", async () => {
    const fetcher = (async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return new Response(JSON.stringify({
        id: "1", email: "a@b.c", name: "Ana", emergency_contact: { name: "Kim", email: "k@b.c" },
      }));
    }) as unknown as typeof fetch;
    expect(await fetchProfile("tok", fetcher)).toEqual({
      email: "a@b.c", name: "Ana", emergency_contact: { name: "Kim", email: "k@b.c" },
    });
  });

  it("returns null for a rejected token", async () => {
    const fetcher = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    expect(await fetchProfile("bad", fetcher)).toBeNull();
  });
});
