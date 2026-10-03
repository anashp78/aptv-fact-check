CREATE TYPE "public"."channel_tier" AS ENUM('1', '2', '3', '4');--> statement-breakpoint
CREATE TYPE "public"."claim_verdict" AS ENUM('verified', 'false', 'unverified', 'opinion');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'plus', 'pro', 'team');--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"name" text NOT NULL,
	"tier" "channel_tier",
	"tier_reason" text,
	"trust_score" integer DEFAULT 50,
	"niche" text DEFAULT 'gambling',
	"format" text,
	"subscriber_count" integer,
	"videos_analyzed" integer DEFAULT 0,
	"accuracy_trend" jsonb DEFAULT '[]'::jsonb,
	"niche_credibility" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"text" text NOT NULL,
	"timestamp" text,
	"verdict" "claim_verdict" NOT NULL,
	"evidence" text,
	"sources" jsonb DEFAULT '[]'::jsonb,
	"checked_against" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"video_id" text NOT NULL,
	"credibility_score" integer DEFAULT 50,
	"account_age" text,
	"activity_gap" boolean DEFAULT false,
	"channel_specific" boolean DEFAULT false,
	"sock_puppet_probability" real DEFAULT 0,
	"writing_fingerprint" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche" text NOT NULL,
	"category" text NOT NULL,
	"fact" text NOT NULL,
	"source" text,
	"verified" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"daily_checks" integer DEFAULT 0,
	"last_check_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"title" text,
	"grade" text,
	"authenticity" real,
	"accuracy" real,
	"bs_meter" real,
	"clickbait" real,
	"originality" real,
	"content_density" real,
	"value_delivered" real,
	"summary" jsonb DEFAULT '[]'::jsonb,
	"transcript" text,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_analyses_video_id_unique" UNIQUE("video_id")
);
