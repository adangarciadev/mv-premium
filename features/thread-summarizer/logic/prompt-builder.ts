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
 * Light format suggestions rotated per username via deterministic hash.
 * These are SUGGESTIONS, not mandates — the model has creative freedom.
 * Kept abstract (no copyable phrases) to prevent the model from cloning them.
 */
const TAGLINE_HINTS = [
	'Prueba con una metáfora o comparación.',
	'Prueba con un contraste entre dos facetas opuestas suyas.',
	'Prueba con una frase que podría ser el lema de su vida forera.',
	'Prueba con algo que el propio usuario diría.',
	'Prueba con un cargo o título inventado.',
] as const

const VERDICT_HINTS = [
	'Prueba con una sentencia tajante sobre lo que haría o dejaría de hacer.',
	'Prueba con una frase que diría sobre él un rival del foro.',
	'Prueba con un escenario hipotético absurdo.',
	'Prueba con un epitafio de foro breve.',
	'Prueba con una comparación inesperada.',
] as const

function usernameHash(username: string, seed = 0): number {
	let h = seed
	for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) | 0
	return Math.abs(h)
}

function getHints(username: string) {
	return {
		tagline: TAGLINE_HINTS[usernameHash(username, 0) % TAGLINE_HINTS.length],
		verdict: VERDICT_HINTS[usernameHash(username, 13) % VERDICT_HINTS.length],
	}
}

/**
 * Builds a user analysis prompt for Gemini.
 * Produces a personality-driven profile of a single user's participation in the thread.
 */
export function buildUserAnalysisPromptGemini(username: string, pageCount: number): string {
	const maxTopics = pageCount <= 3 ? 4 : pageCount <= 7 ? 5 : pageCount <= 15 ? 6 : 7
	const maxInteractions = pageCount <= 3 ? 3 : pageCount <= 7 ? 4 : 5
	const maxHighlights = pageCount <= 3 ? 2 : 3
	const hints = getHints(username)

	return `${PROMPT_MARKERS.USER_ANALYSIS}
Eres un analista de foros con mucha personalidad. Te paso TODOS los mensajes de "${username}" en un hilo de Mediavida.
Tu trabajo: hacer un retrato ÚNICO y memorable de ESTE USUARIO. No un informe genérico. Un perfil con personalidad que haga que quien lo lea diga "es clavado".

FORMATO DE SALIDA (JSON estrictamente válido):
{
  "username": "${username}",
  "tagline": "Frase corta y memorable (máx 10-15 palabras) que SOLO pueda aplicarse a ESTE usuario. ${hints.tagline}",
  "profile": "2-3 frases naturales describiendo quién es ESTE usuario y QUÉ LO DIFERENCIA de cualquier otro del hilo. Escríbelo como si alguien lo describiera en una quedada. Busca sus manías, contradicciones y forma de entrar en debates. APERTURA: NO uses la palabra 'forero' ni 'forera' en la primera frase. Arranca con una acción, una escena o una contradicción suya.",
  "topics": [
    "Tema o posición recurrente muy concreto 1",
    "Tema o posición recurrente muy concreto 2",
    "... (hasta ${maxTopics} temas)"
  ],
  "interactions": [
    "Patrón de interacción con otro usuario concreto (con @nick, sobre qué, cómo, con qué resultado)",
    "... (hasta ${maxInteractions} patrones)"
  ],
  "style": "Descripción VÍVIDA de cómo se comunica ESTE usuario. ¿Qué lo hace reconocible al leerlo? Busca su vocabulario propio, sus muletillas, su forma de construir argumentos o soltar sentencias. PROHIBIDO empezar con 'Directo', 'Su comunicación es...' o 'Su prosa...'. PROHIBIDO usar: 'bilis', 'pluma', 'sentencias lapidarias', 'autopsia', 'navaja suiza'.",
  "highlights": [
    "Post o momento concreto con #N del post (prioriza los más votados [👍N], pero incluye también alguno polémico o donde rompa su propio patrón habitual)",
    "... (hasta ${maxHighlights} momentos)"
  ],
  "verdict": "Frase final BREVE (1-2 frases máximo) con personalidad. ${hints.verdict} Que sea memorable y solo aplique a ESTE forero."
}

PERSONALIDAD:
- Tu objetivo es encontrar lo que hace ÚNICO a "${username}". No a un forero genérico.
- SÉ VALIENTE y honesto. Si es un troll, dilo. Si es el más pesado del hilo, también. Si tiene contradicciones, señálalas con gracia.
- VARÍA el vocabulario y la estructura entre campos. Si usas una metáfora en el tagline, no repitas el mismo recurso en el verdict. Si describes su estilo con una imagen, que el profile use otra distinta.
- El "verdict" debe ser BREVE y contundente (1-2 frases MÁXIMO, no un párrafo). Si supera 2 frases, RECÓRTALO.
${pageCount > 3 ? `- EVOLUCIÓN: Si "${username}" cambió de opinión o de tono entre las primeras y últimas páginas, menciónalo.\n` : ''}
CONTENIDO:
- Devuelve SOLO el JSON. Sin bloques de código markdown. El JSON debe ser válido.
- Todos los posts son de "${username}". Analiza SU personalidad.
- [→ responde al #N] = respuesta a otro. Úsalo para entender interacciones.
- {responde: #N} y {menciona: @nick} = pistas de interacción automáticas.
- [CITA_INICIO]...[CITA_FIN] = cita de otros. NO la atribuyas a "${username}" salvo que la reafirme.
- Blockquotes = lo que otros le dijeron. Si incluyen el nick, úsalo en interactions.
- [👍N] = votos. Prioriza los más votados en highlights.
- "topics": temas MUY CONCRETOS. NO digas "habla de tecnología".
- "interactions": NICKS CONCRETOS con @nick. Si no hay evidencia, devuelve [] y NO inventes.
- "highlights": contenido CONCRETO con #N. Busca variedad: un post votado y uno inesperado.
- NO DUPLIQUES entre campos. Detecta ironía/sarcasmo.
- No confundas apodos/rangos/títulos visuales con el nick real.
- Responde en español.`
}

