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
