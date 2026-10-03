export type ClaimVerdict = "verified" | "false" | "unverified" | "opinion";

export type ChannelTier = 1 | 2 | 3 | 4;

export type TierLabel = "The Real Ones" | "The Middle" | "Dingleberry" | "Fraud";

export const TIER_LABELS: Record<ChannelTier, TierLabel> = {
  1: "The Real Ones",
  2: "The Middle",
  3: "Dingleberry",
  4: "Fraud",
};

export type LetterGrade = "A" | "B" | "C" | "D" | "F";

export interface VideoAnalysis {
  videoId: string;
  grade: LetterGrade;
  authenticity: number;
  accuracy: number;
  bsMeter: number;
  clickbait: number;
  originality: number;
  contentDensity: number;
  valueDelivered: number;
  summary: string[];
  claims: Claim[];
  analyzedAt: string;
}

export interface Claim {
  id: string;
  text: string;
  timestamp: string;
  verdict: ClaimVerdict;
  evidence: string;
  sources: string[];
}

export interface SourceResult {
  url: string;
  title: string;
  snippet: string;
  matchPercentage: number;
  type: "article" | "video" | "reddit" | "forum";
}

export interface SourceAnalysis {
  videoId: string;
  originalityScore: number;
  citedSources: SourceResult[];
  matchingSources: SourceResult[];
  verdict: string;
}

export interface CommenterProfile {
  username: string;
  credibilityScore: number;
  accountAge: string;
  activityGap: boolean;
  channelSpecific: boolean;
  sockPuppetProbability: number;
  writingFingerprint: WritingFingerprint;
}

export interface WritingFingerprint {
  vocabularyFrequency: string[];
  sentencePatterns: string[];
  punctuationHabits: string[];
  capitalizationPattern: string;
  repeatedPhrases: string[];
  consistentMisspellings: string[];
}

export interface CommentAnalysis {
  videoId: string;
  healthScore: number;
  totalComments: number;
  analyzedComments: number;
  suspiciousClusters: SockPuppetCluster[];
  commenters: CommenterProfile[];
}

export interface SockPuppetCluster {
  accounts: string[];
  similarity: number;
  sharedPatterns: string[];
}

export interface ChannelAnalysis {
  channelId: string;
  channelName: string;
  trustScore: number;
  accuracyTrend: number[];
  tier: ChannelTier | null;
  tierLabel: TierLabel | null;
  videosAnalyzed: number;
  nicheCredibility: Record<string, number>;
}

export interface AnalysisState {
  status: "idle" | "loading" | "analyzing" | "complete" | "error";
  videoId: string | null;
  video: VideoAnalysis | null;
  sources: SourceAnalysis | null;
  comments: CommentAnalysis | null;
  channel: ChannelAnalysis | null;
  error: string | null;
}

export type DisplayMode = "badge" | "sidebar" | "overlay";
