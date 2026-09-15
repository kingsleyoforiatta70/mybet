import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          MatchEdge
        </Link>
        <span className="text-xs text-muted-foreground">Football predictions, backed by data</span>
      </div>
    </header>
  );
}
