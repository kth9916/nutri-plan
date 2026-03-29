import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CreditCard,
  Check,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Shield,
} from "lucide-react";

/**
 * 구독 관리 페이지
 *
 * 토스페이먼츠 결제 흐름:
 * 1. createOrder: 서버에서 orderId 생성 (pending 상태)
 * 2. 토스페이먼츠 위젯 팝업 (테스트 모드)
 * 3. 결제 완료 → confirmPayment: 서버에서 상태 업데이트
 *
 * 보안 설계:
 * - orderId는 서버에서 생성 (클라이언트 조작 방지)
 * - 결제 금액은 서버에서 검증
 * - TOSS_SECRET_KEY는 서버에서만 사용
 *
 * 현재 구현: 토스페이먼츠 테스트 SDK 연동
 * 리팩토링 방향: 실제 프로덕션 배포 시 도메인 등록 및 시크릿 키 교체 필요
 */
export default function Subscription() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [isAuthenticated, loading]);

  const createOrderMutation = trpc.payment.createOrder.useMutation();
  const confirmPaymentMutation = trpc.payment.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success("Pro 플랜으로 업그레이드되었습니다!");
      setIsPaymentLoading(false);
      // 사용자 정보 갱신
      window.location.reload();
    },
    onError: () => {
      toast.error("결제 처리 중 오류가 발생했습니다.");
      setIsPaymentLoading(false);
    },
  });

  const isPro = user?.plan === "pro";

  /**
   * 토스페이먼츠 테스트 결제 실행
   *
   * 테스트 카드 번호: 4242 4242 4242 4242
   * 유효기간: 임의 미래 날짜, CVC: 임의 3자리
   */
  const handlePayment = async () => {
    try {
      setIsPaymentLoading(true);

      // 1. 서버에서 orderId 생성
      const { orderId, amount } = await createOrderMutation.mutateAsync({ plan: "pro" });

      // 2. 토스페이먼츠 SDK 동적 로드
      // 설계 결정: 동적 임포트로 초기 번들 크기 최소화
      const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;

      if (!tossClientKey || tossClientKey === "test_ck_placeholder") {
        // 토스 키가 없는 경우 Mock 결제 처리 (개발/데모 환경)
        toast.info("테스트 환경: Mock 결제를 처리합니다...");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await confirmPaymentMutation.mutateAsync({
          paymentKey: `mock_payment_${Date.now()}`,
          orderId,
          amount,
        });
        return;
      }

      // 실제 토스페이먼츠 SDK 로드
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(tossClientKey);

      const payment = tossPayments.payment({ customerKey: `user_${user?.id}` });

      // 3. 결제 위젯 표시
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amount },
        orderId,
        orderName: "NutriPlan Pro 월간 구독",
        successUrl: `${window.location.origin}/dashboard/subscription?success=true&orderId=${orderId}`,
        failUrl: `${window.location.origin}/dashboard/subscription?fail=true`,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("PAY_PROCESS_CANCELED")) {
        toast.info("결제가 취소되었습니다.");
      } else {
        toast.error("결제 중 오류가 발생했습니다.");
      }
      setIsPaymentLoading(false);
    }
  };

  // 결제 성공/실패 URL 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const fail = params.get("fail");
    const orderId = params.get("orderId");
    const paymentKey = params.get("paymentKey");
    const amount = params.get("amount");

    if (success && orderId && paymentKey && amount) {
      confirmPaymentMutation.mutate({
        paymentKey,
        orderId,
        amount: Number(amount),
      });
      // URL 파라미터 제거
      window.history.replaceState({}, "", "/dashboard/subscription");
    } else if (fail) {
      toast.error("결제에 실패했습니다.");
      window.history.replaceState({}, "", "/dashboard/subscription");
    }
  }, []);

  if (loading || !isAuthenticated) return null;

  const freePlanFeatures = [
    "월 1회 식단 생성",
    "기본 달력 뷰",
    "식단 승인/교체",
    "최종 확정",
  ];

  const proPlanFeatures = [
    "무제한 식단 생성",
    "엑셀 파일 다운로드",
    "클라우드 파일 저장",
    "AI 맞춤 추천 강화",
    "영양 분석 리포트",
    "우선 고객 지원",
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">구독 관리</h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            현재 플랜 및 결제 관리
          </p>
        </div>

        {/* Current Plan Status */}
        <div className={`rounded-xl border p-6 ${isPro ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPro ? "bg-primary" : "bg-muted"}`}>
                {isPro ? (
                  <Crown className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <Zap className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="font-semibold">
                  {isPro ? "Pro 플랜" : "Free 플랜"}
                </div>
                <div className="text-sm text-muted-foreground font-light">
                  {isPro ? "모든 기능 사용 가능" : "기본 기능 사용 중"}
                </div>
              </div>
            </div>
            <Badge variant={isPro ? "default" : "secondary"} className="text-xs">
              {isPro ? "현재 플랜" : "무료"}
            </Badge>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Free Plan */}
          <div className={`rounded-xl border p-6 ${!isPro ? "border-primary/30 ring-1 ring-primary/20" : "border-border"}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-lg">Free</div>
                <div className="text-2xl font-bold mt-1">₩0<span className="text-sm font-normal text-muted-foreground">/월</span></div>
              </div>
              {!isPro && <Badge variant="secondary" className="text-xs">현재</Badge>}
            </div>
            <div className="space-y-2.5 mb-6">
              {freePlanFeatures.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-light">{feature}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" disabled={!isPro}>
              {!isPro ? "현재 플랜" : "다운그레이드"}
            </Button>
          </div>

          {/* Pro Plan */}
          <div className={`rounded-xl border p-6 relative overflow-hidden ${isPro ? "border-primary/30 ring-1 ring-primary/20" : "border-border"}`}>
            {!isPro && (
              <div className="absolute top-3 right-3">
                <Badge className="text-xs bg-primary">추천</Badge>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-lg flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-primary" />
                  Pro
                </div>
                <div className="text-2xl font-bold mt-1">₩29,000<span className="text-sm font-normal text-muted-foreground">/월</span></div>
              </div>
              {isPro && <Badge className="text-xs">현재</Badge>}
            </div>
            <div className="space-y-2.5 mb-6">
              {proPlanFeatures.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-light">{feature}</span>
                </div>
              ))}
            </div>
            {isPro ? (
              <Button variant="outline" className="w-full" disabled>
                현재 플랜
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={handlePayment}
                disabled={isPaymentLoading}
              >
                {isPaymentLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    결제 처리 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Pro로 업그레이드
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Payment Security Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
          <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground font-light leading-relaxed">
            결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
            카드 정보는 NutriPlan에 저장되지 않으며, PCI DSS 보안 기준을 준수합니다.
            현재 테스트 환경에서는 실제 결제가 발생하지 않습니다.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
