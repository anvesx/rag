import type { Principal } from "@brain/core-types";

export interface Clause {
  sql: string;
  params: unknown[];
}

// Constant text: ids only ever travel as bound params. The group list is one
// JSON param, so 1000 groups use 3 variables, not 1000. Every comparison is
// BINARY, so a NOCASE column cannot widen an id match. A column that is not a
// valid JSON array reads as empty: it grants nothing and cannot break the query.
const arr = (col: string): string =>
  `json_each(CASE WHEN json_valid(${col}) THEN CASE WHEN json_type(${col}) = 'array' THEN ${col} ELSE '[]' END ELSE '[]' END)`;
const SQL =
  "(tenant_id = ? COLLATE BINARY AND (" +
  `EXISTS (SELECT 1 FROM ${arr("allow_users")} WHERE value = ? COLLATE BINARY) OR ` +
  `EXISTS (SELECT 1 FROM ${arr("allow_groups")} AS g WHERE EXISTS (SELECT 1 FROM json_each(?) AS m WHERE m.value = g.value COLLATE BINARY))` +
  "))";

/** SQL predicate over tenant_id, allow_users, allow_groups (JSON text columns). */
export function allowClause(p: Principal): Clause {
  return { sql: SQL, params: [p.tenantId, p.id, JSON.stringify(p.groups)] };
}
