import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

/**
 * [FINAL STABILIZED ENTRY POINT]
 * 
 * 1. .js 확장자를 사용하여 ESM 번들링 호환성 확보
 * 2. 모든 내부 서비스(sdk, supabase, db)는 지연 초기화(Lazy) 방식으로 보호됨
 * 3. 최상단 에러 트랩을 통해 크래시 원인을 직접 노출
 */

// 지뢰가 제거된 안전한 모듈들을 불러옵니다.
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Vercel Rewrite 지원
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

// OAuth 라우트
try {
  registerOAuthRoutes(app);
} catch (e) {
  console.error("[OAuth] Registration failed:", e);
}

// 헬스 체크
app.get("/api/health", (req, res) => {
  res.status(200).send("NutriPlan Server is Fully Stabilized! 모든 지뢰가 제거되었습니다.");
});

// 전역 에러 핸들러 (최상단)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Fatal Error]", err);
  res.status(500).send(`<h1>서버 내부 오류</h1><pre>${err.stack || err.message}</pre>`);
});

export default app;
