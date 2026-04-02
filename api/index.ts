import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// [주의] 절대로 ../server/db.js를 직접 임포트하지 않습니다. (500 에러의 원인)
// 대신 필요한 DB 조회 로직을 여기서 직접 구현하거나 안전한 라이브러리만 사용합니다.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and } from "drizzle-orm";
import { 
  users, 
  mealPlans, 
  notifications, 
  userDailyUsage 
} from "../drizzle/schema.js";

/**
 * [ABSOLUTE STABILITY PHASE 2 - DB INLINED]
 */

// 1. 핵심 설정
const ENV = {
  appId: process.env.VITE_APP_ID || "",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "",
};

// 2. DB 연결 (인라인 지연 초기화)
let _db: any = null;
function getInlinedDb() {
  if (_db) return _db;
  if (!ENV.databaseUrl) return null;
  const client = postgres(ENV.databaseUrl, { prepare: false, max: 1 });
  _db = drizzle(client);
  return _db;
}

// 3. Supabase Admin
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  _supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey);
  return _supabaseAdmin;
}

// 4. tRPC 기초
const t = initTRPC.context<any>().create({ transformer: superjson });
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const router = t.router;

// 7. [인라인 복구] 인증 라우터
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user || null),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    // 로그아웃 로직 (쿠키 삭제 등 필요한 경우)
    return { success: true };
  }),
});

const mealPlanRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getInlinedDb();
    if (!db) return [];
    return db.select().from(mealPlans).where(eq(mealPlans.userId, ctx.user.id)).orderBy(desc(mealPlans.createdAt));
  }),
});

const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getInlinedDb();
    if (!db) return [];
    return db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(20);
  }),
});

const usageRouter = router({
  getDailyStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getInlinedDb();
    const today = new Date().toISOString().split('T')[0];
    let usage = null;
    if (db) {
      const result = await db.select().from(userDailyUsage)
        .where(and(eq(userDailyUsage.userId, ctx.user.id), eq(userDailyUsage.date, today)))
        .limit(1);
      usage = result[0];
    }
    const isPro = (ctx.user as any).plan === "pro";
    return {
      generationMode: isPro ? "pro" : "free",
      maxGenerations: isPro ? 10 : 1,
      usedGenerations: usage?.generationCount || 0,
      maxExchanges: isPro ? 50 : 5,
      usedExchanges: usage?.exchangeCount || 0,
    };
  }),
});

// 전체 라우터 조립
const appRouter = router({
  auth: authRouter,
  mealPlan: mealPlanRouter,
  notification: notificationRouter,
  usage: usageRouter,
  health: publicProcedure.query(() => ({ status: "fully_integrated" })),
});

// 8. Express 앱 및 OAuth 콜백 핸들러 직접 구현
const app = express();
app.use(express.json());

// [인라인 복구] OAuth 콜백 (Supabase 인증 후 호출됨)
app.get("/api/oauth/callback", async (req, res) => {
  // Supabase가 클라이언트에서 처리하지만, 만약 서버 사이드 콜백이 필요할 경우를 대비
  res.redirect("/dashboard");
});

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
          const { data: { user: authUser }, error } = await admin.auth.getUser(token);
          
          if (error) {
            console.error("[Auth] Supabase token verification failed:", error.message);
          }

          if (authUser && !error) {
            console.log("[Auth] Supabase user verified:", authUser.id);
            const db = getInlinedDb();
            if (db) {
              // 1. 유저 정보 조회
              let res = await db.select().from(users).where(eq(users.openId, authUser.id)).limit(1);
              let userRecord = res[0];

              // 2. 유저가 DB에 없으면 즉시 생성 (SSO 로그인 등 최초 접속)
              if (!userRecord) {
                console.log("[Auth] New user detected, creating DB record for:", authUser.id);
                const newUser = {
                  openId: authUser.id,
                  email: authUser.email || "",
                  name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
                  lastSignedIn: new Date(),
                  role: "user",
                  plan: "free"
                };
                try {
                  await db.insert(users).values(newUser).onConflictDoUpdate({
                    target: users.openId,
                    set: { lastSignedIn: new Date() }
                  });
                  res = await db.select().from(users).where(eq(users.openId, authUser.id)).limit(1);
                  userRecord = res[0];
                  console.log("[Auth] DB user created/updated successfully");
                } catch (dbErr) {
                  console.error("[Auth] DB sync failed:", dbErr);
                }
              } else {
                // 로그인 시간 업데이트
                await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userRecord.id));
                console.log("[Auth] Existing user session updated");
              }
              
              if (userRecord) return { req: opts.req, res: opts.res, user: userRecord };
            }
          }
        } catch (e) {
          console.error("[Auth Failure] Unexpected error:", e);
        }
      }
      return { req: opts.req, res: opts.res, user: null };
    },
  })
);

app.get("/api/health", (req, res) => {
  res.status(200).send("NutriPlan Server Fully Integrated & LIVE!");
});

export default app;
