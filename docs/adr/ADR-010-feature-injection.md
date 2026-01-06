# ADR-010: Feature Injection Architecture

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension injects multiple features into mediavida.com. Each feature has different requirements:

1. **Scope**: Some features are global (Command Menu), others only in threads (Infinite Scroll)
2. **Timing**: Some must load immediately, others can wait
3. **Dependencies**: Some require specific DOM elements to exist
4. **Performance**: Initial bundle should be as small as possible

## Decision

### 1. Centralized Orchestrator: `run-injections.ts`

All injections are coordinated from a single file that:

- Receives a pre-calculated `PageContext` (avoids repeated regex)
- Decides which features to load based on URL
- Uses dynamic imports for code splitting

```
┌─────────────────────────────────────────────────────────────────┐
│                     main.content.tsx                            │
│                                                                 │
│   1. Calculate PageContext (once)                               │
│   2. Call runInjections(ctx, pageContext)                       │
│   3. Observe DOM mutations → re-run runInjections               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     run-injections.ts                           │
│                                                                 │
│   GLOBAL FEATURES (once)                                        │
│   ├─ Command Menu        ─────────────────────────────┐         │
│   ├─ User Customizations                              │         │
│   ├─ Dashboard Button                                 │ Dynamic │
│   ├─ New Thread Button                                │ Imports │
│   └─ Global Shortcuts                                 │         │
│                                                       ▼         │
│   CONDITIONAL FEATURES                           ┌────────┐     │
│   ├─ Editor (hasEditor?)   ──────────────────────│ Bundle │     │
│   ├─ Code Blocks (hasCode?)                      │ Chunks │     │
│   ├─ Thread Features (isThread?)                 └────────┘     │
│   └─ Profile Features (isProfile?)                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Pre-calculated PageContext

To avoid running URL regex in each feature:

```typescript
export interface PageContext {
isThread: boolean // /foro/[subforum]/[id]-[slug]
isCine: boolean // /foro/cine
isFavorites: boolean // /foro/favoritos
isForumGlobalView: boolean // /foro/spy, /foro/new, etc.
isForumList: boolean // /foro
isSubforum: boolean // /foro/[subforum]
isHomepage: boolean // /
isMediaForum: boolean // /foro/cine/* or /foro/tv/*
// ...
}
```

Calculated ONCE in `main.content.tsx` and passed to `runInjections()`.

### 3. Loading Strategy by Type

#### Global Features (immediate load, once)

```typescript
if (!globalFeaturesInitialized) {
globalFeaturesInitialized = true

import('@/features/command-menu/logic/inject-command-menu').then(({ injectCommandMenu }) => injectCommandMenu())

import('@/features/shortcuts').then(({ initGlobalShortcuts }) => initGlobalShortcuts())
}
```

- ✅ Only run once (flag `globalFeaturesInitialized`)
- ✅ Dynamic import to not block initial bundle
- ✅ Parallel execution (don't wait for each other)

#### Conditional Features (URL-based)

```typescript
if (pageContext?.isThread) {
const results = await Promise.allSettled([
import('@/features/pinned-posts/logic/pin-posts'),
import('@/features/infinite-scroll'),
import('@/features/gallery'),
// ...
])

// Process results individually
if (pinnedPosts.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.PinnedPosts)) {
pinnedPosts.value.initPinButtonsObserver()
}
}
```

- ✅ Only loaded on relevant pages
- ✅ `Promise.allSettled` = one failed feature doesn't break others
- ✅ Feature Flags allow disabling features individually

#### DOM-based Features (can re-run)

```typescript
const hasEditor = document.querySelector('textarea#cuerpo')
if (hasEditor) {
import('@/features/editor/logic/editor-toolbar').then(({ injectEditorToolbar }) => injectEditorToolbar())
}
```

- ✅ Re-evaluated on each DOM mutation
- ✅ Support dynamically loaded content (AJAX)
- ⚠️ `inject*` functions must be idempotent

### 4. Feature Module Pattern

Each feature exports `inject*` functions that:

1. Are **idempotent** (can be called multiple times without duplicating UI)
2. Manage their own lifecycle (mount/unmount if React)
3. Have no side effects on import (only on execution)

```typescript
// features/gallery/index.ts

import { FEATURE_IDS } from '@/constants/feature-ids'
import { mountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'

export function injectGalleryTrigger() {
// Guard: prevent duplicates
if (isFeatureMounted(FEATURE_IDS.GALLERY_TRIGGER)) return

// Create container
const container = document.createElement('div')
document.body.appendChild(container)

// Mount React (with automatic cleanup)
mountFeature(FEATURE_IDS.GALLERY_TRIGGER, container, <GalleryTrigger />)
}
```

### 5. Feature Flags Integration

Each conditional feature checks its flag before initializing:

```typescript
import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'

if (infiniteScroll.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.InfiniteScroll)) {
infiniteScroll.value.injectInfiniteScroll(ctx)
}
```

This allows:

- Disabling features without code changes
- A/B testing of features
- Quick rollback if bugs occur

## Execution Flow

```
┌─────────────────────┐
│ User navigates to   │
│ mediavida.com/foro/ │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ WXT injects         │
│ main.content.tsx    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Calculate PageContext│
│ {isSubforum: true}  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ runInjections()     │
├─────────────────────┤
│ 1. Global Features  │ ──── Command Menu, Dashboard
│ 2. Subforum Check   │ ──── Favorite Subforums
│ 3. Thread Check     │ ──── (skip, not a thread)
└─────────────────────┘
```

## Alternatives Considered

### 1. All features in single bundle

- ❌ **Rejected**: 2MB+ bundle for every page
- ❌ Slow initial load

### 2. Feature-per-content-script

```
// wxt.config.ts
matches: {
  'threads': '*://*.mediavida.com/foro/*/*',
  'editor': '*://*.mediavida.com/foro/post*',
}
```

- ⚠️ Considered but rejected
- Complex manifest management
- Harder to share code between features

### 3. Web Components (no React)

- ❌ **Rejected**: Lose React ecosystem
- ❌ Less developer productivity

## Consequences

### Positive

- ✅ **Small initial bundle** (~200KB vs 2MB+)
- ✅ **Fast page load** (only needed features)
- ✅ **Isolated failures** (one feature crash doesn't break others)
- ✅ **Easy to add features** (follow the pattern)

### Negative

- ⚠️ More complex initialization logic
- ⚠️ Async loading means slight delay for some features

### Mitigation

- Critical features (Command Menu) load first
- Loading indicators for async features

---

## References

- [entrypoints/content/run-injections.ts](../../entrypoints/content/run-injections.ts)
- [constants/feature-ids.ts](../../constants/feature-ids.ts)
- [lib/content-modules/utils/react-helpers.ts](../../lib/content-modules/utils/react-helpers.ts)
