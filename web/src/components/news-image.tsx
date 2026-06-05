"use client";

import { useState } from "react";

/**
 * Article image that hides itself if it fails to load (some arusa CDN images
 * are access-protected / 403), so the gradient fallback shows through.
 */
export function NewsImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setOk(false)} loading="lazy" />
  );
}
