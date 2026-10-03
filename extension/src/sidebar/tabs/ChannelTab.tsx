import type { ChannelAnalysis } from "@/types/analysis";
import { TIER_LABELS } from "@/types/analysis";
import { Meter } from "../components/Meter";

const TIER_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-green-900/30", text: "text-green-400", border: "border-green-600" },
  2: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-600" },
  3: { bg: "bg-orange-900/30", text: "text-orange-400", border: "border-orange-600" },
  4: { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-600" },
};

interface ChannelTabProps {
  data: ChannelAnalysis | null;
}

export function ChannelTab({ data }: ChannelTabProps) {
  if (!data) {
    return <div className="p-4 text-slate-500 text-sm">No channel data.</div>;
  }

  const tierStyle = data.tier ? TIER_COLORS[data.tier] : null;

  return (
    <div className="p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-slate-200 font-semibold">
          {data.channelName}
        </h2>
        {data.tier && tierStyle && (
          <div
            className={`px-2.5 py-1 rounded-lg border ${tierStyle.bg} ${tierStyle.border}`}
          >
            <span className={`text-[10px] font-bold ${tierStyle.text}`}>
              TIER {data.tier}
            </span>
            <span className={`text-[10px] ml-1 ${tierStyle.text}`}>
              {TIER_LABELS[data.tier]}
            </span>
          </div>
        )}
      </div>

      <Meter label="Trust Score" value={data.trustScore} />

      <div className="text-xs text-slate-400">
        Videos Analyzed:{" "}
        <span className="text-slate-200 font-mono">{data.videosAnalyzed}</span>
      </div>

      {data.accuracyTrend.length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            ACCURACY TREND
          </h3>
          <div className="flex items-end gap-0.5 h-12">
            {data.accuracyTrend.map((val, i) => (
              <div
                key={i}
                className="flex-1 bg-[var(--aptv-gold)] rounded-t opacity-70"
                style={{ height: `${val}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {Object.keys(data.nicheCredibility).length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            NICHE CREDIBILITY
          </h3>
          {Object.entries(data.nicheCredibility).map(([niche, score]) => (
            <Meter key={niche} label={niche} value={score} />
          ))}
        </div>
      )}
    </div>
  );
}
