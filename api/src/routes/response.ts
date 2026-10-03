import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { responseGenerator } from "../services/response-generator";
import { logger } from "../lib/logger";

export const responseRoutes = new Hono();

const responseSchema = z.object({
  videoTitle: z.string(),
  channelName: z.string(),
  grade: z.string(),
  summary: z.array(z.string()),
  falseClaims: z.array(
    z.object({
      text: z.string(),
      evidence: z.string(),
    })
  ),
});

responseRoutes.post(
  "/response-script",
  zValidator("json", responseSchema),
  async (c) => {
    const input = c.req.valid("json");

    if (input.falseClaims.length === 0) {
      return c.json({ error: "No false claims to respond to" }, 400);
    }

    logger.info({ videoTitle: input.videoTitle }, "Response script requested");

    try {
      const script = await responseGenerator.generate(input);
      return c.json({ script });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      return c.json({ error: msg }, 500);
    }
  }
);
