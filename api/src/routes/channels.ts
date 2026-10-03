import { Hono } from "hono";
import { channelRepository } from "../repositories/channel";

export const channelRoutes = new Hono();

channelRoutes.get("/channels", async (c) => {
  const niche = c.req.query("niche") ?? "gambling";
  const channels = await channelRepository.findByNiche(niche);
  return c.json({ channels });
});

channelRoutes.get("/channels/:channelId", async (c) => {
  const channelId = c.req.param("channelId");
  const channel = await channelRepository.findByChannelId(channelId);
  if (!channel) {
    return c.json({ error: "Channel not found" }, 404);
  }
  return c.json(channel);
});
