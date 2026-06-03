# Cloud Data Map

Este documento inventaria los datos persistidos actualmente por MV Premium y propone una politica de backup/cloud sync futura. No describe un backend ni una implementacion de sincronizacion; su objetivo es definir que datos son portables, donde viven y que riesgos tienen.

La recomendacion principal es usar una allowlist explicita de datos de usuario y exportar valores descomprimidos. No se debe sincronizar "todo lo que empiece por `mvp-`", porque hoy hay secretos, caches, estado temporal y preferencias locales mezcladas en el almacenamiento de la extension.

## Fuentes de Persistencia

| Fuente | Uso actual | Canonica para backup |
| --- | --- | --- |
| `browser.storage.local` via `@wxt-dev/storage` | Fuente principal para settings, features, temas, drafts, pines y estadisticas. | Si, solo para claves allowlisted. |
| Zustand persist sobre WXT | `mvp-settings`, gestionado por `useSettingsStore` con `createJSONStorage` y adaptador WXT. | Si, filtrando campos sensibles. |
| Zustand persist por defecto | `mvp-profile`, persistido en `localStorage` por `store/profile-store.ts`. | No, es estado local de UI/dispositivo. |
| `localStorage` | Caches sincronas para early content scripts y nueva homepage. | No, son caches reconstruibles. |
| `sessionStorage` | Datos pendientes durante navegacion, por ejemplo prefill o tracking diferido. | No, es estado temporal. |
| Memoria | Caches de resumen IA y caches de sesion. | No, no es persistente. |
| IndexedDB | No se usa actualmente. | No aplica. |

## Datos Persistidos

### Ajustes Globales

| Dato | Clave / storage | Tipo principal | Lectura / escritura | Backup |
| --- | --- | --- | --- | --- |
| Ajustes de extension | `mvp-settings` en `browser.storage.local` via Zustand persist WXT | `Settings`, `SettingsState` | `useSettingsStore`, `getSettings`, `initCrossTabSync`, setters `setSetting`/`updateSettings` | Si, excluyendo claves API. |
| Color bold separado | `mvp-bold-color`, `mvp-bold-color-enabled` | `string`, `boolean` | `setBoldColor`, `setBoldColorEnabled`, `init-bold-color` | Si, si se mantiene separado de `mvp-settings`. |
| Tema UI resuelto/raw | `mvp-ui-theme`, `mvp-ui-theme-raw` | `Theme`, `ResolvedTheme` | `ThemeProvider`, `useStoredTheme`, `saveThemeMode` | Si. |
| Usuario actual detectado | `mvp-current-user` | `CurrentUser` | `detectAndSaveCurrentUser`, `getCurrentUser` | No, cache de identidad local. |

Campos sensibles dentro de `mvp-settings` que deben excluirse por defecto: `imgbbApiKey`, `tmdbApiKey`, `giphyApiKey` y `geminiApiKey`.

### Temas y Apariencia

| Dato | Clave / storage | Tipo principal | Lectura / escritura | Backup |
| --- | --- | --- | --- | --- |
| Tema custom de la UI | `mvp-theme-custom` | `CustomThemeState` | `useThemeStore.loadFromStorage`, `setActivePreset`, `setCustomColor`, `setCustomRadius` | Si. |
| Presets guardados de UI | `mvp-theme-saved-presets` | `ThemePreset[]` | `savedPresetsStorage`, `saveCurrentAsPreset`, `importPresets` | Si. |
| Fuente custom | `mvp-custom-font` | `string` | `customFontStorage`, `setCustomFont`, `lib/theme/fonts.ts` | Si. |
| Aplicar fuente globalmente | `mvp-apply-font-globally` | `boolean` | `applyFontGloballyStorage`, `setApplyFontGlobally` | Si. |
| Tamano de fuente de posts | `mvp-post-font-size` | `number` | `postFontSizeStorage`, `setPostFontSize`, early cache | Si. |
| Tema visual de Mediavida | `mvp-mv-theme` | `MvThemePersisted` | `useMvThemeStore`, `loadFromStorage`, `setEnabled`, `setGroupColor`, `applyPreset` | Si. |
| Presets MV Theme | `mvp-mv-theme-presets` | `MvThemePreset[]` | `getCompressed`, `setCompressed`, acciones de `useMvThemeStore` | Si, descomprimido. |
| CSS generado MV Theme | `mvp-mv-theme-css` | `string` comprimido | `regenerateAndCacheCSS`, `getCompressed`, `setCompressed` | No, cache regenerable. |

