import { createClient } from "@supabase/supabase-js";

// Vite(클라이언트)와 Node.js(서버) 환경 모두를 지원하도록 수정합니다.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 브라우저 콘솔에서 즉시 원인을 파악할 수 있도록 로깅을 추가합니다.
  console.error("환경 변수 로드 실패: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 정의되지 않았습니다.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseAdmin() {
  // 서버 환경에서는 process.env를 사용합니다.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl || "", serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
