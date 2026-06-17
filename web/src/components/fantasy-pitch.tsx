"use client";

import {
  FORMATION,
  POSITION_SHORT,
  isForward,
  type Assignments,
  type FormationSlot,
  type FantasyPlayer,
} from "@/lib/fantasy";
import { clubLogo } from "@/lib/tournament";

// Last name (or last two tokens) for a compact jersey label.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length <= 2 ? parts[parts.length - 1] : parts.slice(-2).join(" ");
}

function SlotToken({
  slot,
  player,
  isCaptain,
  isVice,
  onClick,
}: {
  slot: FormationSlot;
  player: FantasyPlayer | null;
  isCaptain: boolean;
  isVice: boolean;
  onClick: () => void;
}) {
  const fwd = isForward(slot.position);
  const logo = player ? clubLogo(player.clubName) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group focus:outline-none"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <div
        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg transition-transform group-hover:scale-110 group-active:scale-95 ring-2 ${
          player
            ? fwd
              ? "bg-red-600 text-white ring-red-300/40"
              : "bg-amber-400 text-zinc-950 ring-amber-200/50"
            : "bg-black/40 text-white/60 ring-white/30 ring-dashed border border-dashed border-white/40"
        }`}
      >
        {player ? (
          logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
          ) : (
            POSITION_SHORT[slot.position]
          )
        ) : (
          <span className="text-base leading-none">+</span>
        )}

        {isCaptain && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 text-amber-400 text-[8px] font-black flex items-center justify-center ring-1 ring-amber-400">
            C
          </span>
        )}
        {isVice && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 text-white/80 text-[8px] font-black flex items-center justify-center ring-1 ring-white/50">
            V
          </span>
        )}
      </div>

      <div className="flex flex-col items-center leading-none">
        <span className="text-[9px] sm:text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] max-w-[72px] truncate">
          {player ? shortName(player.name) : POSITION_SHORT[slot.position]}
        </span>
        {player && (
          <span className="text-[8px] sm:text-[9px] font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tabular-nums">
            ${player.price.toFixed(1)}M
          </span>
        )}
      </div>
    </button>
  );
}

export function FantasyPitch({
  assignments,
  captainId,
  viceCaptainId,
  onSlotClick,
}: {
  assignments: Assignments;
  captainId: string | null;
  viceCaptainId: string | null;
  onSlotClick: (slot: FormationSlot) => void;
}) {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-emerald-900/60 shadow-xl select-none">
      {/* Pitch surface + stripes */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-700 to-emerald-800" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 8%, transparent 8% 16%)",
        }}
      />
      {/* Field markings */}
      <div className="absolute inset-3 border-2 border-white/40 rounded-sm" />
      <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-2 border-white/30" />
      <div className="absolute left-3 right-3 top-[22%] border-t border-dashed border-white/25" />
      <div className="absolute left-3 right-3 bottom-[22%] border-t border-dashed border-white/25" />

      {/* Slots */}
      {FORMATION.map((slot) => (
        <SlotToken
          key={slot.id}
          slot={slot}
          player={assignments[slot.id]}
          isCaptain={Boolean(captainId) && assignments[slot.id]?.id === captainId}
          isVice={Boolean(viceCaptainId) && assignments[slot.id]?.id === viceCaptainId}
          onClick={() => onSlotClick(slot)}
        />
      ))}
    </div>
  );
}
