import {
  serial,
  pgTable,
  pgEnum,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  integer,
  numeric,
  unique,
} from "drizzle-orm/pg-core";

// ===================== ENUMS =====================
// PostgreSQL에서는 enum을 테이블 밖에서 먼저 선언해야 합니다.

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const planEnum = pgEnum("plan", ["free", "pro"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
]);
export const fileStatusEnum = pgEnum("file_status", [
  "uploaded",
  "processing",
  "completed",
  "failed",
]);
export const mealPlanStatusEnum = pgEnum("meal_plan_status", [
  "draft",
  "confirmed",
]);
export const mealDayStatusEnum = pgEnum("meal_day_status", [
  "pending",
  "approved",
  "replaced",
]);

// ===================== TABLES =====================

/**
 * Core user table backing auth flow.
 * role: 'user' | 'admin' 으로 관리자 권한 분리
 * plan: 'free' | 'pro' 로 구독 플랜 관리
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  workplaceCategory: varchar("workplaceCategory", { length: 128 }),
  role: roleEnum("role").default("user").notNull(),
  /**
   * 구독 플랜: free(무료) / pro(유료)
   * 결제 완료 시 pro로 업데이트됨
   */
  plan: planEnum("plan").default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 구독 결제 내역 테이블
 * 토스페이먼츠 결제 완료 후 저장
 */
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  orderId: varchar("orderId", { length: 128 }).notNull().unique(),
  paymentKey: varchar("paymentKey", { length: 256 }),
  plan: planEnum("plan").default("pro").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: subscriptionStatusEnum("status").default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * 업로드된 엑셀 파일 메타데이터 테이블
 * 실제 파일 바이트는 S3에 저장, 여기서는 메타데이터만 관리
 */
export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  status: fileStatusEnum("status").default("uploaded").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = typeof uploadedFiles.$inferInsert;

/**
 * 월간 식단 플랜 테이블
 * 한 달 단위의 식단 계획을 관리
 */
export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  sourceFileId: integer("sourceFileId").references(() => uploadedFiles.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  title: varchar("title", { length: 255 }),
  requestPrompt: text("requestPrompt"),
  status: mealPlanStatusEnum("status").default("draft").notNull(),
  exportFileKey: varchar("exportFileKey", { length: 512 }),
  exportFileUrl: text("exportFileUrl"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;

/**
 * 일별 식단 항목 테이블
 * 각 날짜별 아침/점심/저녁/간식 메뉴를 JSON으로 저장
 */
export const mealDays = pgTable("meal_days", {
  id: serial("id").primaryKey(),
  mealPlanId: integer("mealPlanId")
    .notNull()
    .references(() => mealPlans.id),
  dayOfMonth: integer("dayOfMonth").notNull(),
  meals: json("meals").notNull(),
  candidates: json("candidates"),
  selectedCandidateIndex: integer("selectedCandidateIndex").default(0).notNull(),
  nutritionInfo: json("nutritionInfo"),
  status: mealDayStatusEnum("status").default("pending").notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MealDay = typeof mealDays.$inferSelect;
export type InsertMealDay = typeof mealDays.$inferInsert;

/**
 * 인앱 알림 테이블
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * 월별 식단 생성 횟수 추적 테이블
 */
export const mealPlanUsage = pgTable("meal_plan_usage", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  generationCount: integer("generationCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MealPlanUsage = typeof mealPlanUsage.$inferSelect;
export type InsertMealPlanUsage = typeof mealPlanUsage.$inferInsert;

/**
 * 일별 AI 사용량 추적 테이블
 * - date: YYYY-MM-DD 형식
 * - Free: 일일 식단 생성 1회, 교환 5회 제한
 * - Pro: 일일 식단 생성 10회, 교환 50회 제한
 */
export const userDailyUsage = pgTable("user_daily_usage", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(),
  generationCount: integer("generationCount").default(0).notNull(),
  exchangeCount: integer("exchangeCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: unique("user_date_idx").on(table.userId, table.date),
}));

export type UserDailyUsage = typeof userDailyUsage.$inferSelect;
export type InsertUserDailyUsage = typeof userDailyUsage.$inferInsert;
