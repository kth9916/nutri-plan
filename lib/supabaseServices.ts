/**
 * Supabase 데이터 서비스 모듈
 * 
 * 아키텍처 설계:
 * - 모든 데이터베이스 작업을 한 곳에 모아 관리
 * - 각 함수는 단일 책임 원칙(SRP) 준수
 * - 에러 핸들링과 타입 안정성 강화
 * - 프론트엔드에서 직접 호출 가능 (Server Actions 또는 API Routes)
 * 
 * 이 방식을 선택한 이유:
 * 1. 단순성: tRPC 같은 복잡한 추상화 제거
 * 2. 명확성: 각 함수가 정확히 무엇을 하는지 명확
 * 3. 유지보수성: 데이터 로직이 한 곳에 집중
 * 4. 재사용성: 여러 페이지에서 동일한 함수 사용 가능
 */

import { supabase, getSupabaseAdmin } from "./supabase";
import type {
  MealPlan,
  MealDay,
  Subscription,
  Notification,
  MealPlanUsage,
  User,
} from "@/shared/types";

// ============================================================================
// 식단 계획 관련 함수
// ============================================================================

/**
 * 사용자의 모든 식단 계획 조회
 * @param userId - 사용자 ID
 * @returns 식단 계획 배열
 */
export async function getMealPlans(userId: string): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`식단 계획 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * 특정 월의 식단 계획 조회 (없으면 생성)
 * @param userId - 사용자 ID
 * @param year - 연도
 * @param month - 월
 * @returns 식단 계획
 */
export async function getOrCreateMealPlan(
  userId: string,
  year: number,
  month: number
): Promise<MealPlan> {
  // 기존 식단 계획 확인
  const { data: existing, error: selectError } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .single();

  if (!selectError && existing) {
    return existing;
  }

  // 새 식단 계획 생성
  const { data: newPlan, error: insertError } = await supabase
    .from("meal_plans")
    .insert([
      {
        user_id: userId,
        year,
        month,
        status: "generating",
      },
    ])
    .select()
    .single();

  if (insertError) throw new Error(`식단 계획 생성 실패: ${insertError.message}`);
  return newPlan;
}

/**
 * 식단 계획 상태 업데이트
 * @param planId - 식단 계획 ID
 * @param status - 새 상태 ('generating' | 'pending_review' | 'confirmed')
 */
export async function updateMealPlanStatus(
  planId: number,
  status: "generating" | "pending_review" | "confirmed"
): Promise<void> {
  const { error } = await supabase
    .from("meal_plans")
    .update({
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .eq("id", planId);

  if (error) throw new Error(`식단 계획 상태 업데이트 실패: ${error.message}`);
}

// ============================================================================
// 일자별 식단 관련 함수
// ============================================================================

/**
 * 특정 식단 계획의 모든 일자 식단 조회
 * @param planId - 식단 계획 ID
 * @returns 일자별 식단 배열
 */
export async function getMealDays(planId: number): Promise<MealDay[]> {
  const { data, error } = await supabase
    .from("meal_days")
    .select("*")
    .eq("meal_plan_id", planId)
    .order("day_of_month", { ascending: true });

  if (error) throw new Error(`일자별 식단 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * 일자별 식단 생성 (5개 후보 메뉴 포함)
 * @param planId - 식단 계획 ID
 * @param dayOfMonth - 월의 일자 (1-31)
 * @param meals - 식단 정보
 * @param nutritionInfo - 영양 정보
 * @param candidates - 5개 후보 메뉴 배열
 */
export async function createMealDay(
  planId: number,
  dayOfMonth: number,
  meals: any,
  nutritionInfo: any,
  candidates: any[]
): Promise<MealDay> {
  const { data, error } = await supabase
    .from("meal_days")
    .insert([
      {
        meal_plan_id: planId,
        day_of_month: dayOfMonth,
        meals,
        nutrition_info: nutritionInfo,
        candidates,
        selected_candidate_index: 0,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`일자별 식단 생성 실패: ${error.message}`);
  return data;
}

/**
 * 일자별 식단 승인
 * @param mealDayId - 일자별 식단 ID
 */
export async function approveMealDay(mealDayId: number): Promise<void> {
  const { error } = await supabase
    .from("meal_days")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", mealDayId);

  if (error) throw new Error(`식단 승인 실패: ${error.message}`);
}

/**
 * 일자별 식단 후보 메뉴 변경 (새로고침)
 * 프론트엔드에서만 호출 - 로컬 상태에서 다음 후보로 변경
 * @param mealDayId - 일자별 식단 ID
 * @param nextCandidateIndex - 다음 후보 인덱스 (0-4)
 */
export async function selectMealDayCandidate(
  mealDayId: number,
  nextCandidateIndex: number
): Promise<void> {
  if (nextCandidateIndex < 0 || nextCandidateIndex > 4) {
    throw new Error("후보 인덱스는 0-4 범위여야 합니다");
  }

  const { data: mealDay, error: fetchError } = await supabase
    .from("meal_days")
    .select("*")
    .eq("id", mealDayId)
    .single();

  if (fetchError) throw new Error(`식단 조회 실패: ${fetchError.message}`);

  const candidates = mealDay.candidates || [];
  if (nextCandidateIndex >= candidates.length) {
    throw new Error("선택할 수 없는 후보입니다");
  }

  // 선택된 후보의 식단을 현재 식단으로 업데이트
  const selectedCandidate = candidates[nextCandidateIndex];
  const { error: updateError } = await supabase
    .from("meal_days")
    .update({
      meals: selectedCandidate.meals,
      nutrition_info: selectedCandidate.nutrition_info,
      selected_candidate_index: nextCandidateIndex,
      status: "replaced",
    })
    .eq("id", mealDayId);

  if (updateError) throw new Error(`식단 변경 실패: ${updateError.message}`);
}

// ============================================================================
// 구독 관련 함수
// ============================================================================

/**
 * 사용자의 구독 정보 조회
 * @param userId - 사용자 ID
 * @returns 구독 정보
 */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found (정상)
    throw new Error(`구독 정보 조회 실패: ${error.message}`);
  }

  return data || null;
}

