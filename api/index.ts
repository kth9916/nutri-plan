import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import axios from "axios";
import { SignJWT, jwtVerify } from "jose";

/**
 * [FINAL BATTLE - ABSOLUTE STABILITY VERSION]
 * 
 * 500 에러를 유발하는 로컬 파일 임포트 리스크를 ZERO로 만들기 위해
 * 거의 모든 핵심 인프라 로직을 이 파일에 직접 내장합니다.
 */

// 1. ENV 직접 내장
const ENV = {
  appId: process.env.VITE_APP_ID || "",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  cookieSecret: process.env.JWT_SECRET || "default_secret",
};

// 2. Supabase Admin 클라이언트 (지연 생성)
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) throw new Error("Supabase Admin Env Missing");
  _supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _supabaseAdmin;
}

// 3. tRPC 기초 (인라이닝)
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
const t = initTRPC.context<any>().create({ transformer: superjson });
const publicProcedure = t.procedure;
const router = t.router;

// 4. 임시 인증/시스템 라우터 (외부 파일 참조 없이 여기서 정의)
// routers.js를 로드하다가 죽는 경우를 대비해 최소한의 기능을 직접 정의합니다.
const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    // 임시: 인증 성공 여부만 확인 가능하게 함
    return ctx.user || null;
  }),
});

const appRouter = router({
  auth: authRouter,
  health: publicProcedure.query(() => ({ status: "alive" })),
});

// 5. 서버 가동 및 미들웨어
const app = express();
app.use(express.json());

// tRPC 핸들러 연결
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async (opts) => {
      // 6. 컨텍스트 로직 직접 내장 (sdk.js 참조 안 함)
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const admin = getSupabaseAdmin();
          const { data: { user } } = await admin.auth.getUser(token);
          return { req: opts.req, res: opts.res, user };
        } catch (e) {
          return { req: opts.req, res: opts.res, user: null };
        }
      }
      return { req: opts.req, res: opts.res, user: null };
    },
  })
);

// 헬스 체크
app.get("/api/health", (req, res) => {
  res.status(200).send(`
    <h1>NutriPlan Absolute Stabilization Stage</h1>
    <p>외부 파일 임포트를 99% 제거하고 라이브러리만으로 구성한 버전입니다.</p>
    <ul>
      <li>✅ Express: Running</li>
      <li>✅ tRPC: Initialized Inline</li>
      <li>✅ Supabase Admin: Lazy Ready</li>
    </ul>
    <p>이 화면이 보인다면, 지금까지의 모든 500 에러는 <strong>'특정 로컬 파일의 임포트 시점 크래시'</strong>가 100% 확실합니다.</p>
  `);
});

// 전역 에러 트랩
app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).send(`<h1>Critical Server Failure</h1><pre>${err.stack || err.message}</pre>`);
});

export default app;
