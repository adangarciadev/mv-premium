# Mobile Lite Phase 3 Debt

Este documento recoge las deudas y mejoras pendientes detectadas tras probar en Firefox Android real.
La Fase 3 ya es funcional, pero no debe considerarse cerrada a nivel UX/robustez hasta resolver estos puntos.

## Estado Actual

- Firefox Android con `mobileLiteEnabled=true` carga Mobile Lite correctamente.
- El pegado inteligente de URLs funciona en algunos casos reales.
- Se ha añadido un refuerzo con `beforeinput` para capturar inserciones desde sugerencias/portapapeles del teclado movil.
- Se ha identificado que los enlaces moviles de Reddit tipo `/r/<subreddit>/s/<id>` no previsualizan en Mediavida.
- La subida de imagen desde el editor ya funciona.
- El botón `Subir imagen` ya no debe vivir en el panel flotante.
- El botón se intenta colocar en la fila donde aparece `Añadir favoritos`, usando el hueco derecho.

## Deudas Detectadas

### 1. Colocacion Del Boton `Subir imagen`

Hay al menos dos layouts moviles distintos para el editor de Mediavida:

- Respuesta normal/rapida dentro de un hilo.
- Pagina de responder/editor extendido, similar a crear hilo.

La colocacion actual funciona, pero es mejorable:

- Puede quedar visualmente distinta entre ambos layouts.
- Depende de detectar texto tipo `Añadir favoritos`.
- Si Mediavida cambia el texto o el contenedor, puede caer al fallback.
- El boton ya usa clases nativas de Mediavida e icono, pero sus estados tactiles pueden seguir puliendose tras pruebas reales.

Pendiente:

- Capturar HTML real de ambos editores moviles.
- Definir selectores especificos por layout.
- Mantener fallback conservador si no se detecta una fila fiable.
- Evitar superposicion con `Enviar`, preview, favoritos u otros controles nativos.
- Pulir estados tactiles/espaciado del boton `Subir imagen` si las pruebas reales detectan algun roce visual.

### 2. Auto-tags Intermitentes Al Pegar

El autoformateo de URLs a veces funciona y a veces no.

Comportamiento esperado:

- URL unica de imagen soportada -> `[img]URL[/img]`.
- URL unica de media soportada -> `[media]URL[/media]`.
- Texto normal, varias URLs o texto con espacios -> pegado nativo sin tocar.

Posibles causas:

- El listener de `paste` no se engancha siempre al textarea activo.
- Mediavida podria reemplazar el textarea al abrir/cambiar modo de editor.
- Firefox Android podria emitir eventos de pegado distintos segun teclado/app origen.
- El portapapeles integrado del teclado movil puede insertar texto via `beforeinput` sin disparar `paste`.
- Algunas apps pegan texto enriquecido o URLs con caracteres invisibles.
- Algunos enlaces no pasan por los detectores actuales `isImageUrl()` / `isMediaUrl()`.
- Las URLs compartidas por Reddit pueden variar entre `/comments/...`, `redd.it/...` y `/r/.../s/...`.
- Mediavida previsualiza `/comments/...` y `redd.it/...`, pero no parece resolver `/r/.../s/...`.

Pendiente:

- Registrar casos concretos que fallan: URL exacta, pagina, editor usado y app desde la que se copio.
- Normalizar caracteres invisibles si aparecen.
- Validar el refuerzo `beforeinput` en Firefox Android real con portapapeles del teclado.
- No autoenvolver `/r/.../s/...` con `[media]` salvo que se implemente resolucion a URL canonical sin añadir permisos nuevos.
- Verificar que el listener se reinyecta tras mutaciones del editor.
- Ampliar tests con URLs reales que fallen.

### 3. Diagnostico Necesario En Proxima Sesion

Para avanzar sin ir a ciegas, conviene recopilar:

- Captura del editor de respuesta normal con el boton visible.
- Captura del editor extendido/crear hilo con el boton visible.
- HTML de la zona del editor normal.
- HTML de la zona del editor extendido.
- 3 ejemplos de URLs que autoformatean bien.
- 3 ejemplos de URLs que no autoformatean.
- Confirmar si el fallo de auto-tags ocurre al pegar desde:
  - barra de direcciones;
  - app de X/Twitter;
  - app de YouTube;
  - portapapeles/teclado;
  - otra app.

## Reglas Para La Fase 3.1

- No portar editor desktop completo.
- No añadir toolbar completa.
- No añadir permisos nuevos.
- No tocar dashboard/opciones publicas.
- No usar `contextMenus`.
- No usar `scripting.executeScript`.
- Mantener todo limitado a:
  - `platform === 'firefox-android'`;
  - `mobileLiteEnabled === true`.
- Mantener Chrome Desktop y Firefox Desktop sin cambios.

## Propuesta Fase 3.1

Objetivo: pulir solo robustez y colocacion del editor Mobile Lite.

Alcance maximo:

1. Mejorar colocacion del boton `Subir imagen` por layout de editor.
2. Hacer el autoformateo de pegado mas fiable en Firefox Android.

No incluir:

- Subida por drag and drop.
- Toolbar de formato.
- Snippets.
- Editor completo.
- Plantillas.
- Buscadores de cine/juegos/anime.

## Checklist De Verificacion

- Firefox Android, respuesta normal:
  - El boton aparece en una posicion usable.
  - No tapa `Enviar`.
  - Subir imagen inserta `[img]URL[/img]`.
  - Pegar tweet/YouTube inserta `[media]URL[/media]`.

- Firefox Android, editor extendido/crear hilo:
  - El boton aparece en una posicion usable.
  - No tapa titulo, subforo, preview ni submit.
  - Subir imagen inserta `[img]URL[/img]`.
  - Pegar media funciona igual que en respuesta normal.

- Regresion:
  - Con `mobileLiteEnabled=false` no aparece nada.
  - En Firefox Desktop no aparece nada.
  - En Chrome Desktop no aparece nada.
