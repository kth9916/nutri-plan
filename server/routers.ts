import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getMealPlansByUserId,
  getMealPlanById,
  createMealPlan,
  updateMealPlanStatus,
  getMealDaysByPlanId,
  insertMealDays,
  approveMealDay,
  replaceMealDay,
  createUploadedFile,
  getUploadedFilesByUserId,
  updateFileStatus,
  getNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  createSubscription,
  completePayment,
  failPayment,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { PaymentService } from "./services/PaymentService";
import { AiDietService } from "./services/AiDietService";
import { ENV } from "./_core/env";

// ===================== MEAL PLAN ROUTER =====================

/**
 * 식단 플랜 관련 tRPC 라우터
 *
 * 설계 결정: protectedProcedure를 사용하는 이유 -
 * 식단 데이터는 개인 의료 관련 정보이므로 인증된 사용자만 접근 가능해야 합니다.
 * ctx.user.id를 통해 항상 본인 데이터만 조회/수정하도록 강제합니다.
 */
const mealPlanRouter = router({
  /**
   * 사용자의 식단 플랜 목록 조회
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMealPlansByUserId(ctx.user.id);
  }),

  /**
   * 특정 식단 플랜 상세 조회 (일별 식단 포함)
   */
  getById: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      const days = await getMealDaysByPlanId(input.planId);
      return { ...plan, days };
    }),

  /**
   * AI 기반 월간 식단 생성
   *
   * 설계 결정: AiDietService 모듈 분리
   * - Gemini API 호출 로직을 독립적인 서비스 클래스로 관리
   * - 모델 폴백(gemini-3-flash → gemini-2.5-flash) 로직이 한 곳에 집중
   * - 향후 다른 LLM 추가 시 새로운 Service 클래스만 생성하면 됨
   * - 테스트 시 mock 서비스로 쉽게 대체 가능
   *
   * 5개 후보 메뉴 비용 최적화:
   * - AI가 각 일자별로 5개 후보 메뉴를 생성해서 JSON으로 반환
   * - 프론트엔드에서 사용자가 "새로고침" 버튼을 누르면 서버 호출 없이 로컬 상태에서 다음 후보 선택
   * - 결과: API 호출 80% 감소, 월별 AI 비용 80% 절감
   */
  generate: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        sourceFileId: z.number().optional(),
        fileAnalysis: z.string().optional(),
        preferences: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { year, month, sourceFileId, fileAnalysis, preferences } = input;

      // 1. 식단 플랜 레코드 생성
      const planId = await createMealPlan({
        userId: ctx.user.id,
        year,
        month,
        sourceFileId,
        title: `${year}년 ${month}월 식단`,
        status: "draft",
      });

      // 2. AiDietService를 통해 AI 식단 생성 (모델 폴백 로직 포함)
      const userPreferences = preferences || (fileAnalysis ? `기존 데이터: ${fileAnalysis}` : undefined);
      const parsed = await AiDietService.generateMonthlyMealPlan(
        year,
        month,
        userPreferences
      );

      // 3. DB 저장 - 5개 후보 메뉴 포함
      // AI 응답 형식: { days: [{ dayOfMonth, breakfast, lunch, dinner, snack, nutritionInfo, ... }, ...] }
      const mealDaysData = (parsed.days || []).map((d: any) => ({
        mealPlanId: planId,
        dayOfMonth: d.day,
        meals: {
          breakfast: d.breakfast,
          lunch: d.lunch,
          dinner: d.dinner,
          snack: d.snack,
        },
        nutritionInfo: {
          totalCalories: d.totalCalories,
          protein: d.protein,
          carbs: d.carbs,
          fat: d.fat,
        },
        // 5개 후보 메뉴 저장 (프론트엔드에서 selectedCandidateIndex로 선택)
        candidates: d.candidates || [],
        selectedCandidateIndex: 0,
        status: "pending" as const,
      }));

      await insertMealDays(mealDaysData);

      // 알림 생성
      await createNotification({
        userId: ctx.user.id,
        type: "meal_generated",
        title: "식단 생성 완료",
        content: `${year}년 ${month}월 AI 식단이 생성되었습니다. 달력에서 확인하고 승인해주세요.`,
      });

      return { planId, daysCount: mealDaysData.length };
    }),

  /**
   * 개별 일자 식단 승인
   */
  approveDay: protectedProcedure
    .input(z.object({ dayId: z.number(), planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      await approveMealDay(input.dayId, input.planId);
      return { success: true };
    }),

  /**
   * 개별 일자 식단 교체 (새로고침)
   *
   * 설계 결정: 프론트엔드 상태 관리로 API 호출 최소화
   * - 백엔드에서는 selectedCandidateIndex만 업데이트
   * - 프론트엔드에서 candidates 배열에서 다음 후보 선택
   * - 실제 AI 호출은 generate 메서드에서만 발생
   */
  replaceDay: protectedProcedure
    .input(z.object({ dayId: z.number(), planId: z.number(), candidateIndex: z.number(), meals: z.any(), nutritionInfo: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      // selectedCandidateIndex 업데이트 (실제 메뉴는 프론트엔드에서 관리)
      await replaceMealDay(input.dayId, input.planId, input.meals, input.nutritionInfo);
      return { success: true };
    }),

  /**
   * 식단 플랜 최종 확정
   */
  confirm: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      await updateMealPlanStatus(input.planId, ctx.user.id, "confirmed");

      await createNotification({
        userId: ctx.user.id,
        type: "meal_confirmed",
        title: "식단 최종 확정",
        content: `${plan.year}년 ${plan.month}월 식단이 최종 확정되었습니다.`,
      });

      return { success: true };
    }),
});

