import { createClient } from "@supabase/supabase-js";

// 1. 환경 변수 수집 (Vite & Node.js 호환)
const getEnvValue = (key: string) => {
  // Vite (Client-side)
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  // Node.js (Server-side)
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

// Vite의 정적 치환을 위해 명시적 참조도 병행 (Vite 권장 방식)
// 주의: 서버 사이드에서는 import.meta.env가 없을 수 있으므로 옵셔널 체이닝 사용
const VITE_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";
const VITE_ANON_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

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

/**
 * Supabase 어드민 클라이언트 (서버 전용)
 */
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  const url = supabaseUrl || getEnvValue("VITE_SUPABASE_URL");

  if (!serviceRoleKey || !url) {
    throw new Error(
      "Supabase 어드민 환경 변수가 설정되지 않았습니다. (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 확인)"
    );
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}
