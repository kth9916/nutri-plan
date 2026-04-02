import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, ArrowLeft, Mail, LogIn, UserPlus } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type AuthMode = 'login' | 'signup' | 'forgot_password';

export default function Login() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workplaceCategory, setWorkplaceCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("이메일을 입력해주세요.");
      return;
    }
    
    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        if (!password || !name) {
          toast.error("이름과 비밀번호를 모두 입력해주세요.");
          return;
        }
        if (password.length < 6) {
          toast.error("비밀번호는 최소 6자 이상이어야 합니다.");
          return;
        }
        
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              workplaceCategory,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });
        
        if (error) throw error;

        // 이메일 인증이 꺼져있으면 바로 세션이 생성됨 → 대시보드로 이동
        if (signUpData.session) {
          toast.success("가입이 완료되었습니다!");
          try { await refresh(); } catch (_) { /* ignore */ }
          window.location.href = "/dashboard";
          return;
        }
        
        toast.success("가입이 완료되었습니다! 가입 승인을 위해 메일함을 확인해주세요.");
        setAuthMode('login');
        setPassword("");
        
      } else if (authMode === 'login') {
        if (!password) {
          toast.error("비밀번호를 입력해주세요.");
          return;
        }
        
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            toast.error("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
          } else {
            toast.error("이메일 또는 비밀번호가 올바르지 않습니다.");
          }
          return;
        }
        
        toast.success("로그인 성공!");
        window.location.href = "/dashboard";
        
      } else if (authMode === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        
        if (error) throw error;
        toast.success("비밀번호 재설정 링크가 이메일로 발송되었습니다.");
        setAuthMode('login');
        setPassword("");
      }
    } catch (err: any) {
      toast.error(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

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
      toast.error(`${provider} 연동에 실패했습니다.`);
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
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {authMode === 'login' ? '환영합니다' : authMode === 'signup' ? '계정 만들기' : '비밀번호 찾기'}
            </h1>
            <p className="text-sm text-muted-foreground font-light text-center px-4">
              {authMode === 'login' ? 'NutriPlan과 함께 스마트한 식단 관리를 시작하세요' :
               authMode === 'signup' ? '가입하고 모든 기능을 체험해보세요' : 
               '가입하신 이메일을 입력하시면 재설정 링크를 보내드립니다'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-2">
            {authMode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">이름 (닉네임)</label>
                  <Input
                    type="text"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">소속 장소 (선택)</label>
                  <select
                    value={workplaceCategory}
                    onChange={(e) => setWorkplaceCategory(e.target.value)}
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                  >
                    <option value="" disabled>영양사님 근무처를 선택해주세요</option>
                    <option value="학교">학교</option>
                    <option value="공장">공장 및 기업체</option>
                    <option value="병원">병원 및 보건소</option>
                    <option value="사회복지시설">사회복지시설</option>
                    <option value="호텔">호텔 및 레스토랑</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground pl-1">이메일 주소</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
                disabled={isLoading}
              />
            </div>
            
            {authMode !== 'forgot_password' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center pr-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">비밀번호</label>
                  {authMode === 'login' && (
                    <button type="button" onClick={() => setAuthMode('forgot_password')} className="text-xs text-primary hover:underline" disabled={isLoading}>
                      비밀번호를 잊으셨나요?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
                  disabled={isLoading}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-medium mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {authMode === 'login' ? <LogIn className="w-4 h-4" /> : authMode === 'signup' ? <UserPlus className="w-4 h-4" /> : <Mail className="w-4 h-4" />} 
                  {authMode === 'login' ? '이메일로 로그인' : authMode === 'signup' ? '가입하기' : '재설정 링크 보내기'}
                </span>
              )}
            </Button>
          </form>

          {/* Toggle buttons */}
          <div className="flex justify-center space-x-2 text-sm mt-4 mb-6">
            {authMode === 'login' ? (
              <p className="text-muted-foreground">계정이 없으신가요? <button type="button" onClick={() => setAuthMode('signup')} className="font-medium text-primary hover:underline disabled:opacity-50" disabled={isLoading}>회원가입</button></p>
            ) : (
              <p className="text-muted-foreground">이미 계정이 있으신가요? <button type="button" onClick={() => setAuthMode('login')} className="font-medium text-primary hover:underline disabled:opacity-50" disabled={isLoading}>로그인</button></p>
            )}
          </div>

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
