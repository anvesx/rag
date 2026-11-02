# Build context is the repository root: docker build -f apps/rag/Dockerfile .
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rag/app... build
RUN pnpm --filter @rag/app deploy --prod /out

FROM node:22-slim
ENV NODE_ENV=production RAG_HOST=0.0.0.0 RAG_PORT=3000 RAG_DATA_DIR=/data
WORKDIR /app
COPY --from=build /out /app
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/bin.js"]
