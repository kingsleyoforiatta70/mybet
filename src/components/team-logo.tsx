"use client";

import { useState } from "react";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeamLogo({ name, logo, className }: { name: string; logo: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !logo) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ${className ?? "h-8 w-8"}`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      className={`object-contain ${className ?? "h-8 w-8"}`}
      onError={() => setFailed(true)}
    />
  );
}
