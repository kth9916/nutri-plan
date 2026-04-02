import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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

  // We can just query again and manually increment or use raw sql if needed.
  // Actually, selecting and updating is fine here since traffic is low.
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
 */
export async function createMealPlan(data: InsertMealPlan): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mealPlans).values(data);
  return Number((result as any)[0]?.insertId ?? 0);
}

/**
 * 식단 플랜 상태 업데이트 (draft → confirmed)
 * 확정 시각도 함께 기록
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
 * 새 식단 생성 시 한 번에 31개 이하 레코드 삽입
 */
export async function insertMealDays(days: InsertMealDay[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (days.length === 0) return;
  await db.insert(mealDays).values(days);
}

/**
 * 특정 일자 식단 승인
 * - status: approved
 * - approvedAt: 현재 시각
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
 * - 새 meals 데이터로 업데이트
 * - status: replaced → pending (재검토 필요)
 *
 * 설계 결정: 교체 후 status를 'pending'으로 되돌리는 이유 -
 * 교체된 식단도 영양사가 다시 검토하고 승인해야 최종 확정이 가능하도록
 * 워크플로우를 강제함으로써 데이터 품질을 보장합니다.
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
 */
export async function createUploadedFile(data: InsertUploadedFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(uploadedFiles).values(data);
  return Number((result as any)[0]?.insertId ?? 0);
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
 * 토스페이먼츠 결제 요청 전 미리 생성
 */
export async function createSubscription(data: InsertSubscription): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data);
  return Number((result as any)[0]?.insertId ?? 0);
}

/**
 * 결제 완료 처리
 * - subscriptions 테이블: status → paid, paymentKey 저장
 * - users 테이블: plan → pro
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
