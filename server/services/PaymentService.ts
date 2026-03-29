import { ENV } from "../_core/env";
import axios from "axios";

/**
 * PaymentService: 포트원 결제 검증 및 구독 관리
 *
 * 아키텍처 설계:
 * - 포트원 REST API 호출을 독립된 서비스로 분리해서 비즈니스 로직과 분리
 * - 결제 위변조 검증(Verification)을 필수로 수행해서 보안 강화
 * - 에러 핸들링과 재시도 로직을 중앙화해서 유지보수 용이
 *
 * 유지보수 관점:
 * - 포트원 API 변경 시 이 서비스만 수정하면 됨
 * - 다른 결제 게이트웨이로 교체할 때도 인터페이스만 맞추면 됨
 * - 테스트 시 이 서비스를 Mock하면 되므로 단위 테스트 작성 용이
 */

interface PortonePaymentResponse {
  code: number;
  message: string;
  response?: {
    imp_uid: string;
    merchant_uid: string;
    pay_method: string;
    channel: string;
    pg_provider: string;
    pg_id: string;
    pg_tid: string;
    pg_type: string;
    applied_escrow_amount: number;
    status: "ready" | "paid" | "cancelled" | "failed";
    paid_at: number;
    cancelled_at: number;
    fail_reason: string;
    cancel_reason: string;
    receipt_url: string;
    cash_receipt_issued: boolean;
    customer_uid: string;
    customer_key: string;
    amount: number;
    cancel_amount: number;
    currency: string;
    name: string;
    buyer_name: string;
    buyer_email: string;
    buyer_tel: string;
    buyer_addr: string;
    buyer_postcode: string;
    custom_data: string;
    user_agent: string;
    hedged: boolean;
    hedged_amount: number;
    metadata: Record<string, unknown>;
  };
}

export class PaymentService {
  /**
   * 포트원 결제 검증
   *
   * 검증 프로세스:
   * 1. 포트원 API에서 결제 정보 조회
   * 2. 금액 일치 확인 (위변조 방지)
   * 3. 결제 상태 확인 (paid 상태만 유효)
   * 4. 성공 시 true 반환, 실패 시 에러 throw
   *
   * 보안 고려사항:
   * - 클라이언트에서 전달받은 amount는 신뢰하지 않음
   * - 서버에서 DB의 주문 정보와 비교해서 검증 필요
   * - 포트원 API 응답이 위변조되지 않도록 HTTPS 사용
   */
  static async verifyPayment(
    paymentKey: string, // 포트원 결제 고유 ID (imp_uid)
    orderId: string, // 서버에서 생성한 주문 ID
    expectedAmount: number // DB에서 조회한 예상 금액
  ): Promise<boolean> {
    try {
      if (!ENV.portoneApiKey) {
        throw new Error("포트원 API 키가 설정되지 않았습니다.");
      }

      // 포트원 API 호출 (결제 정보 조회)
      const response = await axios.get<PortonePaymentResponse>(
        `https://api.iamport.kr/payments/${paymentKey}`,
        {
          headers: {
            Authorization: `Bearer ${ENV.portoneApiKey}`,
          },
        }
      );

      const { code, message, response: paymentData } = response.data;

      // API 응답 상태 확인
      if (code !== 0) {
        throw new Error(`포트원 API 오류: ${message}`);
      }

      if (!paymentData) {
        throw new Error("결제 정보를 찾을 수 없습니다.");
      }

      // 1. 주문 ID 일치 확인
      if (paymentData.merchant_uid !== orderId) {
        throw new Error("주문 ID가 일치하지 않습니다. (위변조 의심)");
      }

      // 2. 금액 일치 확인 (가장 중요한 검증)
      if (paymentData.amount !== expectedAmount) {
        throw new Error(
          `결제 금액이 일치하지 않습니다. 예상: ${expectedAmount}, 실제: ${paymentData.amount}`
        );
      }

      // 3. 결제 상태 확인
      if (paymentData.status !== "paid") {
        throw new Error(`결제 상태가 유효하지 않습니다: ${paymentData.status}`);
      }

      // 모든 검증 통과
      console.log(`[Payment] 결제 검증 성공: ${paymentKey} (금액: ${expectedAmount}원)`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Payment] 결제 검증 실패: ${errorMessage}`);
      throw new Error(`결제 검증 실패: ${errorMessage}`);
    }
  }

  /**
   * 포트원 결제 취소
   *
   * 사용 시나리오:
   * - 사용자가 Pro 플랜 구독 후 환불 요청
   * - 구독 만료 후 자동 취소
   * - 결제 오류로 인한 자동 롤백
   *
   * 주의사항:
   * - 부분 취소도 지원하지만 여기서는 전액 취소만 구현
   * - 취소 후 DB의 구독 상태도 함께 업데이트 필요
   */
  static async cancelPayment(paymentKey: string, reason: string): Promise<boolean> {
    try {
      if (!ENV.portoneApiKey || !ENV.portoneApiSecret) {
        throw new Error("포트원 API 키가 설정되지 않았습니다.");
      }

      // 포트원 API 호출 (결제 취소)
      const response = await axios.post<PortonePaymentResponse>(
        `https://api.iamport.kr/payments/cancel`,
        {
          imp_uid: paymentKey,
          reason: reason,
        },
        {
          headers: {
            Authorization: `Bearer ${ENV.portoneApiKey}`,
          },
        }
      );

      const { code, message } = response.data;

      if (code !== 0) {
        throw new Error(`포트원 API 오류: ${message}`);
      }

      console.log(`[Payment] 결제 취소 성공: ${paymentKey}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Payment] 결제 취소 실패: ${errorMessage}`);
      throw new Error(`결제 취소 실패: ${errorMessage}`);
    }
  }

  /**
   * Pro 플랜 가격 조회
   *
   * 하드코딩 대신 상수로 관리해서 가격 변경 시 한 곳만 수정하면 됨
   */
  static getPriceForPlan(plan: "free" | "pro"): number {
    const prices = {
      free: 0,
      pro: 29000, // 월 29,000원
    };
    return prices[plan];
  }
}
