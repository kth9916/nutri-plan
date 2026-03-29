/**
 * Supabase 클라이언트 설정
 *
 * 아키텍처 설계:
 * - 서버사이드에서 Supabase 클라이언트를 싱글톤으로 관리
 * - Service Role Key를 사용하여 RLS를 우회하고 관리 작업 수행
 * - 클라이언트 인스턴스는 lazy initialization으로 필요할 때만 생성
 * - 환경 변수 검증을 통해 배포 전 설정 오류 조기 발견
 *
 * 이 방식을 선택한 이유:
 * 1. 단일 진입점: 모든 DB 작업이 이 클라이언트를 통해 이루어져 관리 용이
 * 2. 보안: Service Role Key는 서버에서만 사용, 클라이언트에 노출 안 됨
 * 3. 유지보수성: 향후 Supabase 설정 변경 시 한 곳만 수정
 */

import { createClient } from "@supabase/supabase-js";

// 환경 변수 검증
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Supabase 환경 변수가 설정되지 않았습니다. " +
    "VITE_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요."
  );
}

// Supabase 클라이언트 싱글톤 인스턴스
// Service Role Key를 사용하여 RLS를 우회 (관리 작업용)
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

// 클라이언트사이드 Supabase 클라이언트 생성 함수
// Anon Key를 사용하여 RLS 정책 준수
export function createSupabaseClient() {
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("VITE_SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl!, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}
