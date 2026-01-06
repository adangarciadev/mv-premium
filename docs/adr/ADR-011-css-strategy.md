# ADR-011: Dual CSS Strategy (Shadow DOM + Global)

| Metadata    | Value             |
| ----------- | ----------------- |
| **Status**  | ✅ Accepted       |
| **Date**    | January 2026      |
| **Authors** | MV Premium Team   |

## Context

The extension injects UI into mediavida.com, which has its own CSS styles. This creates conflicts:

1. **Tailwind Preflight** resets global styles → Breaks native forum design
2. **Forum CSS specificity** can affect our components → Inconsistent UI
3. **Dynamic forum themes** (light/dark) must coexist with extension themes

## Decision

### 2-Stylesheet Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     mediavida.com                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ GLOBAL (Light DOM)                                        │  │
│  │                                                           │  │
│  │  ├─ app.css (NO Preflight)                                │  │
│  │  │   └─ Utilities + components only                       │  │
│  │  │   └─ Variables --mv-* for native tokens                │  │
│  │  │                                                        │  │
│  │  └─ Mediavida styles (untouched)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SHADOW DOM (Isolated)                     <ShadowWrapper> │  │
│  │                                                           │  │
│  │  └─ shadow.css (WITH Preflight)                           │  │
│  │      └─ @tailwind base (full reset)                       │  │
│  │      └─ @tailwind components                              │  │
│  │      └─ @tailwind utilities                               │  │
│  │      └─ Shadcn variables (--background, --primary, etc.)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Files and Responsibilities

| File         | Preflight | Scope      | Purpose                                          |
| ------------ | --------- | ---------- | ------------------------------------------------ |
| `shadow.css` | ✅ YES    | Shadow DOM | Full extension UI (Modals, Cards, Sidebars)      |
| `app.css`    | ❌ NO     | Global     | Site modifications (hide ads, layout tweaks)     |
| `theme.css`  | N/A       | Variables  | Shared tokens imported by both                   |

### 1. Shadow CSS (Total Isolation)

```css
/* assets/shadow.css */
@tailwind base; /* ✅ Preflight included */
@tailwind components;
@tailwind utilities;

:root,
:host {
/* Shadcn variables for UI components */
--background: #ffffff;
--foreground: #0a0a0b;
--primary: #18181b;
--card: #ffffff;
--border: #e4e4e7;
--radius: 0.625rem;
/* ... */
}

.dark {
--background: #09090b;
--foreground: #fafafa;
/* ... */
}
```

### 2. App CSS (No Reset)

```css
/* assets/app.css */
@import './theme.css';

/* NO @tailwind base - avoids breaking forum styles */
@tailwind components;
@tailwind utilities;

@layer components {
:root {
/* Mediavida tokens for integration */
--mv-bg-primary: #101213;
--mv-accent: #11a222;
--mv-border: #30353a;
/* ... */
}
}

/* Global modifications to forum */
.ad-container {
display: none !important;
}
```

### 3. ShadowWrapper Component

All extension UI components use the wrapper:

```tsx
// components/shadow-wrapper.tsx
import { ShadowRoot } from '@/lib/shadow-root'
import { SHADOW_CSS } from '@/assets/shadow-styles'

export function ShadowWrapper({ children, className }) {
const theme = useStoredTheme()

return (
<ShadowRoot
styles={SHADOW_CSS} // Full shadow.css
className={className}
data-theme={theme}
>
{children}
</ShadowRoot>
)
}
```

### 4. When to Use Each Scope

#### Shadow DOM (ShadowWrapper) ✅

- Modals and dialogs
- Floating sidebars
- Preview cards (Hover Cards)
- Popovers and dropdowns
- Any complex UI with Shadcn

```tsx
// ✅ Correct: Isolated UI
<ShadowWrapper>
<Card>
<CardHeader>Title</CardHeader>
<CardContent>...</CardContent>
</Card>
</ShadowWrapper>
```

#### Light DOM (Global) ✅

- Buttons that integrate with native toolbar
- Inline icons in posts
- Badges next to forum elements

```tsx
// ✅ Correct: Native integration
<button className="fa fa-bookmark" onClick={...}>
  {/* Uses Mediavida's FontAwesome classes */}
</button>
```

#### ❌ Anti-pattern

```tsx
// ❌ INCORRECT: Tailwind in Light DOM without Shadow
document.body.innerHTML += `
  <div class="p-4 bg-card rounded-lg shadow-md">
    This will look broken (no Preflight)
  </div>
`
```

## Shared CSS Variables

For themes to work in both scopes:

```css
/* theme.css - Imported by app.css and shadow.css */
:root {
--radius: 0.625rem;
--font-sans: 'proxima-nova', sans-serif;

/* Forum tokens */
--mv-accent: #11a222;
--mv-danger: #e02f2f;
}
```

## Theme Synchronization

Theme (light/dark) syncs between:

1. **Settings Store** → User chooses in dashboard
2. **Storage** → Persisted in `chrome.storage.local`
3. **ShadowWrapper** → Reads theme and applies `data-theme`

```typescript
// hooks/use-stored-theme.ts
export function useStoredTheme(): 'light' | 'dark' {
const [theme, setTheme] = useState<'light' | 'dark'>('dark')

useEffect(() => {
// Read from storage
storage.getItem('local:theme').then(setTheme)
// Listen for changes
return storage.watch('local:theme', setTheme)
}, [])

return theme
}
```

## Alternatives Considered

### 1. CSS-in-JS (Emotion, styled-components)

- ❌ Larger bundle
- ❌ Runtime overhead
- ❌ Doesn't leverage Tailwind ecosystem

### 2. CSS Modules

- ⚠️ Works, but less flexible
- ❌ Doesn't solve Preflight problem
- ❌ Not compatible with Shadcn out-of-the-box

### 3. Tailwind Prefix (`tw-`)

- ⚠️ Avoids name collisions
- ❌ Doesn't prevent Preflight from breaking forum
- ❌ More verbose classes

### 4. Everything in Shadow DOM

- ⚠️ Maximum isolation
- ❌ Impossible to integrate buttons with native toolbar
- ❌ More complexity for simple elements

## Consequences

### Positive

- ✅ Extension UI 100% predictable (Shadow DOM)
- ✅ Forum doesn't break (no global Preflight)
- ✅ Themes work in both contexts
- ✅ Compatible with Shadcn/Tailwind without modifications

### Negative

- ⚠️ Two CSS files to maintain
- ⚠️ Must know which scope to use

### Mitigation

- Clear documentation
- `ShadowWrapper` abstracts complexity

---

## References

- [assets/shadow.css](../../assets/shadow.css)
- [assets/app.css](../../assets/app.css)
- [assets/theme.css](../../assets/theme.css)
- [components/shadow-wrapper.tsx](../../components/shadow-wrapper.tsx)
