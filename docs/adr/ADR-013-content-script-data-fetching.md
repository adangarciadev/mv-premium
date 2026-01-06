# ADR-013: Server State in Content Script (Without TanStack Query)

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension uses **TanStack Query** in Options Page for server state management (cache, loading states, automatic refetch). However, the Content Script has features that also require data fetching:

| Feature               | Fetching Type          | Frequency                |
| --------------------- | ---------------------- | ------------------------ |
| **Live Thread**       | Polling every 2-5s     | Continuous while active  |
| **Infinite Scroll**   | On-demand when scrolling| Once per page           |
| **Media Hover Cards** | On hover               | Sporadic                 |
| **GIF Picker**        | On search              | Sporadic                 |

### Key Question

Should we include TanStack Query in the Content Script bundle to handle these cases?

## Decision

**DO NOT use TanStack Query in Content Script.** Instead:

1. **Polling**: Recursive `setTimeout` with adaptive intervals
2. **Fetch on demand**: Simple async functions with manual cache
3. **Cache**: In-memory `Map` or `cachedFetch()` helper

### Justification by Feature

#### Live Thread - Manual Polling

```typescript
// ✅ Current implementation (live-thread-polling.ts)
let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
let currentPollInterval = POLL_INTERVALS.NORMAL

function scheduleNextPoll(): void {
if (!isLiveActive) return
if (pollTimeoutId) clearTimeout(pollTimeoutId)
pollTimeoutId = setTimeout(() => void pollForNewPosts(), currentPollInterval)
}

// Adaptive intervals based on thread activity
function calculatePollInterval(): number {
const timeSinceLastPost = Date.now() - lastPostTimestamp
if (timeSinceLastPost < 30_000) return POLL_INTERVALS.HIGH_ACTIVITY // 5s
if (timeSinceLastPost < 120_000) return POLL_INTERVALS.NORMAL // 10s
if (timeSinceLastPost < 600_000) return POLL_INTERVALS.LOW_ACTIVITY // 20s
return POLL_INTERVALS.INACTIVE // 45s - very inactive thread
}

// Polling CONTINUES in background - only visual indicator changes
document.addEventListener('visibilitychange', () => {
if (document.hidden) {
statusUpdateCallback?.('paused') // Visual only, does NOT stop polling
} else {
// On return: immediate poll to show accumulated posts
if (pollTimeoutId) clearTimeout(pollTimeoutId)
void pollForNewPosts()
}
})
```

> **IMPORTANT**: Polling **is NOT paused** when tab is in background. Posts
> continue to be inserted into DOM even if user doesn't see them. Browsers throttle
> `setTimeout` in background tabs (~1 execution/minute), but posts accumulate
> correctly and appear when user returns to tab.

**Why not TanStack Query?**

```typescript
// ❌ With TanStack Query it would be:
const { data } = useQuery({
queryKey: ['thread', threadId, 'posts'],
queryFn: () => fetchPosts(threadId),
refetchInterval: 3000, // Fixed interval
})
```

| Aspect                 | Manual                             | TanStack Query                      |
| ---------------------- | ---------------------------------- | ----------------------------------- |
| Adaptive intervals     | ✅ 5s/10s/20s/45s based on activity| ❌ Fixed or complex config required |
| Works in background    | ✅ Yes (throttled by browser)      | ⚠️ Depends on config                |
| DOM control            | ✅ Direct post insertion           | ❌ Component re-render              |
| Bundle size            | ✅ 0KB                             | ❌ +15-20KB                         |

#### Infinite Scroll - Fetch On Demand

```typescript
// ✅ Current implementation (infinite-scroll.tsx)
// IntersectionObserver detects scroll to end
const observer = new IntersectionObserver(entries => {
if (entries[0].isIntersecting) {
loadNextPage() // Simple fetch, no cache (each page is unique)
}
})
```

**Why not TanStack Query?**

- Each page is fetched **only once**
- HTML is cached in memory (`pageBlocks.cachedHTML`)
- No refetch or invalidation needed
- TanStack Query would add overhead with no benefit

#### Media Hover Cards & GIF Picker - Manual Cache

```typescript
// ✅ Current implementation (services/media/cache.ts)
export async function cachedFetch<T>(
key: string,
fetcher: () => Promise<T>,
options: { prefix: string; ttl: number }
): Promise<T> {
const cached = getFromCache(key)
if (cached) return cached

const data = await fetcher()
setCache(key, data, options.ttl)
return data
}

// Usage in TMDB service
async function fetchTMDB<T>(endpoint: string, params = {}, ttl = CACHE_TTL.MEDIUM) {
const cacheKey = createCacheKey(endpoint, JSON.stringify(params))
return cachedFetch(cacheKey, () => fetchTMDBViaBackground<T>(endpoint, params), {
prefix: 'mv-tmdb-v2',
ttl,
})
}
```

**Why not TanStack Query?**

- Requests go to Background Script (for CORS and security)
- Simple TTL cache is sufficient
- No complex mutations or invalidations

## Bundle Comparison

| Library               | Size (gzip) | Use in Content Script |
| --------------------- | ----------- | --------------------- |
| TanStack Query        | ~15-20KB    | ❌ Not included       |
| Custom cache          | ~1KB        | ✅ `cachedFetch()`    |
| setTimeout/setInterval| 0KB         | ✅ Native             |

**Total impact**: ~15-20KB savings in Content Script bundle.

## When TO Use TanStack Query

TanStack Query **is used** in Options Page because:

- More complex UI (lists, searches, pagination)
- Multiple queries that invalidate each other
- Declarative loading/error states
- Bundle size not critical (separate file)

```typescript
// Options Page - TanStack Query appropriate
export function useMovieSearch(query: string) {
return useQuery({
queryKey: ['tmdb', 'search', query],
queryFn: () => searchMovies(query),
staleTime: 5 * 60 * 1000,
})
}
```

## Alternatives Considered

### 1. TanStack Query in Content Script

- ❌ +15-20KB bundle
- ❌ Overhead for simple cases
- ❌ Less control over adaptive polling

### 2. SWR (lighter alternative)

- ⚠️ ~8KB, better than TanStack
- ❌ Still unnecessary overhead
- ❌ Doesn't solve adaptive polling problem

### 3. Manual implementation (CHOSEN)

- ✅ 0KB extra
- ✅ Total control over timing
- ✅ Optimized for each use case
- ⚠️ More code to maintain

## Consequences

### Positive

- ✅ Content Script bundle ~15KB smaller
- ✅ Adaptive polling (impossible out-of-the-box with TanStack)
- ✅ Fine control over visibilitychange, cleanup, etc.
- ✅ Features work offline with cached data

### Negative

- ⚠️ More manual code for caching
- ⚠️ No automatic refetch on focus (must implement manually)
- ⚠️ Developers need to understand different patterns

### Mitigation

- `cachedFetch()` helper abstracts common patterns
- Clear documentation of when to use what
- Consistent patterns across features

---

## References

- [features/live-thread/logic/live-thread-polling.ts](../../features/live-thread/logic/live-thread-polling.ts)
- [services/media/cache.ts](../../services/media/cache.ts)
- [ADR-005: LiteAppProvider vs AppProvider](./ADR-005-lite-vs-full-provider.md)
- [TanStack Query Documentation](https://tanstack.com/query)
