# NutriPlan - Project TODO

## Phase 1: DB 스키마 및 환경 설정
- [x] todo.md 작성
- [x] DB 스키마 설계 (users, meal_plans, meal_days, uploaded_files, subscriptions, notifications)
- [x] Drizzle 마이그레이션 생성 및 적용
- [x] .env.example 환경 변수 명세 (VITE_TOSS_CLIENT_KEY, TOSS_SECRET_KEY 포함)

## Phase 2: 글로벌 디자인 시스템
- [x] 스칸디나비안 스타일 CSS 변수 설정 (쿨 그레이, 파스텔 블루, 블러시 핑크)
- [x] 글로벌 폰트 설정 (Inter + 타이포그래피 계층)
- [x] 공통 레이아웃 컴포넌트 구성

## Phase 3: 랜딩 페이지 및 가격 정책 페이지
- [x] 랜딩 페이지 (히어로, 기능 소개, How It Works, CTA, Footer)
- [x] Pricing 페이지 (Free/Pro 플랜 카드 + 토스페이먼츠 CTA)
- [x] 네비게이션 헤더 컴포넌트

## Phase 4: 인증 시스템
- [x] Manus OAuth 기반 로그인 (이메일 + 구글 소셜)
- [x] 인증 상태 관리 및 보호된 라우트 (useAuth 훅)
- [x] 미인증 사용자 리다이렉트 처리

## Phase 5: 대시보드 및 엑셀 업로드
- [x] 대시보드 레이아웃 (사이드바 네비게이션 - NutriPlan 전용 메뉴)
- [x] 대시보드 홈 (통계 카드, 최근 플랜, 빠른 실행, 알림)
- [x] 엑셀 파일 업로드 UI (드래그앤드롭 + 클릭, 진행률 표시)
- [x] 파일 업로드 API 및 S3 저장
- [x] 업로드된 파일 목록 관리 페이지

## Phase 6: AI 분석 및 달력 렌더링
- [x] LLM 기반 월간 식단 자동 생성 API (JSON Schema 구조화 응답)
- [x] 식단 플랜 목록 페이지
- [x] 식단 플랜 상세 페이지 (그리드 레이아웃)
- [x] 식단 데이터 DB 저장 및 조회

## Phase 7: 식단 카드 인터랙션
- [x] 일자별 식단 카드 컴포넌트 (아침/점심/저녁/간식 + 영양 정보)
- [x] 승인 버튼 기능 (낙관적 업데이트 + 서버 동기화)
- [x] 새로고침(교체) 버튼 기능 (AI 재생성)
- [x] 승인 진행률 표시 (프로그레스 바)
- [x] 모든 일자 승인 시 최종 확정 버튼 활성화
- [x] 최종 확정 시 DB 저장 및 알림 발송

## Phase 8: 엑셀 Export 및 파일 관리
- [x] exceljs 기반 엑셀 Export API (식단표 + 영양 요약 시트)
- [x] 깔끔한 테이블 스타일 엑셀 포맷 (헤더 색상, 컬럼 너비)
- [x] 클라우드 파일 관리 페이지 (S3 저장 이력, 다운로드)
- [x] 인앱 알림 시스템 (알림 목록, 읽음 처리)
- [x] 알림 페이지 (전체 읽음 처리)

## Phase 9: 결제 연동
- [x] 토스페이먼츠 SDK 설치 (@tosspayments/tosspayments-sdk)
- [x] 결제 주문 생성 API (orderId 서버 생성)
- [x] 결제 확인 API (서버에서 상태 업데이트)
- [x] 구독 관리 페이지 (Free/Pro 플랜 비교 + 결제 버튼)
- [x] Pro 기능 접근 제어 (엑셀 다운로드 Pro 전용)
- [x] Mock 결제 처리 (토스 키 없는 환경 대응)

## Phase 10: 완성도 향상 및 테스트
- [x] 반응형 디자인 (모바일 대응)
- [x] 로딩/에러/빈 상태 UI 처리
- [x] Vitest 테스트 작성 (9개 테스트 통과)
- [x] TypeScript 타입 오류 0개
- [x] 최종 체크포인트 저장


## Phase 11: 포트원 결제 시스템 및 Gemini AI 고도화

### 1단계: 환경 변수 설정
- [x] 포트원 API 키 설정 (NEXT_PUBLIC_PORTONE_STORE_ID, PORTONE_API_KEY, PORTONE_API_SECRET)
- [x] Gemini API 키 설정 (GEMINI_API_KEY)
- [x] 환경 변수 검증 테스트

