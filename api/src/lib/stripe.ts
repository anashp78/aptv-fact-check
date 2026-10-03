import { logger } from "./logger";

const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"] ?? "";

const PRICE_IDS: Record<string, string> = {
  plus: process.env["STRIPE_PLUS_PRICE_ID"] ?? "",
  pro: process.env["STRIPE_PRO_PRICE_ID"] ?? "",
  team: process.env["STRIPE_TEAM_PRICE_ID"] ?? "",
};

export async function createCheckoutSession(
  email: string,
  tier: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  if (!STRIPE_SECRET_KEY) {
    logger.warn("STRIPE_SECRET_KEY not set — payments disabled");
    return null;
  }

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    logger.error({ tier }, "No Stripe price ID for tier");
    return null;
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "subscription",
        "customer_email": email,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": successUrl,
        "cancel_url": cancelUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ error: err }, "Stripe checkout creation failed");
      return null;
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  } catch (err) {
    logger.error({ error: String(err) }, "Stripe error");
    return null;
  }
}

logger.info({ enabled: !!STRIPE_SECRET_KEY }, "Stripe initialized");
