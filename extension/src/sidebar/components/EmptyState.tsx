interface EmptyStateProps {
  videoId: string | null;
  videoTitle?: string;
  onAnalyze: () => void;
}

export function EmptyState({ videoId, videoTitle, onAnalyze }: EmptyStateProps) {
  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
        <span className="text-[var(--aptv-gold)] font-bold text-4xl">?</span>
        <p className="text-slate-300 text-sm font-medium">
          Navigate to a YouTube video
        </p>
        <p className="text-slate-500 text-xs">
          APTV Fact Check will detect the video automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
      {videoTitle && (
        <p className="text-slate-300 text-sm font-medium leading-snug">
          {videoTitle}
        </p>
      )}
      <p className="text-slate-500 text-xs font-mono">{videoId}</p>
      <button
        onClick={onAnalyze}
        className="px-6 py-2.5 bg-[var(--aptv-gold)] text-black rounded-lg text-sm font-bold hover:bg-yellow-400 transition-colors"
      >
        Analyze This Video
      </button>
      <p className="text-slate-500 text-xs">
        Every niche. Every channel. Graded.
      </p>
    </div>
  );
}
