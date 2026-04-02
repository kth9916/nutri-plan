import express from "express";
import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

/**
 * [자가 진단 5.1단계: tRPC 라이브러리 생존 테스트]
 * 
 * tRPC의 핵심 라이브러리 자체가 Vercel 환경에서 로딩되는지 확인합니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  try {
    const t = initTRPC.create();
    res.status(200).send("tRPC 라이브러리 로드 성공! (initTRPC.create() 호출 가능함)");
  } catch (e: any) {
    res.status(500).send(`tRPC 실행 오류: ${e.message}`);
  }
});

export default app;
