// features/rank search over HTTP at a fixed arrival rate. Run through bin/run.mjs, which seeds the corpus.

import { check } from "k6";
import { SharedArray } from "k6/data";
import http from "k6/http";
import { thresholds } from "./thresholds.js";

const queries = new SharedArray("queries", () => JSON.parse(open(__ENV.QUERIES)));

export const options = {
  scenarios: {
    search: {
      executor: "constant-arrival-rate", // open loop: requests arrive on schedule whether or not the last one finished
      rate: Number(__ENV.RATE || 10),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 10,
      maxVUs: 40,
    },
  },
  thresholds: thresholds("rank"),
};

export default function () {
  const q = queries[Math.floor(Math.random() * queries.length)];
  const url = `${__ENV.BASE}/search?q=${encodeURIComponent(q.query)}&p=${encodeURIComponent(q.principals.join(","))}&k=10`;
  const res = http.get(url);
  check(res, {
    "status 200": (r) => r.status === 200,
    "hits is an array of at most 10": (r) => {
      const h = r.json("hits");
      return Array.isArray(h) && h.length <= 10;
    },
  });
}
