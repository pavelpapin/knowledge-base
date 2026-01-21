FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY packages/workflow/package.json ./packages/workflow/
COPY packages/agent-runner/package.json ./packages/agent-runner/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/workflow ./packages/workflow
COPY packages/agent-runner ./packages/agent-runner
COPY apps/worker ./apps/worker

# Build
RUN pnpm --filter @elio/workflow build && \
    pnpm --filter @elio/agent-runner build && \
    pnpm --filter @elio/worker build

# Run worker
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
