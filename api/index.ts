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

// 5. [인라인 복구] 핵심 라우터 기능 직접 구현
const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user || null),
  }),
  mealPlan: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return [];
      return db.select().from(mealPlans).where(eq(mealPlans.userId, ctx.user.id)).orderBy(desc(mealPlans.createdAt));
    }),
  }),
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return [];
      return db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(20);
    }),
  }),
  usage: router({
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
  }),
  health: publicProcedure.query(() => ({ status: "fully_integrated" })),
});

// 6. Express 앱
const app = express();
app.use(express.json());

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
            const db = getInlinedDb();
            if (db) {
              const res = await db.select().from(users).where(eq(users.openId, authUser.id)).limit(1);
              if (res[0]) return { req: opts.req, res: opts.res, user: res[0] };
            }
          }
        } catch (e) {
          console.error("[Auth Failure]", e);
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
