import { createClient } from "@supabase/supabase-js";

// 1. 환경 변수 수집 (Vite & Node.js 호환)
const getEnvValue = (key: string) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

// Vite의 정적 치환을 위해 명시적 참조도 병행 (Vite 권장 방식)
const VITE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const VITE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

const supabaseUrl = VITE_URL || getEnvValue("VITE_SUPABASE_URL");
const supabaseAnonKey = VITE_ANON_KEY || getEnvValue("VITE_SUPABASE_ANON_KEY");

// 2. URL 유효성 검증
const isValidUrl = (url: string): boolean => {
  try {
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
};

// 3. 디버깅 로그 (에러 발생 전 실행되도록 최상단 배치)
if (typeof window !== "undefined") {
  console.log("[Supabase Init] Detected Config:", {
    hasUrl: !!supabaseUrl,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 10) : "none",
    hasKey: !!supabaseAnonKey,
  });
}

// 4. 안전한 URL 확보 (Invalid URL 에러 방지용 placeholder)
const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : "https://missing-config.supabase.co";

/**
 * Supabase 클라이언트 인스턴스
 * URL이 잘못되어도 인스턴스 생성 시점에서 프로세스가 죽지 않도록 finalUrl을 보장합니다.
 */
export const supabase = createClient(finalUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: typeof window !== "undefined",
    persistSession: typeof window !== "undefined",
    detectSessionInUrl: typeof window !== "undefined",
  },
});

export function getSupabaseAdmin() {
  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(finalUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
