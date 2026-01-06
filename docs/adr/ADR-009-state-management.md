# ADR-009: State Management Architecture

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension has multiple state layers that must coordinate:

1. **Persistent Global State**: Settings, user configuration
2. **Feature State**: Feature-specific data (drafts, saved threads)
3. **UI State**: Open modals, panel positions
4. **Server State**: Data from external APIs (TMDB, Giphy)

Additionally, state must be accessible from multiple contexts:

- Content Script (injected in mediavida.com)
- Options Page (full dashboard)
- Popup (quick access)
- Background Script (service worker)

## Decision

### 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LAYER 1: GLOBAL                          │
│                                                                 │
│   useSettingsStore (Zustand + persist)                          │
│   - Theme, API keys, feature toggles                            │
│   - Persisted in chrome.storage.local                           │
│   - Memoized selectors for performance                          │
│                                                                 │
│   useUIStore (Zustand, no persist)                              │
│   - Ephemeral state: modals, dragging                           │
│   - Resets on reload                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      LAYER 2: FEATURES                          │
│                                                                 │
│   Each feature manages its own storage:                         │
│                                                                 │
│   features/drafts/storage/       → Drafts and templates         │
│   features/saved-threads/storage → Saved threads                │
│   features/pinned-posts/storage  → Pinned posts per thread      │
│   features/stats/storage         → Activity statistics          │
│   features/bookmarks/storage     → Post bookmarks               │
│                                                                 │
│   Pattern: WXT storage.defineItem + CRUD functions              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      LAYER 3: SERVER STATE                      │
│                                                                 │
│   TanStack Query (Options Page only)                            │
│   - External API cache (TMDB, Steam)                            │
│   - Automatic invalidation                                      │
│   - NOT available in Content Script (bundle size)               │
│                                                                 │
│   Content Script uses:                                          │
│   - Custom hooks with manual cache (use-tmdb.ts)                │
│   - Background script for fetch (avoid CORS)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Patterns by State Type

#### 1. Global Settings (Zustand)

```typescript
// store/settings-store.ts
export const useSettingsStore = create<SettingsState>()(
persist(
set => ({
theme: 'dark',
setTheme: theme => set({ theme }),
// ...
}),
{ name: 'settings', storage: wxtStorageAdapter }
)
)

// Usage with selector (avoids unnecessary re-renders)
const theme = useSettingsStore(state => state.theme)
```

#### 2. Feature Storage (Direct WXT)

```typescript
// features/drafts/storage/index.ts
const draftsStorage = storage.defineItem<DraftsData>('local:drafts', {
defaultValue: { drafts: [], folders: [] },
})

export async function getDrafts(): Promise<Draft[]> {
const data = await draftsStorage.getValue()
return data.drafts
}

export async function saveDraft(draft: Draft): Promise<void> {
const data = await draftsStorage.getValue()
data.drafts.push(draft)
await draftsStorage.setValue(data)
}

// Reactive hook for components
export function useDrafts() {
const [drafts, setDrafts] = useState<Draft[]>([])

useEffect(() => {
getDrafts().then(setDrafts)
return draftsStorage.watch(newData => setDrafts(newData.drafts))
}, [])

return drafts
}
```

#### 3. Server State (TanStack Query - Options only)

```typescript
// Only in Options Page (AppProvider includes QueryClient)
export function useMovieSearch(query: string) {
return useQuery({
queryKey: ['tmdb', 'search', query],
queryFn: () => searchMovies(query),
staleTime: 5 * 60 * 1000, // 5 min cache
})
}
```

#### 4. Content Script Server State (Custom Hook)

```typescript
// features/cine/hooks/use-tmdb.ts
// Does NOT use TanStack Query (LiteAppProvider doesn't include it)
export function useMovieSearch(query: string) {
const [data, setData] = useState(null)
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
// Manual cache + fetch via background
const cached = getCache(`tmdb:search:${query}`)
if (cached) {
setData(cached)
return
}

setIsLoading(true)
sendMessage('tmdbRequest', { query })
.then(result => {
setCache(`tmdb:search:${query}`, result)
setData(result)
})
.finally(() => setIsLoading(false))
}, [query])

return { data, isLoading }
}
```

## Data Flow: Content Script vs Options Page

### Content Script (in mediavida.com)

```
User interacts
        │
        ▼
┌───────────────────┐
│  React Component  │
│  (LiteAppProvider)│
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Settings   Feature
 Store     Storage
(Zustand)  (WXT)
    │         │
    └────┬────┘
         │
         ▼
┌───────────────────┐
│ chrome.storage    │
│ .local            │
└───────────────────┘
```

### Options Page (Dashboard)

```
User interacts
        │
        ▼
┌───────────────────┐
│  React Component  │
│   (AppProvider)   │
└────────┬──────────┘
         │
    ┌────┼────────┐
    │    │        │
    ▼    ▼        ▼
Settings Feature  TanStack
 Store   Storage   Query
(Zustand) (WXT)   (Cache)
    │      │        │
    └──────┴────────┘
           │
           ▼
┌───────────────────┐
│ chrome.storage +  │
│ External APIs     │
└───────────────────┘
```

## Alternatives Considered

### 1. Single global state (Redux)

- ❌ **Rejected**: Overkill for this use case
- ❌ Boilerplate heavy
- ❌ Difficult cross-context sync

### 2. React Context only

- ❌ **Rejected**: Doesn't persist
- ❌ No cross-tab sync
- ❌ Complex provider nesting

### 3. TanStack Query everywhere

- ⚠️ Considered but rejected for Content Script
- Bundle size too large for simple features
- See ADR-013 for details

## Consequences

### Positive

- ✅ **Clear separation** of state by concern
- ✅ **Optimized bundles** (Query only where needed)
- ✅ **Reactive updates** across contexts
- ✅ **Type-safe** throughout

### Negative

- ⚠️ Multiple patterns to learn
- ⚠️ More code than single-store solution

### Mitigation

- Clear documentation of when to use each pattern
- Consistent folder structure per feature

---

## References

- [store/settings-store.ts](../../store/settings-store.ts)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [TanStack Query](https://tanstack.com/query)
- [WXT Storage](https://wxt.dev/guide/storage.html)
