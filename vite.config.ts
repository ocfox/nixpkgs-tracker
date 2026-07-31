import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    mode === "development" && devtools({ autoname: true }),
    solidPlugin(),
  ].filter(Boolean),
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
}));
