/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  test: { environment: "jsdom", environmentOptions: { jsdom: { url: "http://localhost:5173" } }, testTimeout: 30000, setupFiles: ["./src/test/setup.ts"], globals: true, css: false },
  build: { chunkSizeWarningLimit: 1200 },
});
