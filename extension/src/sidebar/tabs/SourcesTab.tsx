import type { SourceAnalysis } from "@/types/analysis";
import { Meter } from "../components/Meter";

interface SourcesTabProps {
  data: SourceAnalysis | null;
}

export function SourcesTab({ data }: SourcesTabProps) {
  if (!data) {
    return <div className="p-4 text-slate-500 text-sm">No source data.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <Meter label="Originality Score" value={data.originalityScore} />

      {data.verdict && (
        <p className="text-xs text-slate-300 italic border-l-2 border-[var(--aptv-gold)] pl-3">
          {data.verdict}
        </p>
      )}

      {data.citedSources.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            CITED SOURCES
          </h3>
          {data.citedSources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-3 bg-slate-800 border border-slate-700 hover:border-[var(--aptv-gold)] transition-colors block"
            >
              <p className="text-xs text-blue-400 font-medium truncate">
                {source.title}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {source.snippet}
              </p>
            </a>
          ))}
        </div>
      )}

      {data.matchingSources.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            MATCHING CONTENT
          </h3>
          {data.matchingSources.map((source, i) => (
            <div
              key={i}
              className="rounded-lg p-3 bg-slate-800 border border-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 font-medium truncate flex-1"
                >
                  {source.title}
                </a>
                <span className="text-[10px] text-orange-400 font-mono whitespace-nowrap">
                  {source.matchPercentage}% match
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {source.snippet}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block capitalize">
                {source.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
