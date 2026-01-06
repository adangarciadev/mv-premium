# ADR-005: LiteAppProvider vs AppProvider

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The extension injects multiple React components into different parts of Mediavida:

- Floating sidebars (Cinema, Gallery)
- Modals (Bookmarks, Command Menu)
- Injected buttons (Save Thread, Summarize)
- Full dashboard (Options page)

All these components need access to:

- **ThemeProvider**: For dark/light mode
- **ThemeColorsProvider**: For user custom colors
- **Error Boundaries**: For graceful error handling
- **Toaster**: For toast notifications

Some components **also** need:

- **QueryClientProvider** (TanStack Query): For data fetching with cache
- **Cross-tab sync**: To sync settings between tabs

### Problem

**TanStack Query adds ~50KB** to the bundle. If we include it in all injected components:

```
Content Script Bundle:
├── React + ReactDOM: ~150KB
├── Shadcn UI + Tailwind: ~100KB
├── Features code: ~400KB
├── TanStack Query: ~50KB  ← Unnecessary for many features
└── Total: ~700KB vs ~650KB without Query
```

The problem is amplified because:

1. The content script loads on **every page** of Mediavida
2. Many simple features (buttons, toggles) **don't need Query**
3. Only features with complex fetching (Cinema, Gallery) require it

---

## Decision

Create **two levels of providers**:

### LiteAppProvider (Content Scripts - Default)

```tsx
// providers/lite-app-provider.tsx
export function LiteAppProvider({ children }) {
return (
<ThemeProvider>
<ThemeColorsProvider>
<AppErrorBoundary>{children}</AppErrorBoundary>
<Toaster /> {/* Only first instance */}
</ThemeColorsProvider>
</ThemeProvider>
)
}
```

**Includes:**

- ✅ ThemeProvider (dark/light mode)
- ✅ ThemeColorsProvider (custom colors)
- ✅ AppErrorBoundary
- ✅ Toaster (singleton)

**Does NOT include:**

- ❌ QueryClientProvider
- ❌ Cross-tab sync

### AppProvider (Options Page, Features with Query)

```tsx
// providers/app-provider.tsx
export function AppProvider({ children }) {
return (
<ThemeProvider>
<ThemeColorsProvider>
<QueryClientProvider client={queryClient}>
<AppErrorBoundary>{children}</AppErrorBoundary>
<Toaster />
</QueryClientProvider>
</ThemeColorsProvider>
</ThemeProvider>
)
}
```

**Includes everything from LiteAppProvider plus:**

- ✅ QueryClientProvider
- ✅ Cross-tab sync for settings

### Usage

```tsx
// Content script - simple feature (e.g., save thread button)
// Uses LiteAppProvider automatically via mountFeature()
mountFeature('save-thread', container, <SaveThreadButton />)

// Content script - feature with fetching (e.g., Cinema)
// Must use AppProvider explicitly
<AppProvider>
  <CinemaSidebar />
</AppProvider>

// Options page - Full dashboard
// Always uses AppProvider
<AppProvider>
  <OptionsApp />
</AppProvider>
```

---

## Alternatives Considered

### 1. Single AppProvider for everything

- ❌ **Rejected**: Unnecessarily large bundle
- ❌ TanStack Query loaded even when not used

### 2. Lazy loading of QueryClientProvider

- ⚠️ Considered but rejected
- Complexity to handle state between lazy loads
- Doesn't save as much as two separate providers

### 3. Custom context without TanStack Query

- ❌ **Rejected**: Reinventing the wheel
- TanStack Query has cache, deduplication, automatic refetch

### 4. No providers (props drilling)

- ❌ **Rejected**: Unmaintainable with 20+ features
- Would require passing theme/toast through every component

---

## Consequences

### Positive

- ✅ **~50KB smaller** content script for simple features
- ✅ **Faster load** on pages that don't need Query
- ✅ **Clear separation** of concerns
- ✅ **Same DX** - Both providers have identical API for common features

### Negative

- ⚠️ Developers must know which provider to use
- ⚠️ Can't upgrade from Lite to Full at runtime

### Mitigation

- Document clearly when to use each provider
- Lint rule to check provider usage

---

## References

- [providers/lite-app-provider.tsx](../../providers/lite-app-provider.tsx)
- [providers/app-provider.tsx](../../providers/app-provider.tsx)
- [TanStack Query Documentation](https://tanstack.com/query)
