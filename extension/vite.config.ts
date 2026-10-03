import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-extension-files",
      closeBundle() {
        // Copy manifest.json to dist
        copyFileSync(
          resolve(__dirname, "public/manifest.json"),
          resolve(__dirname, "dist/manifest.json")
        );

        // Copy icons if they exist
        const iconsDir = resolve(__dirname, "dist/icons");
        if (!existsSync(iconsDir)) {
          mkdirSync(iconsDir, { recursive: true });
        }
        const srcIcons = resolve(__dirname, "public/icons");
        if (existsSync(srcIcons)) {
          for (const size of ["icon-16.png", "icon-48.png", "icon-128.png"]) {
            const src = resolve(srcIcons, size);
            if (existsSync(src)) {
              copyFileSync(src, resolve(iconsDir, size));
            }
          }
        }

        // Copy APTV logo
        const logo = resolve(__dirname, "public/aptv_logo.png");
        if (existsSync(logo)) {
          copyFileSync(logo, resolve(__dirname, "dist/aptv_logo.png"));
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/overlay.ts"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
