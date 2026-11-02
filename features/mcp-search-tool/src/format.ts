import { type Pointer, PointerSchema } from "@anvesx/core-types";

export function formatResults(pointers: readonly Pointer[]): string {
  const validPointers = PointerSchema.array().parse(pointers);
  const results = validPointers.map(({ id, source, address, title, version, zone }) => ({
    id,
    source,
    address,
    title,
    version,
    zone,
  }));
  return JSON.stringify({ results });
}
