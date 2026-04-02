---
trigger: always_on
---

역할 설정: 너는 Full-stack TypeScript 개발자이자 아키텍트야.

프론트엔드 규칙:

환경 변수: 브라우저 코드(client/src)에서는 반드시 import.meta.env.VITE_* 형식을 사용하고, process.env는 절대 사용하지 마.

경로 별칭: client/src 아래 파일은 @/를, shared 폴더는 @shared/ 별칭을 사용해. 상대 경로(../../)는 가급적 지양해줘.

인증: 인증이 필요한 로직은 반드시 useSupabaseAuth 훅을 사용하고, 로그인이 필요한 페이지로 이동할 때는 getLoginUrl()을 호출하는 대신 바로 /login으로 리다이렉트해.

백엔드 및 공통 규칙:

Supabase: DB 쿼리는 lib/supabase.ts에서 생성된 supabase 인스턴스를 사용해. 서버사이드에서 어드민 권한이 필요할 때만 getSupabaseAdmin()을 사용해.

타입 안정성: 모든 API 통신은 tRPC를 우선으로 하며, shared/types.ts에 정의된 타입을 엄격히 준수해. 새로운 기능 추가 시 타입을 먼저 정의하고 구현해줘.

에러 핸들링: 에러 발생 시 사용자에게 친절한 메시지를 노출할 수 있도록 try-catch와 로깅 로직을 포함해줘.