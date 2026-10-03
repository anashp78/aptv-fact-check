import { logger } from "../lib/logger";

interface ChannelPageData {
  name: string;
  description: string;
  joinDate: string;
  country: string;
  totalViews: string;
  videoCount: string;
  subscriberCount: string;
  links: { title: string; url: string }[];
  featuredChannels: string[];
  keywords: string[];
  avatarUrl: string;
  bannerUrl: string;
}

interface SocialProfile {
  platform: string;
  url: string;
  followers: string | null;
}

export interface ChannelResearchData {
  page: ChannelPageData | null;
  socials: SocialProfile[];
  websiteInfo: { url: string; title: string; description: string } | null;
}

const YOUTUBE_API_KEY = process.env["YOUTUBE_API_KEY"] ?? "";

export const channelScraper = {
  async research(channelName: string): Promise<ChannelResearchData> {
    logger.info({ channelName }, "Researching channel page");

    const result: ChannelResearchData = {
      page: null,
      socials: [],
      websiteInfo: null,
    };

    // Step 1: Get channel data from YouTube Data API
    if (YOUTUBE_API_KEY) {
      result.page = await this.fetchChannelFromApi(channelName);
    }

    // Step 2: Extract social links and check them
    if (result.page?.links) {
      const socialPlatforms = ["twitter", "instagram", "tiktok", "facebook", "discord", "twitch", "patreon", "linkedin"];

      for (const link of result.page.links) {
        const urlLower = link.url.toLowerCase();
        const platform = socialPlatforms.find((p) => urlLower.includes(p));

        if (platform) {
          result.socials.push({
            platform,
            url: link.url,
            followers: null, // Could scrape but rate-limited
          });
        } else if (!urlLower.includes("youtube.com")) {
          // It's a website — fetch basic info
          if (!result.websiteInfo) {
            result.websiteInfo = await this.fetchWebsiteBasics(link.url);
          }
        }
      }
    }

    logger.info({
      channelName,
      hasPage: !!result.page,
      socialCount: result.socials.length,
      hasWebsite: !!result.websiteInfo,
    }, "Channel research complete");

    return result;
  },

  async fetchChannelFromApi(channelName: string): Promise<ChannelPageData | null> {
    try {
      // First search for the channel
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", channelName);
      searchUrl.searchParams.set("type", "channel");
      searchUrl.searchParams.set("maxResults", "1");
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const searchResp = await fetch(searchUrl.toString());
      if (!searchResp.ok) return null;

      const searchData = (await searchResp.json()) as {
        items?: { snippet?: { channelId?: string } }[];
      };

      const channelId = searchData.items?.[0]?.snippet?.channelId;
      if (!channelId) return null;

      // Get full channel details
      const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelUrl.searchParams.set("part", "snippet,statistics,brandingSettings,topicDetails");
      channelUrl.searchParams.set("id", channelId);
      channelUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const channelResp = await fetch(channelUrl.toString());
      if (!channelResp.ok) return null;

      const channelData = (await channelResp.json()) as {
        items?: {
          snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            country?: string;
            thumbnails?: { high?: { url?: string } };
          };
          statistics?: {
            viewCount?: string;
            subscriberCount?: string;
            videoCount?: string;
          };
          brandingSettings?: {
            channel?: { keywords?: string };
            image?: { bannerExternalUrl?: string };
          };
          topicDetails?: { topicCategories?: string[] };
        }[];
      };

      const ch = channelData.items?.[0];
      if (!ch) return null;

      // Get channel links from the about page (requires scraping — API doesn't expose them)
      const links = await this.scrapeChannelLinks(channelId);

      const keywords = ch.brandingSettings?.channel?.keywords
        ?.split(/\s*"([^"]+)"\s*|\s+/)
        .filter(Boolean) ?? [];

      return {
        name: ch.snippet?.title ?? channelName,
        description: ch.snippet?.description ?? "",
        joinDate: ch.snippet?.publishedAt ?? "",
        country: ch.snippet?.country ?? "",
        totalViews: ch.statistics?.viewCount ?? "",
        videoCount: ch.statistics?.videoCount ?? "",
        subscriberCount: ch.statistics?.subscriberCount ?? "",
        links,
        featuredChannels: [],
        keywords,
        avatarUrl: ch.snippet?.thumbnails?.high?.url ?? "",
        bannerUrl: ch.brandingSettings?.image?.bannerExternalUrl ?? "",
      };
    } catch (err) {
      logger.warn({ error: String(err) }, "YouTube API channel fetch failed");
      return null;
    }
  },

  async scrapeChannelLinks(channelId: string): Promise<{ title: string; url: string }[]> {
    try {
      const resp = await fetch(`https://www.youtube.com/channel/${channelId}/about`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      if (!resp.ok) return [];

      const html = await resp.text();
      const links: { title: string; url: string }[] = [];

      // Extract links from channelExternalLinkViewModel
      const linkMatches = html.matchAll(/"channelExternalLinkViewModel":\{"title":\{"content":"([^"]+)"\},"link":\{"content":"([^"]+)"\}/g);
      for (const m of linkMatches) {
        if (m[1] && m[2]) {
          links.push({ title: m[1], url: m[2] });
        }
      }

      // Fallback: extract from primaryLinks
      if (links.length === 0) {
        const primaryLinks = html.matchAll(/"primaryLinkViewModel":\{"title":\{"content":"([^"]+)"\},"link":\{"content":"([^"]+)"\}/g);
        for (const m of primaryLinks) {
          if (m[1] && m[2]) {
            links.push({ title: m[1], url: m[2] });
          }
        }
      }

      // Also try simpler URL extraction from about page
      if (links.length === 0) {
        const urlPattern = /"url":"(https?:\/\/(?!www\.youtube\.com)[^"]+)"/g;
        const seen = new Set<string>();
        let match;
        while ((match = urlPattern.exec(html)) !== null) {
          const url = match[1];
          if (url && !seen.has(url) && !url.includes("google") && !url.includes("gstatic")) {
            seen.add(url);
            links.push({ title: new URL(url).hostname.replace("www.", ""), url });
          }
          if (links.length >= 10) break;
        }
      }

      return links;
    } catch {
      return [];
    }
  },

  async fetchWebsiteBasics(url: string): Promise<{ url: string; title: string; description: string } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (!resp.ok) return null;

      const html = await resp.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

      return {
        url,
        title: titleMatch?.[1]?.trim() ?? "",
        description: descMatch?.[1]?.trim() ?? "",
      };
    } catch {
      return null;
    }
  },
};
