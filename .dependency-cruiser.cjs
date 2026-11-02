/** Tier rule: features -> core-types only; services -> features; modules -> services+features; apps -> modules. */
module.exports = {
  forbidden: [
    {
      name: "feature-isolation",
      severity: "error",
      from: { path: "^features/([^/]+)/src" },
      to: { path: "^features/[^/]+/", pathNot: ["^features/$1/", "^features/core-types/"] },
    },
    {
      name: "service-isolation",
      severity: "error",
      from: { path: "^services/([^/]+)/src" },
      to: { path: "^(services|modules|apps)/[^/]+/", pathNot: "^services/$1/" },
    },
    { name: "module-no-up", severity: "error", from: { path: "^modules/" }, to: { path: "^apps/" } },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: { tsConfig: { fileName: "tsconfig.base.json" }, doNotFollow: { path: "node_modules" } },
};
