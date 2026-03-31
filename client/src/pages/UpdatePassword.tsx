import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "../../../lib/supabase";
import { KeyRound, CheckCircle2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function UpdatePassword() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Note: PKCE 복구 링크를 클릭했을 때 브라우저가 자동으로 인증을 완료합니다.
  // 이 화면에 진입했다면 백그라운드에서 session 교환이 진행 중이거나 왼료된 상태입니다.

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error("비밀번호 변경에 실패했습니다. 유효하지 않은 링크이거나 세션이 만료되었습니다. 다시 시도해주세요.");
        return;
      }

      setIsSuccess(true);
      toast.success("비밀번호가 성공적으로 변경되었습니다!");
      
      // 3초 뒤 대시보드로 이동
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
      toast.error("알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">변경 완료</h1>
          <p className="text-sm text-muted-foreground mb-8">
            새로운 비밀번호로 안전하게 변경되었습니다. 잠시 후 대시보드로 이동합니다.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full h-12 rounded-xl">대시보드로 바로가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: "oklch(0.88 0.04 10)", filter: "blur(80px)" }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
        style={{ background: "oklch(0.83 0.05 220)", filter: "blur(100px)" }} />

      <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-6 shadow-sm">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">새 비밀번호 설정</h1>
          <p className="text-sm text-muted-foreground font-light text-center">
            새롭게 사용할 비밀번호를 입력해주세요.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground pl-1">새 비밀번호</label>
            <Input
              type="password"
              placeholder="최소 6자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground pl-1">비밀번호 확인</label>
            <Input
              type="password"
              placeholder="비밀번호 다시 입력"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="h-12 rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/20"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-medium mt-4"
            disabled={isLoading || !password || !passwordConfirm}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                변경 중...
              </span>
            ) : "비밀번호 재설정 완료"}
          </Button>
        </form>
      </div>
    </div>
  );
}
