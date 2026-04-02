import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";

/**
 * 최종 안정화된 엔트리 포인트
 * 
 * 해결된 문제:
 * 1. (과거) 최상단 createClient 호출로 인한 서버 크래시 -> lib/supabase.ts의 Proxy 지연 초기화로 해결
 * 2. (방금) 동적 import()의 Vercel 파일 경로 인식 문제 -> 정적 import로 복구하여 번들러 호환성 로직 적용
 */

const app = express();

app.use(express.json({ limit: "50mb" }));

// Vercel rewrite workaround: Restore the original URL path
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

// tRPC API 핸들러
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// OAuth 콜백 핸들러
registerOAuthRoutes(app);

// 자가 진단용 다이렉트 엔드포인트
app.get("/api/debug", (req, res) => {
  res.status(200).send(`
    <h1>서버 자가 진단 (정상 작동 중)</h1>
    <p>모든 모듈이 정적으로 로드되어 정상 작동 중입니다.</p>
    <hr/>
    <p>이제 로그인과 대시보드 진입을 시도해 보세요.</p>
  `);
});

// 전역 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server Error]", err);
  res.status(500).json({
    error: true,
    message: err.message || "Internal Server Error",
  });
});

export default app;
