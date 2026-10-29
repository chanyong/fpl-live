import type { LeagueFixture } from "@/lib/types";

type BpsValue = { value: number; element: number };

/**
 * FPL's bonus rule applied to one match's BPS: 3-2-1 to the top three, ties share the higher
 * award and push the next award down (e.g. two tied first → 3, 3, 1).
 */
export function assignProvisionalBonus(values: BpsValue[]) {
  const sorted = [...values].sort((left, right) => right.value - left.value);
  if (sorted.length === 0) {
    return [] as Array<{ element: number; bonus: number }>;
  }

  const top = sorted[0]?.value;
  const firstGroup = sorted.filter((item) => item.value === top);
  if (firstGroup.length >= 3) {
    return firstGroup.map((item) => ({ element: item.element, bonus: 3 }));
  }

  if (firstGroup.length === 2) {
    const next = sorted.find((item) => item.value < top);
    const thirdGroup = next ? sorted.filter((item) => item.value === next.value) : [];
    return [
      ...firstGroup.map((item) => ({ element: item.element, bonus: 3 })),
      ...thirdGroup.map((item) => ({ element: item.element, bonus: 1 }))
    ];
  }

  const secondValue = sorted.find((item) => item.value < top)?.value;
  if (secondValue === undefined) {
    return [{ element: sorted[0].element, bonus: 3 }];
  }

  const secondGroup = sorted.filter((item) => item.value === secondValue);
  if (secondGroup.length >= 2) {
    return [
      { element: sorted[0].element, bonus: 3 },
      ...secondGroup.map((item) => ({ element: item.element, bonus: 2 }))
    ];
  }

  const third = sorted.find((item) => item.value < secondValue);
  const thirdGroup = third ? sorted.filter((item) => item.value === third.value) : [];
  return [
    { element: sorted[0].element, bonus: 3 },
    { element: secondGroup[0].element, bonus: 2 },
    ...thirdGroup.map((item) => ({ element: item.element, bonus: 1 }))
  ];
}

export type BonusPreviewItem = {
  elementId: number;
  playerName: string;
  teamShortName: string;
  bonus: number;
  bps: number | null;
};

export type BonusPreview = {
  /** confirmed: FPL has already written the bonus rows; projected: estimated from live BPS. */
  status: "confirmed" | "projected" | "none";
  items: BonusPreviewItem[];
};

/** Bonus for one match as the fixture card shows it: FPL's own once published, else from BPS. */
export function fixtureBonusPreview(fixture: Pick<LeagueFixture, "started" | "stats">): BonusPreview {
  if (!fixture.started) {
    return { status: "none", items: [] };
  }

  const bpsStat = fixture.stats.find((stat) => stat.key === "bps");
  const bpsAll = bpsStat ? [...bpsStat.home, ...bpsStat.away] : [];
  const bpsById = new Map(bpsAll.map((item) => [item.elementId, item.value]));

  const bonusStat = fixture.stats.find((stat) => stat.key === "bonus");
  const published = bonusStat ? [...bonusStat.home, ...bonusStat.away].filter((item) => item.value > 0) : [];

  if (published.length > 0) {
    return {
      status: "confirmed",
      items: published
        .map((item) => ({
          elementId: item.elementId,
          playerName: item.playerName,
          teamShortName: item.teamShortName,
          bonus: item.value,
          bps: bpsById.get(item.elementId) ?? null
        }))
        .sort((left, right) => right.bonus - left.bonus || (right.bps ?? 0) - (left.bps ?? 0))
    };
  }

  if (bpsAll.length === 0) {
    return { status: "none", items: [] };
  }

  const byId = new Map(bpsAll.map((item) => [item.elementId, item]));
  const items = assignProvisionalBonus(bpsAll.map((item) => ({ element: item.elementId, value: item.value })))
    .map((award) => {
      const player = byId.get(award.element);
      return {
        elementId: award.element,
        playerName: player?.playerName ?? `#${award.element}`,
        teamShortName: player?.teamShortName ?? "-",
        bonus: award.bonus,
        bps: player?.value ?? null
      };
    })
    .sort((left, right) => right.bonus - left.bonus || (right.bps ?? 0) - (left.bps ?? 0));

  return { status: "projected", items };
}
