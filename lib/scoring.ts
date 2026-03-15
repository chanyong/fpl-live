import type {
  Chip,
  ElementSummary,
  FixtureSummary,
  FplPosition,
  Pick,
  PlayerLiveCard,
  PlayerStatus,
  SquadSplit,
  TeamSummary
} from "@/lib/types";

type LiveElement = {
  minutes: number;
  totalPoints: number;
};

export type ScoringContext = {
  elementsById: Map<number, ElementSummary>;
  teamsById: Map<number, TeamSummary>;
  liveByElementId: Map<number, LiveElement>;
  fixturesByTeamId: Map<number, FixtureSummary[]>;
};

const POSITION_MAP: Record<number, FplPosition> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

const MIN_FORMATION: Record<FplPosition, number> = {
  GKP: 1,
  DEF: 3,
  MID: 2,
  FWD: 1
};

type EffectivePick = Pick & {
  effectiveMultiplier: number;
};

function getPlayerPosition(elementId: number, context: ScoringContext): FplPosition {
  const element = context.elementsById.get(elementId);
  return POSITION_MAP[element?.elementType ?? 3] ?? "MID";
}

function getPlayerFixtureState(elementId: number, context: ScoringContext) {
  const element = context.elementsById.get(elementId);
  const fixtures = element ? context.fixturesByTeamId.get(element.teamId) ?? [] : [];
  const hasStarted = fixtures.some((fixture) => fixture.started);
  const allFinished =
    fixtures.length > 0 &&
    fixtures.every((fixture) => fixture.finished || fixture.finishedProvisional);

  return { hasStarted, allFinished };
}

function getLiveStats(elementId: number, context: ScoringContext) {
  return context.liveByElementId.get(elementId) ?? { minutes: 0, totalPoints: 0 };
}

function applyAutomaticSubs(
  picks: Pick[],
  automaticSubs: Array<{ elementIn: number; elementOut: number }> | undefined,
  chip: Chip,
  context: ScoringContext
) {
  const starters = picks
    .filter((pick) => pick.position <= 11)
    .map((pick) => ({ ...pick, effectiveMultiplier: pick.multiplier }));
  const bench = picks
    .filter((pick) => pick.position > 11)
    .sort((a, b) => a.position - b.position);

  if (chip === "bboost") {
    return starters;
  }

  if (automaticSubs && automaticSubs.length > 0) {
    for (const automaticSub of automaticSubs) {
      const starterIndex = starters.findIndex((pick) => pick.element === automaticSub.elementOut);
      const benchPick = bench.find((pick) => pick.element === automaticSub.elementIn);
      if (starterIndex >= 0 && benchPick) {
        starters[starterIndex] = {
          ...benchPick,
          position: starters[starterIndex].position,
          effectiveMultiplier: 1
        };
      }
    }
  }

  return starters;
}

function resolveCaptaincy(activePicks: EffectivePick[], chip: Chip, context: ScoringContext) {
  let captain = activePicks.find((pick) => pick.isCaptain);

  if (captain) {
    const captainLive = getLiveStats(captain.element, context);
    const captainFixture = getPlayerFixtureState(captain.element, context);
    if (captainLive.minutes === 0 && captainFixture.allFinished) {
      captain = undefined;
    }
  }

  if (!captain) {
    const viceCaptain = activePicks.find((pick) => pick.isViceCaptain);
    if (viceCaptain) {
      const viceLive = getLiveStats(viceCaptain.element, context);
      const viceFixture = getPlayerFixtureState(viceCaptain.element, context);
      if (viceLive.minutes > 0 || !viceFixture.allFinished) {
        captain = viceCaptain;
      }
    }
  }

  return activePicks.map((pick) => {
    let multiplier = pick.effectiveMultiplier > 0 ? 1 : 0;

    if (captain && pick.element === captain.element) {
      multiplier = chip === "3xc" ? 3 : 2;
    }

    return {
      ...pick,
      effectiveMultiplier: multiplier
    };
  });
}

