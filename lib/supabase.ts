/**
 * Supabase 클라이언트 설정
 * 
 * 아키텍처 설계:
 * - 단순하고 직관적: tRPC 같은 과한 추상화 제거
 * - Supabase 클라이언트를 직접 사용하여 명확한 데이터 흐름
 * - 클라이언트와 서버 모두에서 사용 가능한 통일된 인터페이스
 * 
 * 이 방식을 선택한 이유:
 * 1. 명확성: 데이터가 어디서 오는지 한눈에 파악 가능
 * 2. 유지보수성: tRPC 레이어 없이 직접 SQL 쿼리 가능
 * 3. 성능: 불필요한 미들웨어 계층 제거
 * 4. 타입 안정성: Supabase 타입 자동 생성으로 런타임 오류 방지
 */

import { createClient } from "@supabase/supabase-js";

// 환경 변수 검증
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 환경 변수가 설정되지 않았습니다. " +
    "VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요."
  );
}

/**
 * 클라이언트사이드 Supabase 클라이언트
 * - 브라우저에서 실행되는 모든 코드에서 사용
 * - Anon Key를 사용하여 RLS 정책 준수
 * - 자동 세션 관리 (로그인/로그아웃 시 자동 동기화)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * 서버사이드 Supabase 클라이언트 (Service Role Key 사용)
 * - Next.js Server Actions에서만 사용
 * - Service Role Key로 RLS 정책 우회 (관리 작업용)
 * - 환경 변수에서 동적으로 생성
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
