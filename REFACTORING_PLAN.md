# Plan de Refactorización - Mediavida Premium Extension

> **Última actualización:** 2026-01-03
> **Estado general:** ✅ Completado

---

## Resumen de Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Eliminar tipos `any` y crear tipado estricto | ✅ Completado |
| 2 | Crear `constants/timing.ts` | ✅ Completado |
| 3 | Split `background.ts` | ✅ Completado |
| 4 | Split `command-menu.tsx` | ✅ Completado |
| 5 | Consolidar logging | ✅ Completado |
| 6 | Usar `MV_URLS` consistentemente | ✅ Completado |
| 7 | Split archivos grandes restantes | ✅ Completado |

---

## Fase 1: Eliminar tipos `any` y crear tipado estricto ✅

### Objetivo
Reemplazar todos los usos de `any` con tipos específicos para mejorar type-safety.

### Archivos modificados

- [x] `types/ai.ts` - Añadidos tipos para Gemini API responses
- [x] `types/index.ts` - Re-exportar nuevos tipos de AI
- [x] `entrypoints/background.ts` - Respuestas de Gemini API tipadas
- [x] `lib/messaging.ts` - Args de function calls con `GeminiFunctionCall`
- [x] `features/thread-summarizer/logic/summarize.ts` - Error handling con `instanceof Error`
- [x] `services/ai/gemini-service.ts` - Error handling con `instanceof Error`
- [x] `entrypoints/options/views/subforums-view.tsx` - Style prop como `React.CSSProperties`
- [x] `lib/logger.ts` - Logger args con `unknown[]`

### Nuevos tipos creados en `types/ai.ts`

```typescript
- GeminiFunctionCall
- GeminiResponsePart
- GeminiCandidate
- GeminiAPIResponse
- GeminiRequestBody
- GeminiGenerationResult
```

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 2: Crear `constants/timing.ts` ✅

### Objetivo
Centralizar todos los magic numbers de timing (delays, debounces, timeouts).

### Archivos creados/modificados

- [x] `constants/timing.ts` - Nuevo archivo con todas las constantes de timing
- [x] `constants/index.ts` - Re-exportar `TIMING`, `DEBOUNCE`, `FEEDBACK`, `DELAY`, `INTERSECTION`, `TIMEOUT`
- [x] `features/infinite-scroll/logic/infinite-scroll.tsx` - Usar `DEBOUNCE.SCROLL` y `INTERSECTION.INFINITE_SCROLL_MARGIN`
- [x] `lib/content-modules/utils/mutation-observer.ts` - Usar `DEBOUNCE.SCROLL`
- [x] `features/editor/hooks/use-text-history.ts` - Usar `DEBOUNCE.HISTORY` y `TIMEOUT.MAX_HISTORY_ENTRIES`
- [x] `features/drafts/hooks/use-drafts-search.ts` - Usar `DEBOUNCE.INPUT`
- [x] `features/editor/components/live-preview-panel.tsx` - Usar `DEBOUNCE.PREVIEW`

### Constantes centralizadas en `constants/timing.ts`

```typescript
DEBOUNCE = {
  SCROLL: 100,
  INPUT: 150,
  SEARCH: 300,
  SEARCH_HEAVY: 400,
  PREVIEW: 300,
  HISTORY: 300,
  GIF_SEARCH: 500,
}

FEEDBACK = {
  COPY_FEEDBACK: 2000,
  TOAST_DURATION: 3000,
  TOOLTIP_DELAY: 300,
  TOOLTIP_INSTANT: 0,
  TOOLTIP_QUICK: 200,
  HIGHLIGHT_DURATION: 2000,
  DROP_FEEDBACK: 500,
  STATUS_RESET: 300,
}

DELAY = {
  FOCUS: 50,
  SHORT: 100,
  MEDIUM: 150,
  LIVE_THREAD_POLL: 500,
  ANIMATION: 250,
  PROGRESS_COMPLETE: 350,
  RETRY: 500,
  RELOAD: 1500,
  UPDATE_TOAST: 1500,
  SIMULATED_OPERATION: 800,
  SETTINGS_RELOAD: 1500,
}

INTERSECTION = {
  INFINITE_SCROLL_MARGIN: '400px',
  GIF_LAZY_LOAD_MARGIN: '100px',
}

TIMEOUT = {
  CODE_HIGHLIGHT_RETRIES: [200, 500, 800, 1200, 1800, 2500, 3000],
  CODE_HIGHLIGHT_OBSERVER: 5000,
  MAX_HISTORY_ENTRIES: 100,
}
```

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 3: Split `background.ts` ✅