function getEffectivePicks(args: {
  picks: Pick[];
  automaticSubs?: Array<{ elementIn: number; elementOut: number }>;
  chip: Chip;
  context: ScoringContext;
}) {
  const effectiveStarters = applyAutomaticSubs(args.picks, args.automaticSubs, args.chip, args.context);
  const effectivePicks = resolveCaptaincy(effectiveStarters, args.chip, args.context);
  const benchBoostExtras =
    args.chip === "bboost"
      ? args.picks
          .filter((pick) => pick.position > 11)
          .map((pick) => ({ ...pick, effectiveMultiplier: 1 }))
      : [];

  return [...effectivePicks, ...benchBoostExtras];
}

export function computePlayersPlayed(picks: Pick[], context: ScoringContext) {
  return picks
    .filter((pick) => pick.position <= 11)
    .filter((pick) => {
      const live = getLiveStats(pick.element, context);
      const fixtureState = getPlayerFixtureState(pick.element, context);
      return live.minutes > 0 || (fixtureState.hasStarted && !fixtureState.allFinished);
    }).length;
}

export function computeProjectedRanks<T extends { rank: number; totalPoints: number; projectedTotalPoints?: number }>(rows: T[]) {
  const sorted = [...rows].sort((left, right) => {
    const leftScore = left.projectedTotalPoints ?? left.totalPoints;
    const rightScore = right.projectedTotalPoints ?? right.totalPoints;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.rank - right.rank;
  });

  const byRank = new Map<number, number>();
  sorted.forEach((row, index) => {
    byRank.set(row.rank, index + 1);
  });

  return rows.map((row) => ({
    ...row,
    projectedRank: byRank.get(row.rank) ?? row.rank
  }));
}

export function splitSquad(
  picks: Pick[],
  chip: Chip,
  context: ScoringContext,
  automaticSubs?: Array<{ elementIn: number; elementOut: number }>
): SquadSplit {
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  const multiplierByElementId = new Map<number, number>();

  for (const pick of getEffectivePicks({ picks, automaticSubs, chip, context })) {
    multiplierByElementId.set(pick.element, pick.effectiveMultiplier);
  }

  const toCard = (pick: Pick): PlayerLiveCard => {
    const element = context.elementsById.get(pick.element);
    const team = element ? context.teamsById.get(element.teamId) : undefined;
    const live = getLiveStats(pick.element, context);
    const fixtureState = getPlayerFixtureState(pick.element, context);
    const status: PlayerStatus =
      live.minutes > 0
        ? fixtureState.allFinished
          ? "played"
          : "live"
        : fixtureState.hasStarted
          ? "live"
          : "not_played";
    const effectiveMultiplier = multiplierByElementId.get(pick.element) ?? (pick.position > 11 && chip !== "bboost" ? 0 : 1);
    const displayPoints = effectiveMultiplier > 0 ? live.totalPoints * effectiveMultiplier : live.totalPoints;

    return {
      elementId: pick.element,
      webName: element?.webName ?? `Player ${pick.element}`,
      teamShortName: team?.shortName ?? "-",
      position: getPlayerPosition(pick.element, context),
      livePoints: displayPoints,
      minutes: live.minutes,
      status,
      isCaptain: pick.isCaptain,
      isViceCaptain: pick.isViceCaptain,
      photoUrl: element
        ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${element.photo.replace(".jpg", "")}.png`
        : null
    };
  };

  return {
    starters: sorted.filter((pick) => pick.position <= 11).map(toCard),
    bench: chip === "bboost" ? [] : sorted.filter((pick) => pick.position > 11).map(toCard)
  };
}

export function calculateLiveScore(args: {
  picks: Pick[];
  automaticSubs?: Array<{ elementIn: number; elementOut: number }>;
  chip: Chip;
  transferCost: number;
  officialTotalBeforeLive: number;
  context: ScoringContext;
}) {
  const allEffective = getEffectivePicks({
    picks: args.picks,
    automaticSubs: args.automaticSubs,
    chip: args.chip,
    context: args.context
  });

  const liveGross = allEffective.reduce((sum, pick) => {
    const live = getLiveStats(pick.element, args.context);
    return sum + live.totalPoints * pick.effectiveMultiplier;
  }, 0);

  const gwPoints = liveGross - args.transferCost;
  const totalPoints = args.officialTotalBeforeLive + gwPoints;
  const provisional = args.picks.some((pick) => !getPlayerFixtureState(pick.element, args.context).allFinished);

  return {
    lineupPoints: liveGross,
    gwPoints,
    totalPoints,
    provisional
  };
}


