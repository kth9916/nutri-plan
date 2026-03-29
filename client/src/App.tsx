import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import MealPlans from "./pages/MealPlans";
import MealPlanDetail from "./pages/MealPlanDetail";
import Files from "./pages/Files";
import Notifications from "./pages/Notifications";
import Subscription from "./pages/Subscription";

/**
 * 라우트 구조:
 * / → 랜딩 페이지 (공개)
 * /pricing → 가격 정책 페이지 (공개)
 * /dashboard → 대시보드 홈 (인증 필요)
 * /dashboard/upload → 엑셀 업로드 (인증 필요)
 * /dashboard/plans → 식단 플랜 목록 (인증 필요)
 * /dashboard/plans/:id → 식단 플랜 상세 (인증 필요)
 * /dashboard/files → 파일 관리 (인증 필요)
 * /dashboard/notifications → 알림 (인증 필요)
 * /dashboard/subscription → 구독 관리 (인증 필요)
 *
 * 인증 처리: 각 페이지 컴포넌트 내부에서 useAuth()로 처리
 * (중앙화된 ProtectedRoute 대신 분산 처리 방식 선택)
 *
 * 리팩토링 방향:
 * - ProtectedRoute 컴포넌트로 인증 로직 중앙화 가능
 * - 현재 방식은 각 페이지가 독립적으로 인증 처리하여 유연성 높음
 */
function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />

      {/* Dashboard Routes (Auth Required) */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/upload" component={Upload} />
      <Route path="/dashboard/plans" component={MealPlans} />
      <Route path="/dashboard/plans/:id" component={MealPlanDetail} />
      <Route path="/dashboard/files" component={Files} />
      <Route path="/dashboard/notifications" component={Notifications} />
      <Route path="/dashboard/subscription" component={Subscription} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