`mvp-mv-theme-css` puede ser grande, pero se deriva de `mvp-mv-theme` y `mvp-mv-theme-presets`; en import deberia regenerarse, como ya hace `regenerateMvThemeCSSAfterImport`.

### Contenido y Configuracion del Usuario

| Dato | Clave / storage | Tipo principal | Lectura / escritura | Backup |
| --- | --- | --- | --- | --- |
| Drafts, plantillas y carpetas | `mvp-drafts` | `DraftsData`, `Draft`, `DraftFolder` | `getDrafts`, `getDraft`, `createDraft`, `updateDraft`, `deleteDraft`, `getTemplates`, `onDraftsChanged`, `getCompressed`, `setCompressed` | Si, descomprimido. |
| Hilos guardados | `mvp-saved-threads` | `SavedThread[]` | `getSavedThreads`, `saveThread`, `unsaveThread`, `updateThreadNotes`, `watchSavedThreads` | Si. |
| Hilos ocultos | `mvp-hidden-threads` | `HiddenThread[]` | `getHiddenThreads`, `hideThread`, `unhideThread`, `clearHiddenThreads`, `watchHiddenThreads` | Si. |
| Subforos ocultos | `mvp-hidden-subforums` | `HiddenSubforum[]` | `getHiddenSubforums`, `hideSubforum`, `unhideSubforum`, `watchHiddenSubforums` | Si. |
| Reglas de contenido | `mvp-content-rules` | `ContentRule[]` | `getContentRules`, `createContentRule`, `updateContentRule`, `deleteContentRule`, `watchContentRules` | Si. |
| Personalizaciones de usuarios | `mvp-user-customizations` | `UserCustomizationsData`, `UserCustomization`, `GlobalRoleSettings` | `getUserCustomizations`, `saveUserCustomization`, `removeUserCustomization`, `watchUserCustomizations` | Si, con advertencia de privacidad. |
| Subforos favoritos | `mvp-favorite-subforums` | `FavoriteSubforum[]` | `getFavoriteSubforums`, `addFavoriteSubforum`, `removeFavoriteSubforum`, `watchFavoriteSubforums` | Si. |
| Posts anclados por hilo | `mvp-pinned-*` | `PinnedPost[]` | `getPinnedPosts`, `pinPost`, `unpinPost`, `getAllPinnedPosts`, `batchUnpinPosts` | Si, como lista normalizada. |
| Metadata de hilos con pines | `mvp-pinned-meta-*` | `ThreadMeta` | `getThreadMetadata`, `saveThreadMetadata` | Si, ligada a pines. |

Las claves de pines son dinamicas y contienen el path del hilo en la propia clave. Para cloud sync conviene convertirlas a una lista normalizada, por ejemplo `{ threadId, posts, metadata }`, en vez de transportar claves raw.

### Preferencias Pequenas

| Dato | Clave / storage | Tipo principal | Lectura / escritura | Backup |
| --- | --- | --- | --- | --- |
| Delay en live nativo | `mvp-native-live-delay` | `number` | `nativeLiveDelayStorage` | Si. |
| Delay en live custom | `mvp-live-thread-delay` | `number` | `loadLiveThreadDelayPreference`, `setLiveThreadDelay` | Si. |
| Foros recientes homepage | `mvp-homepage-recent-forums` | `string[]` | `getLatestVisitedForums`, `setLatestVisitedForum` | No, preferencia local/reciente. |
| Modo vista bookmarks | `mvp-bookmarks-view-mode` | `ViewMode` | `viewModeStorage` en bookmarks | No, UI local. |
| Live preview | `mvp-live-preview-enabled`, `mvp-live-preview-position` | `string` JSON | `useUIStore` | No, UI local. |
| Perfil UI | `mvp-profile` en `localStorage` | `ProfileStore` parcial | `useProfileStore` | No, UI local/dispositivo. |

### Estadisticas

| Dato | Clave / storage | Tipo principal | Lectura / escritura | Backup |
| --- | --- | --- | --- | --- |
| Tiempo por subforo | `mvp-time-stats` | `TimeStats` (`Record<subforumSlug, milliseconds>`) | `getTimeStats`, `watchTimeStats`, `timeStatsStorage` | Si. |
| Actividad granular / heatmap | `mvp-activity` | `ActivityData`, `ActivityEntry` | `trackActivity`, `getActivityData`, `watchActivity`, `clearActivityData` | No. |

