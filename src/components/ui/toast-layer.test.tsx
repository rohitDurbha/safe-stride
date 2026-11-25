import { renderToStaticMarkup } from "react-dom/server";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";

import { OVERLAY_MAX_Z, TOAST_Z } from "@/lib/layers";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/sonner";

// Sonner renders nothing until a toast exists, so swap in a stand-in that
// draws its container with the style it was given.
vi.mock("sonner", () => ({
  Toaster: ({ style }: { style?: CSSProperties }) => <ol data-sonner-toaster style={style} />,
  toast: () => undefined,
}));

function renderedZIndex(html: string): number {
  const match = html.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error(`no z-index in ${html}`);
  return Number(match[1]);
}

describe("toast layer", () => {
  it("sits above the floating map panels", () => {
    expect(TOAST_Z).toBeGreaterThan(OVERLAY_MAX_Z);
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
