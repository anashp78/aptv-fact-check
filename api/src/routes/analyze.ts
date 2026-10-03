import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { analyzeService } from "../services/analyze";
import { logger } from "../lib/logger";

export const analyzeRoutes = new Hono();

const analyzeBodySchema = z.object({
  videoId: z.string().min(1).max(20),
  title: z.string().max(500).optional(),
  channelName: z.string().max(200).optional(),
});

analyzeRoutes.post(
  "/analyze",
  zValidator("json", analyzeBodySchema),
  async (c) => {
    const { videoId, title, channelName } = c.req.valid("json");

    logger.info({ videoId, title, channelName }, "Analysis requested");

    try {
      const result = await analyzeService.analyzeVideo(videoId, title, channelName);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      logger.error({ videoId, error: message }, "Analysis failed");
      return c.json({ error: message }, 500);
    }
  }
);

analyzeRoutes.get("/analyze/:videoId", async (c) => {
  const videoId = c.req.param("videoId");

  const cached = await analyzeService.getCachedAnalysis(videoId);
  if (!cached) {
    return c.json({ error: "No analysis found" }, 404);
  }

  return c.json(cached);
});