`mvp-activity` no debe entrar en cloud sync. Puede contener titulos, subforos, URLs y acciones (`create`, `update`, `publish`), y ademas el tracking no es suficientemente fiable para tratarlo como dato portable. Para futuras copias cloud, conservar solo `mvp-time-stats`.

### Caches, Tokens y Estado Temporal

| Dato | Clave / storage | Tipo principal | Motivo de exclusion |
| --- | --- | --- | --- |
| Token IGDB/Twitch | `mvp-igdb-access-token`, `mvp-igdb-token-expiry` | `string`, `number` | Token OAuth cacheado y renovable. |
| Cache de iconos FID | `mvp-fid-icons-cache` | `Record<number, FidIconStyle>` | Cache reconstruible desde CSS de Mediavida. |
| Cache media/API | `mv-cache:*` | `CacheEntry<T>` | TTL, redescargable, puede crecer. |
| Cache homepage | `mvp-homepage-cache-v1` en `localStorage` | `HomepageCache` | Cache de datos de portada, redescargable. |
| Username cacheado | `cachedUsername` | `string` | Cache auxiliar sin prefijo `mvp-`. |
| Estado live por hilo | `mvp-live-threads` | `Record<string, LiveThreadState>` | Estado runtime por hilo/dispositivo. |
| Contenido editor temporal | `mvp-editor-preserve` | `EditorPreservedContent` | Puente de navegacion de 30 segundos. |
| Basket thread clipper | `mvp-thread-clipper-basket` | `ThreadClipperBasket` | Sesion temporal con expiracion de 1 hora. |
| Prefills pendientes | `mvp-pending-*` | Varios | Datos de navegacion/submit, no persistencia real. |
| Versiones vistas/migraciones | `mvp-last-seen-version`, `mvp-storage-version` | `string`, `number` | Estado local de producto/migracion. |

## Politica de Backup

### Incluir

- `mvp-settings`, despues de eliminar secretos.
- Temas y apariencia allowlisted: `mvp-ui-theme`, `mvp-ui-theme-raw`, `mvp-theme-custom`, `mvp-theme-saved-presets`, `mvp-custom-font`, `mvp-apply-font-globally`, `mvp-post-font-size`, `mvp-mv-theme`, `mvp-mv-theme-presets`.
- Contenido del usuario: `mvp-drafts`, `mvp-saved-threads`, `mvp-hidden-threads`, `mvp-hidden-subforums`, `mvp-content-rules`, `mvp-user-customizations`, `mvp-favorite-subforums`.
- Pines: todas las entradas `mvp-pinned-*` y `mvp-pinned-meta-*`, convertidas a estructura estable.
- Preferencias pequenas: `mvp-native-live-delay`, `mvp-live-thread-delay`.
- Estadisticas permitidas: `mvp-time-stats`.

### Excluir

- Secretos: `imgbbApiKey`, `tmdbApiKey`, `giphyApiKey`, `geminiApiKey`, `mvp-igdb-access-token`, `mvp-igdb-token-expiry`.
- Actividad granular: `mvp-activity`, incluyendo heatmap, acciones, titulos y URLs.
- Caches/runtime: `mvp-mv-theme-css`, `mvp-fid-icons-cache`, `mv-cache:*`, `mvp-homepage-cache-v1`, `cachedUsername`, `mvp-current-user`.
- Estado temporal: `mvp-editor-preserve`, `mvp-thread-clipper-basket`, `mvp-pending-*`, todo `sessionStorage`.
- Estado local/dispositivo: `mvp-profile`, `mvp-live-preview-*`, `mvp-bookmarks-view-mode`, `mvp-last-seen-version`, `mvp-storage-version`, `mvp-homepage-recent-forums`, `mvp-live-threads`.

## Riesgos

