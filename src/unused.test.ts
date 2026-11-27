import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guards against the shadcn starter bloat coming back. Every UI component has
// to be imported by the app, and every runtime package has to be imported by
// the app or a config file, so an unused one fails `npm test`.

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const CONFIG_FILES = ["tailwind.config.ts", "vite.config.ts", "postcss.config.js", "index.html"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

const appFiles = sourceFiles(SRC).filter((path) => !/\.test\.tsx?$/.test(path));
const read = (path: string) => readFileSync(path, "utf8");

function importsFrom(text: string): string[] {
  const pattern = /(?:from\s*|import\s*\(?\s*|@import\s+)["']([^"']+)["']/g;
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function packageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("node:")) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

describe("unused code", () => {
  it("imports every UI component somewhere in the app", () => {
    const uiDir = join(SRC, "components", "ui");
    const components = readdirSync(uiDir)
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((name) => name.replace(/\.tsx?$/, ""));
    const imported = new Set(
      appFiles.flatMap((path) =>
        importsFrom(read(path))
          .filter((spec) => spec.startsWith("@/components/ui/") || spec.startsWith("./"))
          .map((spec) => spec.split("/").pop() as string),
      ),
    );
    const unused = components.filter((name) => !imported.has(name));
    expect(unused, "delete these components or use them").toEqual([]);
  });

  it("uses every runtime dependency", () => {
    const pkg = JSON.parse(read(join(ROOT, "package.json")));
    const texts = [...appFiles, ...CONFIG_FILES.map((name) => join(ROOT, name))].map(read);
    const used = new Set(texts.flatMap((text) => importsFrom(text).map(packageName)));
    const unused = Object.keys(pkg.dependencies).filter((name) => !used.has(name));
    expect(unused, "remove these packages from package.json").toEqual([]);
  });

  it("finds the app's own imports", () => {
    // A sanity check, so a broken pattern cannot make both tests pass vacuously.
    const app = importsFrom(read(join(SRC, "App.tsx")));
    expect(app).toContain("react-router");
    expect(relative(ROOT, SRC)).toBe("src");
  });
});
