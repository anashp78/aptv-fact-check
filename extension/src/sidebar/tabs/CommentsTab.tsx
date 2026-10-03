import type { CommentAnalysis } from "@/types/analysis";
import { Meter } from "../components/Meter";

interface CommentsTabProps {
  data: CommentAnalysis | null;
}

export function CommentsTab({ data }: CommentsTabProps) {
  if (!data) {
    return <div className="p-4 text-slate-500 text-sm">No comment data.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Meter label="Comment Section Health" value={data.healthScore} />
        <div className="flex gap-4 text-xs text-slate-400">
          <span>
            Total:{" "}
            <span className="text-slate-200 font-mono">
              {data.totalComments}
            </span>
          </span>
          <span>
            Analyzed:{" "}
            <span className="text-slate-200 font-mono">
              {data.analyzedComments}
            </span>
          </span>
        </div>
      </div>

      {data.suspiciousClusters.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-red-400 tracking-wider">
            SOCK PUPPET CLUSTERS
          </h3>
          {data.suspiciousClusters.map((cluster, i) => (
            <div
              key={i}
              className="rounded-lg p-3 bg-red-900/20 border border-red-900/40"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-red-400 font-bold">
                  CLUSTER {i + 1}
                </span>
                <span className="text-[10px] text-red-400 font-mono">
                  {Math.round(cluster.similarity * 100)}% match
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {cluster.accounts.map((account) => (
                  <span
                    key={account}
                    className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded"
                  >
                    @{account}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Shared: {cluster.sharedPatterns.join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {data.commenters.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wider">
            TOP COMMENTERS
          </h3>
          {data.commenters.slice(0, 20).map((commenter) => (
            <div
              key={commenter.username}
              className="rounded-lg p-3 bg-slate-800 border border-slate-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-200 font-medium">
                  @{commenter.username}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    commenter.credibilityScore >= 70
                      ? "text-green-400"
                      : commenter.credibilityScore >= 40
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {commenter.credibilityScore}/100
                </span>
              </div>
              <div className="flex gap-2 text-[10px] text-slate-500">
                <span>Age: {commenter.accountAge}</span>
                {commenter.channelSpecific && (
                  <span className="text-orange-400">Channel-only</span>
                )}
                {commenter.sockPuppetProbability > 50 && (
                  <span className="text-red-400">
                    Sock: {commenter.sockPuppetProbability}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
