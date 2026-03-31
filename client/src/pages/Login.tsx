import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, ArrowLeft, Mail, LogIn } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 이메일 비밀번호 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.");
        return;
      }

      toast.success("로그인 성공!");
      // useAuth의 캐시를 갱신
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      toast.error("알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 소셜 로그인 (OAuth)
  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err) {
      toast.error(`${provider} 로그인에 실패했습니다.`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* 배경 장식 (스칸디나비안 미니멀리즘 기하학) */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: "oklch(0.88 0.04 10)", filter: "blur(80px)" }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
        style={{ background: "oklch(0.83 0.05 220)", filter: "blur(100px)" }} />

      {/* 헤더 네비게이션 */}
      <nav className="relative z-10 container flex items-center justify-between h-16 mt-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-6 shadow-sm">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">환영합니다</h1>
            <p className="text-sm text-muted-foreground font-light text-center">
              NutriPlan과 함께 스마트한 식단 관리를 시작하세요
            </p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground pl-1">이메일</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground pl-1">비밀번호</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-medium mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> 이메일로 계속하기
                </span>
              )}
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-light">
                간편 로그인
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl bg-background/50 hover:bg-background/80"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-black border-none"
              onClick={() => handleSocialLogin('kakao')}
              disabled={isLoading}
            >
              Kakao
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
