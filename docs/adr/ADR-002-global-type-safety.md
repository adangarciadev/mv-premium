# ADR-002: Type Safety for Global Window Properties

| Metadata      | Value              |
| ------------- | ------------------ |
| **Status**    | ✅ Accepted        |
| **Date**      | January 2026       |
| **Authors**   | MVP Team           |
| **Reviewers** | —                  |

---

## Context

The Mediavida website exposes several global properties on the `window` object that the extension needs to access:

- `window.sharedData` - Authenticated user data (nick, avatar, ID)
- `window.idpost` - Current post ID (on thread pages)
- `window.pageData` - Pagination and context data
- `window.post_edit` - Native function to edit posts
- `window.quote` - Native function to quote posts

The original code used `as any` casts to access these properties, which:

1. **Disabled TypeScript** at those critical points
2. **Hid errors** when accessing non-existent properties
3. **Prevented IDE autocompletion**
4. **Reduced confidence** in the project's typing

```typescript
// ❌ Before: No type safety
const nick = (window as any).sharedData?.nick
```

---

## Decision

Create a global type declaration file `types/global.d.ts` that extends the `Window` interface with Mediavida-specific properties:

```typescript
// types/global.d.ts
interface MediavidaSharedData {
nick: string
avatar: string
id: number
// ... other properties
}

interface MediavidaPageData {
// Define structure based on usage
}

declare global {
interface Window {
// Site data
sharedData?: MediavidaSharedData
pageData?: MediavidaPageData
idpost?: number

// Native forum functions
post_edit?: (postId: number) => void
quote?: (postId: number, author: string) => void

// Injected external libraries
Prism?: typeof import('prismjs')
hljs?: typeof import('highlight.js')
}
}

export {}
```

### TypeScript Configuration

Ensure the file is included in `tsconfig.json`:

```json
{
"include": ["types/**/*.d.ts", "**/*.ts", "**/*.tsx"]
}
```

---

## Alternatives Considered

### 1. Continue using `as any`

- ❌ **Rejected**: Defeats the purpose of TypeScript
- ❌ Doesn't prevent runtime errors

### 2. Create typed wrapper functions

```typescript
function getSharedData(): MediavidaSharedData | undefined {
return (window as any).sharedData
}
```

- ⚠️ Considered but rejected: Adds unnecessary indirection
- The global typing approach is cleaner and IDE-friendly

### 3. Use type guards at every access point

- ❌ **Rejected**: Too verbose and repetitive
- Pollutes the code with validation logic

---

## Consequences

### Positive

- ✅ **Full type safety** when accessing `window.sharedData`, etc.
- ✅ **IDE autocompletion** for global properties
- ✅ **Compile-time errors** when accessing non-existent properties
- ✅ **Self-documenting** - Types serve as documentation

### Negative

- ⚠️ Types must be maintained when Mediavida changes their globals
- ⚠️ Risk of types drifting from actual runtime values

### Mitigation

- Add runtime checks for critical properties
- Document source of truth for each global property

---

## References

- [types/global.d.ts](../../types/global.d.ts) - Type declarations
- [TypeScript Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
