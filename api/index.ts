import express from "express";

/**
 * [자가 진단 6단계: 모듈 통합 테스트]
 * 
 * 외부 파일을 import 할 때 발생하는 알 수 없는 경로/번들링 오류를 피하기 위해, 
 * ENV 로직을 파일 내부에 직접 포함시켰습니다.
 */

function getEnv(key: string, defaultValue: string = ""): string {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultValue;
}

const INTERNAL_ENV = {
  appId: getEnv("VITE_APP_ID"),
  isProduction: (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production"),
};

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).send(`
    <h1>모듈 통합 테스트 성공!</h1>
    <p>외부 파일 임포트 없이 내부 로직만으로 서버가 생존했습니다.</p>
    <ul>
      <li>✅ App ID: ${INTERNAL_ENV.appId || "미설정 (하지만 서버는 살아있음)"}</li>
      <li>✅ 모드: ${INTERNAL_ENV.isProduction ? "Production" : "Development"}</li>
    </ul>
    <p>이 화면이 보인다면, 지금까지의 모든 문제는 <strong>'로컬 파일 임포트 경로와 Vercel 번들러 간의 충돌'</strong> 때문이었음이 확실해집니다.</p>
  `);
});

export default app;
