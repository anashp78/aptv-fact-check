import type { LetterGrade } from "@/types/analysis";

const GRADE_COLORS: Record<LetterGrade, string> = {
  A: "text-green-400 border-green-400",
  B: "text-blue-400 border-blue-400",
  C: "text-yellow-400 border-yellow-400",
  D: "text-orange-400 border-orange-400",
  F: "text-red-400 border-red-400",
};

interface HeaderProps {
  grade: LetterGrade | null;
}

export function Header({ grade }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--aptv-border)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--aptv-gold)] font-bold text-lg tracking-wider">
          APTV
        </span>
        <span className="text-slate-400 text-xs font-medium">FACT CHECK</span>
      </div>
      {grade && (
        <div
          className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center font-bold text-lg ${GRADE_COLORS[grade]}`}
        >
          {grade}
        </div>
      )}
    </div>
  );
}
