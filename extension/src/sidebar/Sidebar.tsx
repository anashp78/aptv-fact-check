import { useState, useEffect } from "react";
import type {
  AnalysisState,
  VideoAnalysis,
  ChannelAnalysis,
  CommentAnalysis,
  SourceAnalysis,
} from "@/types/analysis";
import type { ExtensionMessage } from "@/types/messages";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { VideoTab } from "./tabs/VideoTab";
import { SourcesTab } from "./tabs/SourcesTab";
import { CommentsTab } from "./tabs/CommentsTab";
import { ChannelTab } from "./tabs/ChannelTab";
import { EmptyState } from "./components/EmptyState";

type TabId = "video" | "sources" | "comments" | "channel";

interface ApiResponse {
  success: boolean;
  data?: {
    video?: VideoAnalysis | null;
    sources?: SourceAnalysis | null;
    comments?: CommentAnalysis | null;
    channel?: ChannelAnalysis | null;
    error?: string;
  };
  error?: string;
}

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("video");
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    videoId: null,
    video: null,
    sources: null,
    comments: null,
    channel: null,
    error: null,
  });

  useEffect(() => {
    // Check storage for current video on mount
    chrome.storage.local.get("currentVideo", (result) => {
      if (result?.currentVideo?.videoId) {
        setState((prev) => ({
          ...prev,
          videoId: result.currentVideo.videoId as string,
        }));
        setVideoTitle(result.currentVideo.title as string ?? "");
      }
    });

    const listener = (message: ExtensionMessage) => {
      if (message.type === "VIDEO_DETECTED") {
        setState({
          status: "idle",
          videoId: message.videoId,
          video: null,
          sources: null,
          comments: null,
          channel: null,
          error: null,
        });
        setVideoTitle(message.title);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  function handleAnalyze() {
    if (!state.videoId) return;

    setState((prev) => ({ ...prev, status: "loading" }));

    chrome.runtime.sendMessage(
      { type: "ANALYZE_VIDEO", videoId: state.videoId },
      (response: ApiResponse) => {
        if (response?.success && response.data) {
          if (response.data.error) {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: response.data?.error ?? "Analysis failed",
            }));
            return;
          }

          setState({
            status: "complete",
            videoId: state.videoId,
            video: (response.data.video as VideoAnalysis) ?? null,
            sources: (response.data.sources as SourceAnalysis) ?? null,
            comments: (response.data.comments as CommentAnalysis) ?? null,
            channel: (response.data.channel as ChannelAnalysis) ?? null,
            error: null,
          });
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: response?.error ?? "Analysis failed",
          }));
        }
      }
    );
  }

  const renderTab = () => {
    if (state.status === "idle" && !state.video) {
      return (
        <EmptyState
          videoId={state.videoId}
          videoTitle={videoTitle}
          onAnalyze={handleAnalyze}
        />
      );
    }

    if (state.status === "loading" || state.status === "analyzing") {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-[var(--aptv-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Analyzing video...</p>
          <p className="text-xs text-slate-500">
            Extracting claims and fact checking
          </p>
        </div>
      );
    }

    if (state.status === "error") {
      return (
        <div className="p-4 text-center">
          <p className="text-red-400 text-sm">{state.error}</p>
          <button
            onClick={handleAnalyze}
            className="mt-3 px-4 py-2 bg-[var(--aptv-gold)] text-black rounded text-sm font-medium"
          >
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case "video":
        return <VideoTab data={state.video} />;
      case "sources":
        return <SourcesTab data={state.sources} />;
      case "comments":
        return <CommentsTab data={state.comments} />;
      case "channel":
        return <ChannelTab data={state.channel} />;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header grade={state.video?.grade ?? null} />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">{renderTab()}</div>
    </div>
  );
}
