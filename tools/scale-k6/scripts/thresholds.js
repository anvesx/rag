// Pass/fail limits for the rank script. k6 exits 99 when any of these is crossed.
// The p95 is the measured value on the reference run (see ../README.md) plus headroom for a busy laptop.
export const P95_MS = { rank: 100 };

export const thresholds = (name) => ({
  // Latency: 95 percent of requests finish under the limit. Open loop, so a backlog shows up here.
  http_req_duration: [`p(95)<${P95_MS[name]}`],
  // Errors: under 1 percent of requests fail, and every response passes the shape check.
  http_req_failed: ["rate<0.01"],
  checks: ["rate>0.99"],
  // The arrival rate was actually delivered: no iteration was dropped for lack of virtual users.
  dropped_iterations: ["count==0"],
});
