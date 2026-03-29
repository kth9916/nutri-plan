# NutriPlan - 배포 준비 완료 체크리스트

## ✅ 완성된 기능

### 핵심 기능
- [x] 스칸디나비안 미니멀 디자인 시스템
- [x] 랜딩 페이지 및 가격 정책 페이지
- [x] 엑셀 파일 업로드 UI
- [x] AI 분석 로딩 화면
- [x] 월간 식단 달력 렌더링
- [x] 일자별 식단 카드 인터랙션 (승인/새로고침)
- [x] 최종 확정 로직
- [x] 엑셀 Export 기능

### 결제 시스템
- [x] 포트원 V1 SDK 결제 훅
- [x] 포트원 API 검증 로직
- [x] Free/Pro 플랜 구분

### AI 통합
- [x] Gemini API 연동
- [x] 모델 폴백 로직 (gemini-3-flash → gemini-2.5-flash)
- [x] 5개 후보 메뉴 생성
- [x] 구조화된 JSON 출력

### 데이터베이스
- [x] Supabase PostgreSQL 스키마 (RLS 정책 포함)
- [x] Supabase 클라이언트 설정
- [x] 데이터 서비스 모듈 (supabaseServices.ts)

### DevOps & 배포
- [x] GitHub Actions CI 파이프라인 (캐싱 최적화)
- [x] Vercel 배포 설정
- [x] 보안 헤더 설정
- [x] 프로덕션 최적화 (terser, 청크 분리)
- [x] 환경 변수 가이드

### 코드 품질
- [x] TypeScript 타입 정의
- [x] 모듈화된 아키텍처
- [x] 상세한 주석 (설계 결정, 유지보수 가이드)
- [x] Vitest 테스트 (9개 통과)

---

## 📋 배포 전 체크리스트

### 로컬 개발 환경
- [ ] `.env.local` 파일에 모든 환경 변수 설정
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_PORTONE_STORE_ID=
  PORTONE_API_KEY=
  PORTONE_API_SECRET=
  GEMINI_API_KEY=
  ```

- [ ] 로컬 개발 서버 정상 작동 확인
  ```bash
  pnpm dev
  ```

- [ ] TypeScript 컴파일 오류 확인
  ```bash
  pnpm check
  ```

- [ ] 테스트 실행
  ```bash
  pnpm test
  ```

### Supabase 설정
- [ ] Supabase 프로젝트 생성
- [ ] SQL 스크립트 실행 (SUPABASE_SCHEMA.sql)
  - [ ] 테이블 생성 확인
  - [ ] RLS 정책 활성화 확인
  - [ ] 인덱스 생성 확인

- [ ] Supabase Auth 설정
  - [ ] 이메일 인증 활성화
  - [ ] 구글 소셜 로그인 설정 (선택사항)

- [ ] Supabase URL과 Anon Key 복사

### 포트원 설정
- [ ] 포트원 가맹점 계정 생성
- [ ] 테스트 API 키 발급
- [ ] 가맹점 ID, API Key, API Secret 복사

### Gemini API 설정
- [ ] Google Cloud 프로젝트 생성
- [ ] Gemini API 활성화
- [ ] API 키 생성 및 복사

### GitHub 설정
- [ ] GitHub 저장소에 코드 Push
  ```bash
  git add .
  git commit -m "Supabase 마이그레이션 및 배포 준비"
  git push origin main
  ```

### Vercel 배포
- [ ] Vercel 계정 생성
- [ ] GitHub 저장소 연동
- [ ] 환경 변수 추가 (DEPLOYMENT_ENV.md 참고)
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] NEXT_PUBLIC_PORTONE_STORE_ID
  - [ ] PORTONE_API_KEY
  - [ ] PORTONE_API_SECRET
  - [ ] GEMINI_API_KEY

- [ ] 배포 실행
- [ ] 배포 로그 확인
- [ ] 배포된 사이트 접속 테스트

### 배포 후 검증
- [ ] 홈페이지 로드 확인
- [ ] 로그인/로그아웃 테스트
- [ ] 엑셀 업로드 테스트
- [ ] 식단 생성 테스트
- [ ] 결제 테스트 (포트원 테스트 모드)
- [ ] 알림 기능 테스트

---

## 🚀 배포 명령어

### 로컬에서 프로덕션 빌드 테스트
```bash
pnpm build
pnpm start
```

### GitHub에 Push
```bash
git add .
git commit -m "배포 준비 완료"
git push origin main
```

### Vercel 자동 배포
- GitHub main 브랜치에 Push하면 Vercel이 자동으로 배포합니다.

---

## 📞 트러블슈팅

### TypeScript 컴파일 오류
```bash
pnpm check
```
오류가 있으면 수정 후 다시 시도

### 빌드 실패
```bash
pnpm clean  # 캐시 삭제
pnpm install  # 의존성 재설치
pnpm build  # 다시 빌드
```

### 환경 변수 오류
- Vercel 대시보드에서 환경 변수 재확인
- 배포 재시도

---

## 📝 주의사항

⚠️ **보안**
- 절대 `.env.local` 파일을 GitHub에 커밋하지 마세요
- 모든 API 키는 Vercel의 Sensitive 옵션으로 표시하세요
- 정기적으로 API 키를 로테이션하세요

⚠️ **성능**
- 프로덕션 환경에서 console.log 제거됨 (terser 설정)
- 번들 크기 최적화됨 (청크 분리)
- 정적 자산은 CDN에 저장됨

⚠️ **모니터링**
- Vercel 대시보드에서 배포 로그 확인
- 에러 발생 시 Supabase 대시보드에서 데이터 확인
- 포트원 대시보드에서 결제 내역 확인

---

## ✨ 축하합니다!

모든 준비가 완료되었습니다. 이제 배포할 준비가 되었습니다! 🎉
