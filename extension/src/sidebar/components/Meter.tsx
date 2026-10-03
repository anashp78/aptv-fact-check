interface MeterProps {
  label: string;
  value: number;
  max?: number;
  colorClass?: string;
}

function getColorByValue(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-yellow-500";
  if (value >= 20) return "bg-orange-500";
  return "bg-red-500";
}

function getInverseColorByValue(value: number): string {
  if (value <= 20) return "bg-green-500";
  if (value <= 40) return "bg-blue-500";
  if (value <= 60) return "bg-yellow-500";
  if (value <= 80) return "bg-orange-500";
  return "bg-red-500";
}

export function Meter({ label, value, max = 100, colorClass }: MeterProps) {
  const isInverse = label.toLowerCase().includes("bs") || label.toLowerCase().includes("clickbait");
  const barColor = colorClass ?? (isInverse ? getInverseColorByValue(value) : getColorByValue(value));
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className="text-xs text-slate-300 font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
