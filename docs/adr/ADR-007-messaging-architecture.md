# ADR-007: Cross-Context Messaging Architecture

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

A browser extension operates in **multiple isolated contexts**:

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Popup      │  │   Options    │  │  Background      │  │
│  │   (React)    │  │   (React)    │  │  (Service Worker)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                 │                   │             │
│         └─────────────────┼───────────────────┘             │
│                           │ chrome.runtime.sendMessage      │
│  ┌────────────────────────┼────────────────────────────┐   │
│  │                        ▼                            │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  Content Script (injected in mediavida.com)  │   │   │
│  │  │  - No direct access to Chrome APIs           │   │   │
│  │  │  - Cannot fetch external APIs                │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                    TAB (mediavida.com)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Problems

1. **CORS**: Content scripts inherit CORS policies from host site
2. **API Keys**: Keys cannot be exposed in content scripts (visible in DevTools)
3. **Type Safety**: `chrome.runtime.sendMessage` has no types
4. **Boilerplate**: Lots of repetitive code for each message

---

## Decision

Use **@webext-core/messaging** for typed RPC-style messaging.

### Architecture

```typescript
// lib/messaging.ts - Define the protocol

interface ProtocolMap {
// Each key is an "RPC method"
uploadImage: (data: { base64: string; filename: string }) => UploadResult
highlightCode: (data: { code: string; language: string }) => string
fetchTMDB: (data: { type: string; id: string }) => TMDBResult
// ... more methods
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
```

### Usage in Background (Handlers)

```typescript
// entrypoints/background/index.ts
import { onMessage } from '@/lib/messaging'

// Register handlers
onMessage('uploadImage', async ({ data }) => {
  // Background can fetch without CORS
  const response = await fetch('https://api.imgur.com/...', {
    headers: { Authorization: `Client-ID ${API_KEY}` }
  })
  return await response.json()
})

onMessage('highlightCode', async ({ data }) => {
  // PrismJS only exists in background
  return Prism.highlight(data.code, ...)
})
```

### Usage in Content Script (Caller)

```typescript
// features/editor/hooks/use-image-upload.ts
import { sendMessage } from '@/lib/messaging'

async function uploadImage(file: File) {
// Fully typed - IDE autocompletes params and return
const result = await sendMessage('uploadImage', {
base64: await fileToBase64(file),
filename: file.name,
})

if (result.success) {
return result.url
}
throw new Error(result.error)
}
```

---

## Services in Background

Everything below **MUST** go through background:

| Service               | Reason                               |
| --------------------- | ------------------------------------ |
| **Image upload**      | Imgur/Catbox API keys                |
| **TMDB API**          | API key + centralized rate limiting  |
| **Steam API**         | Proxy to avoid CORS                  |
| **Prism highlighting**| Bundle size (see ADR-004)            |
| **Gemini AI**         | Google API key                       |
| **OpenRouter AI**     | API key                              |

### Flow Diagram

```
Content Script          Background              External API
     │                      │                        │
     │  sendMessage         │                        │
     │  'uploadImage'       │                        │
     │ ───────────────────► │                        │
     │                      │  fetch (with API key)  │
     │                      │ ─────────────────────► │
     │                      │                        │
     │                      │ ◄───────────────────── │
     │                      │       response         │
     │ ◄─────────────────── │                        │
     │    UploadResult      │                        │
     │                      │                        │
```

---

## Alternatives Considered

### 1. chrome.runtime.sendMessage directly

```typescript
chrome.runtime.sendMessage({ type: 'upload', data: {...} }, (response) => {
  // No types, callback hell
})
```

- ❌ **Rejected**: No type safety
- ❌ Callback API (not native Promises)
- ❌ Lots of boilerplate

### 2. Custom wrapper over chrome.runtime

- ⚠️ Considered but rejected
- Reinventing the wheel
- @webext-core already solves this

### 3. Direct fetch from content script

- ❌ **Rejected**: CORS blocks most APIs
- ❌ API keys exposed in Network tab

### 4. Own proxy server

- ❌ **Rejected**: Requires infrastructure
- ❌ Additional latency
- ❌ Hosting costs

---

## Consequences

### Positive

- ✅ **Complete type safety**: Errors at compile time
- ✅ **Secure API keys**: Only in background, never in content
- ✅ **No CORS**: Background can fetch any origin
- ✅ **Centralized**: One place for all network logic
- ✅ **Testable**: Background handlers easy to mock

### Negative

- ⚠️ **Latency**: ~5-20ms overhead per message
- ⚠️ **Serialization**: Only JSON-serializable data
- ⚠️ **Dependency**: @webext-core is external dependency
- ⚠️ **Debug**: Stack traces cross contexts

### Usage Patterns

```typescript
// ✅ CORRECT: Fetch in background
const data = await sendMessage('fetchTMDB', { type: 'movie', id: '123' })

// ❌ INCORRECT: Fetch in content script
const data = await fetch('https://api.tmdb.org/...') // CORS error!
```

---

## References

- [lib/messaging.ts](../../lib/messaging.ts) - Message definitions
- [entrypoints/background/](../../entrypoints/background/) - Handlers
- [@webext-core/messaging](https://webext-core.aklinker1.io/guide/messaging/)
