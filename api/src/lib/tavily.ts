import { logger } from "./logger";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function searchWeb(
  query: string,
  maxResults = 5
): Promise<TavilyResult[]> {
  const apiKey = process.env["TAVILY_API_KEY"];
  if (!apiKey) {
    logger.warn("TAVILY_API_KEY not set — web search disabled");
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: false,
        search_depth: "basic",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn({ status: response.status }, "Tavily search failed");
      return [];
    }

    const data = (await response.json()) as TavilyResponse;
    logger.info({ query, resultCount: data.results.length }, "Web search complete");
    return data.results;
  } catch (err) {
    logger.warn({ error: String(err) }, "Tavily search error");
    return [];
  }
}
