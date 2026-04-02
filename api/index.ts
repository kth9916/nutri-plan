import express from "express";
import { ENV } from "../server/_core/env";

/**
 * [자가 진단 5.2단계: ENV 모듈 생존 테스트]
 * 
 * 가장 기초가 되는 ENV 모듈 하나만 임포트했을 때 서버가 생존하는지 확인합니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).send(`ENV 모듈 로드 성공! (appId: ${ENV.appId ? "설정됨" : "미설정"})`);
});

export default app;
