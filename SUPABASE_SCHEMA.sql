/**
 * NutriPlan - Supabase PostgreSQL 스키마
 * 
 * 이 스크립트는 Supabase 대시보드의 SQL Editor에서 직접 실행하세요.
 * 모든 테이블 생성 및 RLS(Row Level Security) 정책이 포함되어 있습니다.
 * 
 * 실행 순서:
 * 1. 테이블 생성 (users, meal_plans, meal_days, uploaded_files, subscriptions, notifications, meal_plan_usage)
 * 2. RLS 활성화
 * 3. RLS 정책 설정 (각 테이블별 SELECT, INSERT, UPDATE, DELETE)
 */

-- ============================================================================
-- 1. 테이블 생성
-- ============================================================================

-- users 테이블
-- Supabase Auth와 동기화되는 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- meal_plans 테이블
-- 월간 식단 계획 정보 저장
CREATE TABLE IF NOT EXISTS meal_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  source_file_id BIGINT,
  status VARCHAR(50) DEFAULT 'generating' CHECK (status IN ('generating', 'pending_review', 'confirmed')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- meal_days 테이블
-- 일자별 식단 정보 (5개 후보 메뉴 포함)
CREATE TABLE IF NOT EXISTS meal_days (
  id BIGSERIAL PRIMARY KEY,
  meal_plan_id BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  meals JSONB NOT NULL, -- {breakfast, breakfast_description, lunch, lunch_description, dinner, dinner_description, snack}
  nutrition_info JSONB NOT NULL, -- {total_calories, protein, carbohydrates, fat}
  candidates JSONB DEFAULT '[]'::jsonb, -- 5개 후보 메뉴 배열
  selected_candidate_index INTEGER DEFAULT 0 CHECK (selected_candidate_index >= 0 AND selected_candidate_index <= 4),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'replaced')),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meal_plan_id, day_of_month)
);

-- uploaded_files 테이블
-- 영양사가 업로드한 엑셀 파일 정보
CREATE TABLE IF NOT EXISTS uploaded_files (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  s3_key TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- subscriptions 테이블
-- 사용자 구독 정보 (Free/Pro 플랜)
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('free', 'pro')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- payment_orders 테이블
-- 포트원 결제 주문 정보
CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('free', 'pro')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- notifications 테이블
-- 인앱 알림 저장
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL CHECK (type IN ('meal_confirmed', 'payment_success', 'payment_failed', 'plan_generated')),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- meal_plan_usage 테이블
-- 월별 식단 생성 횟수 추적 (Free: 월 1회, Pro: 월 10회)
CREATE TABLE IF NOT EXISTS meal_plan_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  generation_count INTEGER DEFAULT 0,
  max_count INTEGER NOT NULL CHECK (max_count IN (1, 10)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- ============================================================================
-- 2. 인덱스 생성 (쿼리 성능 최적화)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_year_month ON meal_plans(year, month);
CREATE INDEX IF NOT EXISTS idx_meal_days_meal_plan_id ON meal_days(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_usage_user_id ON meal_plan_usage(user_id);

-- ============================================================================
-- 3. RLS(Row Level Security) 활성화
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS 정책 설정
-- ============================================================================

-- ============================================================================
-- users 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 새 사용자 프로필 자동 생성 (Auth 가입 시)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- meal_plans 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 식단 계획만 조회 가능
CREATE POLICY "Users can view own meal plans" ON meal_plans
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 식단 계획만 생성 가능
CREATE POLICY "Users can create own meal plans" ON meal_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 식단 계획만 수정 가능
CREATE POLICY "Users can update own meal plans" ON meal_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- 사용자는 자신의 식단 계획만 삭제 가능
CREATE POLICY "Users can delete own meal plans" ON meal_plans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- meal_days 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 식단 일자만 조회 가능 (meal_plans를 통한 간접 참조)
CREATE POLICY "Users can view own meal days" ON meal_days
  FOR SELECT USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 식단 일자만 생성 가능
CREATE POLICY "Users can create own meal days" ON meal_days
  FOR INSERT WITH CHECK (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 식단 일자만 수정 가능
CREATE POLICY "Users can update own meal days" ON meal_days
  FOR UPDATE USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 식단 일자만 삭제 가능
CREATE POLICY "Users can delete own meal days" ON meal_days
  FOR DELETE USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- uploaded_files 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 파일만 조회 가능
CREATE POLICY "Users can view own files" ON uploaded_files
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 파일만 생성 가능
CREATE POLICY "Users can create own files" ON uploaded_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 파일만 삭제 가능
CREATE POLICY "Users can delete own files" ON uploaded_files
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- subscriptions 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 구독 정보만 조회 가능
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 구독 정보만 수정 가능
CREATE POLICY "Users can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- 서버는 구독 정보 생성 가능 (결제 완료 시)
CREATE POLICY "Service can insert subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- payment_orders 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 결제 주문만 조회 가능
CREATE POLICY "Users can view own payment orders" ON payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 결제 주문만 생성 가능
CREATE POLICY "Users can create own payment orders" ON payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 서버는 결제 주문 상태 업데이트 가능
CREATE POLICY "Service can update payment orders" ON payment_orders
  FOR UPDATE USING (true);

-- ============================================================================
-- notifications 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 알림만 수정 가능 (읽음 처리)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 서버는 알림 생성 가능
CREATE POLICY "Service can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- meal_plan_usage 테이블 RLS 정책
-- ============================================================================

-- 사용자는 자신의 사용량만 조회 가능
CREATE POLICY "Users can view own usage" ON meal_plan_usage
  FOR SELECT USING (auth.uid() = user_id);

-- 서버는 사용량 생성/수정 가능
CREATE POLICY "Service can insert usage" ON meal_plan_usage
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update usage" ON meal_plan_usage
  FOR UPDATE USING (true);

-- ============================================================================
-- 5. 트리거 함수 (자동 updated_at 업데이트)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 모든 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_days_updated_at BEFORE UPDATE ON meal_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploaded_files_updated_at BEFORE UPDATE ON uploaded_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_orders_updated_at BEFORE UPDATE ON payment_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plan_usage_updated_at BEFORE UPDATE ON meal_plan_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