### Objetivo
Dividir el archivo background.ts (~795 líneas) en módulos más pequeños y mantenibles.

### Nueva estructura

```
entrypoints/background/
├── index.ts              # Entry point principal (~100 líneas)
├── context-menus.ts      # Menús contextuales (~450 líneas)
├── api-handlers.ts       # Handlers de Steam, TMDB, options (~95 líneas)
├── ai-handlers.ts        # Handlers de Gemini AI (~150 líneas)
├── upload-handlers.ts    # Handlers de ImgBB/Catbox (~155 líneas)
└── prism-highlighter.ts  # Ya existía
```

### Archivos creados/modificados

- [x] `entrypoints/background/context-menus.ts` - Menús contextuales, handlers de guardar hilo, ignorar usuario, silenciar palabra
- [x] `entrypoints/background/upload-handlers.ts` - Handlers de subida a ImgBB y Catbox
- [x] `entrypoints/background/api-handlers.ts` - Handlers de Steam, TMDB y opciones
- [x] `entrypoints/background/ai-handlers.ts` - Handler de Gemini AI con fallback de modelos
- [x] `entrypoints/background/index.ts` - Entry point que orquesta todos los módulos
- [x] `entrypoints/background.ts` - Re-exporta desde el nuevo index.ts

### Beneficios

- **Reducción de ~870 líneas → ~100 líneas** en el archivo principal
- Cada módulo tiene una responsabilidad única
- Más fácil de testear y mantener
- Mejor organización del código

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 4: Split `command-menu.tsx` ✅

### Objetivo
Dividir el componente command-menu.tsx (~906 líneas) en módulos más pequeños.

### Nueva estructura

```
features/command-menu/
├── components/
│   ├── command-menu.tsx           # Componente principal (~460 líneas, reducido de 906)
│   ├── command-header.tsx         # Header glassmorphism (~30 líneas)
│   ├── command-menu-trigger.tsx   # Ya existía
│   ├── highlight-match.tsx        # Highlight de búsqueda (~30 líneas)
│   └── shortcut-keys.tsx          # Renderizado de atajos (~45 líneas)
├── hooks/
│   └── use-command-menu.ts        # Hook de estado y lógica (~270 líneas)
├── types.ts                       # Tipos e interfaces (~50 líneas)
├── utils.ts                       # Helpers y navegación (~90 líneas)
└── logic/
    └── inject-command-menu.ts     # Ya existía
```

### Archivos creados/modificados

- [x] `features/command-menu/types.ts` - Interfaces para props, acciones, datos filtrados
- [x] `features/command-menu/utils.ts` - Helpers de navegación, normalización, contexto
- [x] `features/command-menu/components/highlight-match.tsx` - Componente de resaltado
- [x] `features/command-menu/components/command-header.tsx` - Header premium
- [x] `features/command-menu/components/shortcut-keys.tsx` - Renderizado de atajos de teclado
- [x] `features/command-menu/hooks/use-command-menu.ts` - Hook que encapsula estado y lógica
- [x] `features/command-menu/components/command-menu.tsx` - Componente refactorizado

### Beneficios

- **Reducción de ~906 líneas → ~460 líneas** en el componente principal
- Lógica de estado extraída a hook reutilizable
- Helpers y utilidades centralizados
- Componentes UI pequeños y enfocados
- Tipos bien definidos para mejor autocompletado

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 5: Consolidar logging ✅

### Objetivo
Reemplazar console.log/warn/error dispersos con el logger centralizado.

### Archivos modificados

- [x] `entrypoints/content/run-injections.ts` - console.log → logger.debug
- [x] `features/infinite-scroll/logic/infinite-scroll.tsx` - Todos los console.* → logger.*
- [x] `features/favorites/logic/favorites-page.tsx` - console.log/error → logger.*
- [x] `features/live-thread/logic/live-thread-polling.ts` - console.error → logger.error
- [x] `features/live-thread/logic/live-thread-editor.ts` - console.error → logger.error
- [x] `features/thread-summarizer/logic/summarize.ts` - console.error → logger.error

### Estrategia aplicada

1. **Debug logs** (`console.log` con estilos) → `logger.debug()` (solo visible en DEV)
2. **Error logs** → `logger.error()` (siempre visible con prefijo [MVP])
3. **Warning logs** → `logger.warn()` (siempre visible con prefijo [MVP])
4. **`.catch(console.error)`** → Dejado como está (patrón estándar de Promise)
5. **Background scripts** → Mantenidos con console.* (contexto separado)

### Beneficios

- Logs de debug solo aparecen en desarrollo
- Todos los logs de producción tienen prefijo `[MVP]`
- Logs coloreados para fácil identificación
- Consistencia en el formato de logging

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 6: Usar `MV_URLS` consistentemente ✅

