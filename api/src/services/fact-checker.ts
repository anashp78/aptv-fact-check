import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { searchWeb } from "../lib/tavily";
import { factLibraryRepository } from "../repositories/fact-library";
import { logger } from "../lib/logger";

type ClaimVerdict = "verified" | "false" | "unverified" | "opinion";

interface CheckedClaim {
  text: string;
  timestamp: string;
  verdict: ClaimVerdict;
  evidence: string;
  sources: string[];
  confidence: number;
}

interface FactCheckResult {
  claims: CheckedClaim[];
  accuracy: number;
  authenticity: number;
}

// ── Stage 1: Initial classification (fast, cheap) ───────────────────────────

const CLASSIFY_PROMPT = `You classify claims from YouTube videos using ONLY the knowledge base provided. You DO NOT use your own judgment to mark things false.

KNOWLEDGE BASE:
{KNOWLEDGE_BASE}

BURDEN OF PROOF: INNOCENT UNTIL PROVEN GUILTY.
You can ONLY mark a claim "false" if the KNOWLEDGE BASE above contains a SPECIFIC FACT that DIRECTLY contradicts it. You must QUOTE the KB fact in your evidence. If the KB does not address the claim, you CANNOT mark it false — period.

VERDICTS:
- "verified" — The KB contains a fact that confirms this claim, OR it is universally established common knowledge (gravity exists, water boils at 100C, etc.)
- "false" — The KB contains a SPECIFIC fact that DIRECTLY contradicts this claim. You MUST quote the KB fact. Example: Claim "pass line edge is 5%" → KB says "Pass line house edge is 1.41%" → FALSE with KB citation. NO KB CITATION = CANNOT BE FALSE.
- "opinion" — Teaching, advice, technique explanation, recommendation, prediction, experience, preference, domain-specific theory, strategy discussion. This is the DEFAULT for most content. When in doubt, use opinion.
- "unverified" — Specific factual claim (income numbers, statistics, dates, company facts) that the KB doesn't address and isn't common knowledge.

DEFAULT VERDICT: "opinion"
If you're unsure → opinion. If KB doesn't address it → opinion. If it's domain-specific → opinion. If it's teaching → opinion. If you THINK it's wrong but can't cite a KB fact → opinion.

THE ONLY PATH TO "FALSE":
1. Find the specific claim
2. Find the specific KB fact that contradicts it
3. Quote both in your evidence
4. If you cannot do step 2, the verdict is NOT false

Return JSON:
{
  "claims": [
    {
      "text": "the claim",
      "timestamp": "M:SS",
      "verdict": "verified|false|unverified|opinion|uncertain",
      "evidence": "why you gave this verdict",
      "confidence": 85
    }
  ]
}`;

// ── Stage 2: Web verification for uncertain/false claims ────────────────────

const VERIFY_PROMPT = `You are verifying a claim that was initially flagged as potentially false or uncertain.

ORIGINAL CLAIM: "{CLAIM}"
INITIAL ASSESSMENT: "{INITIAL_EVIDENCE}"

WEB SEARCH RESULTS:
{SEARCH_RESULTS}

Based on the web search evidence, determine the FINAL verdict:
- "verified" — The web evidence CONFIRMS the claim is correct, OR the claim is a standard teaching concept in this domain that web sources discuss without contradiction
- "false" — The web evidence UNANIMOUSLY and CLEARLY proves the claim is factually wrong with specific counter-evidence. Every source must agree it's wrong. If even ONE source supports the claim, it is NOT false.
- "unverified" — Web evidence is mixed, inconclusive, partially supporting, or not found
- "opinion" — The claim is a domain-specific teaching concept, technique explanation, or theoretical framework

THE BAR FOR "FALSE" IS EXTREMELY HIGH:
- ALL web sources must clearly contradict the claim
- There must be ZERO sources supporting or partially supporting it
- The contradiction must be about hard facts (math, science, law), not interpretation
- If the claim is about a specialized technique or theory within a domain (dice control, guitar technique, trading strategy, workout method), it is OPINION not FALSE — even if some people disagree with the theory
- Domain experts teaching their craft get the benefit of the doubt — their explanations of how techniques work are OPINION unless the underlying math is provably wrong
- If web sources discuss the topic but don't directly contradict the specific claim, verdict is UNVERIFIED

WHEN IN DOUBT → UNVERIFIED. Never FALSE.

Return JSON:
{
  "verdict": "verified|false|unverified|opinion",
  "evidence": "explanation citing web sources",
  "sources": ["url1", "url2"]
}`;

