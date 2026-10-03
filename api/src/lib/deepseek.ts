import { logger } from "./logger";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const REQUEST_TIMEOUT_MS = 30000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekResponse {
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function callDeepSeek(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json";
  } = {}
): Promise<string> {
  const apiKey = process.env["DEEPSEEK_API_KEY"];
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not set");
  }

  const model = options.model ?? "deepseek-chat";
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4096;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (options.responseFormat === "json") {
    body["response_format"] = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "DeepSeek API error");
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const content = data.choices[0]?.message?.content ?? "";

    logger.info(
      {
        model,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      "DeepSeek call complete"
    );

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as T;
}
