import { Progress } from "@/components/ui/progress";

export function PredictionBar({
  label,
  pct,
  highlight = false,
}: {
  label: string;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={highlight ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
        <span className={`font-mono text-sm ${highlight ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {pct}%
        </span>
      </div>
      <Progress value={pct} className={highlight ? "h-2" : "h-1.5 opacity-70"} />
    </div>
  );
}
