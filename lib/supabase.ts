import { createClient } from "@supabase/supabase-js";

/**
 * [DEBUG] 환경 변수 로드 확인용 로그
 * 이 로그는 브라우저 콘솔에서 확인할 수 있습니다.
 */
console.log("[Supabase Debug] Environment Info:", {
  isBrowser: typeof window !== "undefined",
  viteUrlValue: import.meta.env?.VITE_SUPABASE_URL,
  processUrlValue: typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : "N/A",
  // 보안을 위해 키는 일부만 노출
  hasAnonKey: !!(import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY)),
});

/**
 * Vite의 정적 분석(Static Replacement)을 위해 환경 변수를 명시적으로 참조합니다.
 */
const VITE_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Node.js 서버 환경을 위한 폴백
const PROCESS_SUPABASE_URL = typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : undefined;
const PROCESS_SUPABASE_ANON_KEY = typeof process !== "undefined" ? process.env?.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = VITE_SUPABASE_URL || PROCESS_SUPABASE_URL;
const supabaseAnonKey = VITE_SUPABASE_ANON_KEY || PROCESS_SUPABASE_ANON_KEY;

// URL 유효성 검사
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
};

// 런타임 에러 방지를 위한 처리
const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : "https://missing-url.supabase.co";

if (!isValidUrl(supabaseUrl)) {
  console.warn("⚠️ [Supabase] VITE_SUPABASE_URL 환경 변수가 누락되었습니다.", { 
    detectedUrl: supabaseUrl 
  });
}

export const supabase = createClient(finalUrl, supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseAdmin() {
  const serviceRoleKey = typeof process !== "undefined" ? process.env?.SUPABASE_SERVICE_ROLE_KEY : undefined;
  
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
