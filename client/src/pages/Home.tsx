import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Sparkles,
  Calendar,
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
  Upload,
  Bell,
  Shield,
  Zap,
  ChevronRight,
  User,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * NutriPlan 랜딩 페이지
 *
 * 디자인 방향: 스칸디나비안 미니멀
 * - 쿨 그레이 배경 + 여유로운 네거티브 스페이스
 * - 굵은 검정 산세리프 헤딩 + 얇은 서브타이틀
 * - 파스텔 블루 + 블러시 핑크 추상 기하학 도형 포인트
 *
 * 구조: Hero → Features → How It Works → Pricing CTA → Footer
 */
export default function Home() {
  const { isAuthenticated, user, logout } = useAuth();
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ===== Navigation ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">NutriPlan</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">기능</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">사용 방법</a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">요금제</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 flex items-center gap-2 rounded-full pr-2 pl-2">
                    <span className="text-sm font-medium">{user?.name}님</span>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end" forceMount>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>대시보드</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard/mypage")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>마이페이지</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>로그아웃</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
                  로그인
                </Button>
                <Button size="sm" onClick={handleGetStarted}>
                  무료 시작 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* 스칸디나비안 추상 기하학 배경 도형 */}
        <div className="absolute top-20 right-[10%] w-72 h-72 rounded-full opacity-40"
          style={{ background: "oklch(0.83 0.05 220 / 0.35)", filter: "blur(60px)" }} />
        <div className="absolute top-40 right-[5%] w-48 h-48 opacity-30"
          style={{
            background: "oklch(0.88 0.04 10 / 0.5)",
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            filter: "blur(40px)"
          }} />
        <div className="absolute bottom-0 left-[5%] w-56 h-56 rounded-full opacity-25"
          style={{ background: "oklch(0.83 0.05 220 / 0.3)", filter: "blur(50px)" }} />

        <div className="container relative">
          <div className="max-w-4xl">
            <Badge variant="secondary" className="mb-6 text-xs font-medium px-3 py-1.5">
              <Sparkles className="w-3 h-3 mr-1.5" />
              AI 기반 맞춤형 식단 추천
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6" style={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              영양사를 위한<br />
              <span className="text-primary">스마트 식단</span><br />
              관리 플랫폼
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mb-10 leading-relaxed">
              엑셀 파일 하나로 AI가 한 달 치 맞춤형 식단을 자동 생성합니다.
              영양 균형을 고려한 추천, 간편한 승인 워크플로우, 그리고 실무에 바로 활용 가능한 엑셀 다운로드까지.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={handleGetStarted} className="text-base px-8 h-12">
                무료로 시작하기
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="text-base px-8 h-12">
                요금제 보기
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-6 mt-12 pt-8 border-t border-border/50">
              <div>
                <div className="text-2xl font-bold">500+</div>
                <div className="text-xs text-muted-foreground font-light">활성 영양사</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-2xl font-bold">12,000+</div>
                <div className="text-xs text-muted-foreground font-light">생성된 식단</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-2xl font-bold">98%</div>
                <div className="text-xs text-muted-foreground font-light">고객 만족도</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section id="features" className="py-24 bg-card">
        <div className="container">
          <div className="max-w-2xl mb-16">
            <Badge variant="outline" className="mb-4 text-xs">핵심 기능</Badge>
            <h2 className="text-4xl font-bold mb-4">영양사 업무를<br />더 스마트하게</h2>
            <p className="text-muted-foreground font-light leading-relaxed">
              반복적인 식단 작성 업무를 AI에게 맡기고, 영양사는 더 중요한 상담과 케어에 집중하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Upload,
                color: "bg-accent",
                iconColor: "text-accent-foreground",
                title: "엑셀 업로드",
                desc: "기존 식단 데이터가 담긴 엑셀 파일을 업로드하면 AI가 자동으로 분석합니다.",
              },
              {
                icon: Sparkles,
                color: "bg-secondary",
                iconColor: "text-secondary-foreground",
                title: "AI 식단 자동 생성",
                desc: "영양 균형, 계절성, 선호도를 고려한 한 달 치 맞춤형 식단을 자동으로 추천합니다.",
              },
              {
                icon: Calendar,
                color: "bg-accent",
                iconColor: "text-accent-foreground",
                title: "달력 형태 미리보기",
                desc: "한 달 치 식단을 달력 형태로 한눈에 확인하고 일자별로 검토할 수 있습니다.",
              },
              {
                icon: CheckCircle,
                color: "bg-secondary",
                iconColor: "text-secondary-foreground",
                title: "승인 워크플로우",
                desc: "일자별 식단을 승인하거나 AI에게 재생성을 요청하는 직관적인 인터랙션을 제공합니다.",
              },
              {
                icon: FileSpreadsheet,
                color: "bg-accent",
                iconColor: "text-accent-foreground",
                title: "엑셀 다운로드",
                desc: "최종 확정된 식단을 실무에서 바로 사용 가능한 깔끔한 엑셀 파일로 다운로드합니다.",
              },
              {
                icon: Bell,
                color: "bg-secondary",
                iconColor: "text-secondary-foreground",
                title: "알림 시스템",
                desc: "식단 확정, 결제 완료 등 중요한 이벤트 발생 시 인앱 알림을 즉시 받아보세요.",
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border/50 bg-background hover:border-primary/30 transition-all duration-200 group">
                <div className={`w-10 h-10 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section id="how-it-works" className="py-24">
        <div className="container">
          <div className="max-w-2xl mb-16">
            <Badge variant="outline" className="mb-4 text-xs">사용 방법</Badge>
            <h2 className="text-4xl font-bold mb-4">4단계로 완성되는<br />월간 식단 계획</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "파일 업로드", desc: "기존 식단 엑셀 파일을 드래그앤드롭으로 업로드", icon: Upload },
              { step: "02", title: "AI 분석", desc: "AI가 영양 균형을 분석하고 한 달 치 식단 자동 생성", icon: Sparkles },
              { step: "03", title: "검토 & 승인", desc: "달력에서 일자별 식단을 확인하고 승인 또는 교체", icon: CheckCircle },
              { step: "04", title: "엑셀 다운로드", desc: "최종 확정된 식단을 깔끔한 엑셀 파일로 다운로드", icon: FileSpreadsheet },
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-muted-foreground mb-1">{item.step}</div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pricing CTA ===== */}
      <section className="py-24 bg-card">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden bg-foreground text-background p-12 md:p-16">
            {/* 배경 장식 */}
            <div className="absolute top-0 right-0 w-96 h-96 opacity-10"
              style={{ background: "oklch(0.83 0.05 220)", borderRadius: "50%", filter: "blur(80px)", transform: "translate(30%, -30%)" }} />
            <div className="absolute bottom-0 left-0 w-64 h-64 opacity-10"
              style={{ background: "oklch(0.88 0.04 10)", borderRadius: "50%", filter: "blur(60px)", transform: "translate(-30%, 30%)" }} />

            <div className="relative max-w-2xl">
              <Badge className="mb-6 bg-background/20 text-background border-background/30 text-xs">
                <Zap className="w-3 h-3 mr-1.5" />
                지금 시작하세요
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-background">
                무료로 시작하고<br />필요할 때 업그레이드
              </h2>
              <p className="text-background/70 font-light mb-8 leading-relaxed">
                Free 플랜으로 핵심 기능을 먼저 경험해보세요.
                더 많은 식단 생성과 고급 기능이 필요하다면 Pro 플랜으로 업그레이드하세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="secondary" onClick={handleGetStarted} className="text-base px-8 h-12">
                  무료로 시작하기
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}
                  className="text-base px-8 h-12 border-background/30 text-background hover:bg-background/10">
                  요금제 비교
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="py-12 border-t border-border/50">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">NutriPlan</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">개인정보처리방침</a>
              <a href="#" className="hover:text-foreground transition-colors">이용약관</a>
              <a href="#" className="hover:text-foreground transition-colors">고객지원</a>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>© 2026 NutriPlan. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
