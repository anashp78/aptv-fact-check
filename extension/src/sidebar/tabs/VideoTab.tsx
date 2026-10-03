import type { VideoAnalysis, ClaimVerdict } from "@/types/analysis";
import { Meter } from "../components/Meter";

const VERDICT_STYLES: Record<ClaimVerdict, { bg: string; text: string; label: string }> = {
  verified: { bg: "bg-green-900/40", text: "text-green-400", label: "VERIFIED" },
  false: { bg: "bg-red-900/40", text: "text-red-400", label: "FALSE" },
  unverified: { bg: "bg-yellow-900/40", text: "text-yellow-400", label: "UNVERIFIED" },
  opinion: { bg: "bg-slate-700/40", text: "text-slate-400", label: "OPINION" },
};

interface VideoTabProps {
  data: VideoAnalysis | null;
}

export function VideoTab({ data }: VideoTabProps) {
  if (!data) {
    return <div className="p-4 text-slate-500 text-sm">No analysis data.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
          SCORECARDS
        </h3>
        <Meter label="Authenticity" value={data.authenticity} />
        <Meter label="Accuracy" value={data.accuracy} />
        <Meter label="BS Meter" value={data.bsMeter} />
        <Meter label="Clickbait" value={data.clickbait} />
        <Meter label="Originality" value={data.originality} />
        <Meter label="Content Density" value={data.contentDensity} />
        <Meter label="Value Delivered" value={data.valueDelivered} />
      </div>

      {data.summary.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            SUMMARY
          </h3>
          <ul className="flex flex-col gap-1.5">
            {data.summary.map((point, i) => (
              <li
                key={i}
                className="text-xs text-slate-300 pl-3 border-l-2 border-[var(--aptv-gold)]"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.claims.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            CLAIMS ({data.claims.length})
          </h3>
          <div className="flex flex-col gap-2">
            {data.claims.map((claim) => {
              const style = VERDICT_STYLES[claim.verdict];
              return (
                <div
                  key={claim.id}
                  className={`rounded-lg p-3 ${style.bg} border border-slate-700`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-200 flex-1">
                      {claim.text}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  {claim.timestamp && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      {claim.timestamp}
                    </span>
                  )}
                  {claim.evidence && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {claim.evidence}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
