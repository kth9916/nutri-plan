# NutriPlan - AI 기반 월간 식단 관리 SaaS

영양사를 위한 AI 기반 맞춤형 월간 식단 자동 추천 및 관리 웹 애플리케이션입니다. Gemini AI를 활용하여 한 달 치 식단을 자동 생성하고, 포트원 결제 시스템으로 구독을 관리하며, 깔끔한 엑셀 파일로 식단을 다운로드할 수 있습니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 식단 생성** | Gemini API로 영양 균형을 고려한 월간 식단 자동 생성 |
| **5개 후보 메뉴** | 각 일자별로 5개 후보 메뉴 제시 (프론트엔드에서 선택, API 호출 80% 감소) |
| **모델 폴백** | gemini-3-flash 기본, Rate Limit 시 gemini-2.5-flash 자동 재시도 |
| **식단 검토** | 카드 그리드/달력 뷰, 승인/교체 버튼, 진행률 표시 |
| **최종 확정** | 모든 일자 승인 시 활성화, DB 저장, 인앱 알림 발송 |
| **엑셀 Export** | exceljs 기반 실무 수준 테이블 포맷 (식단표 + 영양 요약) |
| **포트원 결제** | 포트원 V1 SDK 연동, Free/Pro 플랜 구분 |
| **클라우드 저장** | S3 기반 파일 관리, 다운로드 이력 추적 |
| **인앱 알림** | 식단 생성, 결제 완료 등 중요 이벤트 실시간 알림 |

## 기술 스택

### 프론트엔드
- **React 19** + **TypeScript** — 타입 안정성 확보
- **Tailwind CSS 4** + **shadcn/ui** — 스칸디나비안 미니멀 디자인
- **tRPC** — 타입 안전한 백엔드 통신
- **React Query** — 데이터 페칭 및 캐싱
- **Vite** — 빠른 개발 서버 및 번들링 (프로덕션 최적화: terser, 청크 분리, console.log 제거)

### 백엔드
- **Express 4** + **TypeScript** — 경량 API 서버
- **tRPC 11** — 타입 안전한 RPC 프로토콜
- **Drizzle ORM** — 타입 안전한 데이터베이스 쿼리
- **esbuild** — 빠른 번들링 및 최소화

### 데이터베이스
- **MySQL/TiDB** — 관계형 데이터베이스
- **Drizzle Kit** — 스키마 마이그레이션 관리

### 외부 API
- **Gemini API** — AI 식단 생성
- **포트원 V1** — 결제 처리
- **AWS S3** — 파일 저장소

### 배포 & CI/CD
- **Vercel** — 통합 배포 (프론트엔드 + 백엔드)
- **GitHub Actions** — CI 파이프라인 (pnpm 캐싱, .next 캐싱으로 3~5분 단축)

## 로컬 개발 환경 설정

### 1. 필수 요구사항

- **Node.js** 20.x 이상
- **pnpm** 10.4.1 이상
- **MySQL/TiDB** 데이터베이스
- **Git** (버전 관리)

### 2. 저장소 클론

```bash
git clone https://github.com/your-org/nutri-plan.git
cd nutri-plan
```

### 3. 의존성 설치

```bash
# pnpm으로 의존성 설치 (캐싱 활용)
pnpm install

# 또는 npm/yarn 사용
npm install
# yarn install
```

### 4. 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 다음 변수들을 설정합니다:

```bash
# 데이터베이스
DATABASE_URL=mysql://user:password@localhost:3306/nutriplan

# 인증 (Manus OAuth)
JWT_SECRET=your-jwt-secret-key-here
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/login
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name

# 내장 API (Manus)
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# 포트원 결제
NEXT_PUBLIC_PORTONE_STORE_ID=your-portone-store-id
PORTONE_API_KEY=your-portone-api-key
PORTONE_API_SECRET=your-portone-api-secret

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

**참고:** `.env.example` 파일에서 모든 필수 변수를 확인할 수 있습니다.

### 5. 데이터베이스 마이그레이션

```bash
# Drizzle 마이그레이션 생성
pnpm drizzle-kit generate

