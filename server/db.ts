import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser,
  users,
  mealPlans,
  mealDays,
  uploadedFiles,
  notifications,
  subscriptions,
  userDailyUsage,
  type MealPlan,
  type MealDay,
  type UploadedFile,
  type Notification,
  type InsertMealPlan,
  type InsertMealDay,
  type InsertUploadedFile,
  type InsertNotification,
  type InsertSubscription,
  type UserDailyUsage,
  type InsertUserDailyUsage,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// 서버리스 환경에서 커넥션 유지를 위한 global 선언
const globalForPostgres = global as unknown as {
  postgres: ReturnType<typeof postgres> | undefined;
};

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!globalForPostgres.postgres) {
        globalForPostgres.postgres = postgres(process.env.DATABASE_URL, {
          prepare: false,
          idle_timeout: 20,
          max: 1,
        });
      }
      _db = drizzle(globalForPostgres.postgres);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===================== USER =====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "workplaceCategory"] as const;

    textFields.forEach((field) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    });

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    // PostgreSQL: onConflictDoUpdate (MySQL의 onDuplicateKeyUpdate 대체)
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===================== USER DAILY USAGE =====================

export async function getDailyUsage(userId: number, date: string): Promise<UserDailyUsage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let usageResult = await db.select().from(userDailyUsage)
    .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.date, date)))
    .limit(1);

  if (usageResult.length === 0) {
    // Create if not exists
    await db.insert(userDailyUsage).values({ userId, date });
    usageResult = await db.select().from(userDailyUsage)
      .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.date, date)))
      .limit(1);
  }
  return usageResult[0];
}

export async function incrementDailyUsage(
  userId: number,
  date: string,
  field: "generationCount" | "exchangeCount"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Ensure record exists
  await getDailyUsage(userId, date);

  const record = (await db.select().from(userDailyUsage).where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.date, date))).limit(1))[0];
  
  await db.update(userDailyUsage)
    .set({ [field]: record[field] + 1 })
    .where(eq(userDailyUsage.id, record.id));
}

export async function updateUserCategory(userId: number, workplaceCategory: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ workplaceCategory }).where(eq(users.id, userId));
}

// ===================== MEAL PLANS =====================

/**
 * 사용자의 식단 플랜 목록 조회 (최신순)
 */
export async function getMealPlansByUserId(userId: number): Promise<MealPlan[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mealPlans)
    .where(eq(mealPlans.userId, userId))
    .orderBy(desc(mealPlans.createdAt));
}

/**
 * 특정 식단 플랜 조회 (userId 검증 포함)
 */
export async function getMealPlanById(id: number, userId: number): Promise<MealPlan | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mealPlans)
    .where(and(eq(mealPlans.id, id), eq(mealPlans.userId, userId)))
    .limit(1);
  return result[0];
}

/**
 * 식단 플랜 생성
 * PostgreSQL: .returning()으로 생성된 ID를 바로 받아옵니다.
 */
export async function createMealPlan(data: InsertMealPlan): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mealPlans).values(data).returning({ id: mealPlans.id });
  return result[0].id;
}

/**
 * 식단 플랜 상태 업데이트 (draft → confirmed)
 */
export async function updateMealPlanStatus(
  id: number,
  userId: number,
  status: "draft" | "confirmed",
  exportData?: { exportFileKey: string; exportFileUrl: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mealPlans)
    .set({
      status,
      confirmedAt: status === "confirmed" ? new Date() : undefined,
      ...(exportData ?? {}),
    })
    .where(and(eq(mealPlans.id, id), eq(mealPlans.userId, userId)));
}

// ===================== MEAL DAYS =====================

/**
 * 식단 플랜의 일별 식단 목록 조회
 */
export async function getMealDaysByPlanId(mealPlanId: number): Promise<MealDay[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mealDays)
    .where(eq(mealDays.mealPlanId, mealPlanId))
    .orderBy(mealDays.dayOfMonth);
}

/**
 * 일별 식단 일괄 삽입
 */
export async function insertMealDays(days: InsertMealDay[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (days.length === 0) return;
  await db.insert(mealDays).values(days);
}

/**
 * 특정 일자 식단 승인
 */
export async function approveMealDay(id: number, mealPlanId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mealDays)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(mealDays.id, id), eq(mealDays.mealPlanId, mealPlanId)));
}

/**
 * 특정 일자 식단 교체
 */
export async function replaceMealDay(
  id: number,
  mealPlanId: number,
  newMeals: unknown,
  newNutritionInfo?: unknown
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mealDays)
    .set({
      meals: newMeals,
      nutritionInfo: newNutritionInfo ?? null,
      status: "pending",
      approvedAt: null,
    })
    .where(and(eq(mealDays.id, id), eq(mealDays.mealPlanId, mealPlanId)));
}

// ===================== UPLOADED FILES =====================

/**
 * 업로드 파일 메타데이터 저장
 * PostgreSQL: .returning()으로 생성된 ID를 바로 받아옵니다.
 */
export async function createUploadedFile(data: InsertUploadedFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(uploadedFiles).values(data).returning({ id: uploadedFiles.id });
  return result[0].id;
}

/**
 * 사용자의 업로드 파일 목록 조회
 */
export async function getUploadedFilesByUserId(userId: number): Promise<UploadedFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uploadedFiles)
    .where(eq(uploadedFiles.userId, userId))
    .orderBy(desc(uploadedFiles.createdAt));
}

/**
 * 파일 처리 상태 업데이트
 */
export async function updateFileStatus(
  id: number,
  status: "uploaded" | "processing" | "completed" | "failed"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(uploadedFiles).set({ status }).where(eq(uploadedFiles.id, id));
}

// ===================== NOTIFICATIONS =====================

/**
 * 알림 생성
 */
export async function createNotification(data: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

/**
 * 사용자 알림 목록 조회 (최신 20개)
 */
export async function getNotificationsByUserId(userId: number): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationRead(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}

// ===================== SUBSCRIPTIONS =====================

/**
 * 구독 결제 레코드 생성 (pending 상태)
 * PostgreSQL: .returning()으로 생성된 ID를 바로 받아옵니다.
 */
export async function createSubscription(data: InsertSubscription): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data).returning({ id: subscriptions.id });
  return result[0].id;
}

/**
 * 결제 완료 처리
 */
export async function completePayment(
  orderId: string,
  paymentKey: string,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(subscriptions)
    .set({ status: "paid", paymentKey, paidAt: new Date() })
    .where(eq(subscriptions.orderId, orderId));

  await db.update(users)
    .set({ plan: "pro" })
    .where(eq(users.id, userId));
}

/**
 * 결제 실패 처리
 */
export async function failPayment(orderId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions)
    .set({ status: "failed" })
    .where(eq(subscriptions.orderId, orderId));
}
