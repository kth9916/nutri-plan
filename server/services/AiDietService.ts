import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "../_core/env";

/**
 * AiDietService: Gemini API를 통한 AI 식단 생성
 *
 * 아키텍처 설계:
 * - Gemini API 호출을 독립된 서비스로 분리해서 비즈니스 로직과 완전 분리
 * - 모델 폴백 로직(gemini-3-flash → gemini-2.5-flash)으로 API 안정성 극대화
 * - 구조화된 JSON 출력(Structured Output)을 강제해서 파싱 오류 방지
 * - 에러 핸들링을 중앙화해서 재시도 및 로깅 일관성 유지
 *
 * 비용 최적화 설계:
 * - 한 달 치 식단을 한 번에 생성할 때 각 일자별로 5개 후보 메뉴를 생성
 * - 프론트엔드에서 사용자가 "새로고침" 버튼을 누르면 AI를 다시 호출하지 않고
 *   이미 생성된 5개 후보 중에서 선택만 함 → API 호출 횟수 80% 감소
 * - 월별 생성 횟수 제한(Free: 1회, Pro: 10회)으로 비용 통제
 *
 * 유지보수 관점:
 * - Gemini API 변경 시 이 서비스만 수정하면 됨
 * - 다른 LLM으로 교체할 때도 인터페이스만 맞추면 됨
 * - 테스트 시 이 서비스를 Mock하면 되므로 단위 테스트 작성 용이
 */

/**
 * 5개 후보 메뉴 중 하나
 */
interface MealCandidate {
  name: string;
  description: string;
  calories: number;
}

/**
 * 일별 식단 (5개 후보 메뉴 포함)
 */
