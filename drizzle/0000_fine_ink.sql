CREATE TYPE "public"."file_status" AS ENUM('uploaded', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meal_day_status" AS ENUM('pending', 'approved', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."meal_plan_status" AS ENUM('draft', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "meal_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"mealPlanId" integer NOT NULL,
	"dayOfMonth" integer NOT NULL,
	"meals" json NOT NULL,
	"candidates" json,
	"selectedCandidateIndex" integer DEFAULT 0 NOT NULL,
	"nutritionInfo" json,
	"status" "meal_day_status" DEFAULT 'pending' NOT NULL,
	"approvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"generationCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sourceFileId" integer,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"title" varchar(255),
	"requestPrompt" text,
	"status" "meal_plan_status" DEFAULT 'draft' NOT NULL,
	"exportFileKey" varchar(512),
	"exportFileUrl" text,
	"confirmedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"orderId" varchar(128) NOT NULL,
	"paymentKey" varchar(256),
	"plan" "plan" DEFAULT 'pro' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"fileKey" varchar(512) NOT NULL,
	"fileUrl" text NOT NULL,
	"originalName" varchar(255) NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" varchar(128) NOT NULL,
	"status" "file_status" DEFAULT 'uploaded' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_daily_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"generationCount" integer DEFAULT 0 NOT NULL,
	"exchangeCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_date_idx" UNIQUE("userId","date")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"workplaceCategory" varchar(128),
	"role" "role" DEFAULT 'user' NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "meal_days" ADD CONSTRAINT "meal_days_mealPlanId_meal_plans_id_fk" FOREIGN KEY ("mealPlanId") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_usage" ADD CONSTRAINT "meal_plan_usage_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_sourceFileId_uploaded_files_id_fk" FOREIGN KEY ("sourceFileId") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_daily_usage" ADD CONSTRAINT "user_daily_usage_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;