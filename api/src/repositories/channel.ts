import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { channels } from "../db/schema";

export const channelRepository = {
  async findByChannelId(channelId: string) {
    const results = await db
      .select()
      .from(channels)
      .where(eq(channels.channelId, channelId))
      .limit(1);
    return results[0] ?? null;
  },

  async findByNiche(niche: string) {
    return db.select().from(channels).where(eq(channels.niche, niche));
  },

  async upsert(data: typeof channels.$inferInsert) {
    return db
      .insert(channels)
      .values(data)
      .onConflictDoUpdate({
        target: channels.channelId,
        set: {
          name: data.name,
          tier: data.tier,
          tierReason: data.tierReason,
          trustScore: data.trustScore,
          format: data.format,
          subscriberCount: data.subscriberCount,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
  },
};
