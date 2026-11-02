import type { Connector, ListedDoc } from "@anvesx/connector-kit";

/** Wraps a connector to record what one run lists, and whether the run saw the whole listing. */
export function watchListing(connector: Connector) {
  const listed = new Map<string, ListedDoc>();
  const state = { fromStart: false, complete: false };
  const watched: Connector = {
    id: connector.id,
    fetch: (address, context) => connector.fetch(address, context),
    async list(query) {
      if (!query.cursor) {
        listed.clear();
        state.fromStart = true;
        state.complete = false;
      }
      const page = await connector.list(query);
      for (const item of page.items) listed.set(item.address, item);
      // A run resumed from a saved cursor never saw the early pages, so it cannot prove a delete.
      if (!page.nextCursor && state.fromStart) state.complete = true;
      return page;
    },
  };
  return { watched, listed, sawEverything: () => state.complete };
}
