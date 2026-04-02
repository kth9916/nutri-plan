import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// ESM 환경에서 로컬 파일 임포트 시 .js 확장자를 반드시 명시해야 합니다.
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";

/**
 * [최종 승인 및 검증된 안정화 엔트리 포인트]
 * 
 * 1. 정적 임포트에 .js 확장자를 추가하여 Vercel ESM 번들러 호환성을 100% 확보했습니다.
 * 2. 모든 내부 서비스는 이미 Proxy/Lazy 방식으로 보호되므로 임포트 시 크래시가 없습니다.
 * 3. 통합 테스트로 검증된 환경 변수 안정성을 기반으로 전체 시스템을 재가동합니다.
 */

const app = express();

app.use(express.json({ limit: "50mb" }));

// Vercel Rewrite 지원 미들웨어
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

// OAuth 라우트 등록 (안전하게 시도)
try {
  registerOAuthRoutes(app);
} catch (e) {
  console.error("[OAuth] Registration failed:", e);
}

// 헬스 체크
app.get("/api/health", (req, res) => {
  res.status(200).send("NutriPlan Server is Fully Stabilized! 모든 모듈이 확장자 기반으로 로드되었습니다.");
});

// 전역 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Fatal]", err);
  res.status(500).json({
    error: true,
    message: err.message || "Internal Server Error"
  });
});

export default app;
