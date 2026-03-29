import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * NutriPlan 핵심 비즈니스 로직 테스트
 *
 * 테스트 전략:
 * - DB 및 LLM 호출은 Mock으로 대체 (단위 테스트 원칙)
 * - 실제 비즈니스 로직 (권한 검증, 상태 전이) 위주로 테스트
 * - 통합 테스트는 별도 e2e 테스트로 분리 권장
 */

// ===================== Mock 설정 =====================

vi.mock("./db", () => ({
  getMealPlansByUserId: vi.fn(),
  getMealPlanById: vi.fn(),
  createMealPlan: vi.fn(),
  updateMealPlanStatus: vi.fn(),
  getMealDaysByPlanId: vi.fn(),
  insertMealDays: vi.fn(),
  approveMealDay: vi.fn(),
  replaceMealDay: vi.fn(),
  createUploadedFile: vi.fn(),
  getUploadedFilesByUserId: vi.fn(),
  updateFileStatus: vi.fn(),
  getNotificationsByUserId: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  createNotification: vi.fn(),
  createSubscription: vi.fn(),
  completePayment: vi.fn(),
  failPayment: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.xlsx", key: "test-key" }),
}));

// ===================== 테스트 유틸리티 =====================

function createMockContext(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user-openid",
    email: "test@nutriplan.com",
    name: "테스트 영양사",
    loginMethod: "manus",
    role: "user" as const,
    plan: "free" as const,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    lastSignedIn: new Date("2024-01-01"),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ===================== 인증 테스트 =====================

describe("auth.logout", () => {
  it("로그아웃 시 세션 쿠키를 삭제하고 성공을 반환해야 한다", async () => {
    const { ctx } = { ctx: createMockContext() };
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    ctx.res.clearCookie = (name: string, options: Record<string, unknown>) => {
      clearedCookies.push({ name, options });
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBe(1);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ===================== 식단 플랜 테스트 =====================

describe("mealPlan.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("인증된 사용자의 식단 플랜 목록을 반환해야 한다", async () => {
    const { getMealPlansByUserId } = await import("./db");
    const mockPlans = [
      {
        id: 1,
        userId: 1,
        year: 2024,
        month: 1,
        title: "2024년 1월 식단",
        status: "draft" as const,
        sourceFileId: null,
        exportFileKey: null,
        exportFileUrl: null,
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(getMealPlansByUserId).mockResolvedValue(mockPlans);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mealPlan.list();

    expect(result).toEqual(mockPlans);
    expect(getMealPlansByUserId).toHaveBeenCalledWith(1);
  });
});

describe("mealPlan.approveDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("플랜 소유자가 일자 승인을 할 수 있어야 한다", async () => {
    const { getMealPlanById, approveMealDay } = await import("./db");
    const mockPlan = {
      id: 10,
      userId: 1,
      year: 2024,
      month: 1,
      title: "테스트 식단",
      status: "draft" as const,
      sourceFileId: null,
      exportFileKey: null,
      exportFileUrl: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getMealPlanById).mockResolvedValue(mockPlan);
    vi.mocked(approveMealDay).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mealPlan.approveDay({ dayId: 5, planId: 10 });

    expect(result).toEqual({ success: true });
    expect(approveMealDay).toHaveBeenCalledWith(5, 10);
  });

  it("다른 사용자의 플랜은 승인할 수 없어야 한다", async () => {
    const { getMealPlanById } = await import("./db");
    // 다른 사용자 소유 플랜 → undefined 반환
    vi.mocked(getMealPlanById).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.mealPlan.approveDay({ dayId: 5, planId: 99 })).rejects.toThrow("권한이 없습니다.");
  });
});

describe("mealPlan.confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("모든 일자가 승인된 경우 최종 확정이 가능해야 한다", async () => {
    const { getMealPlanById, getMealDaysByPlanId, updateMealPlanStatus, createNotification } = await import("./db");
    const mockPlan = {
      id: 10,
      userId: 1,
      year: 2024,
      month: 1,
      title: "테스트 식단",
      status: "draft" as const,
      sourceFileId: null,
      exportFileKey: null,
      exportFileUrl: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockDays = Array.from({ length: 31 }, (_, i) => ({
      id: i + 1,
      mealPlanId: 10,
      dayOfMonth: i + 1,
      meals: {},
      nutritionInfo: null,
      status: "approved" as const, // 모두 승인됨
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    vi.mocked(getMealPlanById).mockResolvedValue(mockPlan);
    vi.mocked(getMealDaysByPlanId).mockResolvedValue(mockDays);
    vi.mocked(updateMealPlanStatus).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mealPlan.confirm({ planId: 10 });

    expect(result).toEqual({ success: true });
    expect(updateMealPlanStatus).toHaveBeenCalledWith(10, 1, "confirmed");
  });

  it("미승인 일자가 있으면 최종 확정이 불가해야 한다", async () => {
    const { getMealPlanById, getMealDaysByPlanId } = await import("./db");
    const mockPlan = {
      id: 10,
      userId: 1,
      year: 2024,
      month: 1,
      title: "테스트 식단",
      status: "draft" as const,
      sourceFileId: null,
      exportFileKey: null,
      exportFileUrl: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockDays = [
      { id: 1, mealPlanId: 10, dayOfMonth: 1, meals: {}, nutritionInfo: null, status: "approved" as const, approvedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 2, mealPlanId: 10, dayOfMonth: 2, meals: {}, nutritionInfo: null, status: "pending" as const, approvedAt: null, createdAt: new Date(), updatedAt: new Date() }, // 미승인
    ];

    vi.mocked(getMealPlanById).mockResolvedValue(mockPlan);
    vi.mocked(getMealDaysByPlanId).mockResolvedValue(mockDays);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.mealPlan.confirm({ planId: 10 })).rejects.toThrow(
      "모든 일자의 식단을 승인해야 최종 확정할 수 있습니다."
    );
  });
});

// ===================== 결제 테스트 =====================

describe("payment.createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Pro 플랜 주문 생성 시 orderId와 amount를 반환해야 한다", async () => {
    const { createSubscription } = await import("./db");
    vi.mocked(createSubscription).mockResolvedValue(1);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payment.createOrder({ plan: "pro" });

    expect(result.orderId).toMatch(/^NP-/);
    expect(result.amount).toBe(29000);
    expect(createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        plan: "pro",
        amount: "29000",
        status: "pending",
      })
    );
  });
});

// ===================== 알림 테스트 =====================

describe("notification.markAllRead", () => {
  it("모든 알림을 읽음 처리해야 한다", async () => {
    const { markAllNotificationsRead } = await import("./db");
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notification.markAllRead();

    expect(result).toEqual({ success: true });
    expect(markAllNotificationsRead).toHaveBeenCalledWith(1);
  });
});
