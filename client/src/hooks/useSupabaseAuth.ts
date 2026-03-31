/**
 * Supabase Auth 훅
 *
 * 아키텍처 설계:
 * - 기존 Manus OAuth useAuth 훅을 Supabase Auth로 교체
 * - 간단한 인터페이스: user, loading, isAuthenticated, logout
 * - 실시간 세션 감지 (onAuthStateChange)
 *
 * 이 방식을 선택한 이유:
 * 1. 단순성: Supabase 공식 API를 직접 래핑하기만 함
 * 2. 타입 안정성: Supabase User 타입 그대로 사용
 * 3. 유지보수성: 커스텀 로직 최소화
 */

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  getLoginUrl: () => string;
}

export function useSupabaseAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 실시간 인증 상태 변화 감지 (타입 에러 _event: string, session: any 로 수정)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const getLoginUrl = () => {
    // Supabase 로그인 페이지 URL
    return "/login";
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    getLoginUrl,
  };
}
