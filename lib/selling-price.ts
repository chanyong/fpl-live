/**
 * What a player would sell for, in tenths of a million (issue #39 stage 2). Estimated from public data:
 * the official figure is shown only to the logged-in manager.
 *
 * FPL sells a player at the price paid plus half of any rise, rounded down to 0.1m; a fallen price is paid out
 * in full (rules: transfers_sell_on_fee 0.5, element_sell_at_purchase_price false).
 */
export function sellingPrice(purchase: number, current: number) {
  return current > purchase ? purchase + Math.floor((current - purchase) / 2) : current;
}

export type TransferRecord = {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  event: number;
  time: string;
};

/**
 * The price each player now in the squad was bought at: his most recent transfer in. Transfers made in a
 * Free Hit gameweek are dropped because that squad is undone at the next deadline.
 *
 * Players with no transfer in (held since the manager's first squad) are left out; the caller prices them at
 * the season's opening price (manager joined in gameweek 1) or looks up the price when the squad was built.
 */
export function purchasePrices(transfers: TransferRecord[], freeHitEvents: Set<number>) {
  const prices = new Map<number, number>();
  const newestFirst = [...transfers]
    .filter((transfer) => !freeHitEvents.has(transfer.event))
    .sort((a, b) => b.event - a.event || b.time.localeCompare(a.time));

  for (const transfer of newestFirst) {
    if (!prices.has(transfer.element_in)) {
      prices.set(transfer.element_in, transfer.element_in_cost);
    }
  }

  return prices;
}
