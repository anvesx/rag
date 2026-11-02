import { z } from "zod";

export const SearchInputSchema = z
  .object({
    query: z.string().min(1).max(2000),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .strict();

export type SearchInput = z.infer<typeof SearchInputSchema>;
