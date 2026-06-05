# Mobile Lite Firefox Android Test Checklist

## Build experimental local

Generar el build Firefox con compatibilidad Android declarada solo para prueba local:

```sh
MVP_ENABLE_FIREFOX_ANDROID=true npm run build:firefox
```

En Windows/cmd, o en WSL cuando se use Node de Windows:

```bat
set MVP_ENABLE_FIREFOX_ANDROID=true&& npm run build:firefox
```

No subir este build a AMO hasta completar la validación manual.

## Activación interna

En Firefox Android, abrir cualquier página real de Mediavida con el hash dev:

```text
https://www.mediavida.com/foro#mvp_mobile_lite=enable
```

La extensión guarda `mobileLiteEnabled=true` en el storage local y limpia el hash de la URL. Se
prefiere `#mvp_mobile_lite=enable` porque el hash no se envía al servidor y evita errores de
ruta en Mediavida móvil.

Para desactivar:

```text
https://www.mediavida.com/foro#mvp_mobile_lite=disable
```

También se puede desactivar desde el panel experimental. La variante antigua con query
`?mvp_mobile_lite=enable|disable` se mantiene para pruebas técnicas, pero no es el método
recomendado en móvil. Esta activación no aparece en opciones públicas.

No se añade por ahora un gesto oculto de activación: sería más difícil de auditar y podría
sobrevivir accidentalmente a una publicación Android. El método dev oficial para esta fase es el
hash anterior.

Para sembrar usuarios ignorados de prueba en Firefox Android sin usar DevTools:

```text
https://www.mediavida.com/foro#mvp_mobile_lite=enable&mvp_mobile_lite_ignored_test=enable
```

Esto añade o actualiza estos usuarios en `mvp-user-customizations`:

- `ClauDeS`: `hide`.
- `silentMike`: `mute`.

El hash se limpia después de procesarse. Este método es solo para pruebas internas.

## Favoritos locales

El botón `Guardar hilo` usa el mismo almacenamiento que los favoritos locales de escritorio:

- Key WXT: `local:mvp-saved-threads`.
- Key física en `browser.storage.local`: `mvp-saved-threads`.
- Tipo: `SavedThread[]`.
- Estructura actual:

```ts
interface SavedThread {
	id: string
	title: string
	subforum: string
	subforumId: string
	savedAt: number
	notes?: string
}
```

`id` es la ruta normalizada del hilo sin página final ni `/live`, por ejemplo
`/foro/cine/titulo-del-hilo-123456`. Mobile Lite llama a `saveThread()` desde
`features/saved-threads/logic/storage.ts`, que evita duplicados por `id` y ordena por `savedAt`
descendente. Esto significa que los favoritos guardados desde Firefox Android deberían aparecer
en las vistas de escritorio que lean la misma key local del mismo perfil/instalación.

## Usuarios ignorados locales

Mobile Lite reutiliza la configuración existente de usuarios ignorados:

- Key WXT: `local:mvp-user-customizations`.
- Key física en `browser.storage.local`: `mvp-user-customizations`.
- Solo se leen `isIgnored` e `ignoreType`.
- `ignoreType: "hide"` oculta el post completo.
- `ignoreType: "mute"` colapsa el post con placeholder `Mostrar`.

La edición de usuarios ignorados sigue siendo solo de escritorio por ahora.

## Editor móvil ligero

Mobile Lite añade ayudas mínimas si detecta un editor compatible:

- `textarea#cuerpo`.
- `textarea[name="cuerpo"]`.
- `.editor-body textarea`.

### Subida de imágenes

El botón `Subir imagen` se inyecta junto al textarea del editor móvil, no en el panel flotante.
Usa el pipeline existente de subida:

- `freeimage.host` por defecto.
- ImgBB si el usuario tiene API key configurada y el archivo entra en su límite.
- Validación actual: JPG, PNG, GIF y WebP.
- Límite actual: 64MB con Freeimage, 32MB con ImgBB.

La imagen subida se inserta como:

```text
[img]URL[/img]
```

### Autoformateo al pegar

Mobile Lite autoformatea solo URLs únicas pegadas en el textarea:

- Imagen reconocida por `isImageUrl()` -> `[img]URL[/img]`.
- Media reconocida por `isMediaUrl()` -> `[media]URL[/media]`.
- YouTube Shorts se normaliza con `normalizeMediaUrl()`.

No se interceptan textos largos, varias URLs, ni texto con espacios o saltos de línea.

## Prueba básica en dispositivo

