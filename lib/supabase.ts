import { createClient } from "@supabase/supabase-js";

/**
 * 환경 변수 추출 (클라이언트/서버 호환)
 * Vite 클라이언트에서는 import.meta.env를, Node.js 서버에서는 process.env를 사용합니다.
 */
const getEnv = (key: string) => {
  // 1. Vite 클라이언트 환경 (빌드 타임 치환)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }
  // 2. Node.js 서버 환경
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

// 런타임 에러 방지를 위한 유효성 체크 및 폴백
const isValidUrl = (url: string | undefined): url is string => {
  try {
    return !!url && (url.startsWith("http://") || url.startsWith("https://"));
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.error("❌ Supabase 설정 오류: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 유효하지 않습니다.", {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
}

// createClient에 유효하지 않은 URL이 들어가지 않도록 처리
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : "https://placeholder-url.supabase.co",
  supabaseAnonKey || "",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export function getSupabaseAdmin() {
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
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
