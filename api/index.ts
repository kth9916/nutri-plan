import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";

/**
 * 긴급 자가 진단 엔트리 포인트
 * 
 * 왜 이 방식인가요?
 * 1. 현재 서버가 모듈 로드 시점에 조용히 크래시되어 500 에러("A server error...")만 뱉고 있습니다.
 * 2. 동적 임포트(import())를 사용하여 앱 라우터와 컨텍스트를 로드하면, 로드 중 발생하는 에러를 캐치해서
 *    브라우저에 JSON 형태로 어떤 파일의 몇 번째 줄에서 왜 죽었는지 직접 보여줄 수 있습니다.
 */

const app = express();

// tRPC 표준 에러 형식으로 응답하며, superjson으로 직렬화하여 클라이언트가 읽을 수 있게 합니다.
const sendFatalError = (res: express.Response, error: any, stage: string) => {
  console.error(`[Fatal Startup Error] @ ${stage}:`, error);
  const errorPayload = {
    error: {
      message: `[서버 초기화 에러] ${stage}: ${error instanceof Error ? error.message : String(error)}`,
      code: -32603, // INTERNAL_SERVER_ERROR
      data: {
        code: "INTERNAL_SERVER_ERROR",
        httpStatus: 500,
        stack: error instanceof Error ? error.stack : undefined,
        stage,
        suggestion: "이 로그가 보인다면 특정 파일의 import 단계에서 문법 오류나 환경 변수 누락이 발생한 것입니다."
      }
    }
  };

  // 클라이언트가 superjson을 사용하므로 서버도 결과를 superjson으로 감싸서 보내야 합니다.
  res.status(500).json(superjson.serialize(errorPayload));
};

app.use(express.json({ limit: "50mb" }));

// tRPC API 핸들러 (지연 로딩 방식)
app.all("/api/trpc/:path", async (req, res, next) => {
  try {
    // 1. 라우터와 컨텍스트를 이 시점에 동적으로 로드합니다.
    // 만약 routers.ts나 context.ts 내부에서 죽는다면 여기서 캐치됩니다.
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");

    // 2. 정상 로드 시 tRPC 미들웨어 실행
    return createExpressMiddleware({
      router: appRouter,
      createContext,
    })(req, res, next);
  } catch (error) {
    // 3. 서버가 시작되다 죽었을 때, 브라우저가 JSON을 받을 수 있게 가로챕니다.
    return sendFatalError(res, error, "Module Loading (Routers/Context)");
  }
});

// OAuth 콜백 핸들러 (지연 로딩 방식)
app.get("/api/oauth/callback", async (req, res) => {
  try {
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const tempApp = express();
    registerOAuthRoutes(tempApp);
    return (tempApp as any).handle(req, res);
  } catch (error) {
    return sendFatalError(res, error, "Module Loading (OAuth)");
  }
});

// 전역 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  sendFatalError(res, err, "Express Middleware Runtime");
});

export default app;
