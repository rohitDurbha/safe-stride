import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL, apiUrl, jsonHeaders, readToken, resolveApiUrl } from "./api";

describe("resolveApiUrl", () => {
  it("falls back to the local Flask server when the setting is missing or blank", () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl("")).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl("   ")).toBe(DEFAULT_API_URL);
  });

  it("trims whitespace and trailing slashes from the configured URL", () => {
    expect(resolveApiUrl(" https://user-safestride.hf.space/ ")).toBe(
      "https://user-safestride.hf.space",
    );
    expect(resolveApiUrl("https://api.example.com//")).toBe("https://api.example.com");
  });
});

describe("apiUrl", () => {
  it("joins the base and the path with exactly one slash", () => {
    expect(apiUrl("/safe_path", "https://api.example.com")).toBe(
      "https://api.example.com/safe_path",
    );
    expect(apiUrl("heatmap_data", "https://api.example.com")).toBe(
      "https://api.example.com/heatmap_data",
    );
  });

  it("uses the resolved build setting when no base is given", () => {
    expect(apiUrl("/me")).toMatch(/\/me$/);
  });
});

describe("readToken", () => {
  it("returns the saved token or null", () => {
    expect(readToken({ getItem: () => "abc" })).toBe("abc");
    expect(readToken({ getItem: () => null })).toBeNull();
    expect(readToken({ getItem: () => "" })).toBeNull();
  });

  it("returns null when storage is blocked", () => {
    expect(readToken({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
  });
});

describe("jsonHeaders", () => {
  it("adds the bearer token only when signed in", () => {
    expect(jsonHeaders("abc")).toEqual({ "Content-Type": "application/json", Authorization: "Bearer abc" });
    expect(jsonHeaders(null)).toEqual({ "Content-Type": "application/json" });
  });
});
