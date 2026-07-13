import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    target: "es2022",
    // Keep source maps out of production deploys (less client-side source disclosure).
    sourcemap: false,
  },
  worker: {
    format: "es",
  },
});
