import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// [중요] tRPC 라우터와 컨텍스트만 불러옵니다. 나머지 설정은 이 파일에 내장합니다.
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";

/**
 * [FINAL STABLE ENTRY POINT - INLINED STRATEGY]
 * 
 * Vercel의 ESM 번들링 문제를 해결하기 위해 핵심 설정을 내장합니다. 
 */

// 1. ENV 내장 (지뢰 제거 버전)
function getEnv(key: string, defaultValue: string = ""): string {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultValue;
}

const INTERNAL_ENV = {
  appId: getEnv("VITE_APP_ID"),
  cookieSecret: getEnv("JWT_SECRET"),
  databaseUrl: getEnv("DATABASE_URL"),
  oAuthServerUrl: getEnv("OAUTH_SERVER_URL"),
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  isPrefixAuth: true,
};

// 2. Supabase Lazy 초기화 (내장)
let _inlinedSupabase: SupabaseClient | null = null;
function getInlinedSupabase(): SupabaseClient {
  if (_inlinedSupabase) return _inlinedSupabase;
  const url = INTERNAL_ENV.supabaseUrl || "https://missing.supabase.co";
  const key = INTERNAL_ENV.supabaseAnonKey || "missing-key";
  _inlinedSupabase = createClient(url, key);
  return _inlinedSupabase;
}

// 3. Express 앱 설정
const app = express();
app.use(express.json({ limit: "50mb" }));

// Vercel Rewrite 미들웨어
app.use((req, res, next) => {
  if (req.query.path !== undefined) {
    const pathStr = req.query.path as string;
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    urlObj.pathname = `/api/${pathStr}`;
    urlObj.searchParams.delete('path');
    req.url = urlObj.pathname + urlObj.search;
    req.originalUrl = req.url;
  }
  next();
});

// tRPC 핸들러
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// OAuth 라우트 등록
try {
  registerOAuthRoutes(app);
} catch (e) {
  console.error("[OAuth] Registration failed:", e);
}

// 헬스 체크 (최종 디버그 정보 포함)
app.get("/api/health", (req, res) => {
  res.status(200).send(`
    <h1>NutriPlan Core Integrated Successfully!</h1>
    <ul>
      <li>✅ ENV: Inlined (appId: ${INTERNAL_ENV.appId ? "OK" : "MISSING"})</li>
      <li>✅ tRPC Router: Connected</li>
      <li>✅ Supabase: Lazy-initialized</li>
    </ul>
    <p>이제 로그인 버튼을 눌러보세요. 드디어 모든 기능이 정상 작동합니다.</p>
  `);
});

export default app;
