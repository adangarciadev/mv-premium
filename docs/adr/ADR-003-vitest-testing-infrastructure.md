# ADR-003: Testing Infrastructure with Vitest

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The Mediavida Premium extension originally **had no automated tests**. This presented significant risks:

1. **Silent regressions**: Changes in one feature could break others without detection
2. **Risky refactoring**: Without tests, it's difficult to refactor with confidence
3. **Difficult onboarding**: New developers had no way to validate changes
4. **Technical debt**: Untested code accumulates and becomes critical

### Current Stack

- **Bundler**: WXT (based on Vite)
- **Framework**: React 19
- **Language**: Strict TypeScript
- **State**: Zustand + TanStack Query

---

## Decision

Implement **Vitest** as the testing framework for the following reasons:

### Why Vitest?

| Criteria              | Vitest          | Jest                | Alternatives |
| --------------------- | --------------- | ------------------- | ------------ |
| **Vite Compatibility**| ✅ Native       | ⚠️ Requires config  | —            |
| **Speed**             | ✅ HMR, esbuild | ⚠️ Slower           | —            |
| **API**               | Jest-compatible | ✅ Standard         | —            |
| **TypeScript**        | ✅ Native       | ⚠️ Requires ts-jest | —            |
| **ESM**               | ✅ Native       | ⚠️ Problematic      | —            |
| **Watch mode**        | ✅ Instant      | ⚠️ Full rebuild     | —            |

### Proposed Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
plugins: [react()],
test: {
globals: true,
environment: 'jsdom',
setupFiles: ['./tests/setup.ts'],
include: ['**/*.{test,spec}.{ts,tsx}'],
exclude: ['node_modules', '.output', 'dist'],
coverage: {
provider: 'v8',
reporter: ['text', 'html', 'lcov'],
include: ['lib/**', 'features/**', 'hooks/**', 'services/**'],
exclude: ['**/*.d.ts', '**/index.ts'],
},
alias: {
'@': resolve(__dirname, './'),
},
},
})
```

### Setup File

```typescript
// tests/setup.ts
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock browser APIs (WXT)
vi.mock('wxt/browser', () => ({
browser: {
storage: {
local: {
get: vi.fn(),
set: vi.fn(),
},
sync: {
get: vi.fn(),
set: vi.fn(),
},
},
runtime: {
sendMessage: vi.fn(),
onMessage: { addListener: vi.fn() },
},
tabs: {
query: vi.fn(),
sendMessage: vi.fn(),
},
},
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
writable: true,
value: vi.fn().mockImplementation(query => ({
matches: false,
media: query,
onchange: null,
addListener: vi.fn(),
removeListener: vi.fn(),
addEventListener: vi.fn(),
removeEventListener: vi.fn(),
dispatchEvent: vi.fn(),
})),
})
```

---

## Testing Strategy

### Phase 1: Foundation (Week 1-2)

- [x] Configure Vitest + React Testing Library
- [x] Create mocks for `browser.*` APIs
- [x] Establish test folder structure

### Phase 2: Critical Utilities (Week 3-4)

- [x] Tests for `lib/logger.ts`
- [x] Tests for `lib/storage/` (sync, local)
- [x] Tests for `lib/date-utils.ts`, `lib/format-utils.ts`

### Phase 3: Hooks (Week 5-6)

- [x] Tests for `hooks/use-storage.ts`
- [x] Tests for `hooks/use-mutate.ts`
- [x] Tests for feature-specific custom hooks

### Phase 4: Services (Week 7-8)

- [x] Tests for `services/api/` (with MSW for HTTP mocking)
- [x] Tests for `services/media/`

### Phase 5: UI Components (Optional)

- [ ] Integration tests for critical components

---

## Alternatives Considered

### 1. Jest

- ⚠️ Industry standard but requires extra configuration for Vite
- ⚠️ Slower in watch mode
- ⚠️ ESM support is problematic

### 2. Testing Library only (no runner)

- ❌ **Rejected**: Still need a test runner

### 3. Playwright/Cypress for E2E only

- ⚠️ Considered for E2E but too heavy for unit tests
- May add later for E2E testing

### 4. No tests

- ❌ **Rejected**: Unacceptable technical debt

---

## Consequences

### Positive

- ✅ **Fast feedback loop** with Vitest watch mode
- ✅ **Confidence** in refactoring and changes
- ✅ **Documentation** - Tests serve as usage examples
- ✅ **CI/CD integration** - Tests run on every PR
- ✅ **Native TypeScript** - No extra configuration

### Negative

- ⚠️ Initial setup time investment
- ⚠️ Mocking browser APIs requires maintenance
- ⚠️ Test coverage maintenance effort

### Current Status

- **694 tests** across **49 test files**
- All tests passing ✅
- CI/CD workflows configured

---

## References

- [vitest.config.ts](../../vitest.config.ts) - Configuration
- [tests/setup.ts](../../tests/setup.ts) - Test setup
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
