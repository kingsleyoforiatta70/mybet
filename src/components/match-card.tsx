import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamLogo } from "@/components/team-logo";
import type { Fixture } from "@/lib/types";

function statusBadge(fixture: Fixture) {
  const { short, elapsed } = fixture.status;
  if (short === "NS") {
    return (
      <Badge variant="secondary" className="font-mono">
        {new Date(fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Badge>
    );
  }
  if (["1H", "2H", "HT", "ET", "LIVE"].includes(short)) {
    return <Badge className="bg-red-600 text-white hover:bg-red-600">{elapsed ? `${elapsed}'` : "LIVE"}</Badge>;
  }
  if (short === "FT") return <Badge variant="outline">Full Time</Badge>;
  return <Badge variant="outline">{fixture.status.long}</Badge>;
}

export function MatchCard({ fixture }: { fixture: Fixture }) {
  return (
    <Link href={`/match/${fixture.id}`}>
      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/40">
        <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-1 items-center gap-3">
            <TeamLogo name={fixture.home.name} logo={fixture.home.logo} className="h-7 w-7" />
            <span className="text-sm font-medium">{fixture.home.name}</span>
          </div>
          <div className="flex flex-col items-center gap-1">{statusBadge(fixture)}</div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-right text-sm font-medium">{fixture.away.name}</span>
            <TeamLogo name={fixture.away.name} logo={fixture.away.logo} className="h-7 w-7" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
