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

// =============================================================================
// ULTRAWIDE MODE SCHEMA
// =============================================================================

/** Ultrawide mode levels for page width control */
export const ultrawideSchema = z.enum(['off', 'wide', 'extra-wide', 'full'])
export type UltrawideMode = z.infer<typeof ultrawideSchema>
export const centeredControlsPositionSchema = z.enum(['top', 'side'])
export const gameReleaseCalendarLayoutSchema = z.enum(['showcase', 'minimal', 'bottom'])
export const itadCountrySchema = z.enum(['ES', 'GB', 'US'])
export const relatedThreadsDisplaySchema = z.enum(['hidden', 'collapsible', 'original'])

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
	aiModel: aiModelSchema.default('gemini-3-flash-preview'),

	// Football Calendar
	footballDataApiKey: apiKeySchema.default(''),
	footballCalendarEnabled: z.boolean().default(false),
	footballFavoriteTeamIds: z.array(z.number()).default([]),

	// Sync
	syncEnabled: z.boolean().default(false),

	// Feature Toggles - Navigation
	mobileLiteEnabled: z.boolean().default(true),
	mobileLitePostGesturesEnabled: z.boolean().default(true),
	infiniteScrollEnabled: z.boolean().default(false),
	autoInfiniteScrollEnabled: z.boolean().default(false),
	liveThreadEnabled: z.boolean().default(false),
	autoLiveThreadEnabled: z.boolean().default(false),
	newHomepageEnabled: z.boolean().default(false),
	nativeLiveDelayEnabled: z.boolean().default(true),
	liveThreadDelayEnabled: z.boolean().default(true),

	// Feature Toggles - Content
	mediaHoverCardsEnabled: z.boolean().default(true),
	steamBundleInlineCardsEnabled: z.boolean().default(true),
	fragranticaEmbedsEnabled: z.boolean().default(true),
	itadSubforumSearchEnabled: z.boolean().default(true),
	itadSubforumSearchJuegosEnabled: z.boolean().default(true),
	itadSubforumSearchHuchaEnabled: z.boolean().default(true),
	itadCountry: itadCountrySchema.default('ES'),
	gameReleaseCalendarEnabled: z.boolean().default(true),
	gameReleaseCalendarJuegosEnabled: z.boolean().default(true),
	gameReleaseCalendarJuegosMovilEnabled: z.boolean().default(true),
	gameReleaseCalendarLayout: gameReleaseCalendarLayoutSchema.default('minimal'),
	movieReleaseCalendarCineEnabled: z.boolean().default(true),
	movieReleaseCalendarLayout: gameReleaseCalendarLayoutSchema.default('minimal'),
	threadClipperSubforums: z.array(z.string()).default(['juegos']),
	twitterLiteEmbedsEnabled: z.boolean().default(false),
	threadPreviewEnabled: z.boolean().default(true),
	contentRulesEnabled: z.boolean().default(true),
	classicThreadActionsEnabled: z.boolean().default(false),
	hideIgnoredUserThreadsEnabled: z.boolean().default(true),
	relatedThreadsDisplay: relatedThreadsDisplaySchema.default('hidden'),
	relatedThreadsMaxAgeMonths: z.number().int().min(0).max(300).catch(0).default(0),

	// Feature Toggles - Users
	mutedWordsEnabled: z.boolean().default(false),
	mutedWords: z.array(z.string()).default([]),

	// Privacy & Storage
	enableActivityTracking: z.boolean().default(false),
	enableRhythmTracking: z.boolean().default(true),

	// UI State
	settingsActiveTab: z.string().default('integrations'),
	variablesSidebarExpandedGroups: z.array(z.string()).default([]),

	// Layout
	hideHeaderEnabled: z.boolean().default(false),

	// Feature Toggles - Editor
	autoTagsEnabled: z.boolean().default(true),
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
