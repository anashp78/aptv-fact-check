import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/connection";
import { authUser } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const IS_DEV = process.env["NODE_ENV"] !== "production";
const BASE_URL = process.env["AUTH_BASE_URL"] ?? "http://localhost:3100";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: BASE_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  trustedOrigins: [
    "chrome-extension://*",
    "http://localhost:*",
  ],
});

export async function getUserFromRequest(
  headers: Headers
): Promise<{ id: string; email: string; tier: string } | null> {
  if (IS_DEV) {
    return { id: "local-dev", email: "dev@localhost", tier: "pro" };
  }

  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;

    const rows = await db
      .select({ tier: authUser.tier })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    const tier = rows[0]?.tier ?? "free";

    return {
      id: session.user.id,
      email: session.user.email,
      tier,
    };
  } catch {
    return null;
  }
}

logger.info({ dev: IS_DEV }, "Auth initialized");
