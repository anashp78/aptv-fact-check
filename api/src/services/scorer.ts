import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { logger } from "../lib/logger";

type LetterGrade = "A" | "B" | "C" | "D" | "F";
type AnalysisTier = "free" | "plus" | "pro";

interface ScoringInput {
  accuracy: number;
  authenticity: number;
  contentDensity: number;
  bsIndicatorCount: number;
  clickbaitIndicatorCount: number;
  falseClaimCount: number;
  totalClaimCount: number;
  verifiedClaimCount: number;
  opinionClaimCount: number;
  videoTitle: string;
  niche?: string;
  channelName?: string;
  tier?: AnalysisTier;
}

interface ScoringResult {
  grade: LetterGrade;
  nicheGrade: LetterGrade;
  niche: string;
  bsMeter: number;
  clickbait: number;
  originality: number;
  valueDelivered: number;
  composite: number;
  breakdown: {
    accuracyWeighted: number;
    bsWeighted: number;
    valueWeighted: number;
    originalityWeighted: number;
    clickbaitWeighted: number;
    falseClaimPenalty: number;
  };
}

// ── GRADING METHODOLOGY (deterministic, transparent, defensible) ─────────
//
// COMPOSITE SCORE = weighted sum of 5 metrics, minus false claim penalty
//
//   Accuracy       × 30%   (are claims factually correct?)
//   Integrity      × 25%   (inverse of BS meter — is content honest?)
//   Value          × 25%   (does the viewer gain something?)
//   Originality    × 10%   (is this new or copied?)
//   Title Match    × 10%   (does title match content?)
//
// FALSE CLAIM PENALTY:
//   0 false claims  → no penalty
//   1-2 false       → -5 points per false claim
//   3-5 false       → -8 points per false claim
//   6+ false        → -10 points per false claim + grade cap at D
//
// GRADE THRESHOLDS:
//   A  = composite >= 72
//   B  = composite >= 58
//   C  = composite >= 44
//   D  = composite >= 30
//   F  = composite < 30 OR 6+ false claims
//
// NICHE GRADE:
//   Same formula but bumped one level if zero false claims
//   (rewarding channels that never spread misinformation)
//
// This is DETERMINISTIC — same inputs always produce same grade.
// The AI only provides the subjective metric estimates (BS, clickbait,
// originality, value). The grade calculation is pure math.
// ─────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  accuracy: 0.30,
  integrity: 0.25,
  value: 0.25,
  originality: 0.10,
  titleMatch: 0.10,
};

function calculateGrade(composite: number, falseClaimCount: number): LetterGrade {
  if (falseClaimCount >= 6) return "F";
  if (composite >= 72) return "A";
  if (composite >= 58) return "B";
  if (composite >= 44) return "C";
  if (composite >= 30) return "D";
  return "F";
}

function calculateFalseClaimPenalty(falseCount: number): number {
  if (falseCount === 0) return 0;
  if (falseCount <= 2) return falseCount * 5;
  if (falseCount <= 5) return falseCount * 8;
  return falseCount * 10;
}

function bumpGrade(grade: LetterGrade): LetterGrade {
  const bump: Record<string, LetterGrade> = { B: "A", C: "B", D: "C", F: "D" };
  return bump[grade] ?? grade;
}

// ── AI SCORING PROMPT ────────────────────────────────────────────────────
// AI only estimates 4 subjective metrics + detects niche.
// It does NOT assign a grade — we calculate that deterministically.

