import { searchWeb } from "../lib/tavily";
import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { logger } from "../lib/logger";

interface SourceMatch {
  url: string;
  title: string;
  snippet: string;
  matchPercentage: number;
  type: "article" | "video" | "reddit" | "forum" | "website";
}

interface SourceDetectionResult {
  originalityScore: number;
  verdict: string;
  citedSources: SourceMatch[];
  matchingSources: SourceMatch[];
}

const ANALYSIS_PROMPT = `You are a content originality analyst. Given a video's key claims/summary and web search results, determine:

1. How much of this content is original vs copied/repackaged from existing sources
2. Which sources match the content (with estimated match percentage)
3. Whether the creator cited their sources or passed off others' work as their own

For each matching source, estimate what percentage of the video's content overlaps.

Return JSON:
{
  "originalityScore": 75,
  "verdict": "Mostly original analysis with some concepts borrowed from established sources",
  "citedSources": [],
  "matchingSources": [
    {
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "matchPercentage": 30,
      "type": "article|video|reddit|forum|website"
    }
  ]
}

originalityScore: 0 = fully copied, 100 = completely original
type: "video" for YouTube links, "reddit" for Reddit, "article" for news/blogs, "forum" for forums, "website" for other`;

export const sourceDetector = {
  async detect(
    summary: string[],
    claims: string[],
    videoTitle: string
  ): Promise<SourceDetectionResult | null> {
    logger.info({ videoTitle }, "Running source detection");

    // Build search queries from the video's key content
    const keyPhrases = [
      ...summary.slice(0, 3),
      ...claims.slice(0, 5).map((c) => `"${c.substring(0, 60)}"`),
    ];

    // Search for matching content
    const searchResults = await Promise.all([
      searchWeb(`${videoTitle} original source`, 5),
      searchWeb(keyPhrases[0] ?? videoTitle, 3),
      searchWeb(keyPhrases[1] ?? `"${videoTitle}" copied from`, 3),
    ]);

    const allResults = searchResults.flat();
    if (allResults.length === 0) {
      logger.warn("No web results for source detection");
      return { originalityScore: 80, verdict: "No matching sources found — content appears original", citedSources: [], matchingSources: [] };
    }

    const searchContext = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.substring(0, 200)}`)
      .join("\n\n");

    const raw = await callDeepSeek(
      [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `Video: "${videoTitle}"\n\nVideo Summary:\n${summary.join("\n")}\n\nKey Claims:\n${claims.join("\n")}\n\nWeb Search Results:\n${searchContext}`,
        },
      ],
      { temperature: 0.2, maxTokens: 2048, responseFormat: "json" }
    );

    try {
      const result = parseJsonResponse<SourceDetectionResult>(raw);
      logger.info(
        { originalityScore: result.originalityScore, matchCount: result.matchingSources.length },
        "Source detection complete"
      );
      return result;
    } catch {
      logger.warn("Failed to parse source detection response");
      return null;
    }
  },
};
