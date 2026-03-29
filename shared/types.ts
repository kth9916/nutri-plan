/**
 * NutriPlan 공통 타입 정의
 *
 * 아키텍처 설계:
 * - 모든 백엔드 응답과 프론트엔드 Props는 이 타입들을 사용
 * - Supabase 데이터베이스 스키마와 1:1 매핑
 * - 타입 안정성을 통해 런타임 오류 사전 방지
 * - 프론트엔드와 백엔드 간 계약(Contract) 역할
 *
 * 이 방식을 선택한 이유:
 * 1. 단일 진입점: 모든 타입이 한 곳에 정의되어 일관성 유지
 * 2. 타입 안정성: any 타입 제거로 TypeScript 엄격 모드 준수
 * 3. 자동 완성: IDE에서 타입 힌트 제공으로 개발 속도 향상
 * 4. 리팩토링 안전성: 타입 변경 시 컴파일 오류로 영향 범위 파악 용이
 */

// ============================================================================
// 사용자 관련 타입
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  subscription_plan: "free" | "pro";
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 식단 계획 관련 타입
// ============================================================================

/** 일별 식단 정보 */
export interface MealInfo {
  breakfast: string;
  breakfast_description: string;
  lunch: string;
  lunch_description: string;
  dinner: string;
  dinner_description: string;
  snack: string;
}

/** 일별 영양 정보 */
export interface NutritionInfo {
  total_calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

/** 5개 후보 메뉴 (AI 생성) */
export interface MealCandidate {
  meals: MealInfo;
  nutrition_info: NutritionInfo;
}

/** 일자별 식단 데이터 */
export interface MealDay {
  id: number;
  meal_plan_id: number;
  day_of_month: number;
  meals: MealInfo;
  nutrition_info: NutritionInfo;
  candidates: MealCandidate[]; // 5개 후보 메뉴
  selected_candidate_index: number; // 현재 선택된 후보 인덱스 (0-4)
  status: "pending" | "approved" | "replaced";
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 월간 식단 계획 */
export interface MealPlan {
  id: number;
  user_id: string;
  year: number;
  month: number;
  source_file_id: number | null;
  status: "generating" | "pending_review" | "confirmed";
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  days: MealDay[];
}

// ============================================================================
// 파일 관련 타입
// ============================================================================

export interface UploadedFile {
  id: number;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  s3_key: string;
  s3_url: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 결제 관련 타입
// ============================================================================

export interface Subscription {
  id: number;
  user_id: string;
  plan_type: "free" | "pro";
  status: "active" | "cancelled" | "expired";
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrder {
  id: number;
  user_id: string;
  order_id: string;
  amount: number;
  plan_type: "free" | "pro";
  status: "pending" | "completed" | "failed";
  payment_key: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 알림 관련 타입
// ============================================================================

export interface Notification {
  id: number;
  user_id: string;
  type: "meal_confirmed" | "payment_success" | "payment_failed" | "plan_generated";
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API 응답 타입
// ============================================================================

/** 식단 생성 API 응답 */
export interface GenerateMealPlanResponse {
  plan_id: number;
  year: number;
  month: number;
  days: MealDay[];
}

/** 파일 업로드 API 응답 */
export interface UploadFileResponse {
  file_id: number;
  file_name: string;
  s3_url: string;
}

/** 결제 주문 생성 API 응답 */
export interface CreateOrderResponse {
  order_id: string;
  subscription_id: number;
}

/** 결제 확인 API 응답 */
export interface ConfirmPaymentResponse {
  success: boolean;
  subscription_id: number;
  plan_type: "free" | "pro";
}

/** 엑셀 Export API 응답 */
export interface ExportExcelResponse {
  url: string;
  file_name: string;
}

// ============================================================================
// 월간 생성 횟수 추적 타입
// ============================================================================

export interface MealPlanUsage {
  id: number;
  user_id: string;
  year: number;
  month: number;
  generation_count: number;
  max_count: number; // Free: 1, Pro: 10
  created_at: string;
  updated_at: string;
}
