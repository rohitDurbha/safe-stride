import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";

import { LEAFLET_MAX_Z, TOAST_Z } from "@/lib/layers";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/sonner";

// Sonner renders nothing until a toast exists, so swap in a stand-in that
// draws its container with the style it was given.
vi.mock("sonner", () => ({
  Toaster: ({ style }: { style?: CSSProperties }) => <ol data-sonner-toaster style={style} />,
  toast: () => undefined,
}));

const require = createRequire(import.meta.url);

function highestLeafletZIndex(): number {
  const css = readFileSync(require.resolve("leaflet/dist/leaflet.css"), "utf8");
  const values = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]));
  return Math.max(...values);
}

function renderedZIndex(html: string): number {
  const match = html.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error(`no z-index in ${html}`);
  return Number(match[1]);
}

describe("toast layer", () => {
  it("sits above every Leaflet pane and control", () => {
    const leafletMax = highestLeafletZIndex();
    expect(leafletMax).toBeLessThanOrEqual(LEAFLET_MAX_Z);
    expect(TOAST_Z).toBeGreaterThan(LEAFLET_MAX_Z);
  });

  it("is applied to the Radix toast viewport", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>,
    );
    expect(renderedZIndex(html)).toBe(TOAST_Z);
    expect(html).not.toContain("z-[100]");
  });

  it("is applied to the sonner toaster", () => {
    const html = renderToStaticMarkup(<Toaster />);
    expect(renderedZIndex(html)).toBe(TOAST_Z);
  });
});
