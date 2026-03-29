import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

const PROJECT_ROOT = import.meta.dirname;
const CLIENT_ROOT = path.resolve(PROJECT_ROOT, "client");

// =============================================================================
// Manus Debug Collector (기존 기능 유지)
// =============================================================================
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) return;
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > TRIM_TARGET_BYTES) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map(
    entry => `[${new Date().toISOString()}] ${JSON.stringify(entry)}`
  );
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") return html;
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { src: "/__manus__/debug-collector.js", defer: true },
            injectTo: "head",
          },
        ],
      };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") return next();
        const handlePayload = (payload: any) => {
          if (payload.consoleLogs?.length > 0)
            writeToLogFile("browserConsole", payload.consoleLogs);
          if (payload.networkRequests?.length > 0)
            writeToLogFile("networkRequests", payload.networkRequests);
          if (payload.sessionEvents?.length > 0)
            writeToLogFile("sessionReplay", payload.sessionEvents);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            handlePayload(JSON.parse(body));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// =============================================================================
// Vite Main Configuration
// =============================================================================
export default defineConfig({
  root: CLIENT_ROOT,
  publicDir: path.resolve(CLIENT_ROOT, "public"),
  envDir: PROJECT_ROOT,

  plugins: [
    react(),
    tailwindcss(),
    jsxLocPlugin(),
    vitePluginManusRuntime(),
    vitePluginManusDebugCollector(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(CLIENT_ROOT, "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
      "@assets": path.resolve(PROJECT_ROOT, "attached_assets"),
    },
    // 빌드 시 확장자를 생략해도 정확히 찾을 수 있도록 명시
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },

  build: {
    outDir: path.resolve(PROJECT_ROOT, "dist", "public"),
    emptyOutDir: true,
    minify: "terser",
    // Vercel 빌드 시 메모리 부족 방지를 위해 프로덕션 소스맵 비활성화
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-hook-form"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "lucide-react",
          ],
          trpc: ["@trpc/client", "@trpc/react-query"],
          utils: ["zod", "date-fns", "clsx"],
        },
      },
    },
  },
});