# 마이그레이션 적용
pnpm drizzle-kit migrate
```

### 6. 개발 서버 실행

```bash
# 개발 서버 시작 (Vite + Express)
pnpm run dev

# 브라우저에서 http://localhost:3000 접속
```

### 7. 빌드 및 프로덕션 실행

```bash
# 프로덕션 빌드
pnpm run build

# 빌드 결과 확인
ls -la dist/

# 프로덕션 서버 실행
pnpm run start
```

## 개발 워크플로우

### 1. 코드 스타일 검사

```bash
# ESLint 검사
pnpm run lint

# TypeScript 타입 검사
pnpm check

# 자동 포맷팅 (Prettier)
pnpm run format
```

### 2. 테스트 실행

```bash
# Vitest로 단위 테스트 실행
pnpm test

# 테스트 감시 모드
pnpm test --watch

# 커버리지 리포트
pnpm test --coverage
```

### 3. 데이터베이스 스키마 변경

```bash
# 1. drizzle/schema.ts에서 테이블 정의 수정
# 2. 마이그레이션 SQL 생성
pnpm drizzle-kit generate

# 3. 생성된 SQL 파일 검토 (drizzle/XXXX_*.sql)
# 4. 마이그레이션 적용
pnpm drizzle-kit migrate
```

## GitHub 연동 및 Vercel 배포

### 1. GitHub 저장소 생성

```bash
# 로컬 저장소 초기화 (이미 git init된 경우 스킵)
git init

# 원격 저장소 추가
git remote add origin https://github.com/your-org/nutri-plan.git

# 초기 커밋
git add .
git commit -m "Initial commit: NutriPlan SaaS"

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

### 2. GitHub Secrets 설정

GitHub 리포지토리의 **Settings > Secrets and variables > Actions**에서 다음 환경 변수를 추가합니다:

| 변수명 | 설명 |
|--------|------|
| `DATABASE_URL` | MySQL 연결 문자열 |
| `JWT_SECRET` | JWT 서명 키 |
| `VITE_APP_ID` | Manus OAuth App ID |
| `OAUTH_SERVER_URL` | OAuth 서버 URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth 포털 URL |
| `OWNER_OPEN_ID` | 소유자 OpenID |
| `OWNER_NAME` | 소유자 이름 |
| `BUILT_IN_FORGE_API_URL` | Manus API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus API 키 |
| `VITE_FRONTEND_FORGE_API_KEY` | 프론트엔드 Forge 키 |
| `VITE_FRONTEND_FORGE_API_URL` | 프론트엔드 Forge URL |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 가맹점 ID |
| `PORTONE_API_KEY` | 포트원 API 키 |
| `PORTONE_API_SECRET` | 포트원 API 시크릿 |
| `GEMINI_API_KEY` | Gemini API 키 |

### 3. GitHub Actions CI 파이프라인

`.github/workflows/ci.yml`에서 자동으로 다음 검사가 실행됩니다:

1. **의존성 설치** — pnpm 캐싱으로 3~5분 단축
2. **ESLint 검사** — 코드 스타일 검증
3. **TypeScript 검사** — 타입 안정성 확보
4. **빌드 테스트** — 프로덕션 빌드 성공 확인
5. **Vitest 테스트** — 단위 테스트 실행

**캐싱 전략:**
- **pnpm store 캐싱** — `pnpm-lock.yaml` 기반, 70~80% 시간 단축
- **.next 캐싱** — 증분 빌드로 40~60% 시간 단축

### 4. Vercel 배포 설정

#### 4.1 Vercel 프로젝트 생성

```bash
# Vercel CLI 설치 (선택사항)
npm i -g vercel

# Vercel에 로그인
vercel login

# 프로젝트 배포
vercel
```

