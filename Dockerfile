# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# start.js calls app.listen() and starts the token-refresh cron job.
# server.js alone does not listen (used by Vercel serverless).
CMD ["node", "src/start.js"]
