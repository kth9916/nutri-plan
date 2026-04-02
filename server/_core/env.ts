/**
 * [환경 변수 안전화 작업]
 * 
 * Vercel 서버리스 환경에서 최신 문법(?. , ??)이 때때로 빌드 도구나 Node 버전에 따라 
 * 최상단(Top-level) 크래시를 유발하는 경우가 있습니다. 
 * 이를 가장 원시적이고 안전한 방식으로 재작성합니다.
 */

function getEnv(key: string, defaultValue: string = ""): string {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultValue;
}

export const ENV = {
  appId: getEnv("VITE_APP_ID"),
  cookieSecret: getEnv("JWT_SECRET"),
  databaseUrl: getEnv("DATABASE_URL"),
  oAuthServerUrl: getEnv("OAUTH_SERVER_URL"),
  ownerOpenId: getEnv("OWNER_OPEN_ID"),
  isProduction: (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production"),
  tossSecretKey: getEnv("TOSS_SECRET_KEY"),
  portoneApiKey: getEnv("PORTONE_API_KEY"),
  portoneApiSecret: getEnv("PORTONE_API_SECRET"),
  geminiApiKey: getEnv("GEMINI_API_KEY"),
  forgeApiUrl: getEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: getEnv("BUILT_IN_FORGE_API_KEY"),
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
};
