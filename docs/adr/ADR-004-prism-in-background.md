# ADR-004: Prism.js in Background Script

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The extension needs to provide syntax highlighting for code blocks in the editor and post preview. PrismJS is the chosen library for its broad language support and highlighting quality.

### Problem

PrismJS has a **significant weight**:

- Core: ~20KB minified
- With popular languages: ~100-150KB
- With all languages: ~300KB+

In a browser extension, the **content script** is injected into **every page** the user visits on Mediavida. If we include PrismJS directly:

1. **Bloated bundle**: The content script would grow from ~1.2MB to ~1.4MB
2. **Slow initial load**: Every page would load code that's rarely used
3. **Memory consumption**: PrismJS loaded in every tab unnecessarily

---

## Decision

**Move PrismJS to the Background Script** and communicate via asynchronous messaging.

### Architecture

```
┌─────────────────────────┐     message      ┌──────────────────────────┐
│   Content Script        │ ───────────────▶ │   Background Script      │
│                         │                  │                          │
│ - Editor with code      │                  │ - PrismJS (~100KB)       │
│ - Requests highlight    │                  │ - Lazy loads languages   │
│                         │ ◀─────────────── │ - Returns colored HTML   │
└─────────────────────────┘    HTML string   └──────────────────────────┘
```

### Implementation

```typescript
// entrypoints/background/prism-highlighter.ts
import Prism from 'prismjs'

// Dynamic language loading
const LANGUAGE_LOADERS = {
javascript: () => import('prismjs/components/prism-javascript'),
typescript: () => import('prismjs/components/prism-typescript'),
// ... more languages
}

async function highlightCode(code: string, language: string): Promise<string> {
await loadLanguage(language)
return Prism.highlight(code, Prism.languages[language], language)
}
```

```typescript
// Usage in content script
const highlighted = await sendMessage('highlightCode', { code, language })
```

### Lazy Language Loading

Languages are loaded **on demand**:

- Only the required language is imported when needed
- Cached in memory for subsequent requests
- Dependencies resolved automatically (e.g., TypeScript requires JavaScript)

---

## Alternatives Considered

### 1. PrismJS in Content Script

- ❌ **Rejected**: Bundle too large for every page
- ❌ Unnecessary load on pages without code

### 2. highlight.js instead of PrismJS

- ⚠️ Considered but rejected
- Similar bundle size
- PrismJS has better support for modern languages

### 3. Dedicated Web Worker

- ⚠️ Considered but rejected
- Additional complexity without clear benefit
- Background script is already an isolated context

### 4. External server for highlighting

- ❌ **Rejected**: Requires internet connection
- ❌ Unacceptable latency for UX
- ❌ Privacy concerns

---

## Consequences

### Positive

- ✅ **Lightweight content script**: No PrismJS in main bundle
- ✅ **Efficient loading**: Only the needed language is loaded
- ✅ **Shared memory**: Single PrismJS instance for all tabs
- ✅ **Persistent background**: In MV3, service worker activates on demand

### Negative

- ⚠️ **Latency**: ~10-50ms overhead for messaging
- ⚠️ **Asynchrony**: Code must wait for highlighting
- ⚠️ **Complexity**: Requires robust messaging system

### Accepted Trade-offs

- Latency is imperceptible to the user (code appears then gets colored)
- Messaging complexity already exists for other features

---

## Metrics

| Metric              | Without optimization | With Background |
| ------------------- | -------------------- | --------------- |
| Content Script Size | ~1.4MB               | ~1.2MB          |
| Initial load time   | +150ms               | +0ms            |
| Highlight latency   | 0ms (sync)           | ~20ms (async)   |
| Memory per tab      | +50KB                | +0KB            |

---

## References

- [entrypoints/background/prism-highlighter.ts](../../entrypoints/background/prism-highlighter.ts) - Implementation
- [PrismJS Documentation](https://prismjs.com/)
- [Chrome MV3 Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
