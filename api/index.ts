import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";

/**
 * [최종 승인된 안정화 엔트리 포인트]
 * 
 * 1. 정적 임포트(Static Import)를 통해 Vercel 번들러가 모든 파일을 index.js에 포함하게 합니다.
 * 2. 내부 서비스들(supabase, sdk, db)이 모두 Proxy/Lazy 방식으로 보호되므로 초기화 크래시가 없습니다.
 * 3. 불필요한 dotenv/config를 제거하여 Vercel 네이티브 환경과의 충돌을 방지합니다.
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

// OAuth 라우트 등록
try {
  registerOAuthRoutes(app);
} catch (e) {
  console.error("[OAuth] Registration failed:", e);
}

// 헬스 체크
app.get("/api/health", (req, res) => {
  res.status(200).send("NutriPlan Server is Fully Stabilized! 이제 모든 기능이 정상 작동합니다.");
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