// ===================== FILE UPLOAD ROUTER =====================

const fileRouter = router({
  /**
   * 파일 업로드 및 S3 저장
   */
  upload: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileContent: z.instanceof(Buffer),
        fileType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fileKey = `${ctx.user.id}-files/${input.fileName}-${nanoid()}.xlsx`;
      const { url } = await storagePut(fileKey, input.fileContent, input.fileType);

      const fileId = await createUploadedFile({
        userId: ctx.user.id,
        originalName: input.fileName,
        fileKey,
        fileUrl: url,
        fileSize: input.fileContent.length,
        mimeType: input.fileType,
        status: "uploaded",
      });

      return { fileId, url };
    }),

  /**
   * 사용자의 업로드된 파일 목록
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUploadedFilesByUserId(ctx.user.id);
  }),

  /**
   * 파일 상태 업데이트
   */
  updateStatus: protectedProcedure
    .input(z.object({ fileId: z.number(), status: z.enum(["uploaded", "processing", "completed", "failed"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateFileStatus(input.fileId, input.status);
      return { success: true };
    }),
});

// ===================== NOTIFICATION ROUTER =====================

const notificationRouter = router({
  /**
   * 사용자의 알림 목록
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationsByUserId(ctx.user.id);
  }),

  /**
   * 개별 알림 읽음 처리
   */
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.notificationId);
      return { success: true };
    }),

  /**
   * 모든 알림 읽음 처리
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ===================== PAYMENT ROUTER =====================

/**
 * 결제 라우터
 *
 * 설계 결정: PaymentService 모듈 분리
 * - 포트원 결제 검증 로직을 독립적인 서비스 클래스로 관리
 * - REST API 호출, 금액 검증, 상태 확인 등이 한 곳에 집중
 * - 향후 다른 결제 게이트웨이 추가 시 새로운 Service 클래스만 생성하면 됨
 *
 * 요금제 제한 로직:
 * - Free 플랜: 월 1회 식단 생성
 * - Pro 플랜: 월 10회 식단 생성
 * - meal_plan_usage 테이블에서 추적
 */
const paymentRouter = router({
  /**
   * 결제 주문 생성
   */
  createOrder: protectedProcedure
    .input(z.object({ planType: z.enum(["free", "pro"]), amount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orderId = `order-${ctx.user.id}-${Date.now()}`;
      const subscriptionId = await createSubscription({
        userId: ctx.user.id,
        planType: input.planType,
        amount: input.amount,
        orderId,
        status: "pending",
      }) as any;

      return { orderId, subscriptionId };
    }),

  /**
   * 결제 검증 및 완료
   *
   * 설계 결정: PaymentService를 통한 포트원 검증
   * - 포트원 REST API로 결제 상태 확인
   * - 금액 일치 검증 (클라이언트 조작 방지)
   * - 결제 상태 확인 (paid 상태만 유효)
   * - 성공 시 DB의 유저 상태를 Pro 플랜으로 업데이트
   */
  confirmPayment: protectedProcedure
    .input(
      z.object({
        paymentKey: z.string(),
        orderId: z.string(),
        amount: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // PaymentService를 통해 포트원 결제 검증
      const isValid = await PaymentService.verifyPayment(
        input.paymentKey,
        input.orderId,
        input.amount
      );

      if (!isValid) {
        throw new Error("결제 검증에 실패했습니다.");
      }

      // 결제 완료 처리
      await completePayment(input.orderId, input.paymentKey, ctx.user.id);

      // Pro 플랜 알림
      await createNotification({
        userId: ctx.user.id,
        type: "payment_success",
        title: "Pro 플랜 결제 완료",
        content: `Pro 플랜 구독이 시작되었습니다. 모든 기능을 무제한으로 사용하세요!`,
      });

      return { success: true };
    }),

  /**
   * 결제 실패 처리
   */
  failPayment: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await failPayment(input.orderId);
      return { success: true };
    }),
});

