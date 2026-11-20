import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, getApps } from "firebase/app";

// The config module reads localStorage at import time, so each test gets a
// small in-memory stand-in and a fresh copy of the module.
const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
};

const loadConfig = () => import("./config");

const sampleEnv = {
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "safestride-test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "safestride-test",
  VITE_FIREBASE_STORAGE_BUCKET: "safestride-test.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:abcdef",
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", memoryStorage());
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  // The firebase package keeps its app registry across module resets.
  await Promise.all(getApps().map((app) => deleteApp(app)));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("firebase config", () => {
  it("creates auth, firestore and storage from the VITE_FIREBASE_ settings", async () => {
    for (const [key, value] of Object.entries(sampleEnv)) vi.stubEnv(key, value);

    const config = await loadConfig();

    expect(config.isFirebaseConfigured).toBe(true);
    expect(config.default.options.projectId).toBe("safestride-test");
    expect(config.auth?.app).toBe(config.default);
    expect(config.db?.app).toBe(config.default);
    expect(config.storage?.app).toBe(config.default);
  });

  it("leaves the services empty and warns when no project is configured", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");

    const config = await loadConfig();

    expect(config.isFirebaseConfigured).toBe(false);
    expect(config.auth).toBeNull();
    expect(config.db).toBeNull();
    expect(config.storage).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Firebase is not configured"));
  });

  it("prefers a config saved from the setup page over the build time values", async () => {
    for (const [key, value] of Object.entries(sampleEnv)) vi.stubEnv(key, value);
    localStorage.setItem(
      "firebase_config",
      JSON.stringify({
        apiKey: "saved-key",
        authDomain: "saved-project.firebaseapp.com",
        projectId: "saved-project",
        storageBucket: "saved-project.appspot.com",
        messagingSenderId: "987654321",
        appId: "1:987654321:web:fedcba",
      }),
    );

    const config = await loadConfig();

    expect(config.default.options.projectId).toBe("saved-project");
    expect(config.configManager.getConfig().apiKey).toBe("saved-key");
  });
});
