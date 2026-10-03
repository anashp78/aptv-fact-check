import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/connection";
import { videoAnalyses } from "../db/schema";
import { inArray, eq, desc } from "drizzle-orm";

export const gradeRoutes = new Hono();

// Bulk lookup grades for multiple video IDs (for thumbnail badges)
const bulkSchema = z.object({
  videoIds: z.array(z.string().max(20)).max(50),
});

gradeRoutes.post(
  "/grades/bulk",
  zValidator("json", bulkSchema),
  async (c) => {
    const { videoIds } = c.req.valid("json");
    if (videoIds.length === 0) return c.json({ grades: {} });

    const results = await db
      .select({ videoId: videoAnalyses.videoId, grade: videoAnalyses.grade })
      .from(videoAnalyses)
      .where(inArray(videoAnalyses.videoId, videoIds));

    const grades: Record<string, string> = {};
    for (const r of results) {
      if (r.grade) grades[r.videoId] = r.grade;
    }

    return c.json({ grades });
  }
);

// Channel history — all grades for a channel
gradeRoutes.get("/grades/channel/:channelId", async (c) => {
  const channelId = c.req.param("channelId");

  const results = await db
    .select({
      videoId: videoAnalyses.videoId,
      title: videoAnalyses.title,
      grade: videoAnalyses.grade,
      accuracy: videoAnalyses.accuracy,
      bsMeter: videoAnalyses.bsMeter,
      valueDelivered: videoAnalyses.valueDelivered,
      analyzedAt: videoAnalyses.analyzedAt,
    })
    .from(videoAnalyses)
    .where(eq(videoAnalyses.channelId, channelId))
    .orderBy(desc(videoAnalyses.analyzedAt))
    .limit(50);

  return c.json({ channelId, history: results });
});