### 2단계: 포트원 V1 결제 모듈 교체
- [x] 포트원 V1 SDK 패키지 설치 (@portone/browser-sdk)
- [x] 프론트엔드 결제 훅 구현 (usePortonePayment)
- [x] 백엔드 결제 검증 API 구현 (포트원 REST API 호출)
- [x] 결제 성공 시 DB 유저 상태 업데이트 (Pro 플랜)
- [x] 기존 토스페이먼치 코드 제거

### 3단계: Gemini API 연동 및 모델 폴백
- [x] @google/generative-ai 패키지 설치
- [x] AiDietService 모듈 생성 (Gemini API 호출)
- [x] 모델 폴백 로직 구현 (gemini-3-flash → gemini-2.5-flash)
- [x] 구조화된 JSON 출력 (Structured Output) 강제
- [x] 에러 핸들링 및 재시도 로직

### 4단계: 5개 후보 메뉴 생성 및 상태 관리
- [x] AI 프롬프트 수정 (각 일자별 5개 후보 메뉴 생성)
- [x] 백엔드 meal_days 스키마 확장 (candidates 배열 저장)
- [ ] 프론트엔드 상태 관리 (selectedCandidateIndex)
- [ ] 새로고침 버튼 로직 변경 (AI 호출 → 로컬 상태 변경)

### 5단계: 요금제 제한 로직
- [x] Free 플랜 월 1회 생성 제한
- [x] Pro 플랜 월 10회 생성 제한
- [x] 생성 횟수 추적 테이블 생성 (meal_plan_usage)
- [x] 백엔드 검증 로직 구현

### 6단계: 서비스 모듈 분리
- [x] PaymentService 모듈 생성 (포트원 결제 로직)
- [x] AiDietService 모듈 생성 (Gemini API 호출)
- [ ] 라우터에서 서비스 모듈 호출로 리팩토링
- [ ] 상세 주석 작성 (설계 결정, 유지보수 가이드)

### 7단계: 통합 테스트 및 검증
- [ ] 포트원 결제 플로우 테스트
- [ ] Gemini API 모델 폴백 테스트
- [ ] 5개 후보 메뉴 상태 관리 테스트
- [ ] 요금제 제한 로직 테스트
- [x] 최종 체크포인트 저장


## Phase 12: CI/CD 파이프라인 및 배포 자동화

- [x] GitHub Actions CI 파이프라인 작성 (.github/workflows/ci.yml)
- [x] 캐싱 최적화 (pnpm, node_modules, .next)
- [x] 환경 변수 GitHub Secrets 연동
- [x] Vercel 배포 설정 (vercel.json)
- [x] vite.config.ts 최적화 (보안 헤더, 캐싱 정책, console.log 제거)
- [x] 디버깅 코드 제거 로직 (terser drop_console)
- [x] README.md 포괄적 문서화
- [x] 최종 검증 및 체크포인트 저장


## Phase 13: Supabase 마이그레이션 및 타입 안정성 강화

### 1단계: Supabase 인증 + PostgreSQL 마이그레이션
- [ ] Supabase 클라이언트 설정 (@supabase/supabase-js)
- [ ] PostgreSQL 스키마 재정의 (users, meal_plans, meal_days 등)
- [ ] Supabase Auth 통합 (이메일 + 구글 소셜 로그인)
- [ ] RLS(Row Level Security) 정책 설정
- [ ] Manus OAuth 및 MySQL 완전 제거
- [ ] 기존 데이터 마이그레이션 스크립트 (필요시)

### 2단계: 타입 안정성 강화
- [ ] routers.ts 타입 오류 해결 (응답 타입 정의)
- [ ] MealPlanDetail.tsx 타입 오류 해결 (Props 타입 정의)
- [ ] Subscription.tsx 포트원 결제 타입 정정
- [ ] Upload.tsx 파일 업로드 타입 정정
- [ ] 공통 타입 인터페이스 정의 (types/index.ts)
- [ ] TypeScript 엄격 모드 검증 (pnpm check 0 오류)

### 3단계: 환경 변수 최종 정리
- [ ] Supabase 환경 변수 (URL, Anon Key, Service Role Key)
- [ ] 포트원 환경 변수 (Store ID, API Key, Secret)
- [ ] Gemini API 환경 변수
- [ ] 최종 환경 변수 목록 문서화
- [ ] Vercel 대시보드 복사용 환경 변수 정리

### 4단계: 최종 검증 및 배포 준비
- [ ] 빌드 테스트 (pnpm build)
- [ ] 타입 검사 (pnpm check)
- [ ] 테스트 실행 (pnpm test)
- [ ] 최종 체크포인트 저장
- [ ] GitHub 푸시 및 Vercel 자동 배포 확인
