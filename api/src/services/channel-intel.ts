import { searchWeb } from "../lib/tavily";
import { callDeepSeek, parseJsonResponse } from "../lib/deepseek";
import { channelScraper } from "./channel-scraper";
import { logger } from "../lib/logger";

interface ChannelIntel {
  owner: {
    name: string;
    bio: string;
    knownFor: string[];
    socialLinks: string[];
    websites: string[];
  };
  controversies: {
    title: string;
    summary: string;
    source: string;
    severity: "low" | "medium" | "high" | "critical";
  }[];
  revenue: {
    estimatedMonthlyViews: string;
    revenueStreams: string[];
    paidProducts: string[];
    affiliateLinks: boolean;
    sponsorships: boolean;
  };
  reputation: {
    communityPerception: string;
    redditMentions: string[];
    peerOpinions: string[];
  };
  trustIndicators: {
    positive: string[];
    negative: string[];
  };
  overallAssessment: string;
  channelStats: {
    joinDate: string;
    totalViews: string;
    videoCount: string;
    subscriberCount: string;
    country: string;
    description: string;
    keywords: string[];
    links: { title: string; url: string }[];
    socials: { platform: string; url: string }[];
    websiteUrl: string;
    websiteDescription: string;
  } | null;
}

const ANALYSIS_PROMPT = `You are an investigative analyst for APTV (Advantage Player TV). Given web search results about a YouTube channel and its owner, compile a comprehensive intelligence report.

Analyze EVERYTHING you find:

1. OWNER PROFILE:
   - Real name if publicly known
   - Background, credentials, expertise claims
   - Other businesses, websites, social media
   - Professional history

2. CONTROVERSIES & RED FLAGS:
   - Lawsuits, legal threats, complaints
   - Community drama, feuds with other creators
   - Product complaints, refund issues
   - Fraud allegations, exposed lies
   - Rate severity: low (minor drama), medium (pattern of complaints), high (documented deception), critical (legal action or proven fraud)

3. REVENUE ANALYSIS:
   - How do they make money? (ads, courses, coaching, affiliate, merch, donations, memberships)
   - Paid products — what do they sell and at what price?
   - Affiliate links detected?
   - Sponsorship deals?
   - Are the revenue claims plausible given their view counts?

4. REPUTATION:
   - What does the community say about them?
   - Reddit threads, forum discussions
   - What do other creators in the niche say?
   - Positive mentions vs negative mentions

5. TRUST INDICATORS:
   - Positive: verified expertise, transparency, free value, community respect, longevity
   - Negative: fake testimonials, stock photos, disclaimer contradictions, account age vs claims, deleted negative comments

Return JSON:
{
  "owner": { "name": "", "bio": "", "knownFor": [], "socialLinks": [], "websites": [] },
  "controversies": [{ "title": "", "summary": "", "source": "", "severity": "low|medium|high|critical" }],
  "revenue": { "estimatedMonthlyViews": "", "revenueStreams": [], "paidProducts": [], "affiliateLinks": false, "sponsorships": false },
  "reputation": { "communityPerception": "", "redditMentions": [], "peerOpinions": [] },
  "trustIndicators": { "positive": [], "negative": [] },
  "overallAssessment": ""
}`;

const intelCache = new Map<string, { data: ChannelIntel; cachedAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const channelIntel = {
  async investigate(channelName: string): Promise<ChannelIntel | null> {
    if (!channelName) return null;

    // Check cache first
    const cacheKey = channelName.toLowerCase().trim();
    const cached = intelCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      logger.info({ channelName }, "Returning cached channel intel");
      return cached.data;
    }

    logger.info({ channelName }, "Running channel intelligence (fresh)");

    // Run web searches + channel page scraping in parallel
    const [generalResults, controversyResults, redditResults, productResults, channelResearch] =
      await Promise.all([
        searchWeb(`"${channelName}" YouTube channel owner about`, 5),
        searchWeb(`"${channelName}" YouTube controversy scam complaint`, 5),
        searchWeb(`"${channelName}" YouTube site:reddit.com`, 3),
        searchWeb(`"${channelName}" course product price review`, 3),
        channelScraper.research(channelName),
      ]);

    const allResults = [
      ...generalResults,
      ...controversyResults,
      ...redditResults,
      ...productResults,
    ];

    if (allResults.length === 0 && !channelResearch.page) {
      logger.warn({ channelName }, "No web results or channel data found");
      return null;
    }

    // Format search results for DeepSeek
    const searchContext = allResults
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.substring(0, 300)}`
      )
      .join("\n\n");

    // Add channel page data to context
    let channelContext = "";
    if (channelResearch.page) {
      const p = channelResearch.page;
      channelContext = `\n\nYOUTUBE CHANNEL PAGE DATA:
- Name: ${p.name}
- Subscribers: ${Number(p.subscriberCount).toLocaleString()}
- Total Views: ${Number(p.totalViews).toLocaleString()}
- Videos: ${p.videoCount}
- Joined: ${p.joinDate ? new Date(p.joinDate).toLocaleDateString() : "unknown"}
- Country: ${p.country || "not set"}
- Description: ${p.description.substring(0, 500)}
- Keywords: ${p.keywords.join(", ")}
- Links: ${p.links.map((l) => `${l.title}: ${l.url}`).join(", ")}`;
    }

    if (channelResearch.socials.length > 0) {
      channelContext += `\n- Social Profiles: ${channelResearch.socials.map((s) => `${s.platform}: ${s.url}`).join(", ")}`;
    }

    if (channelResearch.websiteInfo) {
      channelContext += `\n- Website: ${channelResearch.websiteInfo.url} — "${channelResearch.websiteInfo.title}" — ${channelResearch.websiteInfo.description}`;
    }

    const raw = await callDeepSeek(
      [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `Analyze this YouTube channel: "${channelName}"${channelContext}\n\nWeb search results:\n\n${searchContext}`,
        },
      ],
      { temperature: 0.2, maxTokens: 8192, responseFormat: "json" }
    );

    let intel: ChannelIntel;
    try {
      intel = parseJsonResponse<ChannelIntel>(raw);
    } catch (parseErr) {
      logger.warn({ channelName, error: String(parseErr) }, "Failed to parse channel intel JSON");
      return null;
    }

    logger.info(
      {
        channelName,
        controversies: intel.controversies.length,
        revenueStreams: intel.revenue.revenueStreams.length,
        positiveIndicators: intel.trustIndicators.positive.length,
        negativeIndicators: intel.trustIndicators.negative.length,
      },
      "Channel intelligence complete"
    );

    // Attach channel stats from YouTube API
    if (channelResearch.page) {
      intel.channelStats = {
        joinDate: channelResearch.page.joinDate,
        totalViews: channelResearch.page.totalViews,
        videoCount: channelResearch.page.videoCount,
        subscriberCount: channelResearch.page.subscriberCount,
        country: channelResearch.page.country,
        description: channelResearch.page.description,
        keywords: channelResearch.page.keywords,
        links: channelResearch.page.links,
        socials: channelResearch.socials.map((s) => ({ platform: s.platform, url: s.url })),
        websiteUrl: channelResearch.websiteInfo?.url ?? "",
        websiteDescription: channelResearch.websiteInfo?.description ?? "",
      };
    }

    // Cache result
    intelCache.set(cacheKey, { data: intel, cachedAt: Date.now() });

    return intel;
  },
};
