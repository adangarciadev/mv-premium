# ADR-001: Centralized Logging System

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The Mediavida Premium extension had `console.log`, `console.warn`, and `console.error` calls scattered throughout the codebase (~90+ instances across ~55 files). This presented several problems:

1. **Logs in production**: Debug `console.log` statements were showing in production, polluting the user's console.
2. **Inconsistent format**: Each developer used different prefixes (`[MVP]`, `[FeatureName]`, no prefix).
3. **Difficult filtering**: Without a standard format, it was hard to filter extension logs vs. website logs.
4. **Maintenance**: Changing logging behavior required modifying dozens of files.

---

## Decision

Implement a **centralized logger** in `lib/logger.ts` with the following characteristics:

```typescript
export const logger = {
debug: (message: string, ...args: unknown[]) => {
if (import.meta.env.DEV) {
console.log(`%c[MVP] ��� ${message}`, 'color: #8b5cf6', ...args)
}
},
info: (message: string, ...args: unknown[]) => {
console.log(`%c[MVP] ℹ️ ${message}`, 'color: #3b82f6', ...args)
},
warn: (message: string, ...args: unknown[]) => {
console.warn(`%c[MVP] ⚠️ ${message}`, 'color: #f59e0b', ...args)
},
error: (message: string, ...args: unknown[]) => {
console.error(`%c[MVP] ❌ ${message}`, 'color: #ef4444', ...args)
},
}
```

### Migration Rules

| Before                        | After                                          | Notes           |
| ----------------------------- | ---------------------------------------------- | --------------- |
| `console.log('[Debug]', ...)` | `logger.debug(...)`                            | DEV only        |
| `console.log('[Info]', ...)`  | `logger.info(...)`                             | Always          |
| `console.warn(...)`           | `logger.warn(...)`                             | Always          |
| `console.error(...)`          | `logger.error(...)`                            | Always          |
| `.catch(console.error)`       | `.catch(err => logger.error('Context:', err))` | Add context     |

---

## Alternatives Considered

### 1. External library (loglevel, pino-browser)

- ❌ **Rejected**: Adds unnecessary external dependency for a browser extension
- ❌ Bundle size overhead

### 2. Do nothing

- ❌ **Rejected**: Production and maintenance problems persist

### 3. Simple wrapper (chosen) ✅

- ✅ Zero dependencies
- ✅ Tree-shakeable
- ✅ Full control over behavior
- ✅ Easy to extend (e.g., send errors to external service)

---

## Consequences

### Positive

- ✅ **Debug logs removed in production** - Improves UX
- ✅ **Consistent format** - `[MVP]` prefix + emoji + colors
- ✅ **Easy filtering** - Search `[MVP]` in DevTools
- ✅ **Single control point** - Global changes in one file
- ✅ **Better debugging** - Context added to Promise errors

### Negative

- ⚠️ Required migration of ~90 files (one-time effort)
- ⚠️ Developers must remember to use `logger` instead of `console`

### Neutral

- The logger does NOT persist logs (conscious decision to avoid complexity)
- No user-configurable levels (not necessary for this extension)

---

## References

- [lib/logger.ts](../../lib/logger.ts) - Implementation
