# Spec: <feature name>

Ticket: #<n>   Tier: feature | service | module | app   Milestone: M0..M5
Design cards: <ids from docs/specs, e.g. idx.reg>

## Purpose
One paragraph. What problem, for whom.

## Reuse decision
Library picked (exact name@version), why, what thin adapter we write. Link docs/libs.

## Public interface
TypeScript signatures. Errors are typed. This is the contract the tests pin.

## Behaviour
Numbered rules. Include empty, null, huge, duplicate, concurrent, unicode, partial failure.

## Acceptance tests (written first)
- unit: ...
- integration: ...
- mutation: score >= 80
- e2e / scale: ...

## Layout
Files and folders to create. Each file under 80 lines, each folder under 6 files.

## Out of scope