/**
 * 구독 정보 생성 또는 업데이트 (결제 완료 후 호출)
 * 서버사이드에서만 호출 (Service Role Key 필요)
 * @param userId - 사용자 ID
 * @param planType - 플랜 타입 ('free' | 'pro')
 */
export async function upsertSubscription(
  userId: string,
  planType: "free" | "pro"
): Promise<Subscription> {
  const admin = getSupabaseAdmin();

  // 기존 구독 확인
  const { data: existing } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    // 기존 구독 업데이트
    const { data, error } = await admin
      .from("subscriptions")
      .update({
        plan_type: planType,
        status: "active",
        expires_at: null, // Pro 플랜은 만료 없음
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`구독 업데이트 실패: ${error.message}`);
    return data;
  } else {
    // 새 구독 생성
    const { data, error } = await admin
      .from("subscriptions")
      .insert([
        {
          user_id: userId,
          plan_type: planType,
          status: "active",
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`구독 생성 실패: ${error.message}`);
    return data;
  }
}

/**
 * 사용자 프로필의 subscription_plan 업데이트
 * @param userId - 사용자 ID
 * @param planType - 플랜 타입 ('free' | 'pro')
 */
export async function updateUserSubscriptionPlan(
  userId: string,
  planType: "free" | "pro"
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from("users")
    .update({ subscription_plan: planType })
    .eq("id", userId);

  if (error) throw new Error(`사용자 플랜 업데이트 실패: ${error.message}`);
}

// ============================================================================
// 사용률 추적 관련 함수
// ============================================================================

/**
 * 월별 식단 생성 사용률 조회
 * @param userId - 사용자 ID
 * @param year - 연도
 * @param month - 월
 * @returns 사용률 정보
 */
export async function getMealPlanUsage(
  userId: string,
  year: number,
  month: number
): Promise<MealPlanUsage | null> {
  const { data, error } = await supabase
    .from("meal_plan_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`사용률 조회 실패: ${error.message}`);
  }

  return data || null;
}

/**
 * 식단 생성 가능 여부 확인
 * @param userId - 사용자 ID
 * @param planType - 플랜 타입 ('free' | 'pro')
 * @returns 생성 가능 여부
 */
export async function canGenerateMealPlan(
  userId: string,
  planType: "free" | "pro"
): Promise<boolean> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const usage = await getMealPlanUsage(userId, year, month);

  if (!usage) {
    // 첫 생성
    return true;
  }

  const maxCount = planType === "free" ? 1 : 10;
  return usage.generation_count < maxCount;
}

/**
 * 식단 생성 횟수 증가
 * 서버사이드에서만 호출 (Service Role Key 필요)
 * @param userId - 사용자 ID
 * @param planType - 플랜 타입
 */
export async function incrementMealPlanUsage(
  userId: string,
  planType: "free" | "pro"
): Promise<void> {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const maxCount = planType === "free" ? 1 : 10;

  // 기존 사용률 확인
  const { data: existing } = await admin
    .from("meal_plan_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .single();

  if (existing) {
    // 기존 사용률 증가
    const { error } = await admin
      .from("meal_plan_usage")
      .update({ generation_count: existing.generation_count + 1 })
      .eq("id", existing.id);

    if (error) throw new Error(`사용률 업데이트 실패: ${error.message}`);
  } else {
    // 새 사용률 생성
    const { error } = await admin
      .from("meal_plan_usage")
      .insert([
        {
          user_id: userId,
          year,
          month,
          generation_count: 1,
          max_count: maxCount,
        },
      ]);

    if (error) throw new Error(`사용률 생성 실패: ${error.message}`);
  }
}

// ============================================================================
// 알림 관련 함수
// ============================================================================

/**
 * 사용자의 모든 알림 조회
 * @param userId - 사용자 ID
 * @returns 알림 배열
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`알림 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * 알림 생성
 * 서버사이드에서만 호출 (Service Role Key 필요)
 * @param userId - 사용자 ID
 * @param type - 알림 타입
 * @param title - 알림 제목
 * @param content - 알림 내용
 */
export async function createNotification(
  userId: string,
  type: "meal_confirmed" | "payment_success" | "payment_failed" | "plan_generated",
  title: string,
  content: string
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.from("notifications").insert([
    {
      user_id: userId,
      type,
      title,
      content,
      is_read: false,
    },
  ]);

  if (error) throw new Error(`알림 생성 실패: ${error.message}`);
}

/**
 * 알림 읽음 처리
 * @param notificationId - 알림 ID
 */
export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw new Error(`알림 읽음 처리 실패: ${error.message}`);
}