const METRIC_PROMPT = `You estimate 4 subjective metrics about a YouTube video. You do NOT assign a grade.

Score each 0-100:

bsMeter: Is the creator being deliberately deceptive or manipulative?
  0-20 = Honest, transparent, no manipulation
  21-40 = Minor hype but mostly honest
  41-60 = Noticeable exaggeration or pressure tactics
  61-80 = Significant manipulation, fake urgency, misleading framing
  81-100 = Deliberately deceptive, predatory tactics

  NOT BS: subscribe CTAs, promoting real products, enthusiasm, sharing opinions, entertainment

clickbait: Does the title MISREPRESENT the actual content?
  0-20 = Title accurately describes the content
  21-40 = Slightly dramatic but delivers on promise
  41-60 = Title oversells but content is somewhat related
  61-80 = Title is misleading, content doesn't match
  81-100 = Complete bait-and-switch

originality: Is this bringing something new to the niche?
  0-20 = Copied/repackaged from others with no credit
  21-40 = Standard format, nothing new
  41-60 = Some unique perspective or approach
  61-80 = Original analysis, tools, data, or framework
  81-100 = Pioneering content nobody else makes

valueDelivered: Does a viewer in this niche walk away better off?
  0-20 = Complete waste of time
  21-40 = Minimal takeaway
  41-60 = Some useful information
  61-80 = Solid value, viewer learned something actionable
  81-100 = Essential viewing, high-quality education or insight

Also detect the niche/category of the video.

Return JSON only:
{
  "bsMeter": 25,
  "clickbait": 15,
  "originality": 70,
  "valueDelivered": 80,
  "niche": "startup advice"
}`;

export const scorer = {
  async score(input: ScoringInput): Promise<ScoringResult> {
    logger.info({ videoTitle: input.videoTitle }, "Scoring video");

    const raw = await callDeepSeek(
      [
        { role: "system", content: METRIC_PROMPT },
        {
          role: "user",
          content: `Video: "${input.videoTitle}"
${input.channelName ? `Channel: ${input.channelName}` : ""}

Context:
- ${input.falseClaimCount} confirmed false claims out of ${input.totalClaimCount} total
- ${input.verifiedClaimCount} verified true claims
- ${input.opinionClaimCount} opinion/advice claims
- Content density: ${input.contentDensity}%
- ${input.bsIndicatorCount} BS language indicators detected
- ${input.clickbaitIndicatorCount} clickbait indicators detected

Estimate the 4 metrics.`,
        },
      ],
      { temperature: 0.1, maxTokens: 256, responseFormat: "json" }
    );

    const aiMetrics = parseJsonResponse<{
      bsMeter: number;
      clickbait: number;
      originality: number;
      valueDelivered: number;
      niche: string;
    }>(raw);

    // ── Deterministic grade calculation ──
    const accuracyW = input.accuracy * WEIGHTS.accuracy;
    const integrityW = (100 - aiMetrics.bsMeter) * WEIGHTS.integrity;
    const valueW = aiMetrics.valueDelivered * WEIGHTS.value;
    const originalityW = aiMetrics.originality * WEIGHTS.originality;
    const titleMatchW = (100 - aiMetrics.clickbait) * WEIGHTS.titleMatch;
    const penalty = calculateFalseClaimPenalty(input.falseClaimCount);

    const composite = Math.max(0, Math.min(100,
      accuracyW + integrityW + valueW + originalityW + titleMatchW - penalty
    ));

    const grade = calculateGrade(composite, input.falseClaimCount);
    const nicheGrade = input.falseClaimCount === 0 && grade !== "A"
      ? bumpGrade(grade)
      : grade;

    const result: ScoringResult = {
      grade,
      nicheGrade,
      niche: aiMetrics.niche,
      bsMeter: aiMetrics.bsMeter,
      clickbait: aiMetrics.clickbait,
      originality: aiMetrics.originality,
      valueDelivered: aiMetrics.valueDelivered,
      composite: Math.round(composite),
      breakdown: {
        accuracyWeighted: Math.round(accuracyW),
        bsWeighted: Math.round(integrityW),
        valueWeighted: Math.round(valueW),
        originalityWeighted: Math.round(originalityW),
        clickbaitWeighted: Math.round(titleMatchW),
        falseClaimPenalty: Math.round(penalty),
      },
    };

    logger.info(
      {
        grade, nicheGrade, composite: result.composite,
        accuracy: input.accuracy, bs: aiMetrics.bsMeter, value: aiMetrics.valueDelivered,
        originality: aiMetrics.originality, clickbait: aiMetrics.clickbait,
        falseClaimPenalty: penalty, niche: aiMetrics.niche,
      },
      "Scoring complete"
    );

    return result;
  },
};
