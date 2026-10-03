import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/connection";
import { videoAnalyses } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const compareRoutes = new Hono();

const compareSchema = z.object({
  channelIds: z.array(z.string()).min(2).max(5),
});

compareRoutes.post(
  "/compare",
  zValidator("json", compareSchema),
  async (c) => {
    const { channelIds } = c.req.valid("json");

    const results = [];
    for (const channelId of channelIds) {
      const videos = await db
        .select({
          count: sql<number>`count(*)`,
          avgAccuracy: sql<number>`avg(${videoAnalyses.accuracy})`,
          avgBs: sql<number>`avg(${videoAnalyses.bsMeter})`,
          avgClickbait: sql<number>`avg(${videoAnalyses.clickbait})`,
          avgOriginality: sql<number>`avg(${videoAnalyses.originality})`,
          avgValue: sql<number>`avg(${videoAnalyses.valueDelivered})`,
        })
        .from(videoAnalyses)
        .where(eq(videoAnalyses.channelId, channelId));

      const latest = await db
        .select({ grade: videoAnalyses.grade, title: videoAnalyses.title })
        .from(videoAnalyses)
        .where(eq(videoAnalyses.channelId, channelId))
        .orderBy(desc(videoAnalyses.analyzedAt))
        .limit(1);

      results.push({
        channelId,
        videosAnalyzed: Number(videos[0]?.count ?? 0),
        avgAccuracy: Math.round(Number(videos[0]?.avgAccuracy ?? 0)),
        avgBs: Math.round(Number(videos[0]?.avgBs ?? 0)),
        avgClickbait: Math.round(Number(videos[0]?.avgClickbait ?? 0)),
        avgOriginality: Math.round(Number(videos[0]?.avgOriginality ?? 0)),
        avgValue: Math.round(Number(videos[0]?.avgValue ?? 0)),
        latestGrade: latest[0]?.grade ?? "—",
        latestTitle: latest[0]?.title ?? "",
      });
    }

    return c.json({ comparison: results });
  }
);
