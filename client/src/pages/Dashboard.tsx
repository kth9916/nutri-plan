import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  Upload,
  Calendar,
  FileSpreadsheet,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/**
 * 대시보드 홈 페이지
 * - 최근 식단 플랜 요약
 * - 빠른 액션 버튼 (새 식단 생성, 파일 업로드)
 * - 알림 목록
 */
export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const { data: mealPlans, isLoading: plansLoading } = trpc.mealPlan.list.useQuery();
  const { data: notifications } = trpc.notification.list.useQuery();

  if (loading || !isAuthenticated) return null;

  const recentPlans = mealPlans?.slice(0, 3) ?? [];
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">대시보드</h1>
            <p className="text-sm text-muted-foreground font-light mt-0.5">
              AI 기반 월간 식단 관리 현황
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
            <Upload className="w-4 h-4" />
            새 식단 생성
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "총 식단 플랜",
              value: mealPlans?.length ?? 0,
              icon: Calendar,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "확정된 식단",
              value: mealPlans?.filter((p) => p.status === "confirmed").length ?? 0,
              icon: CheckCircle2,
              color: "text-green-600",
              bg: "bg-green-50",
            },
            {
              label: "이번 달 생성",
              value: mealPlans?.filter((p) => {
                const now = new Date();
                return p.year === now.getFullYear() && p.month === now.getMonth() + 1;
              }).length ?? 0,
              icon: TrendingUp,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "읽지 않은 알림",
              value: unreadCount,
              icon: Bell,
              color: "text-orange-500",
              bg: "bg-orange-50",
            },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-light">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Meal Plans */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">최근 식단 플랜</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/plans")} className="text-xs">
                전체 보기 <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {plansLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentPlans.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">아직 식단 플랜이 없습니다</p>
                <p className="text-xs text-muted-foreground font-light mb-4">
                  엑셀 파일을 업로드하여 첫 번째 식단을 생성해보세요
                </p>
                <Button size="sm" onClick={() => navigate("/dashboard/upload")}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  파일 업로드
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 cursor-pointer transition-all"
                    onClick={() => navigate(`/dashboard/plans/${plan.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {plan.title ?? `${plan.year}년 ${plan.month}월 식단`}
                        </div>
                        <div className="text-xs text-muted-foreground font-light">
                          {new Date(plan.createdAt).toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={plan.status === "confirmed" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {plan.status === "confirmed" ? "확정" : "초안"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions + Notifications */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="font-semibold mb-4">빠른 실행</h2>
              <div className="space-y-2">
                {[
                  { label: "엑셀 업로드", icon: Upload, path: "/dashboard/upload", primary: true },
                  { label: "식단 달력 보기", icon: Calendar, path: "/dashboard/plans", primary: false },
                  { label: "파일 관리", icon: FileSpreadsheet, path: "/dashboard/files", primary: false },
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(action.path)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${
                      action.primary
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Notifications */}
            <div className="bg-card rounded-xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">최근 알림</h2>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs h-5 px-1.5">{unreadCount}</Badge>
                )}
              </div>
              {!notifications || notifications.length === 0 ? (
                <div className="text-center py-6">
                  <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-light">알림이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map((notif) => (
                    <div key={notif.id} className={`flex gap-3 ${!notif.isRead ? "opacity-100" : "opacity-60"}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium">{notif.title}</div>
                        <div className="text-xs text-muted-foreground font-light">{notif.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
