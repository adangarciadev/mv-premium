# Mobile Lite / Firefox Android Phase 0

## Estado actual

MV Premium declara compatibilidad con Firefox Android en los builds Firefox publicados en AMO.
El mismo XPI sirve para Firefox Desktop y Firefox Android.

El manifest Firefox siempre incluye `browser_specific_settings.gecko_android` y elimina
`options_ui` / `options_page` para que Firefox Android no muestre la entrada nativa de
`Ajustes`. El dashboard no se elimina: `options.html` sigue empaquetado y se abre desde los
accesos propios de MV Premium, como el botón del navbar de Mediavida.

`mobileLiteEnabled` existe como flag interno persistido y su valor por defecto es `true`. En
Firefox Android, los content scripts tempranos de escritorio salen sin inyectar cambios y el
content script principal inicializa solo las funciones Mobile Lite.

## Funcionalidades que podrían funcionar en móvil

- Persistencia local con `@wxt-dev/storage` / `browser.storage.local`.
- Mensajería typed RPC con background para llamadas externas.
- Filtros simples de contenido si el DOM móvil de Mediavida conserva anclas fiables.
- Personalizaciones ligeras de lectura si se adaptan a selectores móviles.
- Guardado local de favoritos, subforos, hilos o borradores cuando la UI móvil tenga puntos
  de inserción claros.

Estas funciones siguen desactivadas en Android hasta validar DOM, UX y permisos en dispositivo.

## Funcionalidades que deben permanecer desactivadas inicialmente

- Context menus y Thread Clipper basado en menú contextual: `contextMenus` no debe asumirse
  disponible en Firefox Android.
- Command menu, shortcuts globales y flujos orientados a teclado.
- Toolbar de editor completa, diálogos densos, tabla/editor avanzado y plantillas multimedia.
- Infinite scroll, live thread y polling continuo hasta medir rendimiento/batería en móvil.
- Media hover cards: hover no es interacción primaria en móvil.
- Summarizers, post summary y cualquier feature que dependa de API keys hasta revisar UX,
  coste y feedback de errores en pantalla pequeña.
- Features que dependan de `browser.scripting.executeScript`, `tabs.*`, focus de ventanas o
  DNR hasta validación específica en Firefox Android.

## DOM móvil de Mediavida pendiente de adaptar

- Confirmar si los selectores de escritorio de `MV_SELECTORS` existen en móvil.
- Mapear cabecera, user menu, buscador, enlaces de hilo, filas/listas de foro y editor móvil.
- Revisar si los puntos de inserción actuales provocan layout shift o solapan UI nativa.
- Evitar controles hover-only; usar botones táctiles con tamaños y estados visibles.
- Validar Shadow DOM en UIs React inyectadas y estilos sin depender del layout desktop.
- Añadir fixtures/tests de DOM móvil antes de habilitar cualquier feature.

## Auditoría técnica de APIs y permisos

- `storage`, `runtime`, content scripts y messaging son la base más segura para mobile lite.
- El build Firefox actual de WXT genera Manifest V2 con `background.scripts`; se configura
  `persistent: { firefox: false }` para alinearlo con event pages.
- Chrome sigue generando MV3 con service worker; no se añade `gecko_android` en builds Chrome.
- Permisos actuales que requieren cautela móvil:
  - `contextMenus`: no usar en Android.
  - `scripting`: validar cada uso antes de exponerlo.
  - `declarativeNetRequest`: validar reglas y permisos en dispositivo.
  - `activeTab` y host permissions: comprobar prompts y concesión en Firefox Android.
- No se añaden permisos nuevos para esta fase.

## Riesgos de publicar en AMO con Android activado

- Incluir `browser_specific_settings.gecko_android` puede hacer que AMO trate el XPI como
  compatible con Android.
- Firefox Android no tiene la misma paridad de APIs ni de UX que Firefox Desktop.
- Un fallo en content scripts puede afectar navegación normal de Mediavida en móvil.
- Las opciones/popup pueden no ser usables sin revisión responsive.
- Los permisos y host permissions pueden tener prompts o controles distintos en Android.
- El DOM móvil puede cambiar selectores, jerarquía y timings respecto a escritorio.

## Checklist antes de marcar Firefox Android en AMO

- Generar un build Firefox normal con `npm run build:firefox`.
- Confirmar que el manifest Firefox contiene `browser_specific_settings.gecko_android`.
- Confirmar que el manifest Firefox no contiene `options_ui` ni `options_page`.
- Confirmar que `options.html` sigue presente en `.output/firefox-mv2`.
- Ejecutar lint de WebExtension para Firefox Android y revisar incompatibilidades.
- Probar en Firefox Android Release, Beta o Nightly con un dispositivo real o emulador.
- Validar que el background event page despierta y atiende mensajes correctamente.
- Validar storage, messaging, content scripts y permisos en Android.
- Crear una lista explícita de features permitidas para `mobileLiteEnabled`.
- Añadir fixtures/tests del DOM móvil de Mediavida para cada feature que se habilite.
- Probar offline/conectividad mala para flujos que llamen a servicios externos.
- Revisar opciones/popup en viewport móvil antes de exponer controles.
- Subir a AMO con Android solo cuando la lista mobile lite tenga pruebas manuales documentadas.

## Referencias

- Mozilla Extension Workshop: Firefox version compatibility.
- Mozilla Extension Workshop: Developing extensions for Firefox for Android.
- MDN WebExtensions API compatibility tables.