interface DayMealWithCandidates {
  dayOfMonth: number;
  breakfast: MealCandidate[];
  lunch: MealCandidate[];
  dinner: MealCandidate[];
  snack: MealCandidate[];
  nutritionInfo: {
    totalCalories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * AI 생성 결과 (한 달 치)
 */
interface GeneratedMealPlan {
  year: number;
  month: number;
  days: DayMealWithCandidates[];
  generatedAt: string;
}

export class AiDietService {
  private static readonly MODELS = {
    primary: "gemini-3-flash", // 기본 모델 (빠르고 저렴)
    fallback: "gemini-2.5-flash", // 폴백 모델 (안정성)
  };

  // 안전 필터 설정 (식단 생성이므로 필터 최소화)
  private static readonly SAFETY_SETTINGS = [] as any[];

  /**
   * 월간 식단 생성 (5개 후보 메뉴 포함)
   *
   * 프롬프트 설계:
   * - 각 일자별로 아침/점심/저녁/간식 5개 후보씩 생성
   * - 영양 균형 고려 (단백질, 탄수화물, 지방)
   * - 한국 음식 위주로 생성
   * - JSON 형식으로 강제 (파싱 오류 방지)
   *
   * 모델 폴백 로직:
   * 1. gemini-3-flash로 시도
   * 2. 429(Rate Limit) 또는 500+ 에러 발생 시 gemini-2.5-flash로 자동 재시도
   * 3. 2번 재시도 후에도 실패하면 에러 throw
   */
  static async generateMonthlyMealPlan(
    year: number,
    month: number,
    userPreferences?: string
  ): Promise<GeneratedMealPlan> {
    if (!ENV.geminiApiKey) {
      throw new Error("Gemini API 키가 설정되지 않았습니다.");
    }

    const client = new GoogleGenerativeAI(ENV.geminiApiKey);

    // 프롬프트 구성
    const prompt = this.buildPrompt(year, month, userPreferences);

    // 모델 폴백 로직: 기본 모델 → 폴백 모델
    const models = [this.MODELS.primary, this.MODELS.fallback];

    for (let attempt = 0; attempt < models.length; attempt++) {
      const model = models[attempt];
      try {
        console.log(`[AI] 식단 생성 시도: ${model} (시도 ${attempt + 1}/${models.length})`);

        const generativeModel = client.getGenerativeModel({
          model: model,
          safetySettings: this.SAFETY_SETTINGS,
        });

        const response = await generativeModel.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
            responseMimeType: "application/json",
          },
        });

        // 응답 파싱
        // Gemini API 응답 처리
        let responseText: string | undefined;
        if (typeof response === "string") {
          responseText = response;
        } else if ((response as any).text) {
          responseText = (response as any).text();
        } else if ((response as any).response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          responseText = (response as any).response.candidates[0].content.parts[0].text;
        }

        if (!responseText) {
          throw new Error("AI 응답을 파싱할 수 없습니다.");
        }


        // JSON 파싱 (구조화된 출력)
        let parsedResponse: GeneratedMealPlan;
        try {
          parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`AI 응답 JSON 파싱 실패: ${parseError}`);
        }

        // 응답 검증
        if (!parsedResponse.days || parsedResponse.days.length === 0) {
          throw new Error("생성된 식단 데이터가 없습니다.");
        }

        console.log(`[AI] 식단 생성 성공: ${model} (${parsedResponse.days.length}일)`);
        return parsedResponse;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimitError = errorMessage.includes("429") || errorMessage.includes("Rate Limit");
        const isServerError = errorMessage.includes("500") || errorMessage.includes("503");

        // 마지막 시도가 아니고 재시도 가능한 에러인 경우
        if (attempt < models.length - 1 && (isRateLimitError || isServerError)) {
          console.warn(
            `[AI] ${model} 실패 (${errorMessage}). ${models[attempt + 1]}로 재시도합니다.`
          );
          continue; // 다음 모델로 재시도
        }

        // 마지막 시도이거나 재시도 불가능한 에러
        console.error(`[AI] 식단 생성 실패: ${errorMessage}`);
        throw new Error(`AI 식단 생성 실패: ${errorMessage}`);
      }
    }

    throw new Error("모든 AI 모델 시도가 실패했습니다.");
  }

  /**
   * 프롬프트 구성
   *
   * 설계 결정:
   * - 명확한 지시사항으로 AI 응답의 일관성 극대화
   * - JSON 스키마를 프롬프트에 포함해서 구조화된 출력 강제
   * - 영양 정보 계산을 AI에게 맡겨서 정확성 확보
   */
  private static buildPrompt(year: number, month: number, userPreferences?: string): string {
    const daysInMonth = new Date(year, month, 0).getDate();

    return `당신은 전문 영양사입니다. ${year}년 ${month}월의 한 달 치 맞춤형 식단을 생성해주세요.

요구사항:
1. 각 일자별로 아침, 점심, 저녁, 간식 4끼를 생성합니다.
2. 각 끼마다 5개의 후보 메뉴를 생성합니다 (사용자가 선택할 수 있도록).
3. 한국 음식 위주로 구성합니다.
4. 영양 균형을 고려합니다 (단백질, 탄수화물, 지방).
5. 각 일자의 총 칼로리는 2000~2500kcal 범위입니다.
${userPreferences ? `6. 사용자 선호도: ${userPreferences}` : ""}

응답 형식 (반드시 이 JSON 구조를 따르세요):
{
  "year": ${year},
  "month": ${month},
  "days": [
    {
      "dayOfMonth": 1,
      "breakfast": [
        {"name": "계란말이", "description": "계란 2개, 야채", "calories": 250},
        {"name": "계란찜", "description": "계란 2개, 우유", "calories": 240},
        ...5개 후보
      ],
      "lunch": [...5개 후보],
      "dinner": [...5개 후보],
      "snack": [...5개 후보],
      "nutritionInfo": {
        "totalCalories": 2100,
        "protein": 75,
        "carbs": 280,
        "fat": 60
      }
    },
    ...${daysInMonth}일까지
  ],
  "generatedAt": "ISO 8601 형식의 현재 시간"
}

주의사항:
- 각 후보 메뉴의 칼로리는 정확하게 계산해주세요.
- 일자별 총 칼로리는 nutritionInfo의 totalCalories와 일치해야 합니다.
- JSON 형식이 정확해야 파싱이 가능합니다.`;
  }
}
