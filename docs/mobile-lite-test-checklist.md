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

La variante antigua con query `?mvp_mobile_lite=enable|disable` se mantiene para pruebas técnicas,
pero no es el método recomendado en móvil. Esta activación no aparece en opciones públicas.

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

## Usuarios ignorados locales

Mobile Lite reutiliza la configuración existente de usuarios ignorados:

- Key WXT: `local:mvp-user-customizations`.
- Key física en `browser.storage.local`: `mvp-user-customizations`.
- Solo se leen `isIgnored` e `ignoreType`.
- `ignoreType: "hide"` oculta el post completo.
- `ignoreType: "mute"` colapsa el post con placeholder `Mostrar`.

La edición básica de usuarios filtrados existe en Mobile Lite:

- Entrada `Panel MVPremium` dentro del menú móvil de usuario.
- Búsqueda local sobre usuarios ya filtrados.
- Alta manual por nick exacto para `Silenciar` o `Ocultar`.
- Cambio entre `Silenciar`, `Ocultar` y `Quitar`.
- Acciones rápidas `Silenciar` y `Ocultar` dentro de la user card nativa de Mediavida.

Mobile Lite no incluye por ahora búsqueda remota/autocompletado de usuarios de Mediavida.

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
- Confirmar que Chrome y Firefox Desktop no muestran UI Mobile Lite ni entrada `Panel MVPremium`.
- En Firefox Android con `mobileLiteEnabled=false`, abrir Mediavida y confirmar que no aparece UI de MV Premium.
- Activar con `#mvp_mobile_lite=enable`.
- Abrir el menú móvil de usuario y confirmar que aparece `Panel MVPremium`.
- Abrir `Panel MVPremium` y confirmar que muestra `Usuarios filtrados`.
- Escribir un nick exacto no filtrado y confirmar que aparecen acciones `Silenciar` y `Ocultar`.
- Simular un fallo de guardado solo en entorno de prueba y confirmar que el panel muestra un error visible.
- En escritorio, marcar un usuario como oculto (`hide`) y otro como ignorado/colapsado (`mute`).
- En Firefox Android, abrir un hilo donde aparezcan esos usuarios.
- Confirmar que el usuario en modo `hide` desaparece del hilo.
- Confirmar que el usuario en modo `mute` aparece colapsado con botón `Mostrar`.
- Pulsar `Mostrar` y confirmar que el post muteado se puede revelar temporalmente.
- En un listado normal de subforo, pulsar `Ocultar hilo` en una fila y confirmar que desaparece y queda en `mvp-hidden-threads`.
- Abrir una user card nativa desde un nick y confirmar que Mobile Lite añade `Silenciar` y `Ocultar`.
- Cambiar un filtro desde la user card y confirmar que se preservan otras personalizaciones del usuario.
- Si no se puede editar el storage en Firefox Android, activar el seed dev con
  `#mvp_mobile_lite=enable&mvp_mobile_lite_ignored_test=enable` y probar con `ClauDeS` y `silentMike`.
- Abrir el editor de respuesta en un hilo y confirmar que aparece `Subir imagen` junto al textarea del editor.
- Pulsar `Subir imagen`, elegir una imagen de la galería y confirmar que inserta `[img]URL[/img]`.
- Si Firefox Android ofrece cámara en el selector, probar una foto nueva y confirmar inserción.
- Pegar una URL `.jpg`, `.jpeg`, `.png` o `.gif` y confirmar que se envuelve en `[img]`.
- Pegar una URL de YouTube, Instagram, X/Twitter o Steam y confirmar que se envuelve en `[media]`.
- Pegar texto normal o varias URLs y confirmar que el pegado nativo no se altera.
- Recargar la página y confirmar que la entrada `Panel MVPremium` sigue apareciendo mientras el flag siga activo.
- Desactivar con `#mvp_mobile_lite=disable` y confirmar que desaparecen entrada de panel y mejoras móviles tras recargar.

## Checklist de regresión Fase 1.1

### Chrome Desktop

- Build normal sin `MVP_ENABLE_FIREFOX_ANDROID=true`.
- Confirmar que no aparece `browser_specific_settings.gecko_android` en el manifest Chrome.
- Abrir Mediavida y confirmar que no aparece UI Mobile Lite ni entrada `Panel MVPremium`.
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
- Confirmar entrada `Panel MVPremium` dentro del menú móvil de usuario.
- Abrir panel en vertical y horizontal; no debe salirse de pantalla.
- Confirmar que el panel tiene scroll interno si el viewport es bajo.
- Confirmar que usuarios ignorados de escritorio se aplican en hilos móviles.
- Confirmar subida de imagen desde editor móvil.
- Confirmar autoformateo de URLs pegadas en editor móvil.
- Desactivar con `#mvp_mobile_lite=disable`.

## Comprobaciones de regresión

- Build Chrome normal: no debe declarar `gecko_android` y debe mantener `background.service_worker`.
- Build Firefox normal sin `MVP_ENABLE_FIREFOX_ANDROID=true`: no debe declarar `gecko_android`.
- Firefox Desktop: no debe mostrar Mobile Lite aunque el storage tenga `mobileLiteEnabled=true`.
- Chrome Desktop: no debe mostrar Mobile Lite aunque el storage tenga `mobileLiteEnabled=true`.
- No deben aparecer context menus nuevos.
- No debe ejecutarse `scripting.executeScript`.
- No debe pedirse ningún permiso nuevo.
- No debe aparecer toolbar/editor completo de escritorio en móvil.

## Criterios antes de ampliar Fase 1

- Probar en al menos un hilo corto, un hilo largo, portada, listado de foro y página no soportada.
- Revisar consola remota de Firefox Android sin errores recurrentes.
- Verificar que los cambios de usuarios filtrados escriben en `mvp-user-customizations`.
- Confirmar que el panel no tapa controles críticos de Mediavida móvil.
- Confirmar que la UI táctil es usable con una mano.
