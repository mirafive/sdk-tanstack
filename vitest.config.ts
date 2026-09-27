import { defineConfig } from "vitest/config"

export default defineConfig({
  // The file: packages carry their own node_modules until they are published; one React for all.
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom"
  }
})
