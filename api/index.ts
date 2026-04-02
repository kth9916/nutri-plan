import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// [중요] 지뢰가 제거된(Lazy) DB 모듈로부터 필요한 함수만 임포트합니다.
import { 
  getMealPlansByUserId, 
  getNotificationsByUserId, 
  getDailyUsage, 
  getUserByOpenId,
  markNotificationRead
} from "../server/db.js";

/**
 * [CORE RECOVERY STAGE 1 - DASHBOARD & USAGE]
 */

// 1. 핵심 설정 (내장)
const ENV = {
  appId: process.env.VITE_APP_ID || "",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

// 2. Supabase Admin (내장)
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  _supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _supabaseAdmin;
}

// 3. tRPC 기초 설정
const t = initTRPC.context<any>().create({ transformer: superjson });
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const router = t.router;

// 4. [복구] 식단 플랜 라우터
const mealPlanRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMealPlansByUserId(ctx.user.id);
  }),
});

// 5. [복구] 알림 라우터
const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationsByUserId(ctx.user.id);
  }),
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),
});

// 6. [복구] 사용량 통계 라우터 (마이페이지 무한 로딩 해결)
const usageRouter = router({
  getDailyStats: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = await getDailyUsage(ctx.user.id, today);
    // Pro 여부 판단 (임시: free로 고정하되 DB 연동 시 보강)
    const isPro = (ctx.user as any).plan === "pro";
    return {
      generationMode: isPro ? "pro" : "free",
      maxGenerations: isPro ? 10 : 1,
      usedGenerations: dailyUsage?.generationCount || 0,
      maxExchanges: isPro ? 50 : 5,
      usedExchanges: dailyUsage?.exchangeCount || 0,
    };
  }),
});

// 7. [복구] 인증 라우터
const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user || null;
  }),
});

// 전체 라우터 조립
const appRouter = router({
  auth: authRouter,
  mealPlan: mealPlanRouter,
  notification: notificationRouter,
  usage: usageRouter,
  health: publicProcedure.query(() => ({ status: "feature_restored" })),
});

// 8. Express 앱 및 미들웨어
const app = express();
app.use(express.json());

// tRPC 핸들러
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async (opts) => {
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const admin = getSupabaseAdmin();
          const { data: { user: authUser } } = await admin.auth.getUser(token);
          
          if (authUser) {
            // [복구] 실제 DB 유저 정보 조회
            const user = await getUserByOpenId(authUser.id);
            if (user) {
              return { req: opts.req, res: opts.res, user };
            }
          }
        } catch (e) {
          console.error("[Context] Auth failed:", e);
        }
      }
      return { req: opts.req, res: opts.res, user: null };
    },
  })
);

// 헬스 체크
app.get("/api/health", (req, res) => {
  res.status(200).send("NutriPlan Server Dashboard & Usage Restored!");
});

app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: true, message: err.message });
});

export default app;
