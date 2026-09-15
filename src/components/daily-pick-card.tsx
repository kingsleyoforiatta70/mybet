import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Fixture, PredictionSet } from "@/lib/types";

export function DailyPickCard({ fixture, predictions }: { fixture: Fixture; predictions: PredictionSet }) {
  const { headline } = predictions;
  return (
    <Link href={`/match/${fixture.id}`}>
      <Card className="h-full border-primary/40 bg-primary/[0.04] transition-colors hover:border-primary/70">
        <CardContent className="flex h-full flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-muted-foreground">
              {fixture.league.country} — {fixture.league.name}
            </span>
            <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
              {headline.confidence}%
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <TeamLogo name={fixture.home.name} logo={fixture.home.logo} className="h-5 w-5" />
            <span className="truncate">{fixture.home.name}</span>
            <span className="text-xs text-muted-foreground">v</span>
            <span className="truncate">{fixture.away.name}</span>
            <TeamLogo name={fixture.away.name} logo={fixture.away.logo} className="h-5 w-5" />
          </div>

          <div className="mt-auto">
            <p className="text-xs text-muted-foreground">{headline.market}</p>
            <p className="text-base font-semibold">{headline.selection}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
