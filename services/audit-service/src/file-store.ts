import { appendFile, readFile } from "node:fs/promises";
import { z } from "zod";
import { AnchorStoreError } from "./errors.js";
import type { AnchorRecord, AnchorStore } from "./types.js";

const Line = z.strictObject({ tenantId: z.string().min(1), seq: z.number().int().nonnegative(), hash: z.string().min(1), at: z.string() });

/** JSON-lines anchor file. Only ever appended to; a corrupt line is an error, never skipped. */
export function createFileAnchorStore(path: string): AnchorStore {
  return {
    async append(record) {
      try {
        await appendFile(path, `${JSON.stringify(Line.parse(record))}\n`, { flag: "a" });
      } catch (cause) {
        throw new AnchorStoreError(`cannot append to anchor file ${path}`, cause);
      }
    },
    async latest(tenantId) {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw new AnchorStoreError(`cannot read anchor file ${path}`, cause);
      }
      let found: AnchorRecord | undefined;
      for (const line of text.split("\n")) {
        if (line === "") continue;
        try {
          const r: AnchorRecord = Line.parse(JSON.parse(line));
          if (r.tenantId === tenantId) found = r;
        } catch (cause) {
          throw new AnchorStoreError(`corrupt line in anchor file ${path}`, cause);
        }
      }
      return found;
    },
  };
}
