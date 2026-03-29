import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * 포트원 V1 결제 훅
 *
 * 설계 결정:
 * - 포트원 SDK를 직접 호출하지 않고 훅으로 감싸서 재사용성 극대화
 * - 결제 상태(pending/success/error)를 분리해서 UI에서 로딩/성공/실패 상태를 명확히 표시
 * - 결제 완료 후 백엔드에서 검증(결제 위변조 확인)하므로 프론트엔드는 orderId만 전달
 *
 * 유지보수 관점:
 * - 포트원 SDK 업데이트 시 이 훅만 수정하면 되므로 결합도 최소화
 * - 다른 결제 게이트웨이로 교체할 때도 인터페이스만 맞추면 됨
 */

interface UsePortonePaymentOptions {
  onSuccess?: (paymentData: { orderId: string; paymentKey: string; amount: number }) => void;
  onError?: (error: Error) => void;
}

interface PaymentState {
  status: "idle" | "pending" | "success" | "error";
  error: Error | null;
}

export function usePortonePayment(options?: UsePortonePaymentOptions) {
  const [state, setState] = useState<PaymentState>({
    status: "idle",
    error: null,
  });

  /**
   * 포트원 결제창 띄우기
   *
   * 파라미터:
   * - orderId: 서버에서 생성한 주문 ID (중복 방지용)
   * - amount: 결제 금액 (원화, 정수)
   * - customerName: 고객명
   * - customerEmail: 고객 이메일
   *
   * 반환값:
   * - paymentKey: 포트원에서 발급한 결제 고유 키 (백엔드 검증용)
   */
  const requestPayment = useCallback(
    async (params: {
      orderId: string;
      amount: number;
      customerName: string;
      customerEmail: string;
    }) => {
      try {
        setState({ status: "pending", error: null });

        // 포트원 SDK 로드 확인
        if (!window.IMP) {
          throw new Error("포트원 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.");
        }

        // 포트원 가맹점 ID 초기화
        const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
        if (!storeId) {
          throw new Error("포트원 가맹점 ID가 설정되지 않았습니다.");
        }
        window.IMP!.init(storeId);

        // 결제 요청
        return new Promise<{ orderId: string; paymentKey: string; amount: number }>((resolve, reject) => {
          window.IMP!.request_pay(
            {
              pg: "html5_inicis", // 포트원 테스트 PG (실제 운영 시 pg 코드 변경)
              pay_method: "card",
              merchant_uid: params.orderId,
              amount: params.amount,
              name: "NutriPlan Pro 플랜",
              buyer_name: params.customerName,
              buyer_email: params.customerEmail,
              buyer_tel: "010-0000-0000", // 실제 운영 시 사용자 전화번호
              m_redirect_url: `${window.location.origin}/dashboard/subscription?status=pending`,
            },
            (rsp) => {
              // 결제 완료 콜백
              if (rsp.success) {
                // 성공: 백엔드에서 검증하기 위해 paymentKey와 orderId 반환
                setState({ status: "success", error: null });
                toast.success("결제가 완료되었습니다. 검증 중입니다...");
                resolve({
                  orderId: rsp.merchant_uid,
                  paymentKey: rsp.imp_uid, // 포트원 결제 고유 ID
                  amount: params.amount,
                });
                options?.onSuccess?.({
                  orderId: rsp.merchant_uid,
                  paymentKey: rsp.imp_uid,
                  amount: params.amount,
                });
              } else {
                // 실패: 사용자 취소 또는 결제 오류
                const error = new Error(rsp.error_msg || "결제 실패");
                setState({ status: "error", error });
                toast.error(`결제 실패: ${rsp.error_msg}`);
                reject(error);
                options?.onError?.(error);
              }
            }
          );
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ status: "error", error: err });
        toast.error(err.message);
        options?.onError?.(err);
        throw err;
      }
    },
    [options]
  );

  return {
    ...state,
    requestPayment,
    reset: () => setState({ status: "idle", error: null }),
  };
}

/**
 * 포트원 SDK 타입 정의 (window.IMP)
 * 실제 타입은 @portone/browser-sdk에서 제공하지만,
 * 여기서는 필요한 메서드만 정의해서 사용
 */
declare global {
  interface Window {
    IMP?: {
      init: (storeId: string) => void;
      request_pay: (
        params: {
          pg: string;
          pay_method: string;
          merchant_uid: string;
          amount: number;
          name: string;
          buyer_name: string;
          buyer_email: string;
          buyer_tel: string;
          m_redirect_url: string;
        },
        callback: (response: {
          success: boolean;
          merchant_uid: string;
          imp_uid: string;
          error_msg?: string;
        }) => void
      ) => void;
    };
  }
}
