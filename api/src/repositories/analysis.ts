import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { videoAnalyses, claims } from "../db/schema";

export const analysisRepository = {
  async findByVideoId(videoId: string) {
    const results = await db
      .select()
      .from(videoAnalyses)
      .where(eq(videoAnalyses.videoId, videoId))
      .limit(1);
    return results[0] ?? null;
  },

  async createAnalysis(data: typeof videoAnalyses.$inferInsert) {
    const results = await db
      .insert(videoAnalyses)
      .values(data)
      .onConflictDoUpdate({
        target: videoAnalyses.videoId,
        set: {
          grade: data.grade,
          authenticity: data.authenticity,
          accuracy: data.accuracy,
          bsMeter: data.bsMeter,
          clickbait: data.clickbait,
          originality: data.originality,
          contentDensity: data.contentDensity,
          valueDelivered: data.valueDelivered,
          summary: data.summary,
          transcript: data.transcript,
          analyzedAt: new Date(),
        },
      })
      .returning();
    return results[0] ?? null;
  },

  async getClaimsForVideo(videoId: string) {
    return db.select().from(claims).where(eq(claims.videoId, videoId));
  },

  async insertClaims(claimsList: (typeof claims.$inferInsert)[]) {
    if (claimsList.length === 0) return [];
    return db.insert(claims).values(claimsList).returning();
  },
};
