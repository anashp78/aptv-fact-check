import { db } from "./connection";
import { factLibrary } from "./schema";
import { logger } from "../lib/logger";

interface Fact {
  niche: string;
  category: string;
  fact: string;
  source: string;
}

const BLACKJACK_FACTS: Fact[] = [
  // House edges
  { niche: "gambling", category: "blackjack_house_edge", fact: "Blackjack house edge with basic strategy and 6-deck shoe is approximately 0.5%", source: "Standard blackjack mathematics" },
  { niche: "gambling", category: "blackjack_house_edge", fact: "Single deck blackjack with basic strategy has a house edge of approximately 0.15%", source: "Standard blackjack mathematics" },
  { niche: "gambling", category: "blackjack_house_edge", fact: "Insurance bet has a house edge of 7.47% — it is always a bad bet unless counting cards", source: "Standard blackjack mathematics" },
  { niche: "gambling", category: "blackjack_house_edge", fact: "6:5 blackjack payout increases house edge by approximately 1.39% compared to 3:2 payout", source: "Standard blackjack mathematics" },
  { niche: "gambling", category: "blackjack_house_edge", fact: "The dealer hitting on soft 17 increases house edge by approximately 0.22%", source: "Standard blackjack mathematics" },
  { niche: "gambling", category: "blackjack_house_edge", fact: "Not allowing doubling after split increases house edge by approximately 0.14%", source: "Standard blackjack mathematics" },

  // Basic strategy
  { niche: "gambling", category: "blackjack_strategy", fact: "Basic strategy is mathematically optimal play for every hand combination — it is NOT proprietary to any person", source: "Edward O. Thorp, Beat the Dealer (1962)" },
  { niche: "gambling", category: "blackjack_strategy", fact: "Basic strategy was developed in the 1950s-60s by Roger Baldwin, Wilbert Cantey, Herbert Maisel, James McDermott, and later refined by Edward O. Thorp", source: "Gambling mathematics history" },
  { niche: "gambling", category: "blackjack_strategy", fact: "Basic strategy cards are available free in every casino gift shop and online — charging money for basic strategy is selling public domain information", source: "Common knowledge" },
  { niche: "gambling", category: "blackjack_strategy", fact: "Perfect basic strategy reduces house edge to minimum but does NOT give the player an edge over the house", source: "Standard blackjack mathematics" },

  // Card counting
  { niche: "gambling", category: "blackjack_counting", fact: "Card counting is not illegal — it is legal in all US jurisdictions. Casinos can ban counters as private businesses.", source: "US gambling law" },
  { niche: "gambling", category: "blackjack_counting", fact: "Hi-Lo count assigns +1 to 2-6, 0 to 7-9, -1 to 10-A. True count = running count / decks remaining.", source: "Stanford Wong, Professional Blackjack" },
  { niche: "gambling", category: "blackjack_counting", fact: "A skilled card counter has approximately 0.5-1.5% edge over the house depending on rules and penetration", source: "Blackjack mathematics" },
  { niche: "gambling", category: "blackjack_counting", fact: "Continuous Shuffling Machines (CSMs) make card counting impossible — the deck is reshuffled after every hand", source: "Casino operations" },
  { niche: "gambling", category: "blackjack_counting", fact: "Card counting requires bankroll of 200-400 maximum bets to survive variance", source: "Blackjack risk analysis" },

  // Scam patterns
  { niche: "gambling", category: "blackjack_scam", fact: "Any system claiming to beat blackjack without counting cards is mathematically impossible — basic strategy alone does not overcome the house edge", source: "Mathematical proof" },
  { niche: "gambling", category: "blackjack_scam", fact: "Betting progressions (Martingale, Fibonacci, etc.) do not change the house edge in blackjack — they change bet sizing, not the mathematical expectation", source: "Mathematical proof" },
  { niche: "gambling", category: "blackjack_scam", fact: "Being barred from casinos for promoting an illegal offshore sportsbook is NOT the same as being barred for being too good at blackjack", source: "APTV research — Cerasani analysis" },
];