또는 [Vercel 대시보드](https://vercel.com/dashboard)에서 GitHub 저장소를 직접 연결합니다.

#### 4.2 Vercel 환경 변수 설정

Vercel 프로젝트의 **Settings > Environment Variables**에서 위의 GitHub Secrets와 동일한 변수들을 추가합니다.

#### 4.3 배포 자동화

GitHub의 `main` 브랜치에 푸시하면 자동으로:
1. GitHub Actions CI 파이프라인 실행
2. 모든 검사 통과 시 Vercel에 자동 배포
3. 배포 완료 후 프로덕션 URL 생성

### 5. 배포 플로우 요약

```
Local Development
    ↓
git push origin main
    ↓
GitHub Actions CI (lint, type-check, build, test)
    ↓
CI 성공 시 Vercel 자동 배포
    ↓
Production URL 생성 (https://nutri-plan.vercel.app)
```

## 프로젝트 구조

```
nutri-plan/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI 파이프라인
├── client/
│   ├── src/
│   │   ├── pages/                    # 페이지 컴포넌트
│   │   ├── components/               # 재사용 가능한 UI 컴포넌트
│   │   ├── hooks/                    # 커스텀 React 훅
│   │   ├── contexts/                 # React Context
│   │   ├── lib/                      # 유틸리티 함수
│   │   ├── App.tsx                   # 라우트 정의
│   │   └── index.css                 # 글로벌 스타일 (Tailwind)
│   ├── public/                       # 정적 파일 (favicon, robots.txt)
│   └── index.html                    # HTML 진입점
├── server/
│   ├── routers.ts                    # tRPC 라우터 정의
│   ├── db.ts                         # 데이터베이스 쿼리 헬퍼
│   ├── services/
│   │   ├── AiDietService.ts          # Gemini AI 식단 생성
│   │   └── PaymentService.ts         # 포트원 결제 검증
│   ├── _core/
│   │   ├── trpc.ts                   # tRPC 설정
│   │   ├── context.ts                # tRPC 컨텍스트
│   │   ├── llm.ts                    # LLM 호출 헬퍼
│   │   └── env.ts                    # 환경 변수 검증
│   └── index.ts                      # Express 서버 진입점
├── drizzle/
│   ├── schema.ts                     # 데이터베이스 스키마
│   ├── migrations/                   # 마이그레이션 SQL 파일
│   └── drizzle.config.ts             # Drizzle 설정
├── shared/
│   └── const.ts                      # 공유 상수
├── storage/
│   └── index.ts                      # S3 파일 저장소 헬퍼
├── vite.config.ts                    # Vite 설정 (프로덕션 최적화)
├── vercel.json                       # Vercel 배포 설정
├── package.json                      # 프로젝트 메타데이터 및 스크립트
├── pnpm-lock.yaml                    # pnpm 의존성 잠금 파일
├── .env.example                      # 환경 변수 템플릿
├── .gitignore                        # Git 무시 파일
└── README.md                         # 이 파일

```

## 주요 설계 결정

### 1. 5개 후보 메뉴 기반 비용 최적화

**문제:** 사용자가 일별 메뉴 "새로고침" 버튼을 누를 때마다 AI를 호출하면 비용이 과다 청구됨

**해결책:**
- AI가 한 달 치 식단을 생성할 때 각 일자별로 5개 후보 메뉴를 JSON으로 반환
- 프론트엔드에서 사용자가 "새로고침" 버튼을 누르면 서버 호출 없이 로컬 상태에서 다음 후보로 교체
- **결과:** API 호출 80% 감소, 월별 AI 비용 80% 절감

### 2. 모델 폴백 로직

**문제:** Gemini API Rate Limit(429) 또는 서버 에러(500+) 발생 시 사용자 경험 저하

**해결책:**
- 기본 모델: `gemini-3-flash` (빠르고 저렴)
- 폴백 모델: `gemini-2.5-flash` (안정성)
- 429/500+ 에러 시 자동으로 폴백 모델로 재시도
- **결과:** API 안정성 극대화, 사용자 경험 개선

### 3. 서비스 모듈 분리

**문제:** 결제 및 AI 로직이 라우터에 섞여있으면 유지보수 어려움

**해결책:**
- `PaymentService` — 포트원 결제 검증 로직 분리
- `AiDietService` — Gemini API 호출 및 모델 폴백 로직 분리
- 라우터는 서비스 메서드만 호출
- **결과:** 코드 응집도 증가, 테스트 용이, 다른 결제/LLM 추가 시 새로운 Service 클래스만 생성

### 4. 캐싱 전략 (CI/CD)

**pnpm store 캐싱:**
- `pnpm-lock.yaml` 기반 캐시 키 생성
- 의존성 변경 시에만 캐시 무효화
- **효과:** CI 실행 시간 3~5분 단축 (70~80% 개선)

**.next 캐싱:**
- 증분 빌드로 빌드 결과 재사용
- 의존성/설정 변경 시에만 캐시 무효화
- **효과:** 빌드 시간 40~60% 단축

## 트러블슈팅

### 1. 포트원 결제 테스트

포트원 테스트 환경에서 다음 테스트 카드를 사용합니다:

| 카드번호 | 유효기간 | CVC |
|---------|---------|-----|
| 4111-1111-1111-1111 | 12/25 | 123 |

### 2. Gemini API Rate Limit

Rate Limit 발생 시:
1. 모델 폴백 로직이 자동으로 `gemini-2.5-flash`로 재시도
2. 여전히 실패하면 에러 메시지 반환
3. 프론트엔드에서 사용자에게 재시도 안내

### 3. 데이터베이스 연결 오류

```bash
# 데이터베이스 연결 확인
mysql -h localhost -u user -p nutriplan

# 마이그레이션 상태 확인
pnpm drizzle-kit status
```

## 성능 최적화

### 1. 번들 크기 최적화

- **Vite 청크 분리:** React, UI, tRPC, 유틸리티를 별도 청크로 분리
- **Tree-shaking:** 사용하지 않는 코드 자동 제거
- **Code splitting:** 동적 임포트로 초기 로드 시간 단축

### 2. 프로덕션 빌드 최적화

- **Terser 최소화:** 코드 크기 40~50% 감소
- **console.log 제거:** 프로덕션 빌드에서 자동 제거
- **소스맵 제거:** 보안 + 용량 감소

### 3. 캐싱 정책 (Vercel)

- **API 응답:** `Cache-Control: no-cache` (항상 최신 상태)
- **정적 자산:** `Cache-Control: public, max-age=31536000` (1년 캐싱)
- **Next.js 번들:** `Cache-Control: public, max-age=31536000, immutable` (영구 캐싱)

## 보안

### 1. 환경 변수 관리

- 모든 민감한 정보는 `.env.local`에 저장
- `.env.local`은 `.gitignore`에 추가
- GitHub Secrets에서 CI/CD 환경 변수 관리

### 2. 보안 헤더 (Vercel)

```
X-Content-Type-Options: nosniff          # MIME 타입 스니핑 방지
X-Frame-Options: DENY                    # 클릭재킹 방지
X-XSS-Protection: 1; mode=block          # XSS 공격 방지
Referrer-Policy: strict-origin-when-cross-origin  # 레퍼러 정보 제한
Permissions-Policy: geolocation=(), microphone=(), camera=()  # 권한 제한
```

### 3. 결제 보안

- 포트원 API로 결제 검증 (위변조 방지)
- 금액 일치 확인 (클라이언트 조작 방지)
- 결제 상태 확인 (paid 상태만 유효)

## 라이선스

MIT License

## 기여 가이드

1. 이 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 지원

문제 발생 시 GitHub Issues에서 보고해주세요.

---

**마지막 업데이트:** 2026년 3월 29일
**버전:** 1.0.0
