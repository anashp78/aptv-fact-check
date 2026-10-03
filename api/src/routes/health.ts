import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "aptv-fact-check-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});
