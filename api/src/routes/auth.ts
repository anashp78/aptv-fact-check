import { Hono } from "hono";
import { auth } from "../lib/auth";

export const authRoutes = new Hono();

// Better-Auth handles all /api/auth/* routes (signup, login, session, etc.)
authRoutes.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw);
});
