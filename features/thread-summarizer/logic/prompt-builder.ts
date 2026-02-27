/**
 * Parameterized Prompt Builder
 *
 * Single source of truth for all multi-page thread summarization prompts.
 * Consumed by summarize-multi-page.ts via the convenience wrappers.
 *
 * Four prompt variants: batch / meta  ×  gemini / groq
 */

/**
 * Markers embedded in prompts so the background AI handler can detect heavy
 * forum prompts (thread summaries, user analysis) and apply TPM pacing/trimming.
 *
 * Shared between prompt-builder.ts (emitter) and ai-handlers.ts (detector).
 */
export const PROMPT_MARKERS = {
	/** Present in all thread summary prompts (batch + meta). */
	THREAD_SUMMARY: 'TITULO DEL HILO:',
	/** Present in meta-summary prompts (partial summaries). */
	META_SUMMARY: 'RESUMENES PARCIALES:',
	/** Present in all user analysis prompts. */
	USER_ANALYSIS: '[MVP:USER_ANALYSIS]',
} as const

type Provider = 'gemini' | 'groq'
type PromptType = 'batch' | 'meta'

interface PromptConfig {
	provider: Provider
	type: PromptType
	pageCount: number
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Returns scaled limits for key points and participants based on page count.
 * Also used by summarize-multi-page.ts for normalization logic.
 */
export function getScaledLimits(pageCount: number): { maxKeyPoints: number; maxParticipants: number } {
	if (pageCount <= 3) return { maxKeyPoints: 5, maxParticipants: 5 }
	if (pageCount <= 7) return { maxKeyPoints: 7, maxParticipants: 8 }
	if (pageCount <= 15) return { maxKeyPoints: 9, maxParticipants: 10 }
	if (pageCount <= 25) return { maxKeyPoints: 12, maxParticipants: 14 }
	return { maxKeyPoints: 15, maxParticipants: 16 }
}

/**
 * Builds a summary prompt parameterized by provider, type, and page count.
 */
export function buildSummaryPrompt({ provider, type, pageCount }: PromptConfig): string {
	if (provider === 'groq') {
		return type === 'meta' ? buildMetaPromptGroq(pageCount) : buildBatchPromptGroq(pageCount)
	}
	return type === 'meta' ? buildMetaPromptGemini(pageCount) : buildBatchPromptGemini(pageCount)
}

// -- Convenience wrappers (used directly by summarize-multi-page.ts) --

export function buildSingleBatchPromptGemini(pageCount: number): string {
	return buildSummaryPrompt({ provider: 'gemini', type: 'batch', pageCount })
}
export function buildMetaSummaryPromptGemini(pageCount: number): string {
	return buildSummaryPrompt({ provider: 'gemini', type: 'meta', pageCount })
}
export function buildSingleBatchPromptGroq(pageCount: number): string {
	return buildSummaryPrompt({ provider: 'groq', type: 'batch', pageCount })
}
export function buildMetaSummaryPromptGroq(pageCount: number): string {
	return buildSummaryPrompt({ provider: 'groq', type: 'meta', pageCount })
}

// =============================================================================
// USER ANALYSIS PROMPTS
// =============================================================================

/**
 * Builds a user analysis prompt for Gemini.
 * Produces a personality-driven profile of a single user's participation in the thread.
 */
export function buildUserAnalysisPromptGemini(username: string, pageCount: number): string {
	const maxTopics = pageCount <= 3 ? 4 : pageCount <= 7 ? 5 : pageCount <= 15 ? 6 : 7
	const maxInteractions = pageCount <= 3 ? 3 : pageCount <= 7 ? 4 : 5
	const maxHighlights = pageCount <= 3 ? 2 : 3

	return `${PROMPT_MARKERS.USER_ANALYSIS}
Eres un analista de foros. Te paso TODOS los mensajes de "${username}" en un hilo de Mediavida.
Tu trabajo es hacer un análisis de perfil de ESTE USUARIO en este hilo concreto y devolver un objeto JSON válido.

FORMATO DE SALIDA (JSON estrictamente válido):
{
  "username": "${username}",
  "tagline": "Frase corta y memorable (máx 10-15 palabras) que defina al usuario como un apodo o título informal. Con humor, ingenio o ácido si encaja. Ej: 'El fiscal del hilo con hemeroteca y cero paciencia' o 'La navaja escéptica que te revisa cada dato'.",
  "profile": "2-3 frases naturales describiendo quién es este usuario en el hilo: su rol, qué tipo de forero es y qué aporta. Escríbelo como si un forero describiera a otro, no como informe formal.",
  "topics": [
    "Tema o posición recurrente muy concreto 1",
    "Tema o posición recurrente muy concreto 2",
    "... (hasta ${maxTopics} temas)"
  ],
  "interactions": [
    "Descripción de un patrón de interacción con otro usuario concreto (con @nick, sobre qué, cómo)",
    "... (hasta ${maxInteractions} patrones)"
  ],
  "style": "Descripción del tono y forma de comunicarse en 1-2 frases: ¿usa humor?, ¿es directo?, ¿irónico?, ¿agresivo?, ¿reflexivo?, ¿usa memes?",
  "highlights": [
    "Post o momento concreto especialmente destacado con #N del post si lo conoces (menciona el contenido clave)",
    "... (hasta ${maxHighlights} momentos)"
  ],
  "verdict": "Una frase final coloquial y directa que define a este usuario en este hilo. Debe sonar a foro, con personalidad. Ej: 'El típico forero que te desmonta una idea en dos líneas y luego remata con una pulla.'"
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. Sin bloques de código markdown.
- El JSON debe ser válido.
- Todos los posts que te paso son de "${username}". Analiza SU personalidad y comportamiento.
- Los marcadores [→ responde al #N] indican que ese post es una respuesta a otro mensaje. Úsalos para entender con quién interactúa y sobre qué temas.
- Los bloques {responde: #N} y {menciona: @nick} son pistas extraídas automáticamente. Úsalas como evidencia adicional de interacción (sin sobreinterpretar).
- El texto entre [CITA_INICIO] y [CITA_FIN] es una cita de otros usuarios. NO lo atribuyas como opinión de "${username}" salvo que él lo reafirme explícitamente fuera de la cita.
- Si hay blockquotes en los posts, son citas de otros usuarios que "${username}" está respondiendo. Úsalos para entender el contexto de sus respuestas. Si el blockquote incluye el nombre del usuario citado, ÚSALO para las interacciones.
- Los posts con [👍N] tienen N votos de la comunidad. Son los más valorados. Priorízalos en "highlights".
- "tagline": frase CORTA (máx 10-15 palabras). Debe capturar la esencia del usuario con gracia. No repitas el verdict. Piensa en un "título de personaje". Puede ser ácida, graciosa o ingeniosa según encaje con el usuario.
- "profile": 2-3 frases naturales. NO escribas "El usuario X...". Di cosas como "Forero combativo que..." o "Voz moderada del hilo que..." o "El típico fan que...". Que suene humano.
- "topics": temas MUY CONCRETOS de sus posts. Si habla de licencias, di "crítica al cambio de licencia por impacto en proyectos comunitarios". NO digas "habla de tecnología" o "comenta sobre el tema".
- "interactions": describe PATRONES reales mencionando los NICKS CONCRETOS de los usuarios con los que interactúa. Usa @nick (ej: "Entra en bucle con @Pepito cada vez que se discuten fuentes", "Le tira pullas constantes a @Juanito por su postura pro-X"). Si detectas el nick en blockquotes o por contexto, inclúyelo. Si no puedes identificar un nick concreto, describe el tipo de usuario ("usuarios pro-X", "los más alarmistas del hilo").
- Si no hay evidencia suficiente de interacciones concretas (citas, [→ responde al #N], @menciones o contexto claro), devuelve "interactions": [] y NO inventes nicks ni dinámicas.
- "style": sé específico y honesto. "Directo y sin filtros, usa la ironía pero raramente se calienta" es mejor que "amigable y participativo".
- "highlights": menciona el CONTENIDO CONCRETO del post. Incluye el número de post #N cuando lo conozcas (ej: "En el #547, desmonta con datos de Eurostat..."). Prioriza los más votados [👍N]. No digas solo "tuvo un momento memorable".
- "verdict": debe sonar a foro, no a informe. Coloquial, directa, con personalidad. Que quien lea lo reconozca.
- NO DUPLIQUES información entre bloques: "topics" = ideas/posiciones recurrentes, "interactions" = dinámica con personas/grupos, "highlights" = momentos concretos. Cada bloque debe aportar algo distinto.
- Detecta ironía/sarcasmo y descríbela como tal, no la proceses como opinión literal.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real.
- Responde en español.
- IMPORTANTE: El JSON final debe ser válido y contener toda la información solicitada.`
}

/**
 * Builds a user analysis prompt for Groq.
 * More compact version for TPM-constrained providers.
 */
export function buildUserAnalysisPromptGroq(username: string, pageCount: number): string {
	const maxTopics = pageCount <= 3 ? 4 : pageCount <= 7 ? 5 : 6
	const maxInteractions = pageCount <= 3 ? 3 : 4
	const maxHighlights = pageCount <= 3 ? 2 : 3

	return `${PROMPT_MARKERS.USER_ANALYSIS}
Analiza todos los posts de "${username}" en un hilo de Mediavida y devuelve SOLO JSON válido.

SALIDA:
{
  "username": "${username}",
  "tagline": "Frase corta memorable (máx 10-15 palabras) como apodo/título informal. Con humor o ácido si encaja.",
  "profile": "2-3 frases directas y naturales describiendo quién es este forero en el hilo. Como si un forero lo describiera a otro, no formal.",
  "topics": [
    "Tema o posición concreta y específica 1",
    "... hasta ${maxTopics}"
  ],
  "interactions": [
    "Patrón de interacción con @nick concreto (con quién, sobre qué, cómo)",
    "... hasta ${maxInteractions}"
  ],
  "style": "Tono y estilo comunicativo en 1-2 frases específicas.",
  "highlights": [
    "Momento o post concreto destacado con #N del post si lo conoces (prioriza los más votados [👍N])",
    "... hasta ${maxHighlights}"
  ],
  "verdict": "Frase coloquial con personalidad que define a este usuario en este hilo. Que suene a foro."
}

REGLAS CRÍTICAS:
- SOLO JSON. Empieza con { y termina con }. Sin markdown.
- Todos los posts son de "${username}". Analiza SU personalidad y comportamiento.
- [→ responde al #N] = respuesta a otro usuario. Úsalo para detectar patrones de interacción.
- {responde: #N} y {menciona: @nick} = pistas extraídas automáticamente. Úsalas como evidencia adicional de interacción (sin sobreinterpretar).
- [CITA_INICIO] ... [CITA_FIN] = cita de otros usuarios. NO atribuyas ese contenido a "${username}" salvo confirmación explícita fuera de la cita.
- Blockquotes = lo que otros le dijeron. Úsalos para contexto. Si incluyen el nick del citado, úsalo en interactions.
- [👍N] = posts más valorados. Priorízalos en highlights.
- "tagline": CORTA (máx 10-15 palabras). Título de personaje. No repitas el verdict.
- "profile": natural, como forero describiendo a otro. No empieces con "El usuario...".
- "topics": concretos y específicos. No genéricos.
- "interactions": menciona NICKS CONCRETOS con @nick cuando los detectes. Si no puedes identificar un nick, describe el tipo de usuario.
- Si no hay evidencia suficiente de interacciones concretas (citas, [→ responde al #N], @menciones o contexto claro), devuelve "interactions": [] y NO inventes nicks ni dinámicas.
- "highlights": incluye #N del post cuando lo conozcas. Menciona el contenido concreto.
- "style": específico y honesto sobre su tono real.
- "verdict": coloquial, con personalidad, que suene a foro.
- NO DUPLIQUES: topics = ideas recurrentes, interactions = dinámicas con usuarios/grupos, highlights = momentos concretos.
- Detecta ironía/sarcasmo. No la proceses como opinión literal.
- Responde en español.`
}

// =============================================================================
// GEMINI PROMPTS
// =============================================================================

function buildBatchPromptGemini(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Eres un analista de foros. Tu trabajo es resumir MULTIPLES PAGINAS de un hilo de Mediavida y devolver un objeto JSON valido.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "Una frase concisa explicando el tema principal del hilo en estas paginas.",
  "keyPoints": [
    "Punto clave 1",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Resumen breve de su postura o aporte principal" },
    { "name": "Usuario2", "contribution": "Resumen breve de su postura o aporte principal" },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Una frase descriptiva sobre el estado general del debate en estas paginas."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Resume TODOS los posts que te paso, dando una vision global.
- Ignora posts sin contenido ("pole", "+1").
- Incluye también el contenido dentro de spoilers cuando aporte contexto al debate.
- Identifica los temas principales y como evolucionan entre paginas.
- Incluye hasta ${maxParticipants} participantes, priorizando los mas activos y relevantes.
- Si hay autores suficientes, devuelve EXACTAMENTE ${maxParticipants} participantes. Solo devuelve menos si en los posts no hay suficientes autores unicos con contenido relevante.
- AGRUPACIÓN: Si varios usuarios comparten exactamente la misma postura, agrúpalos en una sola entrada separando los nombres por comas (ej: "Pepito, Juanito").
- OP: Solo usa la etiqueta (OP) si aparece explícitamente en los posts de entrada. No la adivines por posición dentro del rango.
- Los posts marcados con [👍N] tienen N votos de la comunidad. Los posts muy votados suelen contener opiniones o informacion especialmente relevante. Tenlos en cuenta para los puntos clave y participantes.
- Usa las ESTADISTICAS DEL HILO como referencia objetiva para seleccionar participantes destacados, pero no te limites solo a los que mas postean: alguien con pocos posts pero muy votados puede ser mas relevante.
- Escribe como alguien que ha leído el hilo completo: natural, claro y con matiz humano.
- Refleja el tono real del debate (ironía, tensión, consenso o cachondeo) cuando aporte contexto.
- Detecta ironía/sarcasmo y no la traduzcas como apoyo literal.
- Si una postura es irónica o ambigua, descríbela como "ironiza con..." o "crítica sarcástica a...".
- No uses verbos de apoyo ("defiende", "apoya", "celebra") salvo evidencia explícita y literal.
- Si no hay certeza total de postura, usa verbos neutrales: "plantea", "argumenta", "cuestiona" o "ironiza".
- Evita lenguaje de informe automático y frases clónicas repetidas (muletillas como "En conclusión", "Cabe destacar").
- Prioriza la precisión factual: no inventes cifras ni mezcles rangos contradictorios. Si un dato numérico no está claro, descríbelo sin número exacto.
- Identifica correctamente QUIÉN critica a QUIÉN: lee el contexto completo de cada post antes de atribuir posturas. No confundas el objeto de la crítica.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real (salvo la etiqueta OP).
- Si un post solo incluye media/embed/enlace (tweet, vídeo, etc.) sin comentario propio del autor, NO lo uses para atribuir postura personal.
- No mezcles hechos de contextos o periodos distintos. Si el hilo compara etapas diferentes, acláralo explícitamente.
- Incluye hasta ${maxKeyPoints} puntos clave.
- En cada punto clave, prioriza conflicto, argumentos y giros del hilo; evita frases genéricas.
- En cada participante, resume postura y por qué destaca (actividad, votos o impacto en la discusión).
- "status" debe ser una frase descriptiva (minimo 12 palabras) sobre el clima y la direccion del debate. Sé directo y evita empezar siempre con "El hilo..." o "El debate...".
- Responde en espanol.
- IMPORTANTE: El bloque JSON final debe ser válido y contener toda la información solicitada.`
}

function buildMetaPromptGemini(pageCount: number): string {
    const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

    return `Eres un analista de foros. Te voy a dar RESUMENES PARCIALES de diferentes secciones de un hilo largo de Mediavida. Tu trabajo es crear UN UNICO RESUMEN GLOBAL coherente combinando todos los parciales.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "El tema principal del hilo completo.",
  "keyPoints": [
    "Punto clave 1 (los mas importantes de todo el hilo)",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Su aportacion general al hilo" },
    { "name": "Usuario2", "contribution": "Su aportacion general al hilo" },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Estado final del debate considerando toda la evolucion del hilo."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Combina los resumenes parciales en UN UNICO resumen coherente.
- No repitas informacion redundante entre secciones.
- Conserva el contenido relevante que provenga de spoilers.
- Prioriza los puntos mas relevantes e impactantes.
- Si un tema evoluciona entre secciones, describe la evolucion.
- Los participantes deben ser los MAS destacados en todo el hilo (hasta ${maxParticipants}).
- AGRUPACIÓN: Si varios usuarios comparten la misma postura, mantenlos agrupados (ej: "Pepito, Juanito").
- OP: Mantén la etiqueta (OP) solo si aparece explícitamente en los parciales/entrada. No la adivines.
- Si hay autores suficientes, devuelve EXACTAMENTE ${maxParticipants} participantes. Solo devuelve menos si no hay suficientes autores unicos relevantes.
- Usa las ESTADISTICAS DEL HILO como referencia objetiva. Alguien con pocos posts pero muy votados puede ser mas relevante que alguien que postea mucho sin impacto.
- Escribe como alguien que ha leído el hilo completo: natural, claro y con matiz humano.
- Refleja el tono real del debate (ironía, tensión, consenso o cachondeo) cuando aporte contexto.
- Detecta ironía/sarcasmo y no la traduzcas como apoyo literal.
- Si una postura es irónica o ambigua, descríbela como "ironiza con..." o "crítica sarcástica a...".
- No uses verbos de apoyo ("defiende", "apoya", "celebra") salvo evidencia explícita y literal.
- Si no hay certeza total de postura, usa verbos neutrales: "plantea", "argumenta", "cuestiona" o "ironiza".
- Evita lenguaje de informe automático y frases clónicas repetidas (muletillas como "En conclusión", "Cabe destacar").
- Prioriza la precisión factual: no inventes cifras ni mezcles rangos contradictorios. Si un dato numérico no está claro, descríbelo sin número exacto.
- Identifica correctamente QUIÉN critica a QUIÉN: lee el contexto completo de cada post antes de atribuir posturas. No confundas el objeto de la crítica.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real.
- Si un post solo incluye media/embed/enlace (tweet, vídeo, etc.) sin comentario propio del autor, NO lo uses para atribuir postura personal.
- No mezcles hechos de contextos o periodos distintos. Si el hilo compara etapas diferentes, acláralo explícitamente.
- En cada punto clave, prioriza conflicto, argumentos y giros del hilo; evita frases genéricas.
- En cada participante, resume postura y por qué destaca (actividad, votos o impacto en la discusión).
- "status" debe ser una frase descriptiva (minimo 12 palabras) sobre el clima final del debate. Sé directo y evita empezar siempre con "El hilo..." o "El debate...".
- Responde en espanol.
- IMPORTANTE: El bloque JSON final debe ser válido.`
}

// =============================================================================
// GROQ PROMPTS
// =============================================================================

function buildBatchPromptGroq(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Analiza varias páginas de un hilo de Mediavida y devuelve SOLO JSON válido.

SALIDA:
{
  "topic": "Una frase concisa explicando el tema principal.",
  "keyPoints": [
    "Punto clave 1 — 1-3 frases breves con contexto concreto.",
    "... hasta ${maxKeyPoints}"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "2-3 frases breves: postura, a qué responde y por qué destaca. Termina con punto." },
    "... hasta ${maxParticipants}"
  ],
  "status": "Frase ORIGINAL de 15-40 palabras sobre el clima del debate. Ejemplo: 'Alta tensión y fragmentación, con el foro partido en bandos personales y un pesimismo generalizado sobre el futuro.'"
}

REGLAS CRITICAS (cumple TODAS):
- SOLO JSON, sin markdown ni texto extra. Empieza con "{" y termina con "}".
- DETALLE: Cada "contribution" en 2-3 frases breves (aprox. 20-55 palabras). Cada punto clave en 1-3 frases breves. Distribuye el espacio EQUITATIVAMENTE entre TODOS los participantes.
- Cada "contribution" y cada punto clave DEBE terminar con punto (.).
- AGRUPACIÓN: Si varios usuarios comparten la misma postura, AGRÚPALOS (ej: "Pepito, Juanito").
- OP: Solo usa la etiqueta (OP) si aparece explícitamente en los posts de entrada. No la adivines por posición dentro del rango.
- PROHIBIDO usar frases genéricas como "participó activamente en el debate", "aportando argumentos", "cabe destacar" o "en conclusión".
- Si hay material suficiente, devuelve EXACTAMENTE ${maxKeyPoints} puntos clave y EXACTAMENTE ${maxParticipants} participantes. Solo devuelve menos si realmente no hay contenido o autores suficientes.
- El "status" DEBE ser una frase descriptiva y original. Evita empezar siempre con "El debate..." o "El hilo...". Sé directo.

REGLAS DE CONTENIDO:
- Resume todo el bloque con visión global. Ignora posts vacíos ("pole", "+1"). Incluye spoilers relevantes.
- Escribe con tono natural, periodístico-informal. Refleja ironía, tensión, consenso o cachondeo.
- En cada punto clave: prioriza conflictos, argumentos concretos y giros del hilo.
- En cada participante: resume su postura CONCRETA y por qué destaca.
- Participantes: prioriza actividad + impacto + votos [👍N]. Si hay suficientes, devuelve EXACTAMENTE ${maxParticipants}.
- Usa las ESTADISTICAS DEL HILO como referencia. Alguien con pocos posts pero muy votados puede ser más relevante.
- Identifica correctamente QUIÉN critica a QUIÉN leyendo el contexto completo de cada post.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real (salvo OP).
- Si un post solo incluye media/embed/enlace (tweet, vídeo, etc.) sin comentario propio del autor, NO lo uses para atribuir postura personal.
- Detecta ironía/sarcasmo y evita invertir la postura real.
- Precisión factual: no inventes cifras ni mezcles contextos.
- Responde 100% en español.`
}

function buildMetaPromptGroq(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Te paso resúmenes parciales de un hilo largo. Devuelve UN ÚNICO resumen global en JSON válido.

SALIDA:
{
  "topic": "Tema principal global en una frase concisa.",
  "keyPoints": [
    "Punto clave 1 — 1-3 frases breves con contexto concreto.",
    "... hasta ${maxKeyPoints}"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "2-3 frases breves: postura, a qué responde y por qué destaca. Termina con punto." },
    "... hasta ${maxParticipants}"
  ],
  "status": "Frase ORIGINAL de 15-40 palabras sobre el clima final del debate. Ejemplo: 'Se cierra con pesimismo generalizado y una fractura total entre facciones que priorizan a sus favoritos sobre el bien colectivo.'"
}

REGLAS CRITICAS (cumple TODAS):
- SOLO JSON, sin markdown ni texto extra. Empieza con "{" y termina con "}".
- DETALLE: Cada "contribution" en 2-3 frases breves (aprox. 20-55 palabras) y cada punto clave en 1-3 frases breves. Distribuye el espacio EQUITATIVAMENTE entre TODOS los participantes.
- Cada "contribution" y cada punto clave DEBE terminar con punto (.).
- AGRUPACIÓN: Si varios usuarios comparten la misma postura, AGRÚPALOS.
- OP: Mantén la etiqueta (OP) solo si aparece explícitamente en los parciales/entrada. No la adivines.
- PROHIBIDO usar frases genéricas como "participó activamente", "cabe destacar" o "en resumen". Si no tienes información concreta, NO incluyas al usuario.
- Si hay material suficiente, devuelve EXACTAMENTE ${maxKeyPoints} puntos clave y EXACTAMENTE ${maxParticipants} participantes. Solo devuelve menos si realmente faltan datos.
- El "status" DEBE ser una frase ORIGINAL. Evita empezar siempre con "El debate..." o "El hilo...".

REGLAS DE CONTENIDO:
- Combina parciales sin repetir y conserva la evolución entre tramos.
- Escribe con tono natural y humano.
- En cada punto clave: prioriza conflictos, argumentos y giros concretos.
- En cada participante: resume su postura CONCRETA y por qué destaca.
- Participantes: actividad + impacto + votos. Si hay suficientes, devuelve EXACTAMENTE ${maxParticipants}.
- Usa las ESTADISTICAS DEL HILO como referencia objetiva.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real.
- Si un post solo incluye media/embed/enlace (tweet, vídeo, etc.) sin comentario propio del autor, NO lo uses para atribuir postura personal.
- Preserva el sentido real de mensajes irónicos/sarcásticos; no los resumas como apoyo literal.
- Precisión factual: sin inventar cifras ni mezclar contextos.
- Responde 100% en español.`
}
