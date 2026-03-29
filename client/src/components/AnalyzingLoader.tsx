import { useEffect, useState } from "react";
import { Sparkles, Brain, CheckCircle2 } from "lucide-react";

/**
 * AI 식단 분석 중 Mock 로딩 화면 컴포넌트
 *
 * 설계 결정:
 * - 단계별 진행 텍스트로 사용자에게 진행 상황 전달 (실제 백엔드 진행률과 무관)
 * - 각 단계는 타이머 기반으로 순차 표시 → 사용자 이탈 방지
 * - 스피너 + 체크마크 전환으로 완료 피드백 제공
 *
 * 리팩토링 방향:
 * - 실제 서버 SSE(Server-Sent Events) 또는 WebSocket으로 실시간 진행률 수신 가능
 * - 현재는 Mock 타이머 기반이므로 실제 처리 시간과 불일치 가능
 */

const ANALYSIS_STEPS = [
  { id: 1, label: "엑셀 파일 파싱 중...", duration: 800 },
  { id: 2, label: "영양 데이터 분석 중...", duration: 1200 },
  { id: 3, label: "AI 식단 패턴 학습 중...", duration: 1500 },
  { id: 4, label: "한 달 치 식단 생성 중...", duration: 2000 },
  { id: 5, label: "영양 균형 최적화 중...", duration: 1000 },
  { id: 6, label: "최종 식단 검토 중...", duration: 800 },
];

interface AnalyzingLoaderProps {
  isVisible: boolean;
  currentStep?: number; // 0-based index
  message?: string;
}

export default function AnalyzingLoader({
  isVisible,
  currentStep = 0,
  message,
}: AnalyzingLoaderProps) {
  const [animatedStep, setAnimatedStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (!isVisible) {
      setAnimatedStep(0);
      setCompletedSteps([]);
      return;
    }

    // 단계별 순차 애니메이션
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    ANALYSIS_STEPS.forEach((step, idx) => {
      const timer = setTimeout(() => {
        setAnimatedStep(idx);
        if (idx > 0) {
          setCompletedSteps((prev) => [...prev, idx - 1]);
        }
      }, elapsed);
      timers.push(timer);
      elapsed += step.duration;
    });

    return () => timers.forEach(clearTimeout);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-xl p-8 max-w-sm w-full mx-4">
        {/* 헤더 */}
        <div className="flex flex-col items-center mb-8">
          {/* 회전 애니메이션 아이콘 */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-bold">AI 식단 생성 중</h3>
          <p className="text-sm text-muted-foreground font-light mt-1 text-center">
            {message ?? "영양 균형을 고려한 맞춤형 식단을 생성하고 있습니다"}
          </p>
        </div>

        {/* 단계별 진행 상태 */}
        <div className="space-y-3">
          {ANALYSIS_STEPS.map((step, idx) => {
            const isCompleted = completedSteps.includes(idx);
            const isCurrent = animatedStep === idx;
            const isPending = idx > animatedStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  isPending ? "opacity-30" : "opacity-100"
                }`}
              >
                {/* 상태 아이콘 */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>

                {/* 단계 텍스트 */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    isCompleted
                      ? "text-muted-foreground line-through"
                      : isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground font-light"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* 전체 진행률 바 */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>진행률</span>
            <span>{Math.round(((animatedStep + 1) / ANALYSIS_STEPS.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{
                width: `${((animatedStep + 1) / ANALYSIS_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 안내 문구 */}
        <p className="text-xs text-muted-foreground font-light text-center mt-4">
          잠시만 기다려주세요. 보통 10~30초 소요됩니다.
        </p>
      </div>
    </div>
  );
}
