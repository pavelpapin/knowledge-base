# Code Review Skill

AI-powered code review with auto-fix capabilities.

## Usage

### Basic Review
```
elio_code_review path="./mcp-server" scope="full"
```

### Auto-Fix Mode
When `autoFix=true`, Claude should automatically apply refactoring suggestions.

## Auto-Fix Protocol

When running code review with `autoFix=true`:

1. **Run the review** to get refactoring recommendations
2. **For each refactoring item**, apply changes automatically:
   - `split` - Split large files into modules (types, client, api, index pattern)
   - `types` - Add proper TypeScript interfaces
   - `extract` - Extract functions to separate files

### Split File Protocol

When a file needs splitting (>200 lines for standard, >300 for integrations):

1. **Analyze the file** to identify logical groupings:
   - Types/interfaces → `types.ts`
   - HTTP client/auth → `client.ts`
   - API functions → `api.ts` or domain-specific files
   - Re-exports → `index.ts`

2. **Create folder** with same name as file (minus .ts)

3. **Write new files** following the pattern:
   ```
   original-file.ts (283 lines)
   →
   original-file/
   ├── types.ts      # Interfaces, types
   ├── client.ts     # Base client, auth
   ├── api.ts        # API functions
   └── index.ts      # Re-exports everything
   ```

4. **Update imports** in dependent files

5. **Delete original file**

6. **Build and verify**

### Architecture Changes

For deep architectural changes (recommended_change in output):

1. **Event Bus** - Add pub/sub for cross-module communication
2. **Shared Utils** - Move common code to @elio/shared
3. **Plugin System** - Create extension points

## Output Format

```json
{
  "score": 85,
  "architecture_score": 90,
  "refactoring": [
    {
      "file": "path/to/file.ts",
      "type": "split",
      "reason": "File exceeds size limit",
      "suggestion": "Split into: types.ts, client.ts, api.ts"
    }
  ],
  "architecture_analysis": {
    "tech_debt": "Description of biggest tech debt",
    "recommended_change": "Most impactful architecture change",
    "data_flow_improvement": "Data flow scalability suggestion"
  }
}
```

## Examples

### Auto-fix large integration file
```
# Run review
elio_code_review path="./mcp-server/src/integrations" scope="full"

# If refactoring suggests split, execute:
# 1. Create folder
# 2. Write types.ts, client.ts, api.ts, index.ts
# 3. Update adapter imports
# 4. Delete original
# 5. Build
```

### Architecture improvement
```
# Review shows: "Add event bus - 25 direct store writes"
# Execute:
# 1. Create core/events.ts with EventEmitter
# 2. Wrap store.save() calls with events
# 3. Add subscribers for cross-module updates
```
