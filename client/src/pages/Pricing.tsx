import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Check, Sparkles, ArrowLeft, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * 가격 정책 페이지 (Pricing)
 *
 * Free / Pro 플랜 구분:
 * - Free: 월 3회 식단 생성, 기본 달력 뷰
 * - Pro: 무제한 생성, 클라우드 저장, 알림, 엑셀 Export
 *
 * 결제 흐름:
 * 1. Pro 플랜 선택 → 로그인 확인
 * 2. 토스페이먼츠 결제 위젯 페이지(/payment)로 이동
 * 3. 결제 완료 후 /payment/success 콜백 처리
 */
export default function Pricing() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();

  const handleProPlan = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    // Pro 플랜 결제 페이지로 이동
    navigate("/payment");
  };

  const handleFreePlan = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    navigate("/dashboard");
  };

  const isPro = user?.plan === "pro";

  const freePlanFeatures = [
    "월 3회 AI 식단 생성",
    "기본 달력 뷰",
    "식단 승인/교체 기능",
    "기본 엑셀 다운로드",
    "이메일 지원",
  ];

  const proPlanFeatures = [
    "무제한 AI 식단 생성",
    "고급 달력 뷰",
    "식단 승인/교체 기능",
    "고급 엑셀 Export (스타일 적용)",
    "클라우드 파일 저장 & 관리",
    "인앱 & 이메일 알림",
    "AI 추천 정확도 개선 (피드백 학습)",
    "우선 고객 지원",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">NutriPlan</span>
          </div>
          <div className="w-20" />
        </div>
      </nav>

      <div className="pt-32 pb-24">
        <div className="container">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 text-xs">
              <Zap className="w-3 h-3 mr-1.5" />
              요금제
            </Badge>
            <h1 className="text-5xl font-bold mb-4" style={{ letterSpacing: "-0.03em" }}>
              심플한 요금제,<br />강력한 기능
            </h1>
            <p className="text-muted-foreground font-light leading-relaxed">
              무료로 시작하고 필요할 때 업그레이드하세요.
              숨겨진 비용 없이 투명한 가격 정책을 제공합니다.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="relative rounded-2xl border border-border bg-card p-8 flex flex-col">
              <div className="mb-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Free</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₩0</span>
                  <span className="text-muted-foreground font-light text-sm">/월</span>
                </div>
                <p className="text-sm text-muted-foreground font-light mt-2">
                  핵심 기능을 무료로 경험해보세요
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {freePlanFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-light">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full h-11"
                onClick={handleFreePlan}
                disabled={isAuthenticated && !isPro}
              >
                {isAuthenticated && !isPro ? "현재 플랜" : "무료로 시작"}
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 flex flex-col">
              {/* Popular Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-4 py-1 text-xs font-medium shadow-sm">
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  가장 인기
                </Badge>
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-primary mb-2">Pro</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₩29,000</span>
                  <span className="text-muted-foreground font-light text-sm">/월</span>
                </div>
                <p className="text-sm text-muted-foreground font-light mt-2">
                  전문 영양사를 위한 완전한 솔루션
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {proPlanFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span className="text-sm font-light">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full h-11"
                onClick={handleProPlan}
                disabled={isPro}
              >
                {isPro ? "현재 Pro 플랜 사용 중" : "Pro 시작하기"}
              </Button>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mt-20">
            <h2 className="text-2xl font-bold mb-8 text-center">자주 묻는 질문</h2>
            <div className="space-y-6">
              {[
                {
                  q: "결제는 어떻게 이루어지나요?",
                  a: "토스페이먼츠를 통해 안전하게 결제됩니다. 신용카드, 체크카드, 간편결제 등 다양한 결제 수단을 지원합니다.",
                },
                {
                  q: "언제든지 해지할 수 있나요?",
                  a: "네, 언제든지 구독을 해지할 수 있습니다. 해지 후에도 결제 기간이 끝날 때까지 Pro 기능을 이용할 수 있습니다.",
                },
                {
                  q: "Free 플랜에서 Pro로 업그레이드하면 기존 데이터는 유지되나요?",
                  a: "네, 기존에 생성한 모든 식단 데이터는 그대로 유지됩니다. 업그레이드 즉시 Pro 기능을 사용할 수 있습니다.",
                },
                {
                  q: "엑셀 파일 형식에 제한이 있나요?",
                  a: ".xlsx, .xls 형식의 엑셀 파일을 지원합니다. 파일 크기는 최대 10MB까지 업로드 가능합니다.",
                },
              ].map((item, i) => (
                <div key={i} className="border-b border-border/50 pb-6">
                  <h3 className="font-semibold mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
