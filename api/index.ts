import express from "express";
// 정적 임포트 경로를 정확하게 수정합니다.
import { ENV } from "../server/_core/env";
import { supabase } from "../lib/supabase"; // ../../가 아니라 ../ 입니다.

/**
 * [자가 진단 3.1단계: 정적 임포트 경로 수정 테스트]
 * 
 * 1. env와 supabase를 올바른 경로로 불러옵니다.
 * 2. 만약 이 상태에서 /api/health가 잘 나온다면, 경로 문제가 500 에러의 주범이었습니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).send(`
    <h1>정적 임포트 테스트 (Stage 1.1) - 경로 수정 완료</h1>
    <ul>
      <li>✅ ENV: 정적 로드 성공 (appId: ${ENV.appId ? "설정됨" : "미설정"})</li>
      <li>✅ Supabase: 정적 로드 성공 (지연 초기화 활성)</li>
    </ul>
    <p>이 메시지가 보인다면 경로 오류가 해결된 것입니다. 이제 routers.ts를 안전하게 불러올 수 있습니다.</p>
  `);
});

export default app;
