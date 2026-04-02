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
import { eq, desc, and, asc, sql } from "drizzle-orm";
import { 
  users, 
  mealPlans, 
  mealDays,
  notifications, 
  userDailyUsage,
  uploadedFiles,
  subscriptions
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

// 4. [복구] 확장된 라우터 기능
const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user || null),
    logout: publicProcedure.mutation(async ({ ctx }) => ({ success: true })),
    updateCategory: protectedProcedure
      .input(z.object({ workplaceCategory: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (db) await db.update(users).set({ workplaceCategory: input.workplaceCategory }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),
  mealPlan: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return [];
      return db.select().from(mealPlans).where(eq(mealPlans.userId, ctx.user.id)).orderBy(desc(mealPlans.createdAt));
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const res = await db.select().from(mealPlans).where(and(eq(mealPlans.id, input.id), eq(mealPlans.userId, ctx.user.id))).limit(1);
        if (!res[0]) throw new TRPCError({ code: "NOT_FOUND" });
        const days = await db.select().from(mealDays).where(eq(mealDays.mealPlanId, input.id)).orderBy(asc(mealDays.dayOfMonth));
        return { ...res[0], days };
      }),
    generate: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        sourceFileId: z.number().optional(),
        fileAnalysis: z.string().optional(),
        preferences: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const today = new Date().toISOString().split('T')[0];
        let usage = (await db.select().from(userDailyUsage)
          .where(and(eq(userDailyUsage.userId, ctx.user.id), eq(userDailyUsage.date, today)))
          .limit(1))[0];
        
        if (!usage) {
          await db.insert(userDailyUsage).values({ userId: ctx.user.id, date: today, generationCount: 0, exchangeCount: 0 });
          usage = { userId: ctx.user.id, date: today, generationCount: 0, exchangeCount: 0 } as any;
        }

        const isPro = (ctx.user as any).plan === "pro";
        const maxGenerations = isPro ? 10 : 1;
        if (usage.generationCount >= maxGenerations) throw new Error("일일 생성 한도를 초과했습니다.");

        // AI 서비스 동적 임포트 및 호출
        const { AiDietService } = await import("../server/services/AiDietService.js");
        const parsed = await AiDietService.generateMonthlyMealPlan(input.year, input.month, input.preferences || input.fileAnalysis);

        // 1. 식단 플랜 생성
        const [newPlan] = await db.insert(mealPlans).values({
          userId: ctx.user.id,
          year: input.year,
          month: input.month,
          sourceFileId: input.sourceFileId,
          title: `${input.year}년 ${input.month}월 AI 식단`,
          requestPrompt: input.preferences || input.fileAnalysis,
          status: "draft",
        }).returning();

        // 2. 일별 식단 저장 (candidates 포함)
        const mealDaysData = parsed.days.map((d: any) => ({
          mealPlanId: newPlan.id,
          dayOfMonth: d.dayOfMonth,
          meals: { breakfast: d.breakfast[0], lunch: d.lunch[0], dinner: d.dinner[0], snack: d.snack[0] },
          nutritionInfo: d.nutritionInfo,
          candidates: { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner, snack: d.snack },
          selectedCandidateIndex: 0,
          status: "pending" as const,
        }));
        await db.insert(mealDays).values(mealDaysData);

        // 3. 알림 및 사용량 업데이트
        await db.insert(notifications).values({
          userId: ctx.user.id,
          type: "meal_generated",
          title: "식단 생성 완료",
          content: `${input.year}년 ${input.month}월 식단이 생성되었습니다.`,
        });
        await db.update(userDailyUsage).set({ generationCount: usage.generationCount + 1 }).where(and(eq(userDailyUsage.userId, ctx.user.id), eq(userDailyUsage.date, today)));

        return { planId: newPlan.id };
      }),
    approveDay: protectedProcedure
      .input(z.object({ dayId: z.number(), planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (db) await db.update(mealDays).set({ status: "approved" }).where(and(eq(mealDays.id, input.dayId), eq(mealDays.mealPlanId, input.planId)));
        return { success: true };
      }),
    replaceDay: protectedProcedure
      .input(z.object({ dayId: z.number(), planId: z.number(), meals: z.any(), nutritionInfo: z.any() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) return;
        const today = new Date().toISOString().split('T')[0];
        await db.update(mealDays).set({ meals: input.meals, nutritionInfo: input.nutritionInfo }).where(eq(mealDays.id, input.dayId));
        await db.update(userDailyUsage).set({ exchangeCount: sql`${userDailyUsage.exchangeCount} + 1` }).where(and(eq(userDailyUsage.userId, ctx.user.id), eq(userDailyUsage.date, today)));
        return { success: true };
      }),
    confirm: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (db) await db.update(mealPlans).set({ status: "confirmed" }).where(and(eq(mealPlans.id, input.planId), eq(mealPlans.userId, ctx.user.id)));
        return { success: true };
      }),
  }),
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return [];
      return db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(20);
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (db) await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, ctx.user.id)));
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = getInlinedDb();
      if (db) await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, ctx.user.id));
      return { success: true };
    }),
  }),
  file: router({
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string(), // Base64 encoded for simplicity in TRPC over HTTP
        fileType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { storagePut } = await import("../server/storage.js");
        const buffer = Buffer.from(input.fileContent, 'base64');
        const fileKey = `${ctx.user.id}-files/${input.fileName}-${nanoid()}.xlsx`;
        const { url } = await storagePut(fileKey, buffer, input.fileType);

        const [newFile] = await db.insert(uploadedFiles).values({
          userId: ctx.user.id,
          originalName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: buffer.length,
          mimeType: input.fileType,
          status: "uploaded",
        }).returning();

        return { fileId: newFile.id, url };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return [];
      return db.select().from(uploadedFiles).where(eq(uploadedFiles.userId, ctx.user.id)).orderBy(desc(uploadedFiles.createdAt));
    }),
  }),
  export: router({
    generateExcel: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const plan = (await db.select().from(mealPlans).where(and(eq(mealPlans.id, input.planId), eq(mealPlans.userId, ctx.user.id))).limit(1))[0];
        if (!plan || plan.status !== "confirmed") throw new Error("확정된 식단만 다운로드할 수 있습니다.");

        const days = await db.select().from(mealDays).where(eq(mealDays.mealPlanId, input.planId)).orderBy(asc(mealDays.dayOfMonth));

        // exceljs 및 storage 동적 임포트
        const ExcelJS = (await import("exceljs")).default as any;
        const { storagePut } = await import("../server/storage.js");
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`${plan.year}년 ${plan.month}월 식단`);
        
        // 간단한 헤더 구성 (코드가 너무 길어지지 않게 핵심만 구현)
        sheet.addRow(["날짜", "아침", "점심", "저녁", "간식", "칼로리"]);
        days.forEach((day: any) => {
          sheet.addRow([
            day.dayOfMonth,
            day.meals.breakfast.name,
            day.meals.lunch.name,
            day.meals.dinner.name,
            day.meals.snack.name,
            day.nutritionInfo.totalCalories
          ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileKey = `${ctx.user.id}-exports/${plan.year}-${plan.month}-${nanoid()}.xlsx`;
        const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        return { url, fileName: `${plan.year}년 ${plan.month}월 식단.xlsx` };
      }),
  }),
  payment: router({
    createOrder: protectedProcedure
      .input(z.object({ planType: z.enum(["free", "pro"]), amount: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const orderId = `order-${ctx.user.id}-${Date.now()}`;
        await db.insert(subscriptions).values({
          userId: ctx.user.id,
          plan: input.planType,
          amount: String(input.amount),
          orderId,
          status: "pending",
        });
        return { orderId };
      }),
    confirmPayment: protectedProcedure
      .input(z.object({ paymentKey: z.string(), orderId: z.string(), amount: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = getInlinedDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // 유저 플랜 업데이트 및 구독 완료
        await db.update(subscriptions).set({ status: "paid", paymentKey: input.paymentKey, paidAt: new Date() }).where(eq(subscriptions.orderId, input.orderId));
        await db.update(users).set({ plan: "pro" }).where(eq(users.id, ctx.user.id));
        
        return { success: true };
      }),
  }),
  subscription: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = getInlinedDb();
      if (!db) return null;
      const res = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
      return res[0] || null;
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
  health: publicProcedure.query(() => ({ status: "all_systems_go" })),
});

// 8. Express 앱 및 OAuth 콜백 핸들러 직접 구현
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// [인라인 복구] OAuth 콜백 (Supabase 인증 후 호출됨)
app.get("/api/oauth/callback", async (req, res) => {
  // Supabase가 클라이언트에서 처리하지만, 만약 서버 사이드 콜백이 필요할 경우를 대비
  res.redirect("/dashboard");
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    onError: ({ path, error }) => {
      console.error(`[tRPC Error] path: ${path}, message: ${error.message}, code: ${error.code}`);
    },
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
