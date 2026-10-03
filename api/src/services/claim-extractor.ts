import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { logger } from "../lib/logger";

interface ExtractedClaim {
  text: string;
  timestamp: string;
  category: "factual" | "statistical" | "opinion" | "promotional" | "anecdotal";
  confidence: number;
}

interface ExtractionResult {
  claims: ExtractedClaim[];
  summary: string[];
  contentDensity: number;
  bsIndicators: string[];
  clickbaitIndicators: string[];
}

const SYSTEM_PROMPT = `You are a fact-checking analyst for APTV (Advantage Player TV). Your job is to extract every verifiable claim from a YouTube video transcript.

Focus on:
1. Statistical claims (percentages, numbers, rates, measurements)
2. Factual assertions about any subject (science, finance, health, tech, history, gambling, law, etc.)
3. Revenue/profit/income claims by the creator
4. Claims about other people, companies, channels, or organizations
5. Mathematical or scientific claims
6. Product/service claims (effectiveness, value, results)
7. Health/medical claims
8. Financial advice presented as fact
9. Legal claims or regulatory assertions

Ignore:
- Pure opinions clearly stated as opinions ("I think", "in my experience")
- Greetings, transitions, filler
- Questions asked to the audience

For each claim, estimate a timestamp from the transcript position (approximate minute:second).

Also analyze:
- BS indicators: hype language, pressure tactics, fear-based selling, unrealistic promises, manufactured urgency
- Clickbait indicators: mismatch between claims and substance, "secret" or "hack" language, "one weird trick" patterns
- Content density: ratio of substantive information to filler/repetition/self-promotion (0-100)

Return JSON:
{
  "claims": [
    {
      "text": "the exact claim",
      "timestamp": "M:SS",
      "category": "factual|statistical|opinion|promotional|anecdotal",
      "confidence": 0.0-1.0
    }
  ],
  "summary": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "contentDensity": 65,
  "bsIndicators": ["indicator 1", "indicator 2"],
  "clickbaitIndicators": ["indicator 1"]
}`;

export const claimExtractor = {
  async extract(
    transcript: string,
    videoTitle: string
  ): Promise<ExtractionResult> {
    logger.info({ titleLength: videoTitle.length, transcriptLength: transcript.length }, "Extracting claims");

    const truncated =
      transcript.length > 15000
        ? transcript.substring(0, 15000) + "\n\n[TRANSCRIPT TRUNCATED]"
        : transcript;

    const raw = await callDeepSeek(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Video Title: "${videoTitle}"\n\nTranscript:\n${truncated}`,
        },
      ],
      { temperature: 0.2, maxTokens: 4096, responseFormat: "json" }
    );

    const result = parseJsonResponse<ExtractionResult>(raw);

    logger.info(
      {
        claimCount: result.claims.length,
        summaryCount: result.summary.length,
        contentDensity: result.contentDensity,
      },
      "Claims extracted"
    );

    return result;
  },
};
