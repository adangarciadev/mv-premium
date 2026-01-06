# ADR-006: CSS Isolation with Shadow DOM

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The extension injects React components with Tailwind CSS and Shadcn UI directly into Mediavida pages. This presents a **style conflict**:

### The Problem

```html
<!-- Mediavida has its own styles -->
<style>
.btn {
background: red;
padding: 10px;
} /* MV styles */
p {
margin: 0;
}
* {
box-sizing: content-box;
} /* Legacy! */
</style>

<!-- We inject -->
<div class="btn p-4 rounded-md">
<!-- Tailwind classes -->
Our button
</div>

<!-- Result: CHAOS -->
<!-- - MV's .btn applies background: red -->
<!-- - Tailwind's p-4 doesn't work without reset -->
<!-- - Incorrect box-sizing breaks layouts -->
```

### Specific Mediavida Issues

1. **Incompatible CSS Reset**: MV uses `box-sizing: content-box` globally
2. **Generic classes**: `.btn`, `.panel`, `.box` collide
3. **Scattered !important**: Hard to override
4. **Inline styles**: Some elements have hardcoded styles

---

## Decision

Use **Shadow DOM** to completely encapsulate extension styles.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Light DOM (Mediavida)                                  │
│  ├── Mediavida styles                                   │
│  ├── <div id="mv-premium-root">  ← Host Element         │
│  │      └── #shadow-root (open/closed)                  │
│  │            ├── <style>Tailwind Reset + Utils</style> │
│  │            ├── <style>Theme Variables</style>        │
│  │            └── <div class="dark">                    │
│  │                  └── <Button>Shadcn Button</Button>  │
│  │                                                      │
│  │          ↑ ISOLATED from external styles             │
│  └──────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. ShadowWrapper Component

```tsx
// components/shadow-wrapper.tsx
export function ShadowWrapper({ children, className }) {
const hostRef = useRef<HTMLDivElement>(null)
const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

useEffect(() => {
if (hostRef.current && !hostRef.current.shadowRoot) {
const shadow = hostRef.current.attachShadow({
mode: import.meta.env.DEV ? 'open' : 'closed',
})
setShadowRoot(shadow)
}
}, [])

return (
<div ref={hostRef} className={className}>
{shadowRoot &&
createPortal(
<>
<style>{shadowStyles}</style> {/* Tailwind + Theme */}
<div className="dark">{children}</div>
</>,
shadowRoot
)}
</div>
)
}
```

#### 2. Separate Styles

```
assets/
├── shadow.css    # Full Tailwind + Reset (for Shadow DOM)
├── app.css       # MV modifications (no reset, Light DOM)
└── theme.css     # Shared CSS variables
```

#### 3. Keyboard Event Firewall

```tsx
// Shadow DOM blocks keyboard events to prevent
// MV from intercepting shortcuts when typing in inputs
const preventBubbling = useCallback((e: React.KeyboardEvent) => {
e.stopPropagation()
}, [])

return (
<div onKeyDown={preventBubbling} onKeyUp={preventBubbling}>
{children}
</div>
)
```

---

## Alternatives Considered

### 1. CSS Modules / BEM Naming

- ❌ **Rejected**: Doesn't protect against MV's `!important`
- ❌ Tailwind utilities still collide

### 2. Prefix all classes

```css
.mvp-btn {
...;
} /* mvp- prefix */
```

- ⚠️ Considered but rejected
- Requires modifying all Tailwind config
- Still doesn't solve Preflight issue

### 3. iframe isolation

- ❌ **Rejected**: Communication overhead with parent
- ❌ Loses access to page context
- ❌ Breaks keyboard shortcuts

### 4. CSS-in-JS (Emotion/styled-components)

- ❌ **Rejected**: Runtime overhead
- ❌ Larger bundle
- ❌ Different paradigm from Tailwind

---

## Consequences

### Positive

- ✅ **100% predictable UI** inside Shadow DOM
- ✅ **Forum doesn't break** (no global Preflight)
- ✅ **Themes work** in both contexts
- ✅ **Compatible with Shadcn/Tailwind** without modifications

### Negative

- ⚠️ **Complexity**: Extra wrapper for every injected component
- ⚠️ **Debugging**: Shadow DOM in DevTools requires extra clicks
- ⚠️ **Event handling**: Some events need manual propagation

### Mitigation

- `ShadowWrapper` component abstracts complexity
- DevTools Shadow DOM mode enabled by default in dev
- Event firewall handles common cases

---

## References

- [components/shadow-wrapper.tsx](../../components/shadow-wrapper.tsx)
- [lib/shadow-root.tsx](../../lib/shadow-root.tsx)
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
