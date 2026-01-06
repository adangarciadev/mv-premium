# ADR-008: Storage and Persistence Strategy

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension needs to persist multiple types of data with different requirements:

- **Global settings**: Theme, API keys, feature toggles
- **Feature data**: Drafts, saved threads, pinned posts
- **UI state**: Panel positions, visual preferences
- **Cache**: Temporary data from external APIs

The extension ecosystem offers several storage APIs:

- `chrome.storage.local` - Local device data
- `chrome.storage.sync` - Synced with Google account (100KB limit)
- `localStorage` - Not recommended in extensions (doesn't persist in service workers)

## Decision

### 1. Single Backend: WXT Storage API

Use `@wxt-dev/storage` as an abstraction over `chrome.storage`:

```typescript
import { storage } from '@wxt-dev/storage'

// Define typed item with default
const myStorage = storage.defineItem<MyType>('local:my-key', {
defaultValue: initialValue,
})

// Usage
await myStorage.getValue()
await myStorage.setValue(newValue)
myStorage.watch(callback)
```

**Benefits:**

- Unified and typed API
- Works in all contexts (background, content, popup, options)
- Reactive watchers for cross-context sync
- Clear prefixes: `local:` vs `sync:`

### 2. Strategy by Data Type

| Data Type             | Storage                    | Reason                                |
| --------------------- | -------------------------- | ------------------------------------- |
| Global settings       | `local:` + Zustand persist | Can be large, no sync needed          |
| API Keys              | `local:`                   | Security, no sync between devices     |
| Drafts/Templates      | `local:` + compression     | Can be very large                     |
| UI states             | `local:`                   | Ephemeral, device-specific            |
| API cache             | `local:`                   | Temporary, rebuildable                |

### 3. Implementation Patterns

#### A) Global Settings - Zustand + WXT Storage

```typescript
// store/settings-store.ts
const settingsStorage = storage.defineItem<string>('local:settings')

export const useSettingsStore = create(
persist(set => ({ ...DEFAULT_SETTINGS, ...actions }), {
name: 'settings',
storage: createJSONStorage(() => wxtStorageAdapter),
})
)
```

#### B) Feature Storage - Direct WXT with compression

```typescript
// features/drafts/storage.ts
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'

export async function getDrafts(): Promise<Draft[]> {
return await getCompressed<Draft[]>(STORAGE_KEYS.DRAFTS, [])
}
```

#### C) UI State - Zustand without persist (ephemeral)

```typescript
// store/ui-store.ts
export const useUIStore = create<UIState>(set => ({
isModalOpen: false,
// No persist middleware - ephemeral state
}))
```

### 4. Centralized Storage Keys

```typescript
// constants/storage-keys.ts
export const STORAGE_KEYS = {
SETTINGS: 'mv-settings',
DRAFTS: 'mv-drafts',
THEME: 'mv-theme',
// ... all keys in one place
} as const
```

## Alternatives Considered

### IndexedDB

- ❌ More complex to use
- ❌ Doesn't work well in MV3 service workers
- ❌ Overkill for our data volumes

### localStorage

- ❌ Not available in service workers (MV3)
- ❌ Doesn't auto-sync between contexts

### chrome.storage.sync

- ⚠️ 100KB total limit
- ⚠️ 8KB per item limit
- ✅ Useful only for small critical settings (future)

## Consequences

### Positive

- Consistent API across the codebase
- Strong TypeScript types
- Watchers for reactive sync
- Optional compression for large data

### Negative

- WXT dependency (acceptable, already core)
- Migration needed if WXT API changes

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Content Script                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ useSettings  │    │ useDrafts    │    │ useUIStore   │  │
│  │   Store      │    │   Storage    │    │   (memory)   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
└─────────┼───────────────────┼───────────────────────────────┘
          │                   │
          ▼                   ▼
    ┌─────────────────────────────────┐
    │      WXT Storage Adapter        │
    │   storage.defineItem('local:')  │
    └─────────────┬───────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │      chrome.storage.local       │
    │    (Actual persistence)         │
    └─────────────────────────────────┘
                  │
                  │ watch() / onChange
                  ▼
    ┌─────────────────────────────────┐
    │   Options Page / Popup / Other  │
    │   (Automatic synchronization)   │
    └─────────────────────────────────┘
```

## References

- [WXT Storage API](https://wxt.dev/guide/storage.html)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [constants/storage-keys.ts](../../constants/storage-keys.ts)
- [lib/storage/compressed-storage.ts](../../lib/storage/compressed-storage.ts)
