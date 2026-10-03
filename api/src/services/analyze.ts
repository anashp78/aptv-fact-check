import { analysisRepository } from "../repositories/analysis";
import { channelRepository } from "../repositories/channel";
import { transcriptService } from "./transcript";
import { claimExtractor } from "./claim-extractor";
import { factChecker } from "./fact-checker";
import { scorer } from "./scorer";
import { commentFetcher } from "./comments";
import { sockPuppetDetector } from "./sock-puppet";
import { channelIntel } from "./channel-intel";
import { sourceDetector } from "./source-detector";
import { db } from "../db/connection";
import { channels } from "../db/schema";
import { logger } from "../lib/logger";

async function findChannelByName(name: string) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  const byId = await channelRepository.findByChannelId(normalized);
  if (byId) return byId;
  const all = await db.select().from(channels);
  return (
    all.find((ch) => ch.name.toLowerCase() === normalized) ??
    all.find((ch) => normalized.includes(ch.name.toLowerCase())) ??
    all.find((ch) => ch.name.toLowerCase().includes(normalized)) ??
    null
  );
}

async function safeCall<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ label, error: String(err) }, "Pipeline step failed — using fallback");
    return fallback;
  }
}

export const analyzeService = {
  async analyzeVideo(videoId: string, title?: string, channelName?: string) {
    // Fetch transcript and comments in parallel
    const [segments, rawComments] = await Promise.all([
      transcriptService.fetchTranscript(videoId),
      commentFetcher.fetchComments(videoId, 100),
    ]);

    const fullText = transcriptService.segmentsToFullText(segments);
    const videoTitle = title ?? `Video ${videoId}`;

    // Look up channel in our ratings DB
    const channelData = channelName ? await findChannelByName(channelName) : null;
    if (channelData) {
      logger.info({ channelName, tier: channelData.tier }, "Channel found in ratings DB");
    }

    // No transcript — run intel + comments only
    if (!fullText) {
      logger.warn({ videoId }, "No transcript — running intel + comments only");

      const [commentAnalysis, intel] = await Promise.all([
        safeCall("comments", () => rawComments.length > 0 ? sockPuppetDetector.analyze(rawComments) : Promise.resolve(null), null),
        safeCall("intel", () => channelName ? channelIntel.investigate(channelName) : Promise.resolve(null), null),
      ]);

      return {
        video: {
          grade: "—",
          summary: ["No transcript available — video analysis requires captions.", "Check the INTEL and COMMENTS tabs for channel analysis."],
          claims: [],
        },
        sources: null,
        comments: commentAnalysis,
        channel: channelData,
        intel,
        error: null,
      };
    }

    logger.info(
      { videoId, transcriptLength: fullText.length, commentCount: rawComments.length },
      "Transcript + comments fetched, running AI pipeline"
    );

    // Step 1: Extract claims
    const extraction = await safeCall("claim-extract", () => claimExtractor.extract(fullText, videoTitle), {
      claims: [], summary: ["Claim extraction failed"], contentDensity: 50, bsIndicators: [], clickbaitIndicators: [],
    });

    // Step 2: Fact check + comment analysis + channel intel + source detection in parallel
    const [factCheckResult, commentAnalysis, intel, sources] = await Promise.all([
      safeCall("fact-check", () => factChecker.check(
        extraction.claims.map((c) => ({ text: c.text, timestamp: c.timestamp, category: c.category })),
        channelData?.niche ?? undefined
      ), { claims: [], accuracy: 50, authenticity: 50 }),
      safeCall("comments", () => rawComments.length > 0 ? sockPuppetDetector.analyze(rawComments) : Promise.resolve(null), null),
      safeCall("intel", () => channelName ? channelIntel.investigate(channelName) : Promise.resolve(null), null),
      safeCall("sources", () => sourceDetector.detect(
        extraction.summary,
        extraction.claims.map((c) => c.text),
        videoTitle
      ), null),
    ]);

    // Step 3: Score — calculate accuracy ourselves instead of trusting DeepSeek's number
    const falseCount = factCheckResult.claims.filter((c) => c.verdict === "false").length;
    const verifiedCount = factCheckResult.claims.filter((c) => c.verdict === "verified").length;
    const opinionCount = factCheckResult.claims.filter((c) => c.verdict === "opinion").length;
    const totalClaims = factCheckResult.claims.length;

    // Our accuracy formula: (verified + opinions) are "not wrong", false are wrong
    // If zero false claims, accuracy is high. False claims drag it down.
    let calculatedAccuracy: number;
    if (totalClaims === 0) {
      calculatedAccuracy = 50;
    } else if (falseCount === 0) {
      calculatedAccuracy = Math.max(80, Math.round(((verifiedCount + opinionCount) / totalClaims) * 100));
    } else {
      calculatedAccuracy = Math.round(((totalClaims - falseCount) / totalClaims) * 100);
    }

    logger.info({ calculatedAccuracy, deepseekAccuracy: factCheckResult.accuracy, falseCount, verifiedCount, opinionCount, totalClaims }, "Accuracy calculated");

    const scores = await safeCall("scorer", () => scorer.score({
      accuracy: calculatedAccuracy,
      authenticity: factCheckResult.authenticity,
      contentDensity: extraction.contentDensity,
      bsIndicatorCount: extraction.bsIndicators.length,
      clickbaitIndicatorCount: extraction.clickbaitIndicators.length,
      falseClaimCount: falseCount,
      totalClaimCount: factCheckResult.claims.length,
      verifiedClaimCount: verifiedCount,
      opinionClaimCount: opinionCount,
      videoTitle,
      niche: channelData?.niche ?? undefined,
      channelName: channelName ?? undefined,
    }), { grade: "C" as const, nicheGrade: "C" as const, niche: "unknown", bsMeter: 50, clickbait: 50, originality: 50, valueDelivered: 50, composite: 50, breakdown: { accuracyWeighted: 15, bsWeighted: 12, valueWeighted: 12, originalityWeighted: 5, clickbaitWeighted: 5, falseClaimPenalty: 0 } });

    // Step 4: Persist
    const analysis = await safeCall("persist", () => analysisRepository.createAnalysis({
      videoId,
      channelId: channelData?.channelId ?? channelName ?? "",
      title: videoTitle,
      transcript: fullText,
      grade: scores.grade,
      authenticity: factCheckResult.authenticity,
      accuracy: calculatedAccuracy,
      bsMeter: scores.bsMeter,
      clickbait: scores.clickbait,
      originality: scores.originality,
      contentDensity: extraction.contentDensity,
      valueDelivered: scores.valueDelivered,
      summary: extraction.summary,
    }), null);

    const claimInserts = factCheckResult.claims.map((c) => ({
      videoId, text: c.text, timestamp: c.timestamp, verdict: c.verdict, evidence: c.evidence, sources: c.sources,
    }));
    const savedClaims = await safeCall("persist-claims", () => analysisRepository.insertClaims(claimInserts), []);

    logger.info({
      videoId, grade: scores.grade, claimCount: savedClaims.length,
      accuracy: calculatedAccuracy, commentSentiment: commentAnalysis?.sentimentScore ?? null,
    }, "Full analysis complete");

    return {
      video: analysis
        ? { ...analysis, claims: savedClaims, nicheGrade: scores.nicheGrade, niche: scores.niche }
        : { grade: scores.grade, nicheGrade: scores.nicheGrade, niche: scores.niche,
            accuracy: calculatedAccuracy, authenticity: factCheckResult.authenticity,
            bsMeter: scores.bsMeter, clickbait: scores.clickbait, originality: scores.originality,
            contentDensity: extraction.contentDensity, valueDelivered: scores.valueDelivered,
            summary: extraction.summary, claims: savedClaims },
      sources,
      comments: commentAnalysis,
      channel: channelData,
      intel,
    };
  },

  async getCachedAnalysis(videoId: string) {
    const analysis = await analysisRepository.findByVideoId(videoId);
    if (!analysis) return null;
    const claims = await analysisRepository.getClaimsForVideo(videoId);
    const channel = analysis.channelId ? await findChannelByName(analysis.channelId) : null;
    return { video: { ...analysis, claims }, sources: null, comments: null, channel };
  },
};