/**
 * Builds a user analysis prompt for Groq.
 * More compact version for TPM-constrained providers.
 */
export function buildUserAnalysisPromptGroq(username: string, pageCount: number): string {
	const maxTopics = pageCount <= 3 ? 4 : pageCount <= 7 ? 5 : 6
	const maxInteractions = pageCount <= 3 ? 3 : 4
	const maxHighlights = pageCount <= 3 ? 2 : 3
	const hints = getHints(username)

	return `${PROMPT_MARKERS.USER_ANALYSIS}
Analiza todos los posts de "${username}" en un hilo de Mediavida. Haz un retrato ÚNICO y memorable, no un informe genérico. Devuelve SOLO JSON válido.

SALIDA:
{
  "username": "${username}",
  "tagline": "Frase corta memorable (máx 10-15 palabras) que SOLO aplique a ESTE usuario. ${hints.tagline}",
  "profile": "2-3 frases describiendo qué hace DIFERENTE a este usuario. Como si alguien lo describiera en una quedada. Busca sus manías, contradicciones, forma de debatir. NO uses 'forero/a' en la primera frase. Arranca con acción, escena o contradicción.",
  "topics": ["Tema concreto 1", "... hasta ${maxTopics}"],
  "interactions": ["Patrón con @nick concreto (quién, qué, cómo)", "... hasta ${maxInteractions}"],
  "style": "Descripción VÍVIDA de cómo se comunica. ¿Qué lo hace reconocible? Vocabulario propio, muletillas, forma de argumentar. NO empezar con 'Directo', 'Su comunicación es...' ni 'Su prosa...'. NO usar: 'bilis', 'pluma', 'sentencias lapidarias', 'autopsia'.",
  "highlights": ["Momento concreto con #N. Votados y polémicos.", "... hasta ${maxHighlights}"],
  "verdict": "Frase final BREVE (1-2 frases). ${hints.verdict} Que sea memorable."
}

PERSONALIDAD:
- Busca lo ÚNICO de "${username}". Sé valiente y honesto. Sin perfiles tibios.
- VARÍA vocabulario y estructura entre campos. No repitas el mismo recurso literario.
- "verdict" debe ser BREVE y contundente (1-2 frases MÁXIMO, no un párrafo). Si supera 2 frases, RECÓRTALO.
${pageCount > 3 ? `- EVOLUCIÓN: Si cambió de opinión o tono entre páginas, menciónalo.\n` : ''}
CONTENIDO:
- SOLO JSON. Empieza con { y termina con }. Sin markdown.
- Todos los posts son de "${username}". [→ responde al #N] = respuesta a otro.
- {responde: #N} y {menciona: @nick} = pistas de interacción.
- [CITA_INICIO]...[CITA_FIN] = cita de otros. NO atribuyas a "${username}".
- [👍N] = votos. Prioriza en highlights.
- "topics": concretos. "interactions": @nick concretos. Si no hay evidencia, []. NO inventes.
- "highlights": contenido concreto con #N. Variedad: votados e inesperados.
- NO DUPLIQUES entre campos. Detecta ironía/sarcasmo. En español.`
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
