/**
 * AI Service Types - Gemini API Only
 * Simplified for text generation (summaries, rewrites, etc.)
 */

// =============================================================================
// SERVICE TYPES
// =============================================================================

/**
 * AI Service interface - contract for Gemini implementation
 */
export interface AIService {
	/** Summarize the given text */
	summarize(text: string): Promise<string>

	/** Rewrite text in a specific style */
	rewrite(text: string, style?: RewriteStyle): Promise<string>

	/** Polish text - fix errors and improve clarity without changing tone */
	polish(text: string): Promise<string>

	/** Generate text from a custom prompt, optionally with context */
	generate(prompt: string, context?: string): Promise<string>

	/** Interactive chat with history. Returns all messages including the new response. */
	chat(history: ChatMessage[]): Promise<ChatMessage[]>

	/** Check if the service is available and ready */
	isAvailable(): Promise<boolean>

	/** Get the display name of the service */
	getName(): string

	/** Get the provider type */
	getProvider(): 'gemini'
}

/**
 * Available rewrite styles
 */
export type RewriteStyle = 'formal' | 'casual' | 'concise' | 'detailed' | 'friendly'

/**
 * Available Gemini models
 */
export type AIModel =
	| 'gemini-2.5-flash' // Newest stable - Recommended
	| 'gemini-2.5-pro' // More powerful
	| 'gemini-2.5-flash-lite' // Lite version
	| 'gemini-3-flash' // Next gen preview
	| 'gemini-2.0-flash' // Fast and stable

/**
 * AI Service configuration stored in settings
 */
export interface AIConfig {
	geminiApiKey: string
	aiModel: AIModel
}

// =============================================================================
// CHAT TYPES (Simplified - no tools)
// =============================================================================

export interface ChatMessage {
	role: 'user' | 'model' | 'system'
	parts: ChatPart[]
}

export type ChatPart = { text: string }

// =============================================================================
// GEMINI API RESPONSE TYPES
// =============================================================================

/**
 * Function call extracted from Gemini response
 */
export interface GeminiFunctionCall {
	name: string
	args: Record<string, unknown>
}

/**
 * Part in Gemini API response content
 */
export interface GeminiResponsePart {
	text?: string
	functionCall?: {
		name: string
		args: Record<string, unknown>
	}
}

/**
 * Candidate in Gemini API response
 */
export interface GeminiCandidate {
	content?: {
		parts?: GeminiResponsePart[]
		role?: string
	}
	finishReason?: string
	safetyRatings?: Array<{
		category: string
		probability: string
	}>
}

/**
 * Full Gemini API response structure
 */
export interface GeminiAPIResponse {
	candidates?: GeminiCandidate[]
	promptFeedback?: {
		safetyRatings?: Array<{
			category: string
			probability: string
		}>
	}
	error?: {
		code?: number
		message?: string
		status?: string
	}
}

/**
 * Request body for Gemini API
 */
export interface GeminiRequestBody {
	systemInstruction?: {
		parts: Array<{ text: string }>
	}
	contents?: Array<{
		role: 'user' | 'model'
		parts: Array<{ text: string }>
	}>
	generationConfig?: {
		temperature?: number
		topK?: number
		topP?: number
		maxOutputTokens?: number
	}
}

/**
 * Result from Gemini generation (internal use)
 */
export interface GeminiGenerationResult {
	success: boolean
	text?: string
	functionCalls?: GeminiFunctionCall[]
	error?: string
}