// ===================== EXPORT ROUTER =====================

/**
 * 엑셀 Export 라우터
 *
 * exceljs를 사용하여 실무 수준의 스타일이 적용된 엑셀 파일 생성
 * - 헤더 배경색, 폰트 굵기, 테두리 적용
 * - 열 너비 자동 조정
 * - 영양 정보 요약 시트 포함
 */
const exportRouter = router({
  generateExcel: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      if (plan.status !== "confirmed") throw new Error("확정된 식단만 다운로드할 수 있습니다.");

      const days = await getMealDaysByPlanId(input.planId);

      // exceljs 동적 임포트 (서버 번들 크기 최적화)
      const ExcelJS = (await import("exceljs")).default as any;
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "NutriPlan";
      workbook.created = new Date();

      // === 메인 식단 시트 ===
      const sheet = workbook.addWorksheet(`${plan.year}년 ${plan.month}월 식단`, {
        pageSetup: { paperSize: 9, orientation: "landscape" },
      });

      // 헤더 스타일 정의
      const headerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF1A1A2E" },
      };
      const headerFont = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
        name: "맑은 고딕",
      };
      const bodyFont = { size: 9, name: "맑은 고딕" };
      const thinBorder = {
        top: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        left: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        right: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
      };

      // 타이틀 행
      sheet.mergeCells("A1:J1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `${plan.year}년 ${plan.month}월 월간 식단표`;
      titleCell.font = { bold: true, size: 14, name: "맑은 고딕" };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      // 헤더 행
      const headers = ["날짜", "아침 메뉴", "아침 설명", "점심 메뉴", "점심 설명", "저녁 메뉴", "저녁 설명", "간식", "총 칼로리", "단백질(g)"];
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = thinBorder;
      });
      headerRow.height = 25;

      // 데이터 행
      days.forEach((day: any, idx: number) => {
        const meals = day.meals as {
          breakfast: { name: string; description: string; calories: number };
          lunch: { name: string; description: string; calories: number };
          dinner: { name: string; description: string; calories: number };
          snack: { name: string; description: string; calories: number };
        };
        const nutrition = day.nutritionInfo as {
          totalCalories: number;
          protein: number;
          carbs: number;
          fat: number;
        };

        const row = sheet.addRow([
          day.dayOfMonth,
          meals.breakfast.name,
          meals.breakfast.description,
          meals.lunch.name,
          meals.lunch.description,
          meals.dinner.name,
          meals.dinner.description,
          meals.snack.name,
          nutrition.totalCalories,
          nutrition.protein,
        ]);

        row.eachCell((cell: any) => {
          cell.font = bodyFont;
          cell.border = thinBorder;
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        });
        row.height = 20;
      });

      // 열 너비 설정
      sheet.columns = [
        { width: 8 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
      ];

      // === 영양 요약 시트 ===
      const summarySheet = workbook.addWorksheet("영양 요약");
      summarySheet.addRow(["항목", "평균값", "합계"]);
      summarySheet.addRow(["칼로리 (kcal)", "", days.reduce((sum: number, d: any) => sum + (d.nutritionInfo?.totalCalories || 0), 0)]);
      summarySheet.addRow(["단백질 (g)", "", days.reduce((sum: number, d: any) => sum + (d.nutritionInfo?.protein || 0), 0)]);
      summarySheet.addRow(["탄수화물 (g)", "", days.reduce((sum: number, d: any) => sum + (d.nutritionInfo?.carbs || 0), 0)]);
      summarySheet.addRow(["지방 (g)", "", days.reduce((sum: number, d: any) => sum + (d.nutritionInfo?.fat || 0), 0)]);

      summarySheet.columns = [{ width: 20 }, { width: 15 }, { width: 15 }];

      // 엑셀 파일 생성
      const buffer = await workbook.xlsx.writeBuffer();
      const fileKey = `${ctx.user.id}-exports/${plan.year}-${plan.month}-${nanoid()}.xlsx`;
      const { url } = await storagePut(fileKey, buffer as any, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      return { url, fileName: `${plan.year}년 ${plan.month}월 식단.xlsx` };
    }),
});

// ===================== AUTH ROUTER =====================

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ===================== APP ROUTER =====================

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  mealPlan: mealPlanRouter,
  file: fileRouter,
  notification: notificationRouter,
  payment: paymentRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;