- **Secretos**: las claves API en `mvp-settings` permitirian uso de servicios externos si se filtran. Deben excluirse por defecto. Si algun dia se ofrece opt-in, deberia requerir cifrado y confirmacion explicita.
- **Privacidad social**: `mvp-user-customizations` puede incluir notas privadas, usuarios ignorados, avatares y colores de resaltado. Es backup-worthy, pero el usuario debe entender que revela preferencias sobre otros usuarios.
- **Contenido sensible**: `mvp-drafts` puede contener borradores privados, plantillas y texto no publicado. Debe sincronizarse solo dentro de un backup autenticado y transportado de forma segura.
- **Historial de navegacion/actividad**: `mvp-activity`, caches de homepage y caches API pueden revelar titulos, URLs, busquedas o contenido visto. Deben quedar fuera del cloud sync por defecto.
- **Tamano**: `mvp-drafts`, `mvp-activity`, `mvp-mv-theme-css` y presets comprimidos pueden crecer. Para backup, exportar `mvp-drafts` y presets descomprimidos, pero excluir caches y actividad granular.
- **Conflictos multi-dispositivo**: colecciones como drafts, pines, reglas y personalizaciones necesitan IDs estables y estrategia de merge. Este documento solo define el mapa; no define resolucion de conflictos.

## Formato JSON Propuesto

El backup futuro deberia ser un objeto versionado, por allowlist y con valores ya descomprimidos:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-03T00:00:00.000Z",
  "app": {
    "name": "mv-premium",
    "extensionVersion": "2.0.0"
  },
  "policy": {
    "secrets": "excluded",
    "activity": "time-stats-only",
    "compressedValues": "decompressed"
  },
  "data": {
    "settings": {
      "theme": "dark",
      "syncEnabled": false,
      "mutedWords": []
    },
    "themes": {
      "ui": {
        "resolvedTheme": "dark",
        "rawTheme": "dark",
        "custom": {
          "activePresetId": "mediavida",
          "customColorsLight": {},
          "customColorsDark": {}
        },
        "savedPresets": [],
        "customFont": "",
        "applyFontGlobally": false,
        "postFontSize": 100
      },
      "mediavida": {
        "state": {
          "enabled": false,
          "activePresetId": "original",
          "colorOverrides": {}
        },
        "savedPresets": []
      }
    },
    "content": {
      "drafts": {
        "drafts": [],
        "folders": []
      },
      "savedThreads": [],
      "hiddenThreads": [],
      "hiddenSubforums": [],
      "contentRules": [],
      "userCustomizations": {
        "users": {},
        "globalSettings": {}
      },
      "favoriteSubforums": [],
      "pinnedPosts": [
        {
          "threadId": "/foro/cine/example-123",
          "metadata": {
            "title": "Example",
            "subforumSlug": "cine",
            "subforumName": "Cine"
          },
          "posts": []
        }
      ]
    },
    "preferences": {
      "nativeLiveDelay": 0,
      "liveThreadDelay": 0
    },
    "stats": {
      "timeStats": {}
    }
  },
  "excluded": {
    "secretFields": ["imgbbApiKey", "tmdbApiKey", "giphyApiKey", "geminiApiKey"],
    "storageKeys": [
      "mvp-igdb-access-token",
      "mvp-igdb-token-expiry",
      "mvp-activity",
      "mvp-mv-theme-css",
      "mvp-fid-icons-cache",
      "mvp-current-user",
      "mvp-editor-preserve",
      "mvp-thread-clipper-basket",
      "mvp-profile",
      "mvp-bookmarks-view-mode",
      "mvp-last-seen-version",
      "mvp-storage-version",
      "mvp-homepage-recent-forums",
      "mvp-live-threads"
    ],
    "patterns": ["mv-cache:*", "mvp-pending-*", "mvp-live-preview-*"]
  }
}
```

## Relacion con Export/Import Actual

`entrypoints/options/lib/export-import.ts` ya exporta una snapshot descomprimida usando `getDecompressedSnapshot()` y filtra claves con prefijo `mvp-`. Ese flujo es util como antecedente para backup manual, pero no debe reutilizarse tal cual para cloud sync porque:

- Exporta por filtro amplio de prefijo, no por allowlist.
- Puede incluir secretos dentro de `mvp-settings`.
- Puede incluir datos locales o temporales que empiecen por `mvp-`.
- Solo excluye unas pocas claves explicitas, como `mvp-bookmarks-view-mode` y `mvp-mv-theme-css`.

Para cloud sync, el flujo futuro deberia construir `data` desde funciones tipadas por familia, filtrar campos sensibles antes de serializar y regenerar caches tras importar.

