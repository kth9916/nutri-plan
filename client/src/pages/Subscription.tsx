import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Subscription 페이지
 *
 * 포트원 V1 SDK를 사용한 결제 통합
 * - Free 플랜: 무료 (월 1회 식단 생성)
 * - Pro 플랜: 월 9,900원 (월 10회 식단 생성)
 *
 * 아키텍처 설계:
 * - 포트원 결제 로직은 usePortonePayment 훅으로 분리
 * - 결제 검증은 백엔드 PaymentService에서 처리
 * - 구독 상태는 DB의 subscriptions 테이블에서 관리
 */

export default function Subscription() {
  const { user, isAuthenticated, loading } = useAuth();
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  // tRPC 뮤테이션
  const createOrderMutation = trpc.payment.createOrder.useMutation();
  const confirmPaymentMutation = trpc.payment.confirmPayment.useMutation();
  const getSubscriptionQuery = trpc.payment.getSubscription.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  // 구독 정보 로드
  useEffect(() => {
    if (getSubscriptionQuery.data) {
      setSubscription(getSubscriptionQuery.data);
    }
  }, [getSubscriptionQuery.data]);

  const handlePayment = async () => {
    try {
      setIsPaymentLoading(true);

      // 1. 서버에서 orderId 생성
      const { orderId } = await createOrderMutation.mutateAsync({
        planType: "pro",
        amount: 9900,
      });

      // 2. 포트원 SDK 동적 로드
      const portoneStoreId = import.meta.env.VITE_NEXT_PUBLIC_PORTONE_STORE_ID;

      if (!portoneStoreId || portoneStoreId === "test_store_placeholder") {
        // 테스트 환경: Mock 결제 처리
        toast.info("테스트 환경: Mock 결제를 처리합니다...");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await confirmPaymentMutation.mutateAsync({
          paymentKey: `mock_payment_${Date.now()}`,
          orderId,
          amount: 9900,
        });

        toast.success("결제가 완료되었습니다!");
        setIsPaymentLoading(false);
        return;
      }

      // 실제 포트원 SDK 로드 및 결제
      const { PortOne } = await import("@portone/browser-sdk/v2");

      // 포트원 결제 요청
      const response = await PortOne.requestPayment({
        storeId: portoneStoreId,
        paymentId: orderId,
        orderName: "NutriPlan Pro 월간 구독",
        totalAmount: 9900,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          customerId: `user_${user?.id}`,
          email: user?.email || "",
          name: user?.name || "",
        },
        redirectUrl: `${window.location.origin}/dashboard/subscription?orderId=${orderId}`,
      });

      if (response.code !== null) {
        // 결제 실패
        toast.error(`결제 실패: ${response.message}`);
        setIsPaymentLoading(false);
        return;
      }

      // 결제 성공 시 paymentId로 검증
      if (response.paymentId) {
        await confirmPaymentMutation.mutateAsync({
          paymentKey: response.paymentId,
          orderId,
          amount: 9900,
        });

        toast.success("결제가 완료되었습니다!");
      }
    } catch (error: unknown) {
      console.error("결제 오류:", error);
      if (error instanceof Error && error.message?.includes("CANCELLED")) {
        toast.info("결제가 취소되었습니다.");
      } else {
        toast.error("결제 중 오류가 발생했습니다.");
      }
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // 결제 성공/실패 URL 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");

    if (orderId) {
      // 결제 완료 후 구독 정보 새로고침
      getSubscriptionQuery.refetch();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (loading || !isAuthenticated) return null;

  const isPro = subscription?.planType === "pro";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">구독 관리</h1>
          <p className="text-muted-foreground mb-8">
            현재 플랜을 확인하고 업그레이드하세요.
          </p>

          {/* 현재 구독 상태 */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>현재 플랜</CardTitle>
              <CardDescription>
                {isPro ? "Pro 플랜 (월 10회 식단 생성)" : "Free 플랜 (월 1회 식단 생성)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">월간 식단 생성 횟수</p>
                  <p className="text-2xl font-bold">{isPro ? "10회" : "1회"}</p>
                </div>
                {isPro && subscription?.expiresAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">구독 만료일</p>
                    <p className="text-lg font-semibold">
                      {new Date(subscription.expiresAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 요금제 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free 플랜 */}
            <Card className={isPro ? "" : "border-primary/50 bg-primary/5"}>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>무료</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-3xl font-bold">무료</p>
                  <p className="text-sm text-muted-foreground">월 1회 식단 생성</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 월 1회 식단 생성
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 기본 식단 템플릿
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 엑셀 다운로드
                  </li>
                </ul>
                {!isPro && (
                  <Button disabled className="w-full">
                    현재 플랜
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Pro 플랜 */}
            <Card className={isPro ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>월 9,900원</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-3xl font-bold">9,900원</p>
                  <p className="text-sm text-muted-foreground">월 10회 식단 생성</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 월 10회 식단 생성
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> AI 맞춤형 식단
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 영양 분석 차트
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 우선 지원
                  </li>
                </ul>
                {isPro ? (
                  <Button disabled className="w-full">
                    현재 플랜
                  </Button>
                ) : (
                  <Button
                    onClick={handlePayment}
                    disabled={isPaymentLoading}
                    className="w-full"
                  >
                    {isPaymentLoading ? "결제 중..." : "Pro 플랜 구독"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
