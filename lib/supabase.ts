import { createClient } from "@supabase/supabase-js";

/**
 * 환경 변수 유틸리티
 * Vite(import.meta.env)와 Node.js(process.env) 환경을 모두 지원합니다.
 */
const getEnv = (key: string): string | undefined => {
  // 1. Vite 환경 변수 확인 (클라이언트)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }
  // 2. Node.js 환경 변수 확인 (서버)
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

// 런타임 에러 방지를 위한 유효성 검사
if (!supabaseUrl || !supabaseAnonKey) {
  // 빌드 타임이 아닌 브라우저 콘솔에서 명확한 원인을 파악할 수 있게 합니다.
  console.error(
    "Supabase configuration missing: " +
      "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables."
  );
}

/**
 * 기본 Supabase 클라이언트 (Anonymous)
 * - 브라우저/서버 공용
 */
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * 관리자용 Supabase 클라이언트 (Service Role)
 * - 주의: 서버 사이드에서만 호출되어야 함
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined.");
  }

  return createClient(supabaseUrl || "", serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
