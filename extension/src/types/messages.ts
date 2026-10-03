export type MessageType =
  | "VIDEO_DETECTED"
  | "ANALYZE_VIDEO"
  | "ANALYSIS_STATUS"
  | "TOGGLE_SIDEBAR"
  | "SET_DISPLAY_MODE";

export interface VideoDetectedMessage {
  type: "VIDEO_DETECTED";
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
}

export interface AnalyzeVideoMessage {
  type: "ANALYZE_VIDEO";
  videoId: string;
}

export interface AnalysisStatusMessage {
  type: "ANALYSIS_STATUS";
  status: "loading" | "analyzing" | "complete" | "error";
  tab?: "video" | "sources" | "comments" | "channel";
  progress?: number;
}

export interface ToggleSidebarMessage {
  type: "TOGGLE_SIDEBAR";
}

export interface SetDisplayModeMessage {
  type: "SET_DISPLAY_MODE";
  mode: "badge" | "sidebar" | "overlay";
}

export type ExtensionMessage =
  | VideoDetectedMessage
  | AnalyzeVideoMessage
  | AnalysisStatusMessage
  | ToggleSidebarMessage
  | SetDisplayModeMessage;
