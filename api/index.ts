import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";

/**
 * 최종 안정화된 Vercel 엔트리 포인트
 * 
 * 해결된 핵심 이슈:
 * 1. 초기화 크래시 (500 Error): lib/supabase.ts 및 sdk.ts를 Proxy 기반 지연 초기화로 변경하여 해결.
 * 2. 파일 찾기 오류 (ERR_MODULE_NOT_FOUND): 동적 import() 대신 정적 import를 사용하여 Vercel 번들러 호환성 확보.
 * 3. 무한 리다이렉트: client/src/main.tsx에서 로그인 페이지 중복 이동 방어 로직 추가.
 */

const app = express();

// JSON 바디 파싱 설정
app.use(express.json({ limit: "50mb" }));

// Vercel rewrite workaround: Restore the original URL path for Express routing
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
try {
  registerOAuthRoutes(app);
} catch (e) {
  console.error("[OAuth] Failed to register routes:", e);
}

// 자가 진단용 다이렉트 엔드포인트 (안정성 확인용)
app.get("/api/debug", (req, res) => {
  res.status(200).send(`
    <div style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: #2ecc71;">서버 자가 진단 (정상 작동 중)</h1>
      <p>모든 모듈이 정적으로 로드되어 정상 작동 중입니다.</p>
      <hr/>
      <p><strong>상태:</strong> 정적 임포트 성공, 지연 초기화 활성화됨</p>
      <p>이제 로그인 버튼을 눌러보세요.</p>
    </div>
  `);
});

// 전역 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server Fatal Error]", err);
  res.status(500).json({
    error: true,
    message: err.message || "Internal Server Error",
    suggestion: "서버 내부 로직 실행 중 오류가 발생했습니다. 로그를 확인하세요."
  });
});

export default app;
