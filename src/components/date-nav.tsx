"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);

  return (
    <div className="flex items-center gap-2">
      <Link href={`/?date=${prev}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        ← Prev
      </Link>
      <input
        type="date"
        value={date}
        onChange={(e) => {
          if (e.target.value) router.push(`/?date=${e.target.value}`);
        }}
        className="h-7 rounded-lg border border-input bg-transparent px-2 text-[0.8rem] text-foreground"
      />
      <Link href={`/?date=${next}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Next →
      </Link>
    </div>
  );
}
