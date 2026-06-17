"use client";

import { useState } from "react";

// Brand tints cycled deterministically per article so the fallback covers
// don't all look identical in a grid.
const TINTS = [
  "from-red-950 via-red-900/40 to-zinc-950",
  "from-zinc-900 via-red-950/50 to-black",
  "from-amber-950/60 via-zinc-900 to-black",
  "from-red-900/50 via-zinc-900 to-zinc-950",
  "from-zinc-950 via-red-950/40 to-red-900/30",
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * Article image with a guaranteed visual: renders the real photo when it
 * loads, otherwise a branded Top10 cover (tinted gradient + logo watermark) so
 * a card is never blank — some arusa CDN images are access-protected (403) or
 * the article simply has no image.
 */
export function NewsImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src as string} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />
    );
  }

  // Branded fallback cover. Reuses the caller's className so it fills the same
  // box (the absolute inset-0 / sizing classes apply to this element too).
  return (
    <div className={`${className ?? ""} bg-gradient-to-br ${tintFor(alt)} flex items-center justify-center overflow-hidden`}>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 16px)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/top10-arusa-logo.png"
        alt=""
        aria-hidden
        className="w-1/3 max-w-[120px] min-w-[64px] opacity-25 drop-shadow-lg select-none"
        loading="lazy"
      />
    </div>
  );
}
