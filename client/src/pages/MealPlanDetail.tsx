import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle2,
  RefreshCw,
  Download,
  ArrowLeft,
  Sun,
  Coffee,
  Utensils,
  Moon,
  ChevronDown,
  ChevronUp,
  Flame,
  CheckCheck,
  AlertCircle,
  Lock,
  Calendar,
  LayoutGrid,
} from "lucide-react";

// ===================== 타입 정의 =====================

interface MealItem {
  name: string;
  description: string;
  calories: number;
}

interface DayMeals {
  breakfast: MealItem;
  lunch: MealItem;
  dinner: MealItem;
  snack: MealItem;
}

interface NutritionInfo {
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealDayData {
  id: number;
  mealPlanId: number;
  dayOfMonth: number;
  meals: DayMeals;
  nutritionInfo: NutritionInfo | null;
  status: "pending" | "approved" | "replaced";
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===================== 식단 카드 컴포넌트 =====================

/**
 * 일별 식단 카드 컴포넌트
 *
 * 상태 관리:
 * - pending: 검토 대기 (승인/교체 버튼 활성)
 * - approved: 승인 완료 (녹색 배지)
 * - replaced: AI 재생성 후 대기 중 (pending으로 변경됨)
 *
 * 인터랙션 설계:
 * - 카드 클릭으로 상세 내용 펼침/접기
 * - 승인 버튼: 즉시 낙관적 업데이트 후 서버 동기화
 * - 교체 버튼: 로딩 스피너 표시 후 새 식단으로 교체
 */
function MealDayCard({
  day,
  planId,
  onApprove,
  onReplace,
  isReplacing,
}: {
  day: MealDayData;
  planId: number;
  onApprove: (dayId: number) => void;
  onReplace: (dayId: number, dayOfMonth: number) => void;
  isReplacing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const mealIcons = {
    breakfast: { icon: Coffee, label: "아침", color: "text-orange-500" },
    lunch: { icon: Sun, label: "점심", color: "text-yellow-500" },
    dinner: { icon: Utensils, label: "저녁", color: "text-blue-500" },
    snack: { icon: Moon, label: "간식", color: "text-purple-400" },
  };

  const isApproved = day.status === "approved";

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isApproved
          ? "border-green-200 bg-green-50/50"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      {/* Card Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
            isApproved ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
          }`}>
            {day.dayOfMonth}
          </div>
          <div>
            <div className="text-sm font-medium">
              {day.meals.breakfast?.name ?? "식단 없음"}
            </div>
            <div className="text-xs text-muted-foreground font-light">
              {day.nutritionInfo?.totalCalories ?? 0} kcal
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isApproved ? (
            <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              승인됨
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              검토 필요
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
          {/* Meal Items */}
          <div className="grid grid-cols-2 gap-3">
            {(["breakfast", "lunch", "dinner", "snack"] as const).map((mealType) => {
              const meal = day.meals[mealType];
              const { icon: Icon, label, color } = mealIcons[mealType];
              return (
                <div key={mealType} className="p-3 rounded-lg bg-background border border-border/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-sm font-medium leading-tight">{meal?.name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground font-light mt-0.5 leading-relaxed">{meal?.description ?? ""}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-muted-foreground">{meal?.calories ?? 0} kcal</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nutrition Summary */}
          {day.nutritionInfo && (
            <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-muted/50">
              {[
                { label: "칼로리", value: `${day.nutritionInfo.totalCalories}`, unit: "kcal" },
                { label: "단백질", value: `${day.nutritionInfo.protein}`, unit: "g" },
                { label: "탄수화물", value: `${day.nutritionInfo.carbs}`, unit: "g" },
                { label: "지방", value: `${day.nutritionInfo.fat}`, unit: "g" },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs text-muted-foreground font-light">{item.label}</div>
                  <div className="text-sm font-semibold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.unit}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {!isApproved && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReplace(day.id, day.dayOfMonth)}
                disabled={isReplacing}
                className="flex-1 gap-1.5"
              >
                {isReplacing ? (
                  <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                교체
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(day.id)}
                className="flex-1 gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                승인
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== 달력 셀 컴포넌트 =====================

/**
 * 월간 달력 뷰의 개별 날짜 셀
 *
 * 설계 결정:
 * - 달력 뷰는 전통적인 7열 그리드 구조 사용 (일~토)
 * - 각 셀에 아침 식단명 + 승인 상태 표시
 * - 클릭 시 해당 날짜 카드로 스크롤
 */
function CalendarCell({
  day,
  onApprove,
  onReplace,
  isReplacing,
  isConfirmed,
}: {
  day: MealDayData | null;
  onApprove: (dayId: number) => void;
  onReplace: (dayId: number, dayOfMonth: number) => void;
  isReplacing: boolean;
  isConfirmed: boolean;
}) {
  if (!day) {
    return <div className="h-24 rounded-lg bg-muted/20" />;
  }

  const isApproved = day.status === "approved";

  return (
    <div
      className={`h-24 rounded-lg border p-2 flex flex-col justify-between transition-all ${
        isApproved
          ? "border-green-200 bg-green-50/40"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${isApproved ? "text-green-700" : "text-foreground"}`}>
          {day.dayOfMonth}
        </span>
        {isApproved ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-orange-400" />
        )}
      </div>
      <div>
        <p className="text-xs font-medium leading-tight truncate">
          {day.meals.breakfast?.name ?? "-"}
        </p>
        <p className="text-xs text-muted-foreground font-light">
          {day.nutritionInfo?.totalCalories ?? 0} kcal
        </p>
      </div>
      {!isApproved && !isConfirmed && (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onReplace(day.id, day.dayOfMonth); }}
            disabled={isReplacing}
            className="flex-1 text-xs py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
          >
            {isReplacing ? "..." : "교체"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(day.id); }}
            className="flex-1 text-xs py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            승인
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== 메인 페이지 =====================

export default function MealPlanDetail() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);

  // 뷰 모드: "grid" (카드 그리드) | "calendar" (월간 달력)
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  // 식단 플랜 데이터 조회
  const { data, isLoading, refetch } = trpc.mealPlan.getById.useQuery(
    { id: planId },
    { enabled: !!planId && isAuthenticated }
  );

  // 낙관적 업데이트를 위한 로컬 상태
  // 설계 결정: 서버 응답을 기다리지 않고 즉시 UI 반영 → 사용자 경험 향상
  const [localDays, setLocalDays] = useState<MealDayData[] | null>(null);
  const [replacingDayId, setReplacingDayId] = useState<number | null>(null);

  useEffect(() => {
    if (data?.days) {
      setLocalDays(data.days as MealDayData[]);
    }
  }, [data?.days]);

  const utils = trpc.useUtils();

  const approveMutation = trpc.mealPlan.approveDay.useMutation({
    onMutate: ({ dayId }) => {
      // 낙관적 업데이트: 서버 응답 전에 UI 즉시 변경
      setLocalDays((prev) =>
        prev?.map((d) =>
          d.id === dayId ? { ...d, status: "approved" as const, approvedAt: new Date() } : d
        ) ?? null
      );
    },
    onError: () => {
      // 실패 시 롤백: 서버 데이터로 복원
      refetch();
      toast.error("승인 처리 중 오류가 발생했습니다.");
    },
    onSuccess: () => {
      toast.success("식단이 승인되었습니다.");
    },
  });

  const replaceMutation = trpc.mealPlan.replaceDay.useMutation({
    onSuccess: (newData, variables) => {
      // 교체 성공: 새 식단 데이터로 업데이트
      setLocalDays((prev) =>
        prev?.map((d) =>
          d.id === variables.dayId
            ? {
                ...d,
                meals: newData.meals as DayMeals,
                nutritionInfo: newData.nutritionInfo as NutritionInfo,
                status: "pending" as const,
                approvedAt: null,
              }
            : d
        ) ?? null
      );
      setReplacingDayId(null);
      toast.success("새 식단으로 교체되었습니다.");
    },
    onError: () => {
      setReplacingDayId(null);
      toast.error("식단 교체 중 오류가 발생했습니다.");
    },
  });

  const confirmMutation = trpc.mealPlan.confirm.useMutation({
    onSuccess: () => {
      toast.success("식단이 최종 확정되었습니다! 엑셀 파일로 다운로드하세요.");
      utils.mealPlan.getById.invalidate({ id: planId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const exportMutation = trpc.export.generateExcel.useMutation({
    onSuccess: ({ downloadUrl }) => {
      // 다운로드 링크 자동 클릭
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${data?.plan.year}년_${data?.plan.month}월_식단표.xlsx`;
      a.click();
      toast.success("엑셀 파일 다운로드가 시작되었습니다.");
    },
    onError: () => {
      toast.error("엑셀 생성 중 오류가 발생했습니다.");
    },
  });

  const handleApprove = (dayId: number) => {
    approveMutation.mutate({ dayId, planId });
  };

  const handleReplace = (dayId: number, dayOfMonth: number) => {
    setReplacingDayId(dayId);
    replaceMutation.mutate({ dayId, planId, dayOfMonth });
  };

  // 모든 일자 승인 여부 확인
  const allApproved = useMemo(() => {
    if (!localDays || localDays.length === 0) return false;
    return localDays.every((d) => d.status === "approved");
  }, [localDays]);

  const approvedCount = useMemo(
    () => localDays?.filter((d) => d.status === "approved").length ?? 0,
    [localDays]
  );

  const isPro = (user as { plan?: string } | null)?.plan === "pro";
  const isConfirmed = data?.plan.status === "confirmed";

  /**
   * 달력 그리드 생성
   * - 해당 월의 첫 번째 요일을 기준으로 빈 셀 채우기
   * - 7열 그리드 (일요일 시작)
   */
  const calendarGrid = useMemo(() => {
    if (!data?.plan || !localDays) return [];

    const year = data.plan.year;
    const month = data.plan.month;
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=일, 6=토
    const daysInMonth = new Date(year, month, 0).getDate();

    const grid: (MealDayData | null)[] = [];

    // 첫 주 빈 셀
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }

    // 날짜별 식단 데이터 매핑
    for (let d = 1; d <= daysInMonth; d++) {
      const dayData = localDays.find((ld) => ld.dayOfMonth === d) ?? null;
      grid.push(dayData);
    }

    return grid;
  }, [data?.plan, localDays]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard/plans")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              목록
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {data?.plan.title ?? `${data?.plan.year}년 ${data?.plan.month}월 식단`}
                </h1>
                {isConfirmed ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                    <CheckCheck className="w-3 h-3 mr-1" />
                    최종 확정
                  </Badge>
                ) : (
                  <Badge variant="secondary">초안</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-light mt-0.5">
                {approvedCount}/{localDays?.length ?? 0}일 승인 완료
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 뷰 모드 전환 */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                카드
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                달력
              </button>
            </div>

            {/* 최종 확정 버튼 */}
            {!isConfirmed && (
              <Button
                onClick={() => confirmMutation.mutate({ planId })}
                disabled={!allApproved || confirmMutation.isPending}
                className="gap-2"
                title={!allApproved ? "모든 일자를 승인해야 확정할 수 있습니다" : ""}
              >
                {confirmMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                최종 확정
                {!allApproved && (
                  <span className="text-xs opacity-70">({approvedCount}/{localDays?.length ?? 0})</span>
                )}
              </Button>
            )}

            {/* 엑셀 다운로드 버튼 */}
            {isConfirmed && (
              <Button
                onClick={() => {
                  if (!isPro) {
                    toast.error("엑셀 다운로드는 Pro 플랜 전용 기능입니다.", {
                      action: { label: "업그레이드", onClick: () => navigate("/pricing") },
                    });
                    return;
                  }
                  exportMutation.mutate({ planId });
                }}
                variant={isPro ? "default" : "outline"}
                className="gap-2"
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : isPro ? (
                  <Download className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                엑셀 다운로드
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isConfirmed && localDays && localDays.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">승인 진행률</span>
              <span className="text-sm font-semibold text-primary">
                {Math.round((approvedCount / localDays.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(approvedCount / localDays.length) * 100}%` }}
              />
            </div>
            {allApproved && (
              <div className="flex items-center gap-2 mt-3 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                모든 일자가 승인되었습니다. 최종 확정 버튼을 눌러주세요.
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ===== 카드 그리드 뷰 ===== */}
        {viewMode === "grid" && localDays && localDays.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {localDays.map((day) => (
              <MealDayCard
                key={day.id}
                day={day}
                planId={planId}
                onApprove={handleApprove}
                onReplace={handleReplace}
                isReplacing={replacingDayId === day.id}
              />
            ))}
          </div>
        )}

        {/* ===== 달력 뷰 ===== */}
        {viewMode === "calendar" && localDays && localDays.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 p-6">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-xs font-semibold py-2 ${
                    i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* 달력 그리드 */}
            <div className="grid grid-cols-7 gap-2">
              {calendarGrid.map((day, idx) => (
                <CalendarCell
                  key={idx}
                  day={day}
                  onApprove={handleApprove}
                  onReplace={handleReplace}
                  isReplacing={day !== null && replacingDayId === day.id}
                  isConfirmed={isConfirmed}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!localDays || localDays.length === 0) && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-2">식단 데이터가 없습니다</p>
            <p className="text-sm text-muted-foreground font-light">
              식단 생성 중 오류가 발생했을 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
