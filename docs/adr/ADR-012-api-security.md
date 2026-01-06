# ADR-012: API Keys Security

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension integrates with multiple external APIs:

| API        | Purpose                    | Key Type                       |
| ---------- | -------------------------- | ------------------------------ |
| **TMDB**   | Movie/series information   | Extension key (embedded)       |
| **Giphy**  | GIF search                 | Extension key (embedded)       |
| **Imgbb**  | Image upload               | User key                       |
| **Gemini** | AI for summaries           | User key                       |

### Security Issues

1. **Content Scripts are public**: Any code in Content Script can be inspected
2. **CORS**: Content Scripts cannot fetch external APIs directly
3. **User keys**: Must be stored securely and not exposed

## Decision

### Proxy Architecture in Background Script

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT SCRIPT                              │
│                                                                 │
│   services/api/tmdb.ts                                          │
│   ┌──────────────────────────────────────────┐                  │
│   │ async function getMovie(id: string) {    │                  │
│   │   // Does NOT have API key               │                  │
│   │   // Only sends message to background    │                  │
│   │   return sendMessage('tmdbRequest', {    │                  │
│   │     endpoint: `/movie/${id}`,            │                  │
│   │     params: {}                           │                  │
│   │   })                                     │                  │
│   │ }                                        │                  │
│   └──────────────────────────────────────────┘                  │
│                         │                                       │
│                         │ chrome.runtime.sendMessage            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKGROUND SCRIPT                           │
│                                                                 │
│   entrypoints/background/api-handlers.ts                        │
│   ┌──────────────────────────────────────────┐                  │
│   │ // API key from .env (build time)        │                  │
│   │ const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY          │
│   │                                          │                  │
│   │ onMessage('tmdbRequest', async ({data}) => {                │
│   │   const url = new URL(TMDB_BASE + data.endpoint)            │
│   │   url.searchParams.set('api_key', TMDB_KEY) // ✅ Secure    │
│   │                                          │                  │
│   │   const res = await fetch(url)  // ✅ No CORS               │
│   │   return res.json()                      │                  │
│   │ })                                       │                  │
│   └──────────────────────────────────────────┘                  │
│                         │                                       │
│                         │ fetch (no CORS restrictions)          │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  External API │
                  │  (TMDB, etc.) │
                  └───────────────┘
```

### 1. Extension Keys (TMDB, Giphy)

**Storage**: Environment variables at build time

```typescript
// .env (NOT committed to git)
VITE_TMDB_API_KEY=abc123...
VITE_GIPHY_API_KEY=xyz789...

// entrypoints/background/api-handlers.ts
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
```

**Request Flow**:

```typescript
// Content Script - Does NOT have access to key
// services/api/tmdb.ts
export async function getMovieDetails(id: number): Promise<TMDBMovieDetails> {
return sendMessage('tmdbRequest', {
endpoint: `/movie/${id}`,
params: { append_to_response: 'credits,videos' },
})
}

// Background Script - HAS the key and does the fetch
// entrypoints/background/api-handlers.ts
onMessage('tmdbRequest', async ({ data }) => {
const url = new URL(`${TMDB_BASE_URL}${data.endpoint}`)
url.searchParams.set('api_key', TMDB_API_KEY) // Key injected here
url.searchParams.set('language', 'es-ES')

// Additional params from caller
for (const [key, value] of Object.entries(data.params || {})) {
url.searchParams.set(key, value)
}

const response = await fetch(url.toString())
return response.json()
})
```

### 2. User Keys (Imgbb, Gemini)

**Storage**: `chrome.storage.local` (encrypted by browser)

```typescript
// store/settings-store.ts
interface SettingsState {
imgbbApiKey: string
geminiApiKey: string
// ...
}

// User configures in Options Page
export const useSettingsStore = create(
persist(
set => ({
imgbbApiKey: '',
setImgbbApiKey: (key: string) => set({ imgbbApiKey: key }),
// ...
}),
{ name: 'settings', storage: wxtStorageAdapter }
)
)
```

**Request Flow with User Key**:

```typescript
// Content Script requests from background
const result = await sendMessage('uploadImage', {
imageData: base64,
// Does NOT send API key
})

// Background gets key from storage
onMessage('uploadImage', async ({ data }) => {
const settings = await storage.getItem('local:settings')
const apiKey = settings.imgbbApiKey

if (!apiKey) {
throw new Error('API key not configured')
}

const formData = new FormData()
formData.append('key', apiKey)
formData.append('image', data.imageData)

const res = await fetch('https://api.imgbb.com/1/upload', {
method: 'POST',
body: formData,
})

return res.json()
})
```

### 3. Key Verification

For features requiring keys, we verify before showing UI:

```typescript
// Content Script
const hasTmdbKey = await sendMessage('hasTmdbApiKey')
if (!hasTmdbKey) {
// Don't show movie hover cards
return
}

// Background
onMessage('hasTmdbApiKey', () => {
return !!TMDB_API_KEY
})
```

### 4. Secure Error Messages

Never expose key details in errors:

```typescript
// ❌ Incorrect
throw new Error(`Invalid key: ${apiKey}`)

// ✅ Correct
throw new Error('API key is invalid or expired')
```

## Alternatives Considered

### 1. Keys in Content Script

- ❌ **Rejected**: Visible in DevTools Sources tab
- ❌ Anyone can extract and abuse keys

### 2. Obfuscation

- ❌ **Rejected**: Security through obscurity doesn't work
- ❌ Determined attackers can deobfuscate

### 3. Own proxy server

- ⚠️ Considered for rate limiting
- ❌ Hosting costs
- ❌ Single point of failure
- ❌ Privacy concerns

### 4. No external APIs

- ❌ **Rejected**: Features like Cinema and GIF picker require them

## Consequences

### Positive

- ✅ **Keys not exposed** in Content Script
- ✅ **User keys encrypted** by browser
- ✅ **No CORS issues** (Background can fetch anywhere)
- ✅ **Centralized rate limiting** possible in Background

### Negative

- ⚠️ **Latency**: Extra hop through messaging
- ⚠️ **Complexity**: More code for simple requests
- ⚠️ **Keys in built artifact**: Extension keys still in Background bundle

### Mitigation

- Keys in Background are harder to extract than in Content Script
- Rate limiting in Background prevents abuse even if keys extracted
- User keys never leave user's device

---

## References

- [entrypoints/background/api-handlers.ts](../../entrypoints/background/api-handlers.ts)
- [lib/messaging.ts](../../lib/messaging.ts)
- [Chrome Extension Security](https://developer.chrome.com/docs/extensions/mv3/security/)
