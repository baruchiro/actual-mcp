# Copilot Instructions for actual-mcp

## What This Is
TypeScript/Node.js MCP server exposing Actual Budget financial data to LLMs. ~3,000 LOC, uses @modelcontextprotocol/sdk + @actual-app/api, tested with Vitest.

## Critical Build Order (ALWAYS Follow)
**Most common failure: Not running `npm ci` first!**

```bash
# 1. REQUIRED FIRST - Install deps (~15s)
npm ci

# 2. Build TypeScript to build/ (~10s)
npm run build

# 3. Run tests (~2s, 124 tests)
npm run test

# 4. Validate before commit
npm run quality  # lint + format:check + type-check (~15s)
```

**Known issue**: `npm run format:check` may fail on `.github/workflows/*.yml` files - this is expected and acceptable for code-only PRs.

## CI Must Pass (Replicate with: `npm ci && npm run build && npm run test:coverage && npm run quality`)
- **build-and-test**: npm ci → build → test:coverage (Node 22, 10min timeout)
- **type-check**: npm ci → tsc --noEmit (Node 22, 5min timeout)  
- **lint**: npm ci → npm run quality (Node 22, 5min timeout)
- **coverage-report**: Downloads artifacts, runs vitest-coverage-report

## Project Structure
```
src/
├── index.ts              # MCP server entry (stdio/SSE/HTTP transports)
├── actual-api.ts         # Actual Budget API lifecycle manager
├── types.ts              # Shared types
├── core/                 # Shared utilities
│   ├── data/             # Fetch functions (accounts, transactions, categories, payees, rules)
│   ├── aggregation/      # group-by, sum-by, sort-by, transaction-grouper
│   ├── mapping/          # category-mapper, transaction-mapper
│   ├── input/            # validators
│   └── types/            # domain.ts
└── tools/                # MCP tool implementations (14 tools)
    ├── index.ts          # Tool registration
    └── [tool-name]/      # Each tool has index.ts + optional: input-parser, data-fetcher, report-generator, types
```

**Tool Pattern**: Each `src/tools/[name]/` contains:
- `index.ts` - Schema + handler
- `input-parser.ts` - Validation (optional)
- `data-fetcher.ts` - Data retrieval (optional)
- `report-generator.ts` - Markdown output (optional)
- Keep files < 500 lines (refactor if approaching)

## Config Files
- `tsconfig.json` - ES2022, Node16 modules, strict mode
- `tsconfig.build.json` - Excludes tests, adds sourcemaps
- `vitest.config.ts` - Tests: `src/{core,tools}/**/*.test.ts`, coverage excludes domain.ts
- `eslint.config.ts` - ESLint 9 flat config, TypeScript rules, explicit return types required
- `.prettierrc` - semi, singleQuote, printWidth: 120
- `.gitignore` - Excludes node_modules/, build/, coverage/, .env, data/**

## Key Commands
```bash
npm ci               # Clean install (ALWAYS run first)
npm run build        # tsc → build/ + chmod 755 index.js
npm run test         # Vitest run
npm run test:coverage # With coverage reports
npm run type-check   # tsc --noEmit
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check (may fail on YAML - ignore)
npm run quality      # lint + format:check + type-check
npm run watch        # tsc --watch
npm start            # tsx src/index.ts (dev mode)
```

## Common Issues
1. **"Cannot find module"** → Run `npm ci`
2. **Old build errors** → Delete `build/`, run `npm run build`
3. **ESM import errors** → Use `.js` extensions in imports (TypeScript ESM convention)
4. **Mock failures** → Use `vi.mock()` with factory functions
5. **YAML format warnings** → Ignore for code PRs
6. **Type errors** → Strict mode enforced, explicit return types required

## Testing
- Co-located: `file.ts` → `file.test.ts`
- Mock with `vi.mock()`
- Coverage: happy path + edge case + error case
- Only `src/core/` and `src/tools/` measured

## Dependencies
- MCP: @modelcontextprotocol/sdk 1.17.4
- Actual: @actual-app/api 25.11.0
- Validation: zod + zod-to-json-schema
- Test: vitest 3.2.4
- Node: v16+ (CI uses 20-22)

## Environment Variables
Required in `.env` (see `.env.example`):
```
ACTUAL_SERVER_URL=
ACTUAL_PASSWORD=
ACTUAL_BUDGET_SYNC_ID=
ACTUAL_BUDGET_ENCRYPTION_PASSWORD=  # Optional
```

## Search Tips
- Tools: `src/tools/*/index.ts`
- API: `src/actual-api.ts`
- Types: `src/types.ts`, `src/core/types/domain.ts`
- Tests: `*.test.ts` co-located
- Utils: `src/utils.ts`, `src/core/`

**Trust these instructions first.** Only search if info is incomplete/wrong.