### Objetivo
Reemplazar URLs hardcodeadas con constantes de `MV_URLS`.

### Constantes utilizadas

- `MV_BASE_URL` - URL base de Mediavida
- `MV_URLS.SPY` - Página Spy
- `MV_URLS.AVATAR_BASE` - Base de URLs de avatares
- `getUserProfileUrl(username)` - Genera URL de perfil
- `getSearchUrl(query)` - Genera URL de búsqueda

### Archivos modificados

- [x] `entrypoints/background/context-menus.ts` - 5 URLs reemplazadas
- [x] `entrypoints/options/options-app.tsx` - 4 URLs reemplazadas
- [x] `features/command-menu/utils.ts` - 1 URL reemplazada
- [x] `features/command-menu/hooks/use-command-menu.ts` - 2 URLs reemplazadas
- [x] `features/saved-threads/components/wiki-posts-table.tsx` - 1 URL reemplazada
- [x] `features/bookmarks/components/bookmarks-manager.tsx` - 1 URL reemplazada
- [x] `features/favorite-subforums/components/favorite-subforums-panel.tsx` - 1 URL reemplazada

### Nota

Algunas URLs en archivos especiales (emojis, parser) se mantienen hardcodeadas porque:
- Son constantes de configuración específicas del dominio
- Se usan en contextos donde importar módulos no es ideal

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Fase 7: Split archivos grandes restantes ✅

### Objetivo
Dividir otros archivos grandes identificados.

### Archivos completados

- [x] `draft-editor-view.tsx` (1223 líneas → ~400 líneas) → Dividido en módulos

### Nueva estructura de `draft-editor-view`

```
entrypoints/options/views/draft-editor/
├── index.ts                  # Re-exports públicos
├── types.ts                  # Tipos, schema Zod, interfaces (~90 líneas)
├── draft-editor-view.tsx     # Componente principal refactorizado (~400 líneas)
├── use-draft-editor.ts       # Hook de autosave, carga, submit (~180 líneas)
├── use-editor-handlers.ts    # Hook de toolbar, paste, scroll (~230 líneas)
├── editor-header.tsx         # Header con título y metadata (~130 líneas)
├── editor-footer.tsx         # Footer con ayuda y stats (~95 líneas)
├── preview-panel.tsx         # Panel de vista previa (~45 líneas)
└── editor-dialogs.tsx        # Todos los diálogos (~160 líneas)
```

### Beneficios

- **Reducción de ~1223 líneas → ~400 líneas** en el componente principal
- Hooks reutilizables extraídos (`useDraftEditor`, `useEditorHandlers`)
- Componentes UI pequeños y enfocados
- Tipos bien definidos para mejor autocompletado
- Mejor separación de responsabilidades

### Archivos pendientes (baja prioridad)

- [ ] `infinite-scroll.tsx` (~511 líneas) - Ya es relativamente manejable
- [ ] `settings-view.tsx` (~628 líneas) - Ya tiene componentes separados

### Verificación

- ✅ `npm run compile` ejecutado sin errores

---

## Notas

- Los mensajes de UI en español son intencionales y NO se modificarán
- Código y comentarios técnicos en inglés
- Interfaz de usuario en español

---

## Historial de Cambios

| Fecha | Fase | Cambios |
|-------|------|---------|
| 2026-01-03 | 7 | ✅ Fase 7 completada - `draft-editor-view.tsx` dividido en 8 módulos (types, hooks x2, componentes x4, index) |
| 2026-01-03 | 6 | ✅ Fase 6 completada - URLs hardcodeadas reemplazadas con `MV_URLS` en 7 archivos |
| 2026-01-03 | 5 | ✅ Fase 5 completada - Logging consolidado con `logger` centralizado en 6 archivos principales |
| 2026-01-03 | 4 | ✅ Fase 4 completada - `command-menu.tsx` dividido en 7 módulos (types, utils, hook, highlight-match, command-header, shortcut-keys, componente refactorizado) |
| 2026-01-03 | 3 | ✅ Fase 3 completada - `background.ts` dividido en 5 módulos (context-menus, upload-handlers, api-handlers, ai-handlers, index) |
| 2026-01-03 | 2 | ✅ Fase 2 completada - `constants/timing.ts` creado con DEBOUNCE, FEEDBACK, DELAY, INTERSECTION, TIMEOUT |
| 2026-01-03 | 1 | ✅ Fase 1 completada - Tipos `any` eliminados, nuevos tipos Gemini creados |
| 2026-01-03 | - | Plan inicial creado |

