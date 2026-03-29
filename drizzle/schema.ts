import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * role: 'user' | 'admin' 으로 관리자 권한 분리
 * plan: 'free' | 'pro' 로 구독 플랜 관리
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /**
   * 구독 플랜: free(무료) / pro(유료)
   * 결제 완료 시 pro로 업데이트됨
   */
  plan: mysqlEnum("plan", ["free", "pro"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 구독 결제 내역 테이블
 * 토스페이먼츠 결제 완료 후 저장
 * - orderId: 토스페이먼츠 주문 ID (클라이언트에서 생성)
 * - paymentKey: 토스페이먼츠 결제 키 (결제 승인 후 반환)
 * - amount: 결제 금액
 * - status: 결제 상태 (pending → paid | failed)
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  orderId: varchar("orderId", { length: 128 }).notNull().unique(),
  paymentKey: varchar("paymentKey", { length: 256 }),
  plan: mysqlEnum("plan", ["free", "pro"]).default("pro").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "failed", "cancelled"])
    .default("pending")
    .notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * 업로드된 엑셀 파일 메타데이터 테이블
 * 실제 파일 바이트는 S3에 저장, 여기서는 메타데이터만 관리
 * - fileKey: S3 오브젝트 키
 * - fileUrl: S3 공개 URL (CDN)
 * - originalName: 원본 파일명
 * - fileSize: 파일 크기 (bytes)
 * - status: 처리 상태 (uploaded → processing → completed | failed)
 */
export const uploadedFiles = mysqlTable("uploaded_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["uploaded", "processing", "completed", "failed"])
    .default("uploaded")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = typeof uploadedFiles.$inferInsert;

/**
 * 월간 식단 플랜 테이블
 * 한 달 단위의 식단 계획을 관리
 * - year/month: 식단 대상 연월
 * - status: draft(초안) → confirmed(최종 확정)
 * - sourceFileId: 분석에 사용된 엑셀 파일 ID
 * - exportFileKey: 다운로드용 엑셀 파일 S3 키
 */
export const mealPlans = mysqlTable("meal_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  sourceFileId: int("sourceFileId").references(() => uploadedFiles.id),
  year: int("year").notNull(),
  month: int("month").notNull(),
  title: varchar("title", { length: 255 }),
  status: mysqlEnum("status", ["draft", "confirmed"])
    .default("draft")
    .notNull(),
  exportFileKey: varchar("exportFileKey", { length: 512 }),
  exportFileUrl: text("exportFileUrl"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;

/**
 * 일별 식단 항목 테이블
 * 각 날짜별 아침/점심/저녁/간식 메뉴를 JSON으로 저장
 * - dayOfMonth: 해당 월의 일자 (1~31)
 * - meals: { breakfast, lunch, dinner, snack } JSON 구조
 * - nutritionInfo: 영양 정보 JSON (칼로리, 단백질, 탄수화물, 지방)
 * - status: pending(대기) → approved(승인) | replaced(교체됨)
 * - approvedAt: 승인 시각
 *
 * 설계 결정: meals를 JSON 컬럼으로 저장하는 이유 -
 * 식단 구성이 유연하게 변경될 수 있고(간식 추가, 메뉴 항목 수 변동),
 * 개별 식사 항목에 대한 쿼리 필요성이 낮아 JSON이 적합.
 * 향후 검색 필요 시 Generated Column으로 인덱싱 가능.
 */
export const mealDays = mysqlTable("meal_days", {
  id: int("id").autoincrement().primaryKey(),
  mealPlanId: int("mealPlanId")
    .notNull()
    .references(() => mealPlans.id),
  dayOfMonth: int("dayOfMonth").notNull(),
  /**
   * meals JSON 구조:
   * {
   *   breakfast: { name: string, description: string, calories: number },
   *   lunch: { name: string, description: string, calories: number },
   *   dinner: { name: string, description: string, calories: number },
   *   snack?: { name: string, description: string, calories: number }
   * }
   */
  meals: json("meals").notNull(),
  /**
   * nutritionInfo JSON 구조:
   * { totalCalories: number, protein: number, carbs: number, fat: number, fiber: number }
   */
  nutritionInfo: json("nutritionInfo"),
  status: mysqlEnum("status", ["pending", "approved", "replaced"])
    .default("pending")
    .notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MealDay = typeof mealDays.$inferSelect;
export type InsertMealDay = typeof mealDays.$inferInsert;

/**
 * 인앱 알림 테이블
 * 식단 확정, 결제 완료 등 중요 이벤트 알림 저장
 * - type: 알림 유형 (meal_confirmed, payment_success, etc.)
 * - isRead: 읽음 여부
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
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
