import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PredictionPick } from "@/lib/types";

export function HeadlinePick({ pick }: { pick: PredictionPick }) {
  return (
    <Card className="border-primary/40 bg-primary/[0.04]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Best Bet</CardTitle>
          <Badge variant="secondary" className="font-mono">
            {pick.confidence}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">
          {pick.market}: {pick.selection}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {pick.rationale.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
