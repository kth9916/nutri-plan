import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  Upload,
  CheckCheck,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";

export default function MealPlans() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const { data: plans, isLoading } = trpc.mealPlan.list.useQuery();

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">식단 플랜</h1>
            <p className="text-sm text-muted-foreground font-light mt-0.5">
              생성된 월간 식단 플랜 목록
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
            <Plus className="w-4 h-4" />
            새 식단 생성
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !plans || plans.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-2">아직 식단 플랜이 없습니다</p>
            <p className="text-sm text-muted-foreground font-light mb-6">
              엑셀 파일을 업로드하여 첫 번째 AI 식단을 생성해보세요
            </p>
            <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
              <Upload className="w-4 h-4" />
              파일 업로드
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-5 bg-card rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-all group"
                onClick={() => navigate(`/dashboard/plans/${plan.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    plan.status === "confirmed" ? "bg-green-100" : "bg-accent"
                  }`}>
                    {plan.status === "confirmed" ? (
                      <CheckCheck className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-accent-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {plan.title ?? `${plan.year}년 ${plan.month}월 식단`}
                    </div>
                    <div className="text-sm text-muted-foreground font-light">
                      생성일: {new Date(plan.createdAt).toLocaleDateString("ko-KR")}
                      {plan.confirmedAt && ` · 확정일: ${new Date(plan.confirmedAt).toLocaleDateString("ko-KR")}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={plan.status === "confirmed" ? "default" : "secondary"}
                    className={plan.status === "confirmed" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : ""}
                  >
                    {plan.status === "confirmed" ? "최종 확정" : "초안"}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
