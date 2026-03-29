# NutriPlan - 배포 환경 변수 가이드

Vercel에 배포할 때 필요한 모든 환경 변수입니다. 아래 값들을 Vercel 대시보드의 **Settings → Environment Variables**에 추가하세요.

---

## **필수 환경 변수 (Supabase)**

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key (공개) | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (비공개) | `eyJhbGc...` |

---

## **필수 환경 변수 (포트원 결제)**

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 가맹점 ID | `imp_12345678` |
| `PORTONE_API_KEY` | 포트원 API Key | `your-api-key` |
| `PORTONE_API_SECRET` | 포트원 API Secret | `your-api-secret` |

---

## **필수 환경 변수 (Gemini AI)**

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |

---

## **선택 환경 변수 (분석/모니터링)**

| 변수명 | 설명 |
|--------|------|
| `VITE_ANALYTICS_ENDPOINT` | 분석 서비스 엔드포인트 (선택사항) |
| `VITE_ANALYTICS_WEBSITE_ID` | 분석 웹사이트 ID (선택사항) |

---

## **Vercel 배포 단계**

### **1단계: 환경 변수 추가**

```bash
# 로컬 개발용 (.env.local)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_PORTONE_STORE_ID=imp_12345678
PORTONE_API_KEY=your-api-key
PORTONE_API_SECRET=your-api-secret
GEMINI_API_KEY=your-gemini-key
```

### **2단계: Vercel 대시보드에서 설정**

1. Vercel 대시보드 → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 위의 모든 변수를 추가
4. **Deployments** → **Redeploy** 클릭

### **3단계: 배포 확인**

```bash
# 배포 후 로그 확인
vercel logs
```

---

## **주의사항**

⚠️ **절대 하지 말 것:**
- `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 코드에 노출하지 마세요
- `PORTONE_API_SECRET`를 클라이언트에 노출하지 마세요
- `GEMINI_API_KEY`를 클라이언트에 노출하지 마세요

✅ **권장사항:**
- 모든 비공개 키는 Vercel의 **Sensitive** 옵션으로 표시
- 정기적으로 API 키 로테이션
- 프로덕션 환경과 개발 환경 분리

---

## **환경 변수 검증**

배포 후 다음 명령으로 환경 변수가 제대로 로드되는지 확인할 수 있습니다:

```bash
# 프로젝트 루트에서
npm run check
```

TypeScript 컴파일 오류가 없으면 배포 준비 완료입니다.
