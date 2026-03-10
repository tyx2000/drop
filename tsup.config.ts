import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: process.env.BUILD_DTS !== "false",
  sourcemap: true,
  clean: process.env.BUILD_CLEAN !== "false",
  minify: process.env.BUILD_MINIFY === "true",
  outDir: process.env.BUILD_OUT_DIR || "dist",
  external: ["react"]
});
