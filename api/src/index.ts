import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeRoutes } from "./routes/analyze";
import { channelRoutes } from "./routes/channels";
import { gradeRoutes } from "./routes/grades";
import { responseRoutes } from "./routes/response";
import { compareRoutes } from "./routes/compare";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { logger } from "./lib/logger";

// ── Startup validation ──────────────────────────────────────────────────────

const REQUIRED_KEYS = ["DATABASE_URL", "DEEPSEEK_API_KEY"];
const OPTIONAL_KEYS = ["YOUTUBE_API_KEY", "TAVILY_API_KEY"];

for (const key of REQUIRED_KEYS) {
  if (!process.env[key]) {
    logger.error({ key }, "MISSING REQUIRED ENV VAR — API will not function");
  }
}

for (const key of OPTIONAL_KEYS) {
  if (!process.env[key]) {
    logger.warn({ key }, "Optional env var not set — some features disabled");
  }
}

// ── Rate limiting (simple in-memory) ────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60000;

// ── App ─────────────────────────────────────────────────────────────────────

const app = new Hono();

app.use("*", cors({ origin: "*" }));

// Rate limit middleware for analyze endpoint
app.use("/api/v1/analyze", async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "local";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && entry.resetAt > now) {
    if (entry.count >= RATE_LIMIT) {
      return c.json({ error: "Rate limit exceeded. Try again in a minute." }, 429);
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }

  await next();
});

app.get("/", (c) => c.json({ status: "ok" }));
app.route("/api/v1", healthRoutes);
app.route("/api", authRoutes);
app.route("/api/v1", analyzeRoutes);
app.route("/api/v1", channelRoutes);
app.route("/api/v1", gradeRoutes);
app.route("/api/v1", responseRoutes);
app.route("/api/v1", compareRoutes);

const port = parseInt(process.env["PORT"] ?? "3100", 10);

logger.info({ port }, "APTV Fact Check API starting");
logger.info({
  deepseek: !!process.env["DEEPSEEK_API_KEY"],
  youtube: !!process.env["YOUTUBE_API_KEY"],
  tavily: !!process.env["TAVILY_API_KEY"],
  db: !!process.env["DATABASE_URL"],
}, "Service status");

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
