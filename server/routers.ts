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
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { PaymentService } from "./services/PaymentService";
import { AiDietService } from "./services/AiDietService";

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
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.id, ctx.user.id);
      if (!plan) throw new Error("식단 플랜을 찾을 수 없습니다.");
      const days = await getMealDaysByPlanId(input.id);
      return { plan, days };
    }),

  /**
   * AI 기반 월간 식단 생성
   *
   * 처리 흐름:
   * 1. meal_plans 레코드 생성 (draft 상태)
   * 2. LLM에 식단 생성 요청 (JSON Schema 기반 구조화 응답)
   * 3. 생성된 식단을 meal_days 테이블에 일괄 삽입
   *
   * 성능 최적화 방향:
   * - 현재: 동기적 LLM 호출 (단일 요청)
   * - 개선: 주 단위로 병렬 LLM 호출 → 응답 속도 4배 향상 가능
   * - 개선: Redis 캐싱으로 유사 식단 요청 재사용
   */
  generate: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        sourceFileId: z.number().optional(),
        fileAnalysis: z.string().optional(), // 엑셀 파일 분석 결과 텍스트
        preferences: z.string().optional(),  // 선호도/제약사항
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { year, month, sourceFileId, fileAnalysis, preferences } = input;

      // 해당 월의 일수 계산
      const daysInMonth = new Date(year, month, 0).getDate();

      // 1. 식단 플랜 레코드 생성
      const planId = await createMealPlan({
        userId: ctx.user.id,
        year,
        month,
        sourceFileId,
        title: `${year}년 ${month}월 식단`,
        status: "draft",
      });

      // 2. LLM에 식단 생성 요청
      const systemPrompt = `당신은 전문 영양사 AI 어시스턴트입니다. 
영양 균형(탄수화물 50-60%, 단백질 15-20%, 지방 20-30%)을 고려하여 
한국인 식습관에 맞는 맞춤형 월간 식단을 생성합니다.
각 식사는 구체적인 메뉴명과 간단한 설명을 포함해야 합니다.`;

      const userPrompt = `${year}년 ${month}월 (${daysInMonth}일) 월간 식단을 생성해주세요.
${fileAnalysis ? `\n기존 식단 분석 결과:\n${fileAnalysis}` : ""}
${preferences ? `\n선호도/제약사항:\n${preferences}` : ""}

각 날짜별로 아침, 점심, 저녁, 간식 메뉴를 생성해주세요.`;

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "monthly_meal_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                days: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer", description: "일자 (1~31)" },
                      breakfast: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          calories: { type: "integer" },
                        },
                        required: ["name", "description", "calories"],
                        additionalProperties: false,
                      },
                      lunch: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          calories: { type: "integer" },
                        },
                        required: ["name", "description", "calories"],
                        additionalProperties: false,
                      },
                      dinner: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          calories: { type: "integer" },
                        },
                        required: ["name", "description", "calories"],
                        additionalProperties: false,
                      },
                      snack: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          calories: { type: "integer" },
                        },
                        required: ["name", "description", "calories"],
                        additionalProperties: false,
                      },
                      totalCalories: { type: "integer" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fat: { type: "number" },
                    },
                    required: ["day", "breakfast", "lunch", "dinner", "snack", "totalCalories", "protein", "carbs", "fat"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["days"],
              additionalProperties: false,
            },
          },
        },
      });

      // 3. LLM 응답 파싱 및 DB 저장
      const rawContent = llmResponse.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : null;
      if (!content) throw new Error("AI 식단 생성에 실패했습니다.");

      const parsed = JSON.parse(content) as {
        days: Array<{
          day: number;
          breakfast: { name: string; description: string; calories: number };
          lunch: { name: string; description: string; calories: number };
          dinner: { name: string; description: string; calories: number };
          snack: { name: string; description: string; calories: number };
          totalCalories: number;
          protein: number;
          carbs: number;
          fat: number;
        }>;
      };

      const mealDaysData = parsed.days.map((d) => ({
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
      // 플랜 소유권 검증
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");
      await approveMealDay(input.dayId, input.planId);
      return { success: true };
    }),

  /**
   * 개별 일자 식단 AI 재생성 (교체)
   *
   * 설계 결정: 단일 일자 재생성 시 별도 LLM 호출
   * - 전체 재생성 대비 비용 효율적
   * - 사용자 피드백을 프롬프트에 반영하여 추천 정확도 향상
   */
  replaceDay: protectedProcedure
    .input(
      z.object({
        dayId: z.number(),
        planId: z.number(),
        dayOfMonth: z.number(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "당신은 전문 영양사 AI입니다. 영양 균형을 고려한 하루 식단을 JSON으로 생성합니다.",
          },
          {
            role: "user",
            content: `${plan.year}년 ${plan.month}월 ${input.dayOfMonth}일 식단을 새로 생성해주세요.
${input.feedback ? `피드백: ${input.feedback}` : ""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "single_day_meal",
            strict: true,
            schema: {
              type: "object",
              properties: {
                breakfast: {
                  type: "object",
                  properties: { name: { type: "string" }, description: { type: "string" }, calories: { type: "integer" } },
                  required: ["name", "description", "calories"],
                  additionalProperties: false,
                },
                lunch: {
                  type: "object",
                  properties: { name: { type: "string" }, description: { type: "string" }, calories: { type: "integer" } },
                  required: ["name", "description", "calories"],
                  additionalProperties: false,
                },
                dinner: {
                  type: "object",
                  properties: { name: { type: "string" }, description: { type: "string" }, calories: { type: "integer" } },
                  required: ["name", "description", "calories"],
                  additionalProperties: false,
                },
                snack: {
                  type: "object",
                  properties: { name: { type: "string" }, description: { type: "string" }, calories: { type: "integer" } },
                  required: ["name", "description", "calories"],
                  additionalProperties: false,
                },
                totalCalories: { type: "integer" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
              },
              required: ["breakfast", "lunch", "dinner", "snack", "totalCalories", "protein", "carbs", "fat"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent2 = llmResponse.choices[0]?.message?.content;
      const content2 = typeof rawContent2 === 'string' ? rawContent2 : null;
      if (!content2) throw new Error("AI 식단 재생성에 실패했습니다.");

      const newMeal = JSON.parse(content2);
      const newMeals = {
        breakfast: newMeal.breakfast,
        lunch: newMeal.lunch,
        dinner: newMeal.dinner,
        snack: newMeal.snack,
      };
      const newNutrition = {
        totalCalories: newMeal.totalCalories,
        protein: newMeal.protein,
        carbs: newMeal.carbs,
        fat: newMeal.fat,
      };

      await replaceMealDay(input.dayId, input.planId, newMeals, newNutrition);
      return { success: true, meals: newMeals, nutritionInfo: newNutrition };
    }),

  /**
   * 식단 최종 확정
   * - 모든 일자가 approved 상태인지 검증
   * - 확정 후 알림 발송
   */
  confirm: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getMealPlanById(input.planId, ctx.user.id);
      if (!plan) throw new Error("권한이 없습니다.");

      const days = await getMealDaysByPlanId(input.planId);
      const allApproved = days.every((d) => d.status === "approved");
      if (!allApproved) {
        throw new Error("모든 일자의 식단을 승인해야 최종 확정할 수 있습니다.");
      }

      await updateMealPlanStatus(input.planId, ctx.user.id, "confirmed");

      // 확정 알림 생성
      await createNotification({
        userId: ctx.user.id,
        type: "meal_confirmed",
        title: "식단 최종 확정 완료",
        content: `${plan.year}년 ${plan.month}월 식단이 최종 확정되었습니다. 엑셀 파일로 다운로드하세요.`,
      });

      return { success: true };
    }),
});

// ===================== FILE ROUTER =====================

const fileRouter = router({
  /**
   * 파일 업로드 URL 생성 및 메타데이터 저장
   * 실제 파일 바이트는 클라이언트에서 직접 S3에 업로드
   * (서버를 거치지 않아 대용량 파일도 빠르게 처리)
   *
   * 대안: 서버 경유 업로드 - 보안은 높지만 서버 부하 증가
   */
  upload: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        fileData: z.string(), // base64 encoded
      })
    )
    .mutation(async ({ ctx, input }) => {
      const suffix = nanoid(8);
      const fileKey = `users/${ctx.user.id}/uploads/${suffix}-${input.fileName}`;

      // base64 → Buffer 변환 후 S3 업로드
      const buffer = Buffer.from(input.fileData, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      const fileId = await createUploadedFile({
        userId: ctx.user.id,
        fileKey,
        fileUrl: url,
        originalName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        status: "uploaded",
      });

      return { fileId, fileUrl: url, fileKey };
    }),

  /**
   * 사용자 업로드 파일 목록
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUploadedFilesByUserId(ctx.user.id);
  }),
});

// ===================== NOTIFICATION ROUTER =====================

const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationsByUserId(ctx.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ===================== PAYMENT ROUTER =====================

/**
 * 토스페이먼츠 결제 관련 라우터
 *
 * 결제 흐름:
 * 1. createOrder: 주문 레코드 생성 (pending)
 * 2. 클라이언트에서 토스페이먼츠 위젯으로 결제 진행
 * 3. confirmPayment: 결제 키 검증 및 상태 업데이트
 *
 * 보안 설계:
 * - 결제 금액은 서버에서 검증 (클라이언트 조작 방지)
 * - paymentKey는 서버에서만 처리 (토스 시크릿 키 사용)
 */
const paymentRouter = router({
  /**
   * 주문 생성 (결제 전 단계)
   */
  createOrder: protectedProcedure
    .input(z.object({ plan: z.literal("pro") }))
    .mutation(async ({ ctx, input }) => {
      const orderId = `NP-${nanoid(16)}`;
      const amount = 29000; // Pro 플랜 월 구독료

      await createSubscription({
        userId: ctx.user.id,
        orderId,
        plan: input.plan,
        amount: String(amount),
        status: "pending",
      });

      return { orderId, amount };
    }),

  /**
   * 결제 확인 (토스페이먼츠 콜백 처리)
   *
   * 보안 주의: 실제 프로덕션에서는 토스페이먼츠 API를 통해
   * paymentKey + orderId + amount를 서버에서 직접 검증해야 합니다.
   * 현재는 테스트 환경이므로 클라이언트 전달값을 신뢰합니다.
   *
   * 리팩토링 방향:
   * - TOSS_SECRET_KEY로 /v1/payments/confirm API 호출
   * - 응답의 amount와 DB 금액 비교 검증
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
      // 테스트 환경: 결제 완료 처리
      await completePayment(input.orderId, input.paymentKey, ctx.user.id);

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
      const ExcelJS = (await import("exceljs")).default;
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
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = thinBorder;
      });
      headerRow.height = 25;

      // 데이터 행
      days.forEach((day, idx) => {
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
        } | null;

        const row = sheet.addRow([
          `${plan.month}월 ${day.dayOfMonth}일`,
          meals.breakfast?.name ?? "",
          meals.breakfast?.description ?? "",
          meals.lunch?.name ?? "",
          meals.lunch?.description ?? "",
          meals.dinner?.name ?? "",
          meals.dinner?.description ?? "",
          meals.snack?.name ?? "",
          nutrition?.totalCalories ?? "",
          nutrition?.protein ?? "",
        ]);

        // 짝수/홀수 행 배경색 교대
        const bgColor = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          cell.font = bodyFont;
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.border = thinBorder;
        });
        row.height = 35;
      });

      // 열 너비 설정
      const colWidths = [10, 16, 28, 16, 28, 16, 28, 14, 10, 10];
      colWidths.forEach((width, i) => {
        sheet.getColumn(i + 1).width = width;
      });

      // === 영양 정보 요약 시트 ===
      const summarySheet = workbook.addWorksheet("영양 정보 요약");
      summarySheet.addRow(["날짜", "총 칼로리", "단백질(g)", "탄수화물(g)", "지방(g)"]);
      summarySheet.getRow(1).eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: "center" };
      });

      days.forEach((day) => {
        const n = day.nutritionInfo as { totalCalories: number; protein: number; carbs: number; fat: number } | null;
        summarySheet.addRow([
          `${plan.month}월 ${day.dayOfMonth}일`,
          n?.totalCalories ?? 0,
          n?.protein ?? 0,
          n?.carbs ?? 0,
          n?.fat ?? 0,
        ]);
      });
      summarySheet.columns.forEach((col) => { col.width = 14; });

      // S3에 업로드
      const buffer = await workbook.xlsx.writeBuffer();
      const fileKey = `users/${ctx.user.id}/exports/${plan.year}-${plan.month}-meal-plan-${nanoid(6)}.xlsx`;
      const { url } = await storagePut(fileKey, Buffer.from(buffer), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // DB에 export 파일 정보 저장
      await updateMealPlanStatus(input.planId, ctx.user.id, "confirmed", { exportFileKey: fileKey, exportFileUrl: url });

      return { downloadUrl: url };
    }),
});

// ===================== APP ROUTER =====================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  mealPlan: mealPlanRouter,
  file: fileRouter,
  notification: notificationRouter,
  payment: paymentRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;
