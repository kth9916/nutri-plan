import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트 초기화 전략: 지연 초기화 (Lazy Initialization)
 * 
 * 왜 이 방식을 사용하나요?
 * 1. 서버 사이드(Vercel 등)에서 모듈 로드 시점에 환경 변수가 로컬 스코프에 주입되지 않았을 수 있습니다.
 * 2. 최상단(Top-level)에서 createClient를 호출하면 환경 변수 누락 시 즉시 크래시(500 에러)가 발생합니다.
 * 3. Proxy를 통해 실제 메서드나 속성에 접근하는 시점에 클라이언트를 생성함으로써 안정성을 확보합니다.
 */

// 1. 환경 변수 수집 유틸리티
const getEnvValue = (key: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

const getSupabaseConfig = () => {
  // Vite의 정적 치환 우선 시도
  const vUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";
  const vKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

  const url = vUrl || getEnvValue("VITE_SUPABASE_URL");
  const key = vKey || getEnvValue("VITE_SUPABASE_ANON_KEY");

  return { url, key };
};

// 2. 클라이언트 인스턴스 캐시
let _supabaseInstance: SupabaseClient | null = null;
let _supabaseAdminInstance: SupabaseClient | null = null;

/**
 * 실제 Supabase 클라이언트를 생성하는 내부 함수
 */
function createLazyClient(): SupabaseClient {
  if (_supabaseInstance) return _supabaseInstance;

  const { url, key } = getSupabaseConfig();

  // 최소한의 유효성 검사 (크래시 방지용 placeholder URL 제공)
  const finalUrl = (url && (url.startsWith("http://") || url.startsWith("https://"))) 
    ? url 
    : "https://missing-config.supabase.co";

  if (!key && typeof window !== "undefined") {
    console.warn("[Supabase] Anon Key가 누락되었습니다. 로그인이 작동하지 않을 수 있습니다.");
  }

  _supabaseInstance = createClient(finalUrl, key || "missing-key", {
    auth: {
      autoRefreshToken: typeof window !== "undefined",
      persistSession: typeof window !== "undefined",
      detectSessionInUrl: typeof window !== "undefined",
    },
  });

  return _supabaseInstance;
}

/**
 * Proxy를 사용한 supabase 객체
 * 기존의 'import { supabase } from "@/lib/supabase"' 코드를 수정하지 않고 그대로 쓸 수 있게 합니다.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = createLazyClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Supabase 어드민 클라이언트 (서버 전용)
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdminInstance) return _supabaseAdminInstance;

  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  const { url } = getSupabaseConfig();

  if (!serviceRoleKey || !url) {
    // 서버 사이드에서 호출되었는데 키가 없는 경우에만 에러 발생 (tRPC 핸들러에서 캐치 가능)
    throw new Error(
      "Supabase 어드민 환경 변수가 설정되지 않았습니다. VITE_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY를 확인하세요."
    );
  }

  _supabaseAdminInstance = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdminInstance;
}
