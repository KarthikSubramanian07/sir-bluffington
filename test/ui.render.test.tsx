// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/ui/App.tsx";

// Signal to React that act() is supported in this environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
  localStorage.clear();
});

function findButton(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.toLowerCase().includes(text.toLowerCase()),
  );
  if (!btn) throw new Error(`Button "${text}" not found`);
  return btn as HTMLButtonElement;
}

describe("UI renders without crashing", () => {
  it("shows the landing page, then deals a table on Take your seat", async () => {
    await act(async () => {
      createRoot(container).render(<App />);
    });

    // Landing renders the wordmark and the SEO copy.
    expect(container.textContent).toContain("Sir Bluffington's");
    expect(container.textContent).toContain("poker trainer");
    expect(container.querySelector(".hero-title")).not.toBeNull();

    // Sitting down deals a hand and renders the felt without throwing.
    await act(async () => {
      findButton("take your seat").click();
    });
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelectorAll(".seat").length).toBe(6);
    // The hero always sees their own hole cards.
    expect(container.querySelector(".seat--hero .card")).not.toBeNull();
  });
});
