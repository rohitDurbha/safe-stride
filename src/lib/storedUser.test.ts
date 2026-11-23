import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredUser, STORED_USER_KEY } from "./storedUser";

const storageWith = (value: string | null) => ({
  getItem: (key: string) => (key === STORED_USER_KEY ? value : null),
});

describe("readStoredUser", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the parsed user with its emergency contact", () => {
    const user = {
      email: "walker@example.com",
      emergency_contact: { name: "Sam", email: "sam@example.com" },
    };
    expect(readStoredUser(storageWith(JSON.stringify(user)))).toEqual(user);
  });

  it("returns null when nothing is stored or storage is unavailable", () => {
    expect(readStoredUser(storageWith(null))).toBeNull();
    expect(readStoredUser(undefined)).toBeNull();
  });

  it("returns null for malformed or non object values", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readStoredUser(storageWith("{not json"))).toBeNull();
    expect(readStoredUser(storageWith("42"))).toBeNull();
    expect(readStoredUser(storageWith("null"))).toBeNull();
  });

  it("returns null when reading storage throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readStoredUser(blocked)).toBeNull();
  });
});
