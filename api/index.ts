import express from "express";

/**
 * [자가 진단 1단계: Bare Minimum]
 * 
 * 모든 내부 모듈 로딩을 중단하고 오직 Express 기본 기능만 남깁니다.
 * 이 상태에서 배포 후 /api/health 주소가 작동하는지 확인합니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).send("Bare Minimum Server is Alive! 만약 이 메시지가 보인다면 프로젝트 설정(package.json 등)은 정상입니다.");
});

// 모든 API 요청에 대해 초기화 중임을 알림
app.all("/api/trpc/:path", (req, res) => {
  res.status(200).json({
    error: {
      message: "서버가 현재 자가 진단(격리 테스트) 중입니다. /api/health를 확인하세요.",
      code: -32603,
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 200 }
    }
  });
});

export default app;
