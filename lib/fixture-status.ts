type FixtureEndState = {
  started: boolean;
  finished: boolean;
  finishedProvisional: boolean;
};

/**
 * True once the match itself is over.
 *
 * FPL splits this across two flags: `finished_provisional` flips at the final
 * whistle, while `finished` only follows once bonus points are confirmed —
 * sometimes hours later. Reading `finished` alone leaves a completed match
 * labelled LIVE for the rest of the gameweek.
 */
export function hasFixtureEnded(fixture: FixtureEndState) {
  return fixture.finished || fixture.finishedProvisional;
}

/** True while the match is actually in play. */
export function isFixtureInPlay(fixture: FixtureEndState) {
  return fixture.started && !hasFixtureEnded(fixture);
}
