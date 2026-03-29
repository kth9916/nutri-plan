// vite.config.ts 전체를 이 내용으로 덮어쓰셔도 안전합니다.
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

const PROJECT_ROOT = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()],
  resolve: {
    alias: {
      // 핵심 수정: 절대 경로로 client/src를 정확히 찍어줍니다.
      "@": path.resolve(PROJECT_ROOT, "client", "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
      "@assets": path.resolve(PROJECT_ROOT, "attached_assets"),
    },
  },
  // root 설정을 통해 Vite가 어디서부터 index.html을 찾을지 정의합니다.
  root: path.resolve(PROJECT_ROOT, "client"),
  build: {
    // 빌드 결과물이 루트의 dist/public에 생기도록 설정
    outDir: path.resolve(PROJECT_ROOT, "dist", "public"),
    emptyOutDir: true,
  },
});
