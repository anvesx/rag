export type ShutdownOptions = {
  close: () => Promise<void>;
  /** If close has not finished by then, exit 1 anyway. */
  forceExitMs: number;
  exit?: (code: number) => void;
  signals?: NodeJS.Signals[];
  error?: (message: string) => void;
};

/**
 * Runs `close` once on the first of `signals`, exits 0 when it finishes, 1 when it fails, and 1 when it outlasts `forceExitMs`.
 * Returns the stop function too; calling it again returns the same run.
 */
export function installShutdown(opts: ShutdownOptions): () => Promise<void> {
  const { close, forceExitMs, exit = (code) => process.exit(code), signals = ["SIGINT", "SIGTERM"], error = console.error } = opts;
  let running: Promise<void> | undefined;
  const stop = () =>
    (running ??= (async () => {
      const timer = setTimeout(() => {
        error(`rag: shutdown exceeded ${forceExitMs}ms, forcing exit`);
        exit(1);
      }, forceExitMs);
      try {
        await close();
        clearTimeout(timer);
        exit(0);
      } catch (cause) {
        clearTimeout(timer);
        error(`rag: shutdown failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        exit(1);
      }
    })());
  for (const signal of signals) process.on(signal, () => void stop());
  return stop;
}
