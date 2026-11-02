import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ports = { rank: 18790 };

/** Polls until `url` answers with any HTTP status, or throws after `ms`. */
export const waitFor = async (url, ms = 120_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (
      await fetch(url).then(
        () => true,
        () => false,
      )
    )
      return;
    await sleep(250);
  }
  throw new Error(`${url} did not answer within ${ms}ms`);
};

/** The rank HTTP wrapper over a freshly seeded corpus of `size` docs. */
export const rankServer = (size) => spawn(process.execPath, [join(here, "rank-server.mjs"), String(size), String(ports.rank)], { stdio: "inherit" });
