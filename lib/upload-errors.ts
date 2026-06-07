export type UploadProvider = 'freeimage' | 'imgbb'

export type UploadErrorCode =
	| 'rate_limit'
	| 'server_error'
	| 'network_error'
	| 'payload_too_large'
	| 'invalid_api_key'
	| 'internal_error'
	| 'unknown'

export interface UploadAttemptInfo {
	provider: UploadProvider
	status?: number
	errorCode?: UploadErrorCode
	message?: string
}

interface ClassifyUploadErrorInput {
	status?: number
	message?: string
	provider?: UploadProvider
}

const RATE_LIMIT_PATTERNS = ['rate limit', 'too many requests', 'quota', 'limit exceeded', 'flood limit', '429']
const PAYLOAD_TOO_LARGE_PATTERNS = ['too large', 'file size', 'payload too large', '413', 'image size']
const INVALID_API_KEY_PATTERNS = ['invalid api key', 'invalid key', 'api key', 'auth', 'unauthorized', 'forbidden']
const INTERNAL_ERROR_PATTERNS = ['upload internal error', 'internal upload error', 'internal error']

function includesAny(value: string, patterns: string[]): boolean {
	return patterns.some(pattern => value.includes(pattern))
}

export function classifyUploadError({ status, message = '', provider }: ClassifyUploadErrorInput): UploadErrorCode {
	const normalizedMessage = message.toLowerCase()

	if (status === 429 || includesAny(normalizedMessage, RATE_LIMIT_PATTERNS)) return 'rate_limit'
	if (status === 413 || includesAny(normalizedMessage, PAYLOAD_TOO_LARGE_PATTERNS)) return 'payload_too_large'
	if (
		status === 401 ||
		status === 403 ||
		(provider === 'imgbb' && includesAny(normalizedMessage, INVALID_API_KEY_PATTERNS))
	) {
		return 'invalid_api_key'
	}
	if (status && status >= 500) return 'server_error'
	if (includesAny(normalizedMessage, INTERNAL_ERROR_PATTERNS)) return 'internal_error'

	return 'unknown'
}

export function getUploadErrorUserMessage(errorCode: UploadErrorCode, provider?: UploadProvider): string {
	if (errorCode === 'payload_too_large') {
		return 'La imagen es demasiado grande para subirla.'
	}

	if (errorCode === 'invalid_api_key') {
		return 'La API key de ImgBB no parece válida. Revísala en el panel MVPremium.'
	}

	if (errorCode === 'rate_limit') {
		return provider === 'imgbb'
			? 'ImgBB está limitando subidas temporalmente. Inténtalo de nuevo en unos minutos.'
			: 'Freeimage puede estar limitando subidas temporalmente. Inténtalo de nuevo en unos minutos o configura una API key de ImgBB.'
	}

	if (errorCode === 'server_error' || errorCode === 'internal_error') {
		return provider === 'imgbb'
			? 'ImgBB no ha podido procesar la imagen ahora mismo. Inténtalo de nuevo más tarde.'
			: 'Freeimage puede estar saturado ahora mismo. Inténtalo de nuevo más tarde o configura una API key de ImgBB.'
	}

	if (errorCode === 'network_error') {
		return 'No se pudo conectar con el servicio de subida. Revisa la conexión e inténtalo de nuevo.'
	}

	return 'No se pudo subir la imagen. Inténtalo de nuevo más tarde.'
}
