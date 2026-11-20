import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("reads the message from an Error", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe("Failed to fetch");
  });

  it("returns a thrown string as is", () => {
    expect(errorMessage("User already exists")).toBe("User already exists");
  });

  it("reads a message field from a plain object", () => {
    expect(errorMessage({ message: "Bad token" })).toBe("Bad token");
  });

  it("falls back when there is no usable message", () => {
    expect(errorMessage(null, "Login failed")).toBe("Login failed");
    expect(errorMessage(undefined, "Login failed")).toBe("Login failed");
    expect(errorMessage({ message: 42 }, "Login failed")).toBe("Login failed");
    expect(errorMessage(new Error(""), "Login failed")).toBe("Login failed");
  });

  it("returns an empty string when no fallback is given", () => {
    expect(errorMessage(404)).toBe("");
  });
});
