import { db } from "./connection";
import { channels, factLibrary } from "./schema";
import { logger } from "../lib/logger";

const CRAPS_CHANNELS = [
  { channelId: "color-up", name: "Color Up", tier: "1" as const, format: "HOME", subscriberCount: 135000, trustScore: 95, tierReason: "Best math accuracy in the space. Never sells dreams. Nine years of consistent content." },
  { channelId: "apw", name: "APW (Advantage Player Workshop)", tier: "1" as const, format: "HOME", subscriberCount: 10000, trustScore: 93, tierReason: "Only channel building original technology for craps. Simulator, AI analysis, Dingleberry commentary." },
  { channelId: "mid-atlantic-craps", name: "Mid Atlantic Craps", tier: "1" as const, format: "HOME", subscriberCount: 6100, trustScore: 96, tierReason: "1,550+ videos. Teaches for free. All revenue donated to charity. Free casino lessons." },
  { channelId: "pro-craps", name: "Pro Craps / Casino Gaming Central", tier: "1" as const, format: "HOME", subscriberCount: 8600, trustScore: 88, tierReason: "The discipline channel. Coffee and Craps 3x/week. Focus on money management and emotional discipline." },
  { channelId: "roll2win", name: "Roll2WinCraps", tier: "1" as const, format: "HOME", subscriberCount: 3600, trustScore: 90, tierReason: "Thirty years of real dice control practice. Genuine instruction from lived experience." },
  { channelId: "bluff", name: "Bluff", tier: "1" as const, format: "LIVE", subscriberCount: 600000, trustScore: 85, tierReason: "Pure entertainment. 600K subs without selling a single course or system. Clean." },
  { channelId: "big-az-craps", name: "Big AZ Craps GURU", tier: "1" as const, format: "LIVE", subscriberCount: 11400, trustScore: 87, tierReason: "Nightly videos + live streams 4x/week. 30+ years playing. Twice-yearly Vegas meetups." },
  { channelId: "inside-the-casino", name: "Inside the Casino", tier: "1" as const, format: "LIVE", subscriberCount: 5000, trustScore: 89, tierReason: "60+ live game episodes at real casinos. No courses, no systems. Most honest format possible." },
  { channelId: "dice-degen", name: "Dice Degen", tier: "2" as const, format: "HOME", subscriberCount: 3000, trustScore: 65, tierReason: "Dark side specialty but solo content isn't particularly original. Better as part of CGTV ensemble." },
  { channelId: "old-bay-craps", name: "Old Bay Craps", tier: "2" as const, format: "HOME", subscriberCount: 1100, trustScore: 60, tierReason: "Honest about being a beginner. Learning publicly. Small catalog. Needs to show progression." },
  { channelId: "hawaii-craps", name: "Hawaii Craps Shooters", tier: "2" as const, format: "LIVE", subscriberCount: 28400, trustScore: 55, tierReason: "Decades of experience but 'improve your chances' framing oversells. Paid lessons for unproven claims." },
  { channelId: "reggiemush", name: "ReggieMush", tier: "2" as const, format: "LIVE", subscriberCount: 97000, trustScore: 58, tierReason: "Likable but derivative of Bluff. No educational value. Pure entertainment but not original." },
  { channelId: "rookie-gambler", name: "The Rookie Gambler", tier: "2" as const, format: "LIVE", subscriberCount: 15300, trustScore: 52, tierReason: "'Trying to make money' framing. Beginner journey format isn't original." },
  { channelId: "mark-the-point", name: "Mark The Point", tier: "3" as const, format: "HOME", subscriberCount: 14300, trustScore: 25, tierReason: "'Never Lose Again!' on a negative-EV game. Copycat strategies with creative names. If he starts selling, moves to Fraud." },
  { channelId: "greg-uloho", name: "Greg Uloho (Bubble Craps)", tier: "3" as const, format: "LIVE", subscriberCount: 3000, trustScore: 20, tierReason: "Sells strategies for an RNG machine. 400+ videos of playing slot-equivalent with 'strategies'. Wrong, not malicious." },
  { channelId: "jimmy-mastery", name: "Jimmy Mastery", tier: "4" as const, format: "HOME", subscriberCount: 14600, trustScore: 5, tierReason: "$20K/month claims on prop chips. Paid courses. Website disclaimer proves he knows claims are false." },
  { channelId: "john-cerasani", name: "John Cerasani", tier: "4" as const, format: "LIVE", subscriberCount: 200000, trustScore: 8, tierReason: "Barred for promoting illegal bookie. 'Best Blackjack Player' with zero evidence. Repackages free basic strategy." },
  { channelId: "waylons-way", name: "Waylon's Way Craps", tier: "4" as const, format: "HOME", subscriberCount: 8000, trustScore: 10, tierReason: "$700 for free strategies under 'World's Greatest' and 'never loses' branding." },
  { channelId: "sean-perry", name: "Sean Perry", tier: "4" as const, format: "LIVE", subscriberCount: 50000, trustScore: 7, tierReason: "10,000-to-1 DFS manipulation analysis. Debt non-payment. Never addressed the evidence." },
];

