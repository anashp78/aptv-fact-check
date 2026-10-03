import { callDeepSeek } from "../lib/deepseek";
import { logger } from "../lib/logger";

interface ResponseScriptInput {
  videoTitle: string;
  channelName: string;
  falseClaims: { text: string; evidence: string }[];
  grade: string;
  summary: string[];
}

export const responseGenerator = {
  async generate(input: ResponseScriptInput): Promise<string> {
    logger.info({ videoTitle: input.videoTitle, falseClaims: input.falseClaims.length }, "Generating response script");

    const claimsList = input.falseClaims
      .map((c, i) => `${i + 1}. CLAIM: "${c.text}"\n   FACT: ${c.evidence}`)
      .join("\n\n");

    const raw = await callDeepSeek(
      [
        {
          role: "system",
          content: `You write response video scripts for APTV (Advantage Player TV). The tone is:
- Confident but not arrogant
- Sarcastic when warranted, never mean to beginners
- Devastating but factual — every point backed by evidence
- Deadpan delivery of ridiculous facts is funnier than trying to write jokes

Structure:
1. HOOK (10 seconds) — grab attention, state what you found
2. CONTEXT (30 seconds) — who is this creator, what did they claim
3. THE FACTS (bulk) — go through each false claim, show the correct info
4. THE VERDICT — overall assessment
5. CLOSE — tagline, call to action

Keep it under 3 minutes of speaking time (~450 words).
Write it as a narration script with [SHOW: ] cues for what to display on screen.`,
        },
        {
          role: "user",
          content: `Write a response script for this video:

Video: "${input.videoTitle}"
Channel: ${input.channelName}
APTV Grade: ${input.grade}

Summary:
${input.summary.join("\n")}

False Claims Found:
${claimsList}`,
        },
      ],
      { temperature: 0.7, maxTokens: 2048 }
    );

    logger.info({ wordCount: raw.split(/\s+/).length }, "Response script generated");
    return raw;
  },
};
