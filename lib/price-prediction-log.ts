import type { PlayerStat, PriceChangeEvent, PriceChangesResponse } from "@/lib/types";

/**
 * Price prediction hit-rate tracking — record structure.
 *
 * The site has no database, so nothing is stored by default. When `PRICE_PREDICTION_LOG_DIR`
 * points at a persistent directory (e.g. a Railway volume), the last prediction made before each
 * FPL price update is written there as `<nextUpdate>.json` from data the price page already
 * fetched — no extra FPL calls. `evaluateSnapshot` then scores it against the real moves in
 * `stats/price-changes` once that update has happened.
 */

export type PredictedDirection = "up" | "down";

export type PricePrediction = {
  elementId: number;
  webName: string;
  direction: PredictedDirection;
  /** FPL likelihood: ±5 very likely, ±4 likely. */
  likelihood: number;
  progress: number;
  cost: number;
};

export type PricePredictionSnapshot = {
  version: 1;
  /** The FPL price update this snapshot predicts (ISO). */
  forUpdate: string;
  takenAt: string;
  predictions: PricePrediction[];
};

export type PredictionScore = {
  forUpdate: string;
  predicted: number;
  hits: number;
  wrongDirection: number;
  noChange: number;
  /** Moves that happened but were not predicted. */
  missed: number;
  /** hits / predicted, null when nothing was predicted. */
  precision: number | null;
  /** hits / actual moves, null when nothing moved. */
  recall: number | null;
};

export function buildSnapshot(players: PlayerStat[], forUpdate: string, takenAt: Date): PricePredictionSnapshot {
  return {
    version: 1,
    forUpdate,
    takenAt: takenAt.toISOString(),
    predictions: players
      .filter((player) => Math.abs(player.priceLikelihood) >= 4 && !player.priceLockedUntil)
      .map((player) => ({
        elementId: player.id,
        webName: player.webName,
        direction: player.priceLikelihood > 0 ? ("up" as const) : ("down" as const),
        likelihood: player.priceLikelihood,
        progress: player.priceChangePercent,
        cost: player.cost
      }))
  };
}

/** Moves FPL applied in the update window (from 1h before to 6h after the scheduled time). */
export function movesForUpdate(history: PriceChangeEvent[], forUpdate: string) {
  const at = new Date(forUpdate).getTime();
  const moves = new Map<number, PredictedDirection>();
  for (const event of history) {
    const time = new Date(event.changedAt).getTime();
    if (time >= at - 3_600_000 && time <= at + 6 * 3_600_000 && event.costAfter !== event.costBefore) {
      moves.set(event.playerId, event.costAfter > event.costBefore ? "up" : "down");
    }
  }
  return moves;
}

export function evaluateSnapshot(snapshot: PricePredictionSnapshot, history: PriceChangeEvent[]): PredictionScore {
  const moves = movesForUpdate(history, snapshot.forUpdate);
  let hits = 0;
  let wrongDirection = 0;
  let noChange = 0;
  const predictedIds = new Set<number>();

  for (const prediction of snapshot.predictions) {
    predictedIds.add(prediction.elementId);
    const actual = moves.get(prediction.elementId);
    if (!actual) noChange += 1;
    else if (actual === prediction.direction) hits += 1;
    else wrongDirection += 1;
  }

  const missed = [...moves.keys()].filter((id) => !predictedIds.has(id)).length;
  const predicted = snapshot.predictions.length;

  return {
    forUpdate: snapshot.forUpdate,
    predicted,
    hits,
    wrongDirection,
    noChange,
    missed,
    precision: predicted ? hits / predicted : null,
    recall: moves.size ? hits / moves.size : null
  };
}

let lastWrittenAt = 0;

/** Writes the current snapshot when a log directory is configured; at most once per 10 minutes. */
export async function recordPredictionSnapshot(data: PriceChangesResponse) {
  const dir = process.env.PRICE_PREDICTION_LOG_DIR;
  if (!dir || !data.nextUpdate || Date.now() - lastWrittenAt < 10 * 60_000) {
    return;
  }
  lastWrittenAt = Date.now();
  try {
    const [{ mkdir, writeFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    await mkdir(dir, { recursive: true });
    const snapshot = buildSnapshot(data.players, data.nextUpdate, new Date());
    const file = path.join(dir, `${data.nextUpdate.replace(/[:.]/g, "-")}.json`);
    // Overwrite: the snapshot that counts is the last one before the update.
    await writeFile(file, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("price prediction log write failed", error instanceof Error ? error.message : error);
  }
}
