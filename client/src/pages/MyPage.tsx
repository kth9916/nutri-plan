import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, RefreshCw, AlertCircle, FileText, Settings, User } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function MyPage() {
  const { user } = useAuth();
  
  const { data: usage, isLoading: usageLoading } = trpc.usage.getDailyStats.useQuery();
  const { data: mealPlans, isLoading: plansLoading } = trpc.mealPlan.list.useQuery();

  if (usageLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const generationPercentage = usage ? Math.min(100, Math.round((usage.usedGenerations / usage.maxGenerations) * 100)) : 0;
  const exchangePercentage = usage ? Math.min(100, Math.round((usage.usedExchanges / usage.maxExchanges) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-muted-foreground mt-2">
          내 계정 정보와 오늘 하루 AI 한도 및 사용내역을 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 border-border/50 bg-background/50 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              내 프로필
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-lg">{user?.name || "사용자"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">소속 분류</p>
              <p className="font-medium text-sm px-3 py-2 bg-muted/50 rounded-lg border border-border/50">
                {user?.workplaceCategory || "미설정"}
              </p>
            </div>
            <div className="pt-4 border-t border-border/50 flex justify-between items-center">
              <span className="text-sm font-medium">현재 요금제</span>
              <Badge variant={user?.plan === "pro" ? "default" : "secondary"} className="px-3">
                {user?.plan === "pro" ? "Pro 플랜" : "Free 플랜"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Usage Limits Card */}
        <Card className="md:col-span-2 border-border/50 bg-background/50 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              오늘의 이용 한도
            </CardTitle>
            <CardDescription>매일 자정(KST 기준)에 카운트가 초기화됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">월간 AI 식단 전체 생성</span>
                  </div>
                  <span className="text-xs text-muted-foreground">엑셀 파일을 분석해 전체 식단을 자동 생성합니다.</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-foreground">{usage?.usedGenerations}</span>
                  <span className="text-muted-foreground"> / {usage?.maxGenerations} 회</span>
                </div>
              </div>
              <div className="relative">
                <Progress value={generationPercentage} className="h-2.5 bg-muted" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">일일 메뉴 교환 (새로고침)</span>
                  </div>
                  <span className="text-xs text-muted-foreground">마음에 들지 않는 메뉴를 다른 후보로 개별 교체합니다.</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-foreground">{usage?.usedExchanges}</span>
                  <span className="text-muted-foreground"> / {usage?.maxExchanges} 회</span>
                </div>
              </div>
              <div className="relative">
                <Progress value={exchangePercentage} className="h-2.5 bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI History */}
      <h2 className="text-xl font-bold tracking-tight mt-10 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        AI 식단 생성 기록
      </h2>
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
        <div className="grid grid-cols-12 bg-muted/40 p-4 text-sm font-medium text-muted-foreground">
          <div className="col-span-3">생성 일자</div>
          <div className="col-span-2">대상 월</div>
          <div className="col-span-5">상세 요청 (프롬프트/업로드 파일)</div>
          <div className="col-span-2 text-right">바로가기</div>
        </div>
        <div className="divide-y divide-border/50">
          {(!mealPlans || mealPlans.length === 0) ? (
            <div className="p-12 text-center flex flex-col items-center">
              <FileText className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">생성된 식단 기록이 없습니다.</p>
              <Link href="/dashboard/upload">
                <button className="mt-4 text-sm text-primary hover:underline font-medium">새 식단 만들기</button>
              </Link>
            </div>
          ) : (
            mealPlans.map((plan) => (
              <div key={plan.id} className="grid grid-cols-12 items-center p-4 hover:bg-muted/30 transition-colors">
                <div className="col-span-3 text-sm">{format(new Date(plan.createdAt), 'yyyy-MM-dd HH:mm')}</div>
                <div className="col-span-2 font-medium">{plan.year}년 {plan.month}월</div>
                <div className="col-span-5 text-sm text-muted-foreground truncate pr-4">
                  {plan.requestPrompt ? (
                    <span className="bg-muted px-2 py-1 rounded-md text-xs">{plan.requestPrompt}</span>
                  ) : (
                    <span className="italic opacity-60">추가 요청사항 없음</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <Link href={`/dashboard/plans/${plan.id}`} className="inline-flex h-8 items-center justify-center rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    상세 보기
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
