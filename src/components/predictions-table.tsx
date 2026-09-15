import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Fixture, PredictionSet } from "@/lib/types";

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 65) return "bg-emerald-600/15 text-emerald-400 border-emerald-600/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

export function PredictionsTable({ rows }: { rows: { fixture: Fixture; predictions: PredictionSet }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kickoff</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Best Bet</TableHead>
            <TableHead className="text-right">1X2</TableHead>
            <TableHead className="text-right">BTTS</TableHead>
            <TableHead className="text-right">O/U 2.5</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ fixture, predictions }) => (
            <TableRow key={fixture.id} className="cursor-pointer">
              <TableCell className="whitespace-nowrap text-muted-foreground">
                <Link href={`/match/${fixture.id}`} className="block">
                  {new Date(fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Link>
              </TableCell>
              <TableCell className="min-w-[220px]">
                <Link href={`/match/${fixture.id}`} className="flex items-center gap-2">
                  <TeamLogo name={fixture.home.name} logo={fixture.home.logo} className="h-5 w-5" />
                  <span className="text-sm">{fixture.home.name}</span>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <TeamLogo name={fixture.away.name} logo={fixture.away.logo} className="h-5 w-5" />
                  <span className="text-sm">{fixture.away.name}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/match/${fixture.id}`} className="flex items-center gap-2">
                  <span className="text-sm font-medium">{predictions.headline.selection}</span>
                  <Badge variant="outline" className={`font-mono text-[10px] ${confidenceBadgeClass(predictions.headline.confidence)}`}>
                    {predictions.headline.confidence}%
                  </Badge>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/match/${fixture.id}`} className="block font-mono text-xs text-muted-foreground">
                  {predictions.matchResult.home}/{predictions.matchResult.draw}/{predictions.matchResult.away}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/match/${fixture.id}`} className="block font-mono text-xs text-muted-foreground">
                  {predictions.btts.yesPct}%
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/match/${fixture.id}`} className="block font-mono text-xs text-muted-foreground">
                  {predictions.totalGoals.overPct}%
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