export const factChecker = {
  async check(
    claims: { text: string; timestamp: string; category: string }[],
    niche?: string
  ): Promise<FactCheckResult> {
    logger.info({ claimCount: claims.length, niche: niche ?? "general" }, "Fact checking claims (2-stage)");

    // Load knowledge base
    let knowledgeBase = "No niche-specific knowledge base loaded.";
    const nichesToLoad = niche ? [niche] : ["gambling", "sports_betting", "finance", "health"];
    const allFacts = [];
    for (const n of nichesToLoad) {
      const facts = await factLibraryRepository.findByNiche(n);
      allFacts.push(...facts);
    }
    if (allFacts.length > 0) {
      knowledgeBase = allFacts
        .map((f) => `[${f.category}] ${f.fact} (Source: ${f.source ?? "verified"})`)
        .join("\n");
      logger.info({ factCount: allFacts.length }, "Knowledge base loaded");
    }

    // ── Stage 1: Initial classification ──
    const claimsText = claims
      .map((c, i) => `${i + 1}. [${c.timestamp}] ${c.text}`)
      .join("\n");

    const classifyPrompt = CLASSIFY_PROMPT.replace("{KNOWLEDGE_BASE}", knowledgeBase);

    const rawClassify = await callDeepSeek(
      [
        { role: "system", content: classifyPrompt },
        { role: "user", content: `Classify these ${claims.length} claims:\n\n${claimsText}` },
      ],
      { temperature: 0.1, maxTokens: 4096, responseFormat: "json" }
    );

    let classified: { claims: (CheckedClaim & { confidence: number })[] };
    try {
      classified = parseJsonResponse(rawClassify);
    } catch {
      logger.warn("Failed to parse classification — returning all unverified");
      return {
        claims: claims.map((c) => ({
          text: c.text, timestamp: c.timestamp, verdict: "unverified" as const,
          evidence: "Classification failed", sources: [], confidence: 0,
        })),
        accuracy: 50, authenticity: 50,
      };
    }

    // ── Stage 2: Web-verify anything marked "false" or "uncertain" ──
    const needsVerification = classified.claims.filter(
      (c) => c.verdict === "false" || c.verdict === ("uncertain" as string)
    );

    logger.info({
      total: classified.claims.length,
      needsWebCheck: needsVerification.length,
    }, "Stage 1 complete — web-verifying flagged claims");

    // Search and verify in parallel (max 5 to control costs)
    const verificationPromises = needsVerification.slice(0, 5).map(async (claim) => {
      try {
        // Search for evidence about this specific claim
        const searchQuery = claim.text.substring(0, 100);
        const results = await searchWeb(searchQuery, 3);

        if (results.length === 0) {
          // No web evidence found — downgrade to opinion (innocent until proven guilty)
          logger.info({ claim: claim.text.substring(0, 50) }, "No web evidence — marking opinion");
          claim.verdict = "opinion";
          claim.evidence = "No web evidence found to confirm or deny. Treated as domain-specific content.";
          claim.sources = [];
          return;
        }

        const searchContext = results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content.substring(0, 200)}`)
          .join("\n\n");

        const verifyPrompt = VERIFY_PROMPT
          .replace("{CLAIM}", claim.text)
          .replace("{INITIAL_EVIDENCE}", claim.evidence)
          .replace("{SEARCH_RESULTS}", searchContext);

        const rawVerify = await callDeepSeek(
          [
            { role: "system", content: verifyPrompt },
            { role: "user", content: "Determine the final verdict based on web evidence." },
          ],
          { temperature: 0.1, maxTokens: 512, responseFormat: "json" }
        );

        const webResult = parseJsonResponse<{
          verdict: ClaimVerdict;
          evidence: string;
          sources: string[];
        }>(rawVerify);

        claim.verdict = webResult.verdict;
        claim.evidence = webResult.evidence;
        claim.sources = webResult.sources;

        logger.info({
          claim: claim.text.substring(0, 50),
          oldVerdict: "false/uncertain",
          newVerdict: webResult.verdict,
        }, "Web verification complete");

      } catch (err) {
        // Web verification failed — default to opinion (innocent until proven guilty)
        logger.warn({ claim: claim.text.substring(0, 50), error: String(err) }, "Web verification failed — defaulting to opinion");
        if (claim.verdict === "false" || claim.verdict === ("uncertain" as string)) {
          claim.verdict = "opinion";
          claim.evidence += " (Web verification inconclusive — treated as opinion)";
        }
      }
    });

    await Promise.all(verificationPromises);

    // Clean up "uncertain" verdicts → opinion (innocent until proven guilty)
    for (const c of classified.claims) {
      if (c.verdict === ("uncertain" as string)) {
        c.verdict = "opinion";
      }
    }

    const finalClaims: CheckedClaim[] = classified.claims.map((c) => ({
      text: c.text,
      timestamp: c.timestamp,
      verdict: c.verdict as ClaimVerdict,
      evidence: c.evidence,
      sources: c.sources ?? [],
      confidence: c.confidence ?? 50,
    }));

    const falseCount = finalClaims.filter((c) => c.verdict === "false").length;
    const verifiedCount = finalClaims.filter((c) => c.verdict === "verified").length;

    logger.info(
      { total: finalClaims.length, verified: verifiedCount, false: falseCount },
      "2-stage fact check complete"
    );

    return {
      claims: finalClaims,
      accuracy: 50, // We calculate this ourselves in analyze.ts
      authenticity: 50,
    };
  },
};