const SPORTS_BETTING_FACTS: Fact[] = [
  // Fundamentals
  { niche: "sports_betting", category: "fundamentals", fact: "Standard American odds vigorish (vig/juice) is -110 on both sides, which equals 4.55% house edge", source: "Standard sportsbook mathematics" },
  { niche: "sports_betting", category: "fundamentals", fact: "To break even at -110 odds, a bettor must win 52.38% of bets", source: "Standard sportsbook mathematics" },
  { niche: "sports_betting", category: "fundamentals", fact: "Closing Line Value (CLV) is the strongest predictor of long-term profitability in sports betting", source: "Professional sports betting research" },
  { niche: "sports_betting", category: "fundamentals", fact: "A 2-leg parlay at -110 each has a house edge of approximately 10% — parlays are exponentially worse for bettors", source: "Parlay mathematics" },
  { niche: "sports_betting", category: "fundamentals", fact: "Implied probability from American odds: negative odds = odds/(odds+100), positive odds = 100/(odds+100)", source: "Standard sportsbook mathematics" },

  // Sharp vs square
  { niche: "sports_betting", category: "sharp_square", fact: "Sharp bettors (professionals) typically maintain 53-57% win rates on sides over large sample sizes", source: "Professional sports betting data" },
  { niche: "sports_betting", category: "sharp_square", fact: "No legitimate sports bettor wins 70%+ of their bets over a meaningful sample size — anyone claiming this is lying or cherry-picking", source: "Sports betting mathematics" },
  { niche: "sports_betting", category: "sharp_square", fact: "Touts (handicapping services) have no regulatory requirement to verify their claimed records — most self-reported records are fabricated", source: "Sports betting industry" },
  { niche: "sports_betting", category: "sharp_square", fact: "If a tout's picks were genuinely profitable, they would make more money betting than selling picks — selling picks is evidence the picks don't work", source: "Logical analysis" },

  // Bankroll
  { niche: "sports_betting", category: "bankroll", fact: "Kelly Criterion optimal bet size = (edge/odds). Most professionals use fractional Kelly (25-50%) to reduce variance.", source: "John Kelly Jr., Bell Labs (1956)" },
  { niche: "sports_betting", category: "bankroll", fact: "Professional sports bettors typically risk 1-3% of bankroll per bet — anyone recommending 10%+ per bet is promoting reckless gambling", source: "Professional sports betting practice" },

  // Scam patterns
  { niche: "sports_betting", category: "scam_pattern", fact: "Guaranteed winners, lock picks, and 'can't lose' parlays do not exist in sports betting — every bet has variance", source: "Mathematical fact" },
  { niche: "sports_betting", category: "scam_pattern", fact: "Screenshot profits without verifiable tracked records (on platforms like Action Network or Pikkit) are worthless — screenshots can be fabricated", source: "Sports betting industry" },
  { niche: "sports_betting", category: "scam_pattern", fact: "The two-sided tout scam: send half your list Team A and half Team B, then upsell the 'winning' half — a classic fraud pattern", source: "Known scam pattern" },
];

const FINANCE_FACTS: Fact[] = [
  // Market returns
  { niche: "finance", category: "returns", fact: "S&P 500 historical average annual return is approximately 10% nominal (7% inflation-adjusted) since 1926", source: "Ibbotson Associates / NYU Stern" },
  { niche: "finance", category: "returns", fact: "95% of actively managed funds underperform their benchmark index over 20-year periods", source: "SPIVA Scorecard, S&P Global" },
  { niche: "finance", category: "returns", fact: "Past performance does not guarantee future results — this is legally required disclosure because it is factually true", source: "SEC regulations" },

  // Fees
  { niche: "finance", category: "fees", fact: "A 1% annual management fee reduces total returns by approximately 28% over 30 years due to compounding drag", source: "Fee impact mathematics" },
  { niche: "finance", category: "fees", fact: "Index funds typically charge 0.03-0.20% annual fees vs 1.0-2.0% for actively managed funds", source: "Vanguard, Fidelity, Schwab published fees" },
  { niche: "finance", category: "fees", fact: "Front-load mutual fund fees of 5% mean you start with only $950 of every $1000 invested", source: "Standard fund fee structure" },

  // Scam patterns
  { niche: "finance", category: "scam_pattern", fact: "Guaranteed returns above risk-free rate (currently ~4-5% for T-bills) are a hallmark of Ponzi schemes", source: "SEC fraud indicators" },
  { niche: "finance", category: "scam_pattern", fact: "Multi-level marketing (MLM) companies: 99% of participants lose money according to FTC research", source: "FTC study on MLM income" },
  { niche: "finance", category: "scam_pattern", fact: "Forex day trading: studies show 70-80% of retail forex traders lose money", source: "ESMA research, broker disclosures" },
  { niche: "finance", category: "scam_pattern", fact: "Anyone selling a course on 'getting rich' makes their money from selling the course, not from the method they teach", source: "Logical analysis" },
  { niche: "finance", category: "scam_pattern", fact: "Cryptocurrency projects without audited smart contracts, anonymous teams, or unrealistic APY promises are high-risk for rug pulls", source: "Crypto industry patterns" },

  // Regulations
  { niche: "finance", category: "regulation", fact: "A fiduciary is legally required to act in the client's best interest. A broker under suitability standard is not.", source: "SEC/DOL fiduciary rule" },
  { niche: "finance", category: "regulation", fact: "Registered Investment Advisors (RIAs) are fiduciaries. Broker-dealers and insurance salespeople often are not.", source: "SEC registration requirements" },
];

