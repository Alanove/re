export type CashPlace = {
  id: string;
  openingBalance: number;
  archived: boolean;
};

export type CashEvent = {
  id: string;
  kind: "income" | "expense" | "transfer";
  date: string;
  createdAt: string;
  amount: number;
  placeId: string | null;
  /** Expense funding. Own money leaves the place. */
  funding?: string;
  fromPlaceId?: string | null;
  toPlaceId?: string | null;
};

export type CashStamp = {
  id: string;
  kind: CashEvent["kind"];
  placeBalanceAfter: number | null;
  fromPlaceBalanceAfter: number | null;
  toPlaceBalanceAfter: number | null;
  householdCashAfter: number;
};

function compareEvents(a: CashEvent, b: CashEvent): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byCreated = a.createdAt.localeCompare(b.createdAt);
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}

/**
 * Replay cash in date order. Each event stores the place balance and the
 * household total (open places only) immediately after it.
 */
export function replayCashLedger(places: CashPlace[], events: CashEvent[]): CashStamp[] {
  const balances = new Map<string, number>();
  const archived = new Set<string>();
  for (const place of places) {
    balances.set(place.id, place.openingBalance);
    if (place.archived) archived.add(place.id);
  }

  function household(): number {
    let total = 0;
    for (const [id, balance] of balances) {
      if (!archived.has(id)) total += balance;
    }
    return total;
  }

  function bump(placeId: string | null | undefined, delta: number): number | null {
    if (!placeId || !balances.has(placeId)) return null;
    const next = (balances.get(placeId) ?? 0) + delta;
    balances.set(placeId, next);
    return next;
  }

  function read(placeId: string | null | undefined): number | null {
    if (!placeId || !balances.has(placeId)) return null;
    return balances.get(placeId) ?? 0;
  }

  return [...events].sort(compareEvents).map((event) => {
    let placeBalanceAfter: number | null = null;
    let fromPlaceBalanceAfter: number | null = null;
    let toPlaceBalanceAfter: number | null = null;

    if (event.kind === "income") {
      placeBalanceAfter = bump(event.placeId, event.amount);
    } else if (event.kind === "expense") {
      if (event.funding === "OWN") {
        placeBalanceAfter = bump(event.placeId, -event.amount);
      } else {
        placeBalanceAfter = read(event.placeId);
      }
    } else {
      fromPlaceBalanceAfter = bump(event.fromPlaceId, -event.amount);
      toPlaceBalanceAfter = bump(event.toPlaceId, event.amount);
    }

    return {
      id: event.id,
      kind: event.kind,
      placeBalanceAfter,
      fromPlaceBalanceAfter,
      toPlaceBalanceAfter,
      householdCashAfter: household(),
    };
  });
}
