import express from "express";

/**
 * [자가 진단 2단계: 정밀 격리 테스트]
 * 
 * 어떤 파일이 서버를 죽이는지 하나씩 체크합니다.
 * 브라우저에서 /api/health 주소로 접속하면 결과를 볼 수 있습니다.
 */

const app = express();

app.get("/api/health", async (req, res) => {
  let report = "<h1>서버 정밀 진단 결과</h1><ul>";
  
  const checkModule = async (name: string, path: string) => {
    try {
      // Vercel ESM 환경에서는 상대 경로와 확장자(.js)를 명시적으로 쓰는 것이 안전합니다.
      await import(path);
      report += `<li style="color: green;">✅ ${name}: 로드 성공</li>`;
      return true;
    } catch (e: any) {
      report += `<li style="color: red;">❌ ${name}: 로드 실패<br/>
                 <small>에러: ${e.message}</small></li>`;
      return false;
    }
  };

  // 1. 순차적으로 의심되는 모듈들을 로드해 봅니다.
  await checkModule("1. 환경 변수 (env)", "../server/_core/env.js");
  await checkModule("2. Supabase 클라이언트 (lib/supabase)", "../../lib/supabase.js");
  await checkModule("3. SDK 서버 (sdk)", "../server/_core/sdk.js");
  await checkModule("4. 데이터베이스 (db)", "../server/db.js");
  await checkModule("5. 전체 라우터 (routers)", "../server/routers.js");

  report += "</ul><hr/><p>만약 모든 항목이 ✅라면, 문제는 초기화가 아닌 런타임 로직에 있습니다.</p>";
  res.status(200).send(report);
});

// tRPC는 아직 비활성화 (원인 파악 후 활성화)
app.all("/api/trpc/:path", (req, res) => {
  res.status(200).json({ message: "/api/health를 확인해주세요." });
});

export default app;
