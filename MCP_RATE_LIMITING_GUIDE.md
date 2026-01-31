# MCP Adapter Rate Limiting Guide

## Status

✅ **Implemented**: perplexity
⏳ **TODO**: notion, gmail, calendar, telegram, slack, linkedin

## How to Add Rate Limiting

### 1. Import

```typescript
import { withRateLimit } from '@elio/shared';
```

### 2. Wrap API Calls

**Before:**
```typescript
execute: async (params) => {
  const result = await notion.createPage(dbId, props);
  return JSON.stringify(result);
}
```

**After:**
```typescript
execute: async (params) => {
  const result = await withRateLimit('notion', () =>
    notion.createPage(dbId, props)
  );
  return JSON.stringify(result);
}
```

## Service Names

Use these exact service names (configured in `packages/shared/src/resilience/rate-limiter.ts`):

- `perplexity` — 20 req/min, 1000 req/day
- `notion` — 3 req/min, 2000 req/day
- `gmail` — 60 req/min, 10000 req/day
- `calendar` — 60 req/min, 10000 req/day
- `telegram` — 30 req/min
- `linkedin` — 10 req/min, 100 req/day
- `slack` — 50 req/min
- `openai` — 60 req/min
- `anthropic` — 60 req/min
- `groq` — 30 req/min

## Adapters by Priority

### High Priority (add first)
1. ✅ **perplexity** — DONE
2. **notion** — 7 API calls in `mcp-server/src/adapters/notion/index.ts`
3. **gmail** — Multiple calls in `mcp-server/src/adapters/gmail/api.ts`

### Medium Priority
4. **calendar** — `mcp-server/src/adapters/calendar/index.ts`
5. **telegram** — `mcp-server/src/adapters/telegram/index.ts`
6. **slack** — `mcp-server/src/adapters/slack/index.ts`

### Low Priority
7. **linkedin** — Already has external rate limiting
8. **twitter**, **youtube**, etc. — Less critical

## Example: Notion Adapter

```typescript
// mcp-server/src/adapters/notion/index.ts

import { withRateLimit } from '@elio/shared';

const tools: AdapterTool[] = [
  {
    name: 'create_page',
    execute: async (params) => {
      const result = await withRateLimit('notion', () =>
        notion.createPage(params.databaseId, properties)
      );
      return JSON.stringify(result);
    }
  },
  {
    name: 'query',
    execute: async (params) => {
      const result = await withRateLimit('notion', () =>
        notion.queryDatabase(params.databaseId)
      );
      return JSON.stringify(result);
    }
  },
  // ... wrap all other notion.* calls
];
```

## Testing

After adding rate limiting:

```bash
# Build
pnpm --filter mcp-server build

# Test manually
# Try 25 rapid requests to perplexity - should see delays/queuing
```

## Notes

- Rate limits are **persistent** in Redis (survive restarts)
- Strategies:
  - `queue` — Wait in queue (perplexity, notion, anthropic, openai, groq)
  - `delay` — Wait and retry (gmail, calendar, telegram, slack)
  - `fail` — Throw error immediately (linkedin)
- Limits can be adjusted in `packages/shared/src/resilience/rate-limiter.ts`
