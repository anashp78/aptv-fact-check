import {
  pgTable,
  text,
  integer,
  timestamp,
  real,
  jsonb,
  uuid,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const claimVerdictEnum = pgEnum("claim_verdict", [
  "verified",
  "false",
  "unverified",
  "opinion",
]);

export const channelTierEnum = pgEnum("channel_tier", ["1", "2", "3", "4"]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "plus",
  "pro",
  "team",
]);

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  name: text("name").notNull(),
  tier: channelTierEnum("tier"),
  tierReason: text("tier_reason"),
  trustScore: integer("trust_score").default(50),
  niche: text("niche").default("gambling"),
  format: text("format"),
  subscriberCount: integer("subscriber_count"),
  videosAnalyzed: integer("videos_analyzed").default(0),
  accuracyTrend: jsonb("accuracy_trend").$type<number[]>().default([]),
  nicheCredibility: jsonb("niche_credibility")
    .$type<Record<string, number>>()
    .default({}),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoAnalyses = pgTable("video_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: text("video_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
  title: text("title"),
  grade: text("grade"),
  authenticity: real("authenticity"),
  accuracy: real("accuracy"),
  bsMeter: real("bs_meter"),
  clickbait: real("clickbait"),
  originality: real("originality"),
  contentDensity: real("content_density"),
  valueDelivered: real("value_delivered"),
  summary: jsonb("summary").$type<string[]>().default([]),
  transcript: text("transcript"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: text("video_id").notNull(),
  text: text("text").notNull(),
  timestamp: text("timestamp"),
  verdict: claimVerdictEnum("verdict").notNull(),
  evidence: text("evidence"),
  sources: jsonb("sources").$type<string[]>().default([]),
  checkedAgainst: text("checked_against"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const factLibrary = pgTable("fact_library", {
  id: uuid("id").defaultRandom().primaryKey(),
  niche: text("niche").notNull(),
  category: text("category").notNull(),
  fact: text("fact").notNull(),
  source: text("source"),
  verified: boolean("verified").default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commentProfiles = pgTable("comment_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  videoId: text("video_id").notNull(),
  credibilityScore: integer("credibility_score").default(50),
  accountAge: text("account_age"),
  activityGap: boolean("activity_gap").default(false),
  channelSpecific: boolean("channel_specific").default(false),
  sockPuppetProbability: real("sock_puppet_probability").default(0),
  writingFingerprint: jsonb("writing_fingerprint")
    .$type<Record<string, unknown>>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legacy users table (kept for backward compat)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  tier: subscriptionTierEnum("tier").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  dailyChecks: integer("daily_checks").default(0),
  lastCheckDate: text("last_check_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Better-Auth tables ──────────────────────────────────────────────────────

export const authUser = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  tier: subscriptionTierEnum("tier").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  dailyChecks: integer("daily_checks").default(0),
  lastCheckDate: text("last_check_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authSession = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUser.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authAccount = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUser.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authVerification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
