import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    start: "src/start.ts"
  },
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: false,
  clean: true,
  hash: false,
  fixedExtension: false,
  inputOptions: {
    // "use client" is kept on the client entry; rolldown warns about it all the same.
    onLog: (level, log, handler) => log.code === "MODULE_LEVEL_DIRECTIVE" || handler(level, log)
  }
})
