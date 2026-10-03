import { db } from "../db/connection";
import { authUser } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  plus: 20,
  pro: 50,
  team: 200,
};

export async function checkUsage(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const limit = TIER_LIMITS[tier] ?? 3;

  const rows = await db
    .select({ dailyChecks: authUser.dailyChecks, lastCheckDate: authUser.lastCheckDate })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row || row.lastCheckDate !== today) {
    return { allowed: true, remaining: limit, limit };
  }

  const count = row.dailyChecks ?? 0;
  if (count >= limit) {
    logger.warn({ userId, tier, count, limit }, "Usage limit reached");
    return { allowed: false, remaining: 0, limit };
  }

  return { allowed: true, remaining: limit - count, limit };
}

export async function recordUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0] ?? "";

  const rows = await db
    .select({ lastCheckDate: authUser.lastCheckDate, dailyChecks: authUser.dailyChecks })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  const row = rows[0];
  const isNewDay = !row || row.lastCheckDate !== today;

  await db
    .update(authUser)
    .set({
      dailyChecks: isNewDay ? 1 : (row?.dailyChecks ?? 0) + 1,
      lastCheckDate: today,
    })
    .where(eq(authUser.id, userId));
}
