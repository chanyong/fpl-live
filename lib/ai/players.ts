import { getBase } from "@/lib/public-data";

export type PlayerMeta = { name: string; teamShort: string; position: "GKP" | "DEF" | "MID" | "FWD" };
export type PlayerMetaMap = ReadonlyMap<number, PlayerMeta>;

const POSITIONS: Record<number, PlayerMeta["position"]> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

/**
 * Display names, club abbreviations and positions of every FPL player, from the same memoised bootstrap the xP
 * table reads (no FPL call of its own). Names are for the screen and the placeholder replacement only: they are
 * never sent to the model.
 */
export async function loadPlayerMeta(): Promise<PlayerMetaMap> {
  const base = await getBase();
  if (!base) {
    throw new Error("player data unavailable");
  }
  const teams = new Map(base.bootstrap.teams.map((team) => [team.id, team.short_name]));
  const map = new Map<number, PlayerMeta>();
  for (const element of base.bootstrap.elements) {
    map.set(element.id, {
      name: element.web_name,
      teamShort: teams.get(element.team) ?? "-",
      position: POSITIONS[element.element_type] ?? "MID"
    });
  }
  return map;
}
