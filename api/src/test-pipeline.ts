import { transcriptService } from "./services/transcript";
import { claimExtractor } from "./services/claim-extractor";
import { factChecker } from "./services/fact-checker";
import { scorer } from "./services/scorer";
import { logger } from "./lib/logger";

const videoId = process.argv[2] ?? "";

if (!videoId) {
  logger.error("Usage: bun src/test-pipeline.ts <videoId>");
  process.exit(1);
}

async function testPipeline() {
  logger.info({ videoId }, "Testing full pipeline");

  // Step 1: Transcript
  logger.info("Step 1: Fetching transcript...");
  const segments = await transcriptService.fetchTranscript(videoId);
  const fullText = transcriptService.segmentsToFullText(segments);
  logger.info({ segments: segments.length, chars: fullText.length }, "Transcript fetched");

  if (!fullText) {
    logger.error("No transcript found");
    process.exit(1);
  }

  if (!process.env["DEEPSEEK_API_KEY"]) {
    logger.warn("DEEPSEEK_API_KEY not set — skipping AI pipeline");
    process.exit(0);
  }

  // Step 2: Extract claims
  logger.info("Step 2: Extracting claims...");
  const extraction = await claimExtractor.extract(fullText, `Video ${videoId}`);
  logger.info({
    claims: extraction.claims.length,
    summary: extraction.summary,
    contentDensity: extraction.contentDensity,
    bsIndicators: extraction.bsIndicators.length,
    clickbaitIndicators: extraction.clickbaitIndicators.length,
  }, "Claims extracted");

  // Step 3: Fact check
  logger.info("Step 3: Fact checking...");
  const factCheckResult = await factChecker.check(
    extraction.claims.map((c) => ({
      text: c.text,
      timestamp: c.timestamp,
      category: c.category,
    })),
    "gambling"
  );

  const falseCount = factCheckResult.claims.filter((c) => c.verdict === "false").length;
  const verifiedCount = factCheckResult.claims.filter((c) => c.verdict === "verified").length;
  const unverifiedCount = factCheckResult.claims.filter((c) => c.verdict === "unverified").length;
  const opinionCount = factCheckResult.claims.filter((c) => c.verdict === "opinion").length;

  logger.info({
    verified: verifiedCount,
    false: falseCount,
    unverified: unverifiedCount,
    opinion: opinionCount,
    accuracy: factCheckResult.accuracy,
    authenticity: factCheckResult.authenticity,
  }, "Fact check results");

  for (const claim of factCheckResult.claims) {
    logger.info({
      verdict: claim.verdict,
      claim: claim.text,
      evidence: claim.evidence,
    }, "Checked claim");
  }

  // Step 4: Score
  logger.info("Step 4: Scoring...");
  const scores = await scorer.score({
    accuracy: factCheckResult.accuracy,
    authenticity: factCheckResult.authenticity,
    contentDensity: extraction.contentDensity,
    bsIndicatorCount: extraction.bsIndicators.length,
    clickbaitIndicatorCount: extraction.clickbaitIndicators.length,
    falseClaimCount: falseCount,
    totalClaimCount: factCheckResult.claims.length,
    verifiedClaimCount: verifiedCount,
    opinionClaimCount: factCheckResult.claims.filter((c) => c.verdict === "opinion").length,
    videoTitle: `Video ${videoId}`,
  });

  logger.info({
    grade: scores.grade,
    bsMeter: scores.bsMeter,
    clickbait: scores.clickbait,
    originality: scores.originality,
    valueDelivered: scores.valueDelivered,
  }, "FINAL SCORES");

  logger.info("Pipeline test complete");
  process.exit(0);
}

testPipeline().catch((err) => {
  logger.error(err, "Pipeline test failed");
  process.exit(1);
});
