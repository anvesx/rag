import { execFileSync } from "node:child_process";
import os from "node:os";

/** The machine and tool versions a run is measured on, printed before any load starts. */
export const describeHost = () => {
  const cpu = os.cpus();
  const k6 = execFileSync("k6", ["version"], { encoding: "utf8" }).trim();
  return [
    `host      ${os.type()} ${os.release()} ${os.arch()}`,
    `cpu       ${cpu[0].model}, ${cpu.length} logical cores`,
    `memory    ${(os.totalmem() / 2 ** 30).toFixed(0)} GiB`,
    `load avg  ${os
      .loadavg()
      .map((n) => n.toFixed(2))
      .join(" ")} (1/5/15 min, before the run)`,
    `node      ${process.version}`,
    `k6        ${k6}`,
  ].join("\n");
};
