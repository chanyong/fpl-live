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

type EffectiveLineup = {
  starters: EffectivePick[];
  bench: Pick[];
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

function hasPlayed(elementId: number, context: ScoringContext) {
  return getLiveStats(elementId, context).minutes > 0;
}

function allFixturesFinished(picks: Pick[], context: ScoringContext) {
  return picks.every((pick) => getPlayerFixtureState(pick.element, context).allFinished);
}

function buildFallbackAutomaticSubs(picks: Pick[], context: ScoringContext) {
  if (!allFixturesFinished(picks, context)) {
    return [] as Array<{ elementIn: number; elementOut: number }>;
  }

  const starters = picks.filter((pick) => pick.position <= 11);
  const bench = picks.filter((pick) => pick.position > 11).sort((a, b) => a.position - b.position);
  const substitutions: Array<{ elementIn: number; elementOut: number }> = [];
  const counts: Record<FplPosition, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };

  for (const starter of starters) {
    const position = getPlayerPosition(starter.element, context);
    if (hasPlayed(starter.element, context)) {
      counts[position] += 1;
    }
  }

  const startingGkp = starters.find((pick) => getPlayerPosition(pick.element, context) === "GKP");
  const benchGkp = bench.find((pick) => getPlayerPosition(pick.element, context) === "GKP");

  if (startingGkp && !hasPlayed(startingGkp.element, context) && benchGkp && hasPlayed(benchGkp.element, context)) {
    substitutions.push({ elementIn: benchGkp.element, elementOut: startingGkp.element });
    counts.GKP = 1;
  }

  const missingOutfield = starters.filter(
    (pick) => getPlayerPosition(pick.element, context) !== "GKP" && !hasPlayed(pick.element, context)
  );
  const benchOutfield = bench.filter(
    (pick) => getPlayerPosition(pick.element, context) !== "GKP" && hasPlayed(pick.element, context)
  );

  let remainingSlots = missingOutfield.length;

  for (const benchPick of benchOutfield) {
    if (remainingSlots === 0) {
      break;
    }

    const benchPosition = getPlayerPosition(benchPick.element, context);
    const nextCounts = {
      ...counts,
      [benchPosition]: counts[benchPosition] + 1
    };
    const nextRemaining = remainingSlots - 1;
    const requiredAfter = (Object.keys(MIN_FORMATION) as FplPosition[])
      .filter((position) => position !== "GKP")
      .reduce((sum, position) => sum + Math.max(0, MIN_FORMATION[position] - nextCounts[position]), 0);

    if (requiredAfter > nextRemaining) {
      continue;
    }

    const outgoing = missingOutfield.shift();
    if (!outgoing) {
      break;
    }

    substitutions.push({ elementIn: benchPick.element, elementOut: outgoing.element });
    counts[benchPosition] = nextCounts[benchPosition];
    remainingSlots = nextRemaining;
  }

  return substitutions;
}

function buildEffectiveLineup(args: {
  picks: Pick[];
  automaticSubs?: Array<{ elementIn: number; elementOut: number }>;
  chip: Chip;
  context: ScoringContext;
}): EffectiveLineup {
  const starters = args.picks
    .filter((pick) => pick.position <= 11)
    .sort((a, b) => a.position - b.position)
    .map((pick) => ({ ...pick, effectiveMultiplier: pick.multiplier }));
  const bench = args.picks
    .filter((pick) => pick.position > 11)
    .sort((a, b) => a.position - b.position);

  if (args.chip === "bboost") {
    return { starters, bench: [] };
  }

  const substitutions =
    args.automaticSubs && args.automaticSubs.length > 0
      ? args.automaticSubs
      : buildFallbackAutomaticSubs(args.picks, args.context);
  const usedBenchIds = new Set<number>();

  for (const substitution of substitutions) {
    const starterIndex = starters.findIndex((pick) => pick.element === substitution.elementOut);
    const benchPick = bench.find((pick) => pick.element === substitution.elementIn);
    if (starterIndex >= 0 && benchPick && !usedBenchIds.has(benchPick.element)) {
      starters[starterIndex] = {
        ...benchPick,
        position: starters[starterIndex].position,
        effectiveMultiplier: 1
      };
      usedBenchIds.add(benchPick.element);
    }
  }

  return {
    starters,
    bench: bench.filter((pick) => !usedBenchIds.has(pick.element))
  };
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
  const lineup = buildEffectiveLineup(args);
  const effectivePicks = resolveCaptaincy(lineup.starters, args.chip, args.context);
  const benchBoostExtras =
    args.chip === "bboost"
      ? args.picks
          .filter((pick) => pick.position > 11)
          .map((pick) => ({ ...pick, effectiveMultiplier: 1 }))
      : [];

  return {
    starters: effectivePicks,
    bench: lineup.bench,
    all: [...effectivePicks, ...benchBoostExtras]
  };
}

export function computePlayersPlayed(args: {
  picks: Pick[];
  automaticSubs?: Array<{ elementIn: number; elementOut: number }>;
  chip: Chip;
  context: ScoringContext;
}) {
  const effective = getEffectivePicks(args).starters;

  return effective.filter((pick) => {
    const live = getLiveStats(pick.element, args.context);
    const fixtureState = getPlayerFixtureState(pick.element, args.context);
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
  const effective = getEffectivePicks({ picks, automaticSubs, chip, context });
  const toCard = (pick: Pick | EffectivePick, forceBench = false): PlayerLiveCard => {
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
    const effectiveMultiplier = "effectiveMultiplier" in pick ? pick.effectiveMultiplier : forceBench || chip === "bboost" ? 1 : 0;
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
    starters: effective.starters.sort((a, b) => a.position - b.position).map((pick) => toCard(pick)),
    bench: chip === "bboost" ? [] : effective.bench.map((pick) => toCard(pick, true))
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
  const effective = getEffectivePicks({
    picks: args.picks,
    automaticSubs: args.automaticSubs,
    chip: args.chip,
    context: args.context
  });

  const liveGross = effective.all.reduce((sum, pick) => {
    const live = getLiveStats(pick.element, args.context);
    return sum + live.totalPoints * pick.effectiveMultiplier;
  }, 0);

  const gwPoints = liveGross;
  const totalPoints = args.officialTotalBeforeLive + liveGross;
  const provisional = args.picks.some((pick) => !getPlayerFixtureState(pick.element, args.context).allFinished);

  return {
    lineupPoints: liveGross,
    gwPoints,
    totalPoints,
    provisional
  };
}