const CRAPS_FACTS = [
  // House edges
  { category: "house_edge", fact: "Pass line house edge is 1.41%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Don't pass house edge is 1.36%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Odds bet has 0% house edge — the only zero-edge bet in the casino", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Place 6 or 8 house edge is 1.52%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Place 5 or 9 house edge is 4.00%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Place 4 or 10 house edge is 6.67%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Field bet house edge is 5.56% (2.78% if 12 pays triple)", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Any 7 house edge is 16.67%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Hard 6 or Hard 8 house edge is 9.09%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Hard 4 or Hard 10 house edge is 11.11%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Big 6 or Big 8 house edge is 9.09% — place bet is always better at 1.52%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Horn bet house edge is 12.5%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Yo (eleven) house edge is 11.11%", source: "Standard craps mathematics" },
  { category: "house_edge", fact: "Any craps house edge is 11.11%", source: "Standard craps mathematics" },

  // Probabilities
  { category: "probability", fact: "There are 36 possible two-dice combinations", source: "Combinatorics" },
  { category: "probability", fact: "Probability of rolling a 7 is 6/36 (16.67%)", source: "Combinatorics" },
  { category: "probability", fact: "Probability of rolling a 6 or 8 is 5/36 (13.89%)", source: "Combinatorics" },
  { category: "probability", fact: "Probability of rolling a 2 or 12 is 1/36 (2.78%)", source: "Combinatorics" },

  // Dice control
  { category: "dice_control", fact: "There are 576 possible dice orientations (24 x 24), not 6 master sets", source: "Combinatorial mathematics — 24 orientations per die" },
  { category: "dice_control", fact: "No casino has ever confirmed measurable dice control impact on house edge", source: "Casino industry" },
  { category: "dice_control", fact: "SRR (Sevens to Rolls Ratio) for random throwing is 1:6 or 6.0", source: "Probability theory" },
  { category: "dice_control", fact: "Laying odds on don't pass REDUCES house edge, not increases it — odds bet is 0% edge", source: "Standard craps mathematics" },

  // Scam patterns
  { category: "scam_pattern", fact: "No betting system can overcome a negative expected value game long term — this is proven by the law of large numbers", source: "Mathematical proof" },
  { category: "scam_pattern", fact: "Bubble craps machines use RNG (Random Number Generator) — identical to slot machine technology. No strategy changes outcomes.", source: "Gaming commission regulations" },
  { category: "scam_pattern", fact: "Claims of consistent monthly profit from craps without verified, audited results are statistically implausible", source: "Probability theory" },
  { category: "scam_pattern", fact: "'Never lose' claims for any negative-EV casino game are mathematically impossible", source: "Mathematical proof" },
  { category: "scam_pattern", fact: "Regression and progression betting systems change bet sizing, not house edge — they cannot overcome the mathematical edge", source: "Mathematical proof" },
  { category: "scam_pattern", fact: "Basic blackjack strategy is public domain — available free in every casino gift shop since the 1960s", source: "Gambling history" },
  { category: "scam_pattern", fact: "Filming with practice chips and prop money while claiming real profits is a common influencer deception pattern", source: "APTV research" },
  { category: "scam_pattern", fact: "Website disclaimers stating 'entertainment only' that contradict profit claims are evidence of knowing misrepresentation", source: "APTV analysis" },
];

async function seed() {
  logger.info("Seeding craps channel ratings...");

  for (const channel of CRAPS_CHANNELS) {
    await db
      .insert(channels)
      .values({
        channelId: channel.channelId,
        name: channel.name,
        tier: channel.tier,
        tierReason: channel.tierReason,
        trustScore: channel.trustScore,
        niche: "gambling",
        format: channel.format,
        subscriberCount: channel.subscriberCount,
      })
      .onConflictDoUpdate({
        target: channels.channelId,
        set: {
          name: channel.name,
          tier: channel.tier,
          tierReason: channel.tierReason,
          trustScore: channel.trustScore,
          format: channel.format,
          subscriberCount: channel.subscriberCount,
          updatedAt: new Date(),
        },
      });
  }

  logger.info({ count: CRAPS_CHANNELS.length }, "Channels seeded");

  logger.info("Seeding craps fact library...");

  const factValues = CRAPS_FACTS.map((f) => ({
    niche: "gambling",
    category: f.category,
    fact: f.fact,
    source: f.source,
    verified: true,
  }));

  await db.insert(factLibrary).values(factValues).onConflictDoNothing();

  logger.info({ count: CRAPS_FACTS.length }, "Facts seeded");

  logger.info("Seed complete");
  process.exit(0);
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
