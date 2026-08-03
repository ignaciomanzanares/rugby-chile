"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clubLogo, clubSlug } from "@/lib/tournament";

/**
 * A club logo that links to the club's page (/teams/[slug]).
 *
 * `className` sizes the image/fallback (e.g. "w-7 h-7 rounded-full ...").
 * Use `stopPropagation` when the logo sits INSIDE another <a>/<button> (a match
 * row, a leader card): nesting anchors is invalid HTML, so there it renders a
 * role="link" span that navigates on click without bubbling to the parent.
 */
export function ClubLogo({
  team,
  className = "",
  wrapperClassName = "",
  stopPropagation = false,
  size,
}: {
  team: string;
  className?: string;
  wrapperClassName?: string;
  stopPropagation?: boolean;
  /** Optional pixel size (applied as inline width/height) for non-Tailwind sizing. */
  size?: number;
}) {
  const router = useRouter();
  const slug = clubSlug(team);
  const logo = clubLogo(team);
  const style = size ? { width: size, height: size } : undefined;

  const inner = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={team} className={className} style={style} />
  ) : (
    <span className={`inline-flex items-center justify-center bg-muted text-foreground/80 font-bold ${className}`} style={style}>
      {team.slice(0, 2).toUpperCase()}
    </span>
  );

  if (!slug) return inner; // unknown club — render the logo but don't link

  if (stopPropagation) {
    return (
      <span
        role="link"
        tabIndex={0}
        title={`Ver ${team}`}
        aria-label={`Ver ${team}`}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); router.push(`/teams/${slug}`); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); router.push(`/teams/${slug}`); } }}
        className={`cursor-pointer inline-flex hover:opacity-90 transition-opacity ${wrapperClassName}`}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={`/teams/${slug}`}
      title={`Ver ${team}`}
      aria-label={`Ver ${team}`}
      className={`inline-flex hover:opacity-90 transition-opacity ${wrapperClassName}`}
    >
      {inner}
    </Link>
  );
}
