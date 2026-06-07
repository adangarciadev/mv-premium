# Mobile Lite Ignored Users

## Scope

Mobile Lite can apply ignored users on Firefox Android by reusing the existing desktop
customization storage. It also lets users add or change ignored users from mobile through
Mediavida's native user card.
Mobile Lite also injects a `Panel MVPremium` entry into Mediavida's mobile user menu for managing
filtered users without leaving the current page.

Runtime guards:

- Platform must be `firefox-android`.
- `mobileLiteEnabled` must be `true`.
- No new permissions are required.

## Storage

The feature reads the existing user customizations storage:

- WXT key: `local:mvp-user-customizations`.
- Physical `browser.storage.local` key: `mvp-user-customizations`.

Relevant shape:

```ts
interface UserCustomization {
	isIgnored?: boolean
	ignoreType?: 'hide' | 'mute'
}

interface UserCustomizationsData {
	users: Record<string, UserCustomization>
}
```

Username matching is case-insensitive and uses the username from the author link URL.

## Mobile DOM Selectors

Post containers:

- `.post[data-num]`
- `.rep[data-num]`
- `div[id^="post-"]`

Author links, in priority order:

- `.post-meta a.autor[href^="/id/"]`
- `.post-header a.autor[href^="/id/"]`
- `a.autor[href^="/id/"]`

The username is extracted from `href="/id/Username"` instead of the visible text. This avoids
breakage when desktop custom nicknames or site rendering change the displayed username.

## Behavior

- `ignoreType: 'hide'` hides the full post container with the existing `mvp-ignored-user` class.
- `ignoreType: 'mute'` applies the existing muted placeholder behavior and injects only the
  minimum CSS needed for Mobile Lite.
- Missing `ignoreType` defaults to `hide`, matching the existing desktop behavior.
- Tapping an author nickname keeps Mediavida's native user card behavior.
- When the native user card appears, Mobile Lite adds `Silenciar` and `Ocultar` to the card.
- Active actions toggle their own filter: tapping `Silenciado` or `Oculto` clears that filter.
- After applying a Mobile Lite user action, the native card is dismissed.
- Manual changes preserve existing desktop customizations for the same user, such as notes,
  colors, badges or avatar cache.
- The mobile user menu includes `Panel MVPremium`, which opens an in-page Shadow DOM panel with:
  - a local search over filtered users,
  - exact-nickname add actions for `Silenciar` and `Ocultar`,
  - per-user controls to switch between `Silenciar`, `Ocultar`, or `Quitar`.
- Storage changes are watched with the existing WXT storage watcher and re-applied in place.
- Newly added posts are handled through a debounced `MutationObserver`.

## Limitations

- The Mobile Lite panel does not perform remote Mediavida user search yet; exact nicknames can be
  typed manually.
- The feature depends on Mediavida keeping author links in the `/id/Username` format.
- If Mediavida changes the post container structure, ignored users may stop applying until
  selectors are updated.
- The Mobile Lite implementation intentionally does not activate the full desktop
  user-customizations module, so custom nicknames, badges, notes, and role colors are not ported.

## Future Work

- Add remote Mediavida user search/autocomplete to the Mobile Lite panel.
- Revisit the mute placeholder UX on touch screens after real-device testing.
- Keep advanced editor features out of Mobile Lite unless explicitly scoped.

## Dev Seed

Firefox Android remote DevTools may not expose extension storage editing reliably. For local
testing only, Mobile Lite supports this hash:

```text
#mvp_mobile_lite_ignored_test=enable
```

When opened on Firefox Android, it merges these users into `mvp-user-customizations`:

- `ClauDeS`: `isIgnored=true`, `ignoreType='hide'`.
- `silentMike`: `isIgnored=true`, `ignoreType='mute'`.

It does not remove existing user customizations and the hash is cleaned from the URL after it is
processed. The usual Mobile Lite platform and feature guards still apply to the actual hide/mute
behavior.
