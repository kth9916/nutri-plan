import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// 경로 설정 및 상수
// =============================================================================
const PROJECT_ROOT = import.meta.dirname;
const CLIENT_ROOT = path.resolve(PROJECT_ROOT, "client");
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

// =============================================================================
// Manus Debug Collector - Helper Functions
// =============================================================================
type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
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

// =============================================================================
// Vite Plugins
// =============================================================================
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
// Main Config
// =============================================================================
export default defineConfig({
  // 1. Root 설정: Vite의 작업 기준 디렉토리를 client로 명시
  root: CLIENT_ROOT,

  // 2. Public 디렉토리: root가 client이므로 그 안의 public을 명시
  publicDir: path.resolve(CLIENT_ROOT, "public"),

  // 3. Env 위치: .env 파일은 프로젝트 루트에 있으므로 한 단계 위를 가리킴
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
      // 4. 별칭 설정: @가 client/src를 정확히 가리키도록 절대 경로 지정
      "@": path.resolve(CLIENT_ROOT, "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
      "@assets": path.resolve(PROJECT_ROOT, "attached_assets"),
    },
  },

  build: {
    // 5. 빌드 결과물: 프로젝트 루트의 dist/public에 생성
    outDir: path.resolve(PROJECT_ROOT, "dist", "public"),
    emptyOutDir: true,
    minify: "terser",
    sourcemap: process.env.NODE_ENV !== "production",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 6. 청크 최적화 (기존 설정 유지)
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

  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      // 프로젝트 루트나 shared 폴더에 접근 가능하도록 허용 범위 설정 필요 시 추가
      allow: [PROJECT_ROOT],
    },
  },
});