const HEALTH_FITNESS_FACTS: Fact[] = [
  // Exercise science
  { niche: "health", category: "exercise", fact: "Spot reduction (losing fat from a specific body area through targeted exercise) is a myth — fat loss is systemic", source: "Exercise science consensus, multiple studies" },
  { niche: "health", category: "exercise", fact: "Muscle confusion is a marketing term, not an exercise science principle. Progressive overload is what drives adaptation.", source: "Exercise science" },
  { niche: "health", category: "exercise", fact: "The anabolic window (need to eat protein within 30 minutes of exercise) has been largely debunked — total daily protein intake matters more than timing", source: "International Society of Sports Nutrition position stand" },
  { niche: "health", category: "exercise", fact: "For muscle growth, 1.6-2.2g protein per kg bodyweight per day is supported by research", source: "Meta-analysis, British Journal of Sports Medicine" },

  // Supplement claims
  { niche: "health", category: "supplements", fact: "The supplement industry is not regulated by the FDA for efficacy before sale — supplements do not need to prove they work", source: "DSHEA Act 1994, FDA regulations" },
  { niche: "health", category: "supplements", fact: "Detox teas and cleanses have no scientific evidence of removing toxins — the liver and kidneys already do this", source: "Medical consensus" },
  { niche: "health", category: "supplements", fact: "Fat burner supplements have minimal to no effect on fat loss beyond caffeine's thermogenic properties (~100 calories/day)", source: "Systematic reviews" },
  { niche: "health", category: "supplements", fact: "Creatine monohydrate is the most studied and effective sports supplement with strong evidence for strength and muscle gains", source: "International Society of Sports Nutrition" },

  // Medical claims
  { niche: "health", category: "medical", fact: "Only licensed physicians (MD/DO) can legally diagnose and treat medical conditions in the US", source: "US medical licensing law" },
  { niche: "health", category: "medical", fact: "Chiropractors (DC) are not medical doctors. Claims of curing diseases through spinal adjustment are not supported by evidence.", source: "Medical consensus" },
  { niche: "health", category: "medical", fact: "Anti-vaccine claims have been thoroughly debunked. The Wakefield study linking vaccines to autism was retracted for fraud.", source: "The Lancet retraction, CDC, WHO" },

  // Scam patterns
  { niche: "health", category: "scam_pattern", fact: "Before/after transformations without timeframe, lighting controls, or third-party verification are unreliable evidence", source: "FTC advertising guidelines" },
  { niche: "health", category: "scam_pattern", fact: "Claiming natural/natty status while displaying physical characteristics inconsistent with natural limits (FFMI >25) is a common deception", source: "Sports science research on natural muscular potential" },
  { niche: "health", category: "scam_pattern", fact: "Rapid weight loss claims (lose 30 lbs in 30 days) are either water weight, dangerous, or fraudulent — healthy fat loss is 1-2 lbs per week", source: "Medical consensus" },
];

async function seedKnowledge() {
  const allFacts = [
    ...BLACKJACK_FACTS,
    ...SPORTS_BETTING_FACTS,
    ...FINANCE_FACTS,
    ...HEALTH_FITNESS_FACTS,
  ];

  logger.info({ totalFacts: allFacts.length }, "Seeding knowledge bases...");

  const values = allFacts.map((f) => ({
    niche: f.niche,
    category: f.category,
    fact: f.fact,
    source: f.source,
    verified: true,
  }));

  await db.insert(factLibrary).values(values).onConflictDoNothing();

  // Count by niche
  const counts: Record<string, number> = {};
  for (const f of allFacts) {
    counts[f.niche] = (counts[f.niche] ?? 0) + 1;
  }

  logger.info(counts, "Knowledge bases seeded");
  process.exit(0);
}

seedKnowledge().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
