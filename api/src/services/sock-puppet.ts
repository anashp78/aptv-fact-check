import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { logger } from "../lib/logger";

interface CommentInput {
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isCreatorReply: boolean;
}

interface CommenterAnalysis {
  username: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  credibilityScore: number;
  channelSpecific: boolean;
  sockPuppetProbability: number;
}

interface SockPuppetCluster {
  accounts: string[];
  similarity: number;
  sharedPatterns: string[];
}

interface CommentAnalysisResult {
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  sentimentScore: number;
  topPraises: string[];
  topComplaints: string[];
  agreementWithVideo: number;
  echoChamberId: number;
  totalComments: number;
  analyzedComments: number;
  suspiciousClusters: SockPuppetCluster[];
  commenters: CommenterAnalysis[];
  summary: string;
}

const SYSTEM_PROMPT = `You analyze YouTube comment sections. Focus on SENTIMENT and AUTHENTICITY.

SENTIMENT ANALYSIS:
- Categorize each comment: positive, negative, neutral, or mixed
- Calculate percentage breakdown
- Extract the top 3 things people PRAISE about the video/creator
- Extract the top 3 things people COMPLAIN about
- Agreement score (0-100): do commenters agree with the video's claims? 100 = total agreement, 0 = total disagreement
- Echo chamber score (0-100): is this an echo chamber? 100 = zero criticism tolerated, all comments identical praise. 0 = healthy diverse discussion

SOCK PUPPET DETECTION:
- Look for accounts with matching writing styles, vocabulary, punctuation
- Accounts that only appear on this one channel
- Overly enthusiastic praise that reads like self-promotion or planted reviews
- Multiple accounts posting similar content

COMMENTER ANALYSIS:
- Sentiment of their comment
- Credibility (0-100): genuine engagement vs planted/bot/astroturf
- Channel-specific: do they only comment on this channel?
- Sock puppet probability (0-100)

SUMMARY:
Write one sentence describing the overall comment section vibe.

Return JSON:
{
  "sentiment": { "positive": 60, "negative": 15, "neutral": 20, "mixed": 5 },
  "sentimentScore": 72,
  "topPraises": ["clear explanation", "helpful strategy", "entertaining"],
  "topComplaints": ["misleading title", "no real proof", "too long"],
  "agreementWithVideo": 80,
  "echoChamberScore": 45,
  "suspiciousClusters": [],
  "commenters": [
    {
      "username": "user1",
      "sentiment": "positive",
      "credibilityScore": 85,
      "channelSpecific": false,
      "sockPuppetProbability": 5
    }
  ],
  "summary": "Mostly positive with genuine discussion, some skepticism about results."
}

sentimentScore: 0 = overwhelmingly negative, 50 = mixed, 100 = overwhelmingly positive`;

export const sockPuppetDetector = {
  async analyze(comments: CommentInput[]): Promise<CommentAnalysisResult> {
    logger.info({ commentCount: comments.length }, "Analyzing comment sentiment + authenticity");

    if (comments.length === 0) {
      return {
        sentiment: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
        sentimentScore: 50,
        topPraises: [],
        topComplaints: [],
        agreementWithVideo: 50,
        echoChamberId: 0,
        totalComments: 0,
        analyzedComments: 0,
        suspiciousClusters: [],
        commenters: [],
        summary: "No comments to analyze.",
      };
    }

    const toAnalyze = comments.slice(0, 25);
    const commentText = toAnalyze
      .map(
        (c, i) =>
          `[${i + 1}] @${c.author} (${c.likeCount} likes, ${c.publishedAt}): ${c.text}`
      )
      .join("\n");

    const raw = await callDeepSeek(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze these ${toAnalyze.length} YouTube comments:\n\n${commentText}`,
        },
      ],
      { temperature: 0.2, maxTokens: 8192, responseFormat: "json" }
    );

    let result: CommentAnalysisResult;
    try {
      result = parseJsonResponse(raw);
    } catch {
      logger.warn("Failed to parse comment analysis JSON — returning empty");
      return {
        sentiment: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
        sentimentScore: 50,
        topPraises: [],
        topComplaints: [],
        agreementWithVideo: 50,
        echoChamberId: 0,
        totalComments: comments.length,
        analyzedComments: toAnalyze.length,
        suspiciousClusters: [],
        commenters: [],
        summary: "Analysis failed — could not parse results.",
      };
    }

    result.totalComments = comments.length;
    result.analyzedComments = toAnalyze.length;

    const clusterCount = result.suspiciousClusters?.length ?? 0;

    logger.info(
      {
        sentimentScore: result.sentimentScore,
        positive: result.sentiment?.positive,
        negative: result.sentiment?.negative,
        clusters: clusterCount,
        echo: result.echoChamberId,
      },
      "Comment analysis complete"
    );

    return result;
  },
};
