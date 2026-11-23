"use client";

import { difficultyStyle } from "@/components/fdr-strip";
import { useLocale } from "@/components/locale-provider";
import { outlookWeeks, type FdrHorizon } from "@/lib/squad-view";
import type { SquadPlayer } from "@/lib/squad-types";

/**
 * Issue #74: a player's next 3 or 5 gameweeks as small FPL-coloured cells (1-2 green, 3 grey, 4 pink, 5 maroon).
 * A double week stacks two games in one cell; a blank week is an empty "–" cell. The opponent and H/A show only
 * from lg and only for 3 weeks; on a narrow card or at 5 weeks a cell is just colour and number.
 */
export function FdrCells({ player, horizon, className = "" }: { player: SquadPlayer; horizon: FdrHorizon; className?: string }) {
  const { tr } = useLocale();
  const weeks = outlookWeeks(player, horizon);
  if (weeks.length === 0) {
    return <span>-</span>;
  }

  return (
    <span className={`flex w-full min-w-0 items-stretch gap-px ${className}`} data-fdr-cells={weeks.length}>
      {weeks.map((week, index) => (
        <span key={`${week.gw}-${index}`} data-fdr-cell data-gw={week.gw} className="flex min-w-0 flex-1 flex-col gap-px">
          {week.games.length === 0 ? (
            <span
              data-fdr-blank
              title={tr(`GW${week.gw} · 경기 없음`, `GW${week.gw} · no game`)}
              className="inline-flex min-h-[18px] flex-1 items-center justify-center rounded-[3px] bg-[var(--surface-strong)] text-caption leading-none text-[var(--muted)]"
            >
              –
            </span>
          ) : (
            week.games.map((game, gameIndex) => (
              <span
                key={gameIndex}
                data-fdr-game
                data-difficulty={game.difficulty}
                title={tr(
                  `GW${week.gw} · ${game.home ? "홈" : "원정"} ${game.opponent} · 난이도 ${game.difficulty}`,
                  `GW${week.gw} · ${game.home ? "Home" : "Away"} ${game.opponent} · difficulty ${game.difficulty}`
                )}
                style={difficultyStyle(game.difficulty)}
                className="flex min-h-[18px] flex-1 flex-col items-center justify-center rounded-[3px] text-caption font-semibold leading-tight tabular-nums"
              >
                {game.difficulty}
                {horizon === 3 ? (
                  <span data-fdr-opp className="hidden max-w-full truncate text-[10px] font-medium leading-none opacity-90 lg:block">
                    {game.opponent} {game.home ? "H" : "A"}
                  </span>
                ) : null}
              </span>
            ))
          )}
        </span>
      ))}
    </span>
  );
}
