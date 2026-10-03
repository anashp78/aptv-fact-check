import { logger } from "../lib/logger";

interface YouTubeComment {
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isCreatorReply: boolean;
}

export const commentFetcher = {
  async fetchComments(videoId: string, maxComments = 100): Promise<YouTubeComment[]> {
    const apiKey = process.env["YOUTUBE_API_KEY"];
    if (!apiKey) {
      logger.warn("YOUTUBE_API_KEY not set — comment analysis requires YouTube Data API v3 key");
      return [];
    }

    logger.info({ videoId, maxComments }, "Fetching YouTube comments");

    const comments: YouTubeComment[] = [];
    let pageToken = "";

    while (comments.length < maxComments) {
      const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("videoId", videoId);
      url.searchParams.set("maxResults", String(Math.min(100, maxComments - comments.length)));
      url.searchParams.set("order", "relevance");
      url.searchParams.set("textFormat", "plainText");
      url.searchParams.set("key", apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(
          { status: response.status, error: errorText.substring(0, 200) },
          "YouTube API comment fetch failed"
        );
        break;
      }

      const data = (await response.json()) as YouTubeApiResponse;

      for (const item of data.items ?? []) {
        const snippet = item.snippet?.topLevelComment?.snippet;
        if (!snippet) continue;

        comments.push({
          author: snippet.authorDisplayName ?? "Unknown",
          text: snippet.textDisplay ?? "",
          likeCount: snippet.likeCount ?? 0,
          publishedAt: snippet.publishedAt ?? "",
          isCreatorReply: (item.snippet?.totalReplyCount ?? 0) > 0,
        });
      }

      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }

    logger.info({ videoId, commentCount: comments.length }, "Comments fetched");
    return comments;
  },
};

interface YouTubeApiResponse {
  items?: {
    snippet?: {
      topLevelComment?: {
        snippet?: {
          authorDisplayName?: string;
          textDisplay?: string;
          likeCount?: number;
          publishedAt?: string;
        };
      };
      totalReplyCount?: number;
    };
  }[];
  nextPageToken?: string;
}