- Instalar el XPI local en Firefox Android Nightly/Beta o el entorno de pruebas disponible.
- Confirmar que el manifest del build experimental contiene `browser_specific_settings.gecko_android`.
- Confirmar que Chrome y Firefox Desktop no muestran el botón Mobile Lite.
- En Firefox Android con `mobileLiteEnabled=false`, abrir Mediavida y confirmar que no aparece UI de MV Premium.
- Activar con `#mvp_mobile_lite=enable`.
- Confirmar que aparece un botón flotante discreto abajo a la derecha.
- Abrir el panel y confirmar el texto `MV Premium Mobile Lite experimental`.
- En un hilo, pulsar `Guardar hilo` y comprobar que el botón cambia a `Guardado`.
- Pulsar de nuevo o recargar y confirmar que no se crean duplicados en `mvp-saved-threads`.
- En escritorio, marcar un usuario como oculto (`hide`) y otro como ignorado/colapsado (`mute`).
- En Firefox Android, abrir un hilo donde aparezcan esos usuarios.
- Confirmar que el usuario en modo `hide` desaparece del hilo.
- Confirmar que el usuario en modo `mute` aparece colapsado con botón `Mostrar`.
- Pulsar `Mostrar` y confirmar que el post muteado se puede revelar temporalmente.
- Si no se puede editar el storage en Firefox Android, activar el seed dev con
  `#mvp_mobile_lite=enable&mvp_mobile_lite_ignored_test=enable` y probar con `ClauDeS` y `silentMike`.
- Abrir el editor de respuesta en un hilo y confirmar que aparece `Subir imagen` junto al textarea del editor.
- Pulsar `Subir imagen`, elegir una imagen de la galería y confirmar que inserta `[img]URL[/img]`.
- Si Firefox Android ofrece cámara en el selector, probar una foto nueva y confirmar inserción.
- Pegar una URL `.jpg`, `.jpeg`, `.png` o `.gif` y confirmar que se envuelve en `[img]`.
- Pegar una URL de YouTube, Instagram, X/Twitter o Steam y confirmar que se envuelve en `[media]`.
- Pegar texto normal o varias URLs y confirmar que el pegado nativo no se altera.
- En una página que no sea hilo, comprobar que el guardado queda deshabilitado o muestra estado no disponible.
- Probar `Arriba` y `Abajo` dentro de un hilo largo.
- Recargar la página y confirmar que el botón sigue apareciendo mientras el flag siga activo.
- Desactivar Mobile Lite desde el panel y confirmar que desaparece tras la acción o al recargar.
- Activar otra vez y luego desactivar con `#mvp_mobile_lite=disable`.

## Checklist de regresión Fase 1.1

### Chrome Desktop

- Build normal sin `MVP_ENABLE_FIREFOX_ANDROID=true`.
- Confirmar que no aparece `browser_specific_settings.gecko_android` en el manifest Chrome.
- Abrir Mediavida y confirmar que no aparece el botón Mobile Lite.
- Confirmar que las features desktop existentes siguen disponibles.

### Firefox Desktop

- Build normal sin `MVP_ENABLE_FIREFOX_ANDROID=true`.
- Confirmar que el manifest Firefox no contiene `gecko_android`.
- Abrir Mediavida con y sin `#mvp_mobile_lite=enable`; no debe aparecer Mobile Lite porque la
  plataforma no es `firefox-android`.
- Confirmar que el background Firefox sigue como event page no persistente.

### Firefox Android con `mobileLiteEnabled=false`

- Build experimental con `MVP_ENABLE_FIREFOX_ANDROID=true`.
- Cargar en dispositivo real.
- Abrir Mediavida sin activar el hash.
- Confirmar que no aparece UI Mobile Lite y que no se inicializan features desktop.

### Firefox Android con `mobileLiteEnabled=true`

- Activar con `#mvp_mobile_lite=enable`.
- Confirmar botón discreto abajo a la derecha con safe-area.
- Abrir panel en vertical y horizontal; no debe salirse de pantalla.
- Confirmar que el panel tiene scroll interno si el viewport es bajo.
- Guardar un hilo y confirmar estado `Guardado`.
- Confirmar que usuarios ignorados de escritorio se aplican en hilos móviles.
- Confirmar subida de imagen desde editor móvil.
- Confirmar autoformateo de URLs pegadas en editor móvil.
- Desactivar desde panel o `#mvp_mobile_lite=disable`.

## Comprobaciones de regresión

- Build Chrome normal: no debe declarar `gecko_android` y debe mantener `background.service_worker`.
- Build Firefox normal sin `MVP_ENABLE_FIREFOX_ANDROID=true`: no debe declarar `gecko_android`.
- Firefox Desktop: no debe mostrar Mobile Lite aunque el storage tenga `mobileLiteEnabled=true`.
- Chrome Desktop: no debe mostrar Mobile Lite aunque el storage tenga `mobileLiteEnabled=true`.
- No deben aparecer context menus nuevos.
- No debe ejecutarse `scripting.executeScript`.
- No debe pedirse ningún permiso nuevo.
- No debe aparecer ningún control nuevo para editar usuarios ignorados desde móvil.
- No debe aparecer toolbar/editor completo de escritorio en móvil.

## Criterios antes de ampliar Fase 1

- Probar en al menos un hilo corto, un hilo largo, portada, listado de foro y página no soportada.
- Revisar consola remota de Firefox Android sin errores recurrentes.
- Verificar que el guardado local escribe en `mvp-saved-threads`.
- Confirmar que el panel no tapa controles críticos de Mediavida móvil.
- Confirmar que la UI táctil es usable con una mano.
