import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Exit code of a spawnSync result. A null status (killed by a signal) or a spawn error is a failure, never a pass. */
export const exitCode = (result) => {
  if (result.error || result.signal || typeof result.status !== "number") return 1;
  return result.status;
};

/** Where a script's k6 summary export is kept: gitignored `reports/`, which the run never deletes. */
export const reportPath = (script) => join(root, "reports", `${script}.json`);
