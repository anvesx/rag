import { registerHooks } from "node:module";

/** Lets a plain `node` child import the repo's `./x.js` specifiers from their `.ts` sources. */
registerHooks({
  resolve(spec, ctx, next) {
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".") && spec.endsWith(".js")) return next(`${spec.slice(0, -3)}.ts`, ctx);
      throw e;
    }
  },
});
