import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    // Full-session controller tests drive many async bot turns; give them room under
    // parallel load (they finish in ~1-3s in isolation).
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/ai/**"],
      reporter: ["text", "html"],
    },
  },
});
