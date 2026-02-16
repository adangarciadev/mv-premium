/**
 * Settings Schema - Zod validation for extension settings
 *
 * This schema provides:
 * - Type-safe validation for all settings
 * - Runtime validation for API keys, colors, etc.
 * - Inferred TypeScript types from schema
 */
import { z } from 'zod'

// =============================================================================
// CUSTOM VALIDATORS
// =============================================================================

/** Validates a hex color string (e.g., #c9a227 or #fff) */
const hexColorSchema = z
	.string()
	.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color hexadecimal inválido')
	.or(z.literal('')) // Allow empty string

/** Validates an API key (non-empty alphanumeric string or empty) */
const apiKeySchema = z.string().max(100)

/** Validates a positive integer for delays/intervals */
const positiveIntSchema = z.number().int().min(0)

// =============================================================================
// AI MODEL SCHEMA
// =============================================================================

export const aiModelSchema = z.enum([
	'gemini-3-flash-preview',
	'gemini-2.5-flash',
	'gemini-2.5-flash-lite',
])

export const groqModelSchema = z.enum([
	'moonshotai/kimi-k2-instruct',
])

export const aiProviderSchema = z.enum(['gemini', 'groq'
])

// =============================================================================
// ULTRAWIDE MODE SCHEMA
// =============================================================================

/** Ultrawide mode levels for page width control */
export const ultrawideSchema = z.enum(['off', 'wide', 'extra-wide', 'full'])
export type UltrawideMode = z.infer<typeof ultrawideSchema>
export const centeredControlsPositionSchema = z.enum(['top', 'side'])

// =============================================================================
// SETTINGS SCHEMA
// =============================================================================

export const settingsSchema = z.object({
	// Theme & Appearance
	theme: z.enum(['light', 'dark', 'system']).default('dark'),
	boldColor: hexColorSchema.default(''),
	boldColorEnabled: z.boolean().default(false),
	codeTheme: z.string().default('github-dark'),

	// API Keys
	imgbbApiKey: apiKeySchema.default(''),
	tmdbApiKey: apiKeySchema.default(''),
	giphyApiKey: apiKeySchema.default(''),

	// AI Settings
	geminiApiKey: apiKeySchema.default(''),
	groqApiKey: apiKeySchema.default(''),
	aiModel: aiModelSchema.default('gemini-3-flash-preview'),
	groqModel: groqModelSchema.default('moonshotai/kimi-k2-instruct'),
	aiProvider: aiProviderSchema.default('gemini'),

	// Sync
	syncEnabled: z.boolean().default(false),

	// Feature Toggles - Navigation
	infiniteScrollEnabled: z.boolean().default(false),
	liveThreadEnabled: z.boolean().default(false),
	newHomepageEnabled: z.boolean().default(false),
	nativeLiveDelayEnabled: z.boolean().default(true),
	liveThreadDelayEnabled: z.boolean().default(true),

	// Feature Toggles - Content
	mediaHoverCardsEnabled: z.boolean().default(true),
	steamBundleInlineCardsEnabled: z.boolean().default(true),

	// Feature Toggles - Users
	mutedWordsEnabled: z.boolean().default(false),
	mutedWords: z.array(z.string()).default([]),

	// Privacy & Storage
	enableActivityTracking: z.boolean().default(true),

	// UI State
	settingsActiveTab: z.string().default('integrations'),
	variablesSidebarExpandedGroups: z.array(z.string()).default([]),

	// Layout
	ultrawideMode: ultrawideSchema.default('off'),
	centeredPostsEnabled: z.boolean().default(false),
	centeredControlsSticky: z.boolean().default(false),
	centeredControlsPosition: centeredControlsPositionSchema.default('top'),
})

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Full settings object type (inferred from schema) */
export type Settings = z.infer<typeof settingsSchema>

/** Partial settings for updates */
export type SettingsUpdate = Partial<Settings>

/** Keys of settings (for selectors) */
export type SettingsKey = keyof Settings

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates a partial settings object.
 * Returns the validated data or throws on error.
 */
export function validateSettings(data: unknown): Settings {
	return settingsSchema.parse(data)
}

/**
 * Safely validates settings, returning null on error.
 */
export function safeValidateSettings(data: unknown): Settings | null {
	const result = settingsSchema.safeParse(data)
	return result.success ? result.data : null
}

/**
 * Validates a single setting value.
 */
export function validateSettingValue<K extends SettingsKey>(key: K, value: unknown): Settings[K] | null {
	const shape = settingsSchema.shape[key]
	const result = shape.safeParse(value)
	return result.success ? (result.data as Settings[K]) : null
}

/**
 * Get default value for a specific setting
 */
export function getDefaultValue<K extends SettingsKey>(key: K): Settings[K] {
	const defaults = settingsSchema.parse({})
	return defaults[key]
}
