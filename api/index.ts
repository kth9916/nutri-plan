import express from "express";
// 정적 임포트를 하나씩 복구하며 Vercel 번들러에 파일을 포함시키고 크래시 여부를 확인합니다.
import { ENV } from "../server/_core/env";
import { supabase } from "../../lib/supabase";

/**
 * [자가 진단 3단계: 정적 임포트 격리 테스트]
 * 
 * 1. env와 supabase만 먼저 정적으로 불러옵니다.
 * 2. 만약 이 상태에서 /api/health가 잘 나온다면, 범인은 routers.ts 혹은 db.ts입니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).send(`
    <h1>정적 임포트 테스트 (Stage 1)</h1>
    <ul>
      <li>✅ ENV: 정적 로드 성공 (appId: ${ENV.appId ? "설정됨" : "미설정"})</li>
      <li>✅ Supabase: 정적 로드 성공 (Proxy 활성화됨)</li>
    </ul>
    <p>이 메시지가 보인다면 위 두 파일은 지뢰가 아닙니다. 다음은 routers.ts를 테스트할 차례입니다.</p>
  `);
});

export default app;